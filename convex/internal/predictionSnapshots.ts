import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import { requireValidCalendarDate } from "../_helpers/calendarDates";
import { isStartAnchorEligible } from "../_helpers/cycleFactEligibility";
import { readCyclePredictionData } from "../_helpers/cyclePredictionData";
import { daysBetweenCalendarDates } from "../_helpers/predictionBounds";
import { buildPeriodPrediction } from "../_helpers/periodPrediction";
import { isPeriodPredictionV2Enabled } from "../_helpers/periodPredictionFlag";
import { PREDICTION_CALIBRATION_VERSION } from "../_helpers/predictionIntervals";
import {
  DEFAULT_PREDICTION_SEGMENT_REF,
  PREDICTION_SNAPSHOT_FEATURE_VERSION,
  currentPredictionSnapshotInput,
  predictionSnapshotMatchesCurrent,
} from "../_helpers/predictionSnapshotContract";

const MAX_REASON_CODES = 16;
const CORRECTION_PAGE_SIZE = 100;
const OUTCOME_RESTORE_PAGE_SIZE = 100;

const qualityValidator = v.union(
  v.literal("high"),
  v.literal("moderate"),
  v.literal("low"),
  v.literal("timing_less_predictable"),
  v.literal("limited_evidence")
);

const reasonCodeValidator = v.union(
  v.literal("ELEVATED_CALIBRATION_RISK"),
  v.literal("USER_CONFIGURED_BASELINE"),
  v.literal("PERSONALIZATION_NOT_APPROVED"),
  v.literal("INSUFFICIENT_CALIBRATION"),
  v.literal("RECENT_TIMING_VARIABLE"),
  v.literal("SPARSE_HISTORY"),
  v.literal("LIMITED_HISTORY"),
  v.literal("USER_PAUSED"),
  v.literal("NO_ELIGIBLE_FACT"),
  v.literal("INVALID_CONFIGURATION"),
  v.literal("APPROXIMATE_DATE"),
  v.literal("LEGACY_UNKNOWN"),
  v.literal("POSSIBLE_MISSING_LOG"),
  v.literal("CONTEXT_SEGMENT"),
  v.literal("RECENT_CORRECTION"),
  v.literal("PARTNER_ASSISTED"),
  v.literal("TOMBSTONED"),
  v.literal("AFTER_CUTOFF"),
  v.literal("INVALID_DATE"),
  v.literal("NON_POSITIVE_INTERVAL")
);

const predictionStatusValidator = v.union(
  v.literal("configured"),
  v.literal("personalized"),
  v.literal("limited_evidence")
);
const probabilityLabelValidator = v.union(
  v.null(),
  v.object({
    level: v.literal(80),
    calibrationStatus: v.literal("approved"),
    calibrationVersion: v.string(),
  })
);
const predictionSegmentIdValidator = v.union(
  v.id("cyclePredictionSegments"),
  v.literal(DEFAULT_PREDICTION_SEGMENT_REF)
);
const correctionReasonValidator = v.union(
  v.literal("primary_correction"),
  v.literal("partner_correction")
);
type CorrectionReason = "primary_correction" | "partner_correction";
type SnapshotCreateArgs = Omit<
  Doc<"predictionSnapshots">,
  "_id" | "_creationTime" | "qualityScoreV1"
> & { qualityScoreV1: number | null };

function isUncorrectedOutcomeStart(event: Doc<"periodEvents">): boolean {
  return (
    isStartAnchorEligible(event) &&
    event.primaryCorrectionVersion === undefined &&
    event.partnerCorrectionVersion === undefined
  );
}

function requireBoundedText(value: string, label: string, maxLength: number) {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_" + label);
  }
}

function requireTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_" + label);
  }
}

async function insertSnapshotRecord(
  ctx: MutationCtx,
  args: SnapshotCreateArgs,
): Promise<Id<"predictionSnapshots">> {
  requireTimestamp(args.generatedAt, "GENERATED_AT");
  requireTimestamp(args.inputCutoffAt, "INPUT_CUTOFF_AT");
  if (args.inputCutoffAt > args.generatedAt) {
    throw new Error("PREDICTION_SNAPSHOT_CUTOFF_AFTER_GENERATION");
  }
  requireValidCalendarDate(args.inputCutoffDate, "Input cutoff date");
  requireValidCalendarDate(args.pointDate, "Prediction point date");
  requireValidCalendarDate(args.earliestDate, "Prediction earliest date");
  requireValidCalendarDate(args.latestDate, "Prediction latest date");
  if (args.earliestDate > args.pointDate || args.pointDate > args.latestDate) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_WINDOW");
  }
  if (
    !Number.isSafeInteger(args.basisCount) ||
    args.basisCount < 0 ||
    !Number.isSafeInteger(args.estimatorVersion) ||
    args.estimatorVersion < 1 ||
    !Number.isSafeInteger(args.contractVersion) ||
    args.contractVersion < 1
  ) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_VERSION_OR_BASIS");
  }
  if (
    args.qualityScoreV1 !== null &&
    (!Number.isFinite(args.qualityScoreV1) ||
      args.qualityScoreV1 < 0 ||
      args.qualityScoreV1 > 100)
  ) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_QUALITY_SCORE");
  }
  if (
    args.reasonCodes.length > MAX_REASON_CODES ||
    new Set(args.reasonCodes).size !== args.reasonCodes.length
  ) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_REASON_CODES");
  }
  requireBoundedText(args.estimatorId, "ESTIMATOR_ID", 128);
  if (args.calibrationVersion !== null) {
    requireBoundedText(args.calibrationVersion, "CALIBRATION_VERSION", 128);
  }
  requireBoundedText(
    args.intervalMethodVersion,
    "INTERVAL_METHOD_VERSION",
    128,
  );
  requireBoundedText(args.featureVersion, "FEATURE_VERSION", 64);

  const [user, segment] = await Promise.all([
    ctx.db.get("users", args.userId),
    args.predictionSegmentId === DEFAULT_PREDICTION_SEGMENT_REF
      ? ctx.db
          .query("cyclePredictionSegments")
          .withIndex("by_user_and_status", (q) =>
            q.eq("userId", args.userId).eq("status", "active"),
          )
          .unique()
      : ctx.db.get("cyclePredictionSegments", args.predictionSegmentId),
  ]);
  const segmentWasActiveAtCutoff =
    segment?.status === "active" && segment.supersededAt === undefined;
  const segmentWasSupersededAfterCutoff =
    segment?.status === "superseded" &&
    segment.supersededAt !== undefined &&
    args.inputCutoffAt < segment.supersededAt;
  if (!user || user.role !== "primary") {
    throw new Error("PREDICTION_SNAPSHOT_PRIMARY_USER_REQUIRED");
  }
  const defaultSegmentWasActiveAtCutoff =
    args.predictionSegmentId === DEFAULT_PREDICTION_SEGMENT_REF &&
    segment?.createdAt !== undefined &&
    segment.createdAt <= args.inputCutoffAt;
  const explicitSegmentInvalid =
    args.predictionSegmentId !== DEFAULT_PREDICTION_SEGMENT_REF &&
    (!segment ||
      segment.userId !== args.userId ||
      segment.createdAt > args.inputCutoffAt ||
      (!segmentWasActiveAtCutoff && !segmentWasSupersededAfterCutoff));
  if (defaultSegmentWasActiveAtCutoff || explicitSegmentInvalid) {
    throw new Error("PREDICTION_SNAPSHOT_SEGMENT_NOT_ACTIVE_AT_CUTOFF");
  }

  const snapshotId = await ctx.db.insert("predictionSnapshots", {
    userId: args.userId,
    generatedAt: args.generatedAt,
    inputCutoffAt: args.inputCutoffAt,
    inputCutoffDate: args.inputCutoffDate,
    status: args.status,
    estimatorId: args.estimatorId,
    estimatorVersion: args.estimatorVersion,
    intervalMethodVersion: args.intervalMethodVersion,
    calibrationVersion: args.calibrationVersion,
    pointDate: args.pointDate,
    earliestDate: args.earliestDate,
    latestDate: args.latestDate,
    probabilityLabel: args.probabilityLabel,
    quality: args.quality,
    ...(args.qualityScoreV1 === null
      ? {}
      : { qualityScoreV1: args.qualityScoreV1 }),
    basisCount: args.basisCount,
    reasonCodes: args.reasonCodes,
    displayStatus: args.displayStatus,
    predictionSegmentId: args.predictionSegmentId,
    featureVersion: args.featureVersion,
    contractVersion: args.contractVersion,
  });
  return snapshotId;
}

export const createSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    generatedAt: v.number(),
    inputCutoffAt: v.number(),
    inputCutoffDate: v.string(),
    status: predictionStatusValidator,
    estimatorId: v.string(),
    estimatorVersion: v.number(),
    intervalMethodVersion: v.string(),
    calibrationVersion: v.union(v.string(), v.null()),
    pointDate: v.string(),
    earliestDate: v.string(),
    latestDate: v.string(),
    probabilityLabel: probabilityLabelValidator,
    quality: qualityValidator,
    qualityScoreV1: v.union(v.number(), v.null()),
    basisCount: v.number(),
    reasonCodes: v.array(reasonCodeValidator),
    displayStatus: v.union(v.literal("shadow"), v.literal("visible")),
    predictionSegmentId: predictionSegmentIdValidator,
    featureVersion: v.string(),
    contractVersion: v.number(),
  },
  returns: v.object({ snapshotId: v.id("predictionSnapshots") }),
  handler: async (ctx, args) => ({
    snapshotId: await insertSnapshotRecord(ctx, args),
  }),
});

export async function ensureCurrentSnapshot(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Id<"predictionSnapshots"> | null> {
  if (!isPeriodPredictionV2Enabled()) return null;
  const user = await ctx.db.get("users", userId);
  if (!user || user.role !== "primary") return null;

  const [predictionData, settings] = await Promise.all([
    readCyclePredictionData(ctx, userId, user),
    ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
  ]);
  const prediction = buildPeriodPrediction({
    cycleIntervals: predictionData.cycleIntervals,
    historyComplete: predictionData.historyComplete,
    configuredCycleLength: settings?.cycleLength ?? 28,
    predictionPaused: settings?.predictionPaused ?? false,
  });
  if (prediction.pointDate === null) return null;

  const { cutoffAt, cutoffDate } = predictionData.cycleIntervals.basis;
  const current = currentPredictionSnapshotInput({
    prediction,
    inputCutoffAt: cutoffAt,
    inputCutoffDate: cutoffDate,
    periodEvents: predictionData.periodEvents,
    settings,
    activeSegment: predictionData.activeSegment,
  });
  const latestSnapshot = await ctx.db
    .query("predictionSnapshots")
    .withIndex("by_user_and_generated_at", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (
    latestSnapshot &&
    predictionSnapshotMatchesCurrent(latestSnapshot, current)
  ) {
    return latestSnapshot._id;
  }

  return await insertSnapshotRecord(ctx, {
    userId,
    generatedAt: Math.max(Date.now(), cutoffAt),
    inputCutoffAt: cutoffAt,
    inputCutoffDate: cutoffDate,
    status: prediction.status,
    estimatorId: prediction.estimatorId,
    estimatorVersion: prediction.estimatorVersion,
    intervalMethodVersion: PREDICTION_CALIBRATION_VERSION,
    calibrationVersion: prediction.calibrationVersion,
    pointDate: prediction.pointDate,
    earliestDate: prediction.earliestDate,
    latestDate: prediction.latestDate,
    probabilityLabel: prediction.probabilityLabel,
    quality: prediction.quality,
    qualityScoreV1: null,
    basisCount: prediction.basisCount,
    reasonCodes: prediction.reasonCodes,
    displayStatus: "visible",
    predictionSegmentId: current.predictionSegmentId,
    featureVersion: PREDICTION_SNAPSHOT_FEATURE_VERSION,
    contractVersion: 2,
  });
}

export const ensureCurrentForUser = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(v.id("predictionSnapshots"), v.null()),
  handler: (ctx, { userId }) => ensureCurrentSnapshot(ctx, userId),
});

export const recordOutcome = internalMutation({
  args: {
    snapshotId: v.id("predictionSnapshots"),
    sourcePeriodEventId: v.id("periodEvents"),
  },
  returns: v.object({
    assessmentId: v.id("predictionSnapshotAssessments"),
    signedErrorDays: v.number(),
    absoluteErrorDays: v.number(),
    insideWindow: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const [snapshot, event] = await Promise.all([
      ctx.db.get("predictionSnapshots", args.snapshotId),
      ctx.db.get("periodEvents", args.sourcePeriodEventId),
    ]);
    if (!snapshot) throw new Error("PREDICTION_SNAPSHOT_NOT_FOUND");
    if (
      !event ||
      event.userId !== snapshot.userId ||
      !isUncorrectedOutcomeStart(event) ||
      event.startDate <= snapshot.inputCutoffDate ||
      event.createdAt <= snapshot.inputCutoffAt
    ) {
      throw new Error("PREDICTION_SNAPSHOT_OUTCOME_NOT_ELIGIBLE");
    }

    const assessment = await appendOutcomeIfEarliest(ctx, snapshot, event);
    if (!assessment) {
      throw new Error("PREDICTION_SNAPSHOT_ALREADY_ASSESSED");
    }

    return assessment;
  },
});

async function appendOutcomeAssessment(
  ctx: MutationCtx,
  snapshot: Doc<"predictionSnapshots">,
  event: Doc<"periodEvents">,
  reason: "eligible_outcome" | "outcome_reinstated" = "eligible_outcome",
) {
  const signedErrorDays = daysBetweenCalendarDates(
    snapshot.pointDate,
    event.startDate,
  );
  const absoluteErrorDays = Math.abs(signedErrorDays);
  const insideWindow =
    snapshot.earliestDate <= event.startDate &&
    event.startDate <= snapshot.latestDate;
  const assessmentId = await ctx.db.insert("predictionSnapshotAssessments", {
    snapshotId: snapshot._id,
    type: "outcome",
    observedEligibleStartDate: event.startDate,
    signedErrorDays,
    absoluteErrorDays,
    insideWindow,
    sourcePeriodEventId: event._id,
    ...(event.authorityVersion === undefined
      ? {}
      : { sourceAuthorityVersion: event.authorityVersion }),
    reason,
    recordedAt: Date.now(),
  });
  return { assessmentId, signedErrorDays, absoluteErrorDays, insideWindow };
}

async function appendOutcomeIfEarliest(
  ctx: MutationCtx,
  snapshot: Doc<"predictionSnapshots">,
  event: Doc<"periodEvents">,
  reason?: "eligible_outcome" | "outcome_reinstated",
) {
  const earliestEffective = await earliestEligibleCandidate(ctx, snapshot._id);
  let winningCandidate = earliestEffective;
  if (
    earliestEffective &&
    earliestEffective.observedEligibleStartDate <= event.startDate
  ) {
    if (earliestEffective.sourcePeriodEventId !== event._id) return null;
  } else {
    if (earliestEffective) await ctx.db.delete(earliestEffective._id);
    const candidateId = await ctx.db.insert("predictionSnapshotOutcomeCandidates", {
      snapshotId: snapshot._id,
      sourcePeriodEventId: event._id,
      observedEligibleStartDate: event.startDate,
      ...(event.authorityVersion === undefined
        ? {}
        : { sourceAuthorityVersion: event.authorityVersion }),
      status: "eligible",
      recordedAt: Date.now(),
    });
    winningCandidate = await ctx.db.get(candidateId);
  }
  const latestOutcome = await ctx.db
    .query("predictionSnapshotAssessments")
    .withIndex("by_snapshot_and_type", (q) =>
      q.eq("snapshotId", snapshot._id).eq("type", "outcome"),
    )
    .order("desc")
    .first();
  if (
    latestOutcome?.type === "outcome" &&
    latestOutcome.sourcePeriodEventId === winningCandidate?.sourcePeriodEventId
  ) {
    return null;
  }
  if (latestOutcome?.type === "outcome") {
    const latestSource = await ctx.db.get("periodEvents", latestOutcome.sourcePeriodEventId);
    if (
      latestSource &&
      isUncorrectedOutcomeStart(latestSource) &&
      latestSource.startDate === latestOutcome.observedEligibleStartDate
    ) {
      await ctx.db.insert("predictionSnapshotAssessments", {
        snapshotId: snapshot._id,
        type: "superseded",
        sourcePeriodEventId: latestOutcome.sourcePeriodEventId,
        ...(latestOutcome.sourceAuthorityVersion === undefined
          ? {}
          : { sourceAuthorityVersion: latestOutcome.sourceAuthorityVersion }),
        reason: "earlier_eligible_start_discovered",
        recordedAt: Date.now(),
      });
    }
  }

  if (!winningCandidate) return null;
  const winnerEvent = await ctx.db.get(
    "periodEvents",
    winningCandidate.sourcePeriodEventId,
  );
  if (!winnerEvent) return null;
  const previousAssessment = await ctx.db
    .query("predictionSnapshotAssessments")
    .withIndex("by_snapshot_source_event_and_type", (q) =>
      q
        .eq("snapshotId", snapshot._id)
        .eq("sourcePeriodEventId", winnerEvent._id)
        .eq("type", "outcome"),
    )
    .first();
  const assessment = await appendOutcomeAssessment(
    ctx,
    snapshot,
    winnerEvent,
    reason ?? (previousAssessment ? "outcome_reinstated" : "eligible_outcome"),
  );
  return winnerEvent._id === event._id ? assessment : null;
}

async function earliestEligibleCandidate(
  ctx: MutationCtx,
  snapshotId: Id<"predictionSnapshots">,
) {
  for (;;) {
    const candidate = await ctx.db
      .query("predictionSnapshotOutcomeCandidates")
      .withIndex("by_snapshot_and_status_and_observed_date", (q) =>
        q.eq("snapshotId", snapshotId).eq("status", "eligible"),
      )
      .first();
    if (!candidate) return null;
    const event = await ctx.db.get("periodEvents", candidate.sourcePeriodEventId);
    if (
      event &&
      event.startDate === candidate.observedEligibleStartDate &&
      isUncorrectedOutcomeStart(event)
    ) {
      return candidate;
    }
    await ctx.db.delete(candidate._id);
  }
}

async function restoreOutcomePage(
  ctx: MutationCtx,
  snapshot: Doc<"predictionSnapshots">,
  cursor: string | null = null,
) {
  const page = await ctx.db
    .query("periodEvents")
    .withIndex("by_user_and_start", (q) =>
      q.eq("userId", snapshot.userId).gt("startDate", snapshot.inputCutoffDate),
    )
    .paginate({ numItems: OUTCOME_RESTORE_PAGE_SIZE, cursor });
  for (const event of page.page) {
    if (
      event.createdAt > snapshot.inputCutoffAt &&
      isUncorrectedOutcomeStart(event)
    ) {
      await appendOutcomeIfEarliest(ctx, snapshot, event, "outcome_reinstated");
      return;
    }
  }
  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.internal.predictionSnapshots.continueOutcomeRestoration,
      { snapshotId: snapshot._id, cursor: page.continueCursor },
    );
  }
}

async function restoreEarliestEffectiveOutcome(
  ctx: MutationCtx,
  snapshot: Doc<"predictionSnapshots">,
) {
  const latestOutcome = await ctx.db
    .query("predictionSnapshotAssessments")
    .withIndex("by_snapshot_and_type", (q) =>
      q.eq("snapshotId", snapshot._id).eq("type", "outcome"),
    )
    .order("desc")
    .first();
  if (latestOutcome?.type !== "outcome") return;
  const candidate = await earliestEligibleCandidate(ctx, snapshot._id);
  if (candidate) {
    if (candidate.sourcePeriodEventId === latestOutcome.sourcePeriodEventId) return;
    const event = await ctx.db.get("periodEvents", candidate.sourcePeriodEventId);
    if (event) await appendOutcomeIfEarliest(ctx, snapshot, event);
  } else {
    await restoreOutcomePage(ctx, snapshot);
  }
}

export const continueOutcomeRestoration = internalMutation({
  args: {
    snapshotId: v.id("predictionSnapshots"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { snapshotId, cursor }) => {
    const snapshot = await ctx.db.get("predictionSnapshots", snapshotId);
    if (snapshot) await restoreOutcomePage(ctx, snapshot, cursor);
    return null;
  },
});

export const recordOutcomesForStart = internalMutation({
  args: {
    sourcePeriodEventId: v.id("periodEvents"),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { sourcePeriodEventId, cursor }) => {
    const event = await ctx.db.get("periodEvents", sourcePeriodEventId);
    if (
      !event ||
      !isUncorrectedOutcomeStart(event)
    ) {
      return null;
    }

    const page = await ctx.db
      .query("predictionSnapshots")
      .withIndex("by_user_and_input_cutoff_at", (q) =>
        q.eq("userId", event.userId).lt("inputCutoffAt", event.createdAt),
      )
      .paginate({ numItems: 25, cursor: cursor ?? null });
    for (const snapshot of page.page) {
      if (event.startDate <= snapshot.inputCutoffDate) continue;
      await appendOutcomeIfEarliest(ctx, snapshot, event);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.internal.predictionSnapshots.recordOutcomesForStart,
        { sourcePeriodEventId, cursor: page.continueCursor },
      );
    }
    return null;
  },
});

export async function appendCorrectionAssessments(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    periodEventId: Id<"periodEvents">;
    sourceAuthorityVersion?: number;
    reason: CorrectionReason;
  }
) {
  if (
    args.sourceAuthorityVersion !== undefined &&
    (!Number.isSafeInteger(args.sourceAuthorityVersion) ||
      args.sourceAuthorityVersion < 0)
  ) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_SOURCE_AUTHORITY_VERSION");
  }

  await appendCorrectionPage(ctx, args);
}

export const continueCorrectionAssessments = internalMutation({
  args: {
    userId: v.id("users"),
    periodEventId: v.id("periodEvents"),
    sourceAuthorityVersion: v.optional(v.number()),
    reason: correctionReasonValidator,
    cursor: v.union(v.string(), v.null()),
    candidateCursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      args.sourceAuthorityVersion !== undefined &&
      (!Number.isSafeInteger(args.sourceAuthorityVersion) ||
        args.sourceAuthorityVersion < 0)
    ) {
      throw new Error("PREDICTION_SNAPSHOT_INVALID_SOURCE_AUTHORITY_VERSION");
    }
    await appendCorrectionPage(ctx, args, args.cursor, args.candidateCursor);
    return null;
  },
});

async function appendCorrectionPage(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    periodEventId: Id<"periodEvents">;
    sourceAuthorityVersion?: number;
    reason: CorrectionReason;
  },
  cursor?: string | null,
  candidateCursor?: string | null,
) {
  // ponytail: process 100 outcomes per transaction; cursor jobs handle larger corrections.
  const page =
    cursor === null
      ? null
      : await ctx.db
          .query("predictionSnapshotAssessments")
          .withIndex("by_source_period_event_and_type", (q) =>
            q
              .eq("sourcePeriodEventId", args.periodEventId)
              .eq("type", "outcome"),
          )
          .paginate({ numItems: CORRECTION_PAGE_SIZE, cursor: cursor ?? null });
  const candidatePage =
    candidateCursor === null
      ? null
      : await ctx.db
          .query("predictionSnapshotOutcomeCandidates")
          .withIndex("by_source_event", (q) =>
            q.eq("sourcePeriodEventId", args.periodEventId),
          )
          .paginate({
            numItems: CORRECTION_PAGE_SIZE,
            cursor: candidateCursor ?? null,
          });

  const recordedAt = Date.now();
  for (const assessment of page?.page ?? []) {
    if (assessment.type !== "outcome") continue;
    const snapshot = await ctx.db.get(
      "predictionSnapshots",
      assessment.snapshotId
    );
    if (!snapshot || snapshot.userId !== args.userId) {
      throw new Error("PREDICTION_SNAPSHOT_CORRECTION_REFERENCE_INVALID");
    }
    await ctx.db.insert("predictionSnapshotAssessments", {
      snapshotId: snapshot._id,
      type: "superseded",
      sourcePeriodEventId: args.periodEventId,
      ...(args.sourceAuthorityVersion === undefined
        ? {}
        : { sourceAuthorityVersion: args.sourceAuthorityVersion }),
      reason: args.reason,
      recordedAt,
    });
  }

  for (const candidate of candidatePage?.page ?? []) {
    const snapshot = await ctx.db.get("predictionSnapshots", candidate.snapshotId);
    if (!snapshot || snapshot.userId !== args.userId) {
      throw new Error("PREDICTION_SNAPSHOT_CORRECTION_REFERENCE_INVALID");
    }
    if (candidate.status !== "eligible") continue;
    await ctx.db.delete(candidate._id);
    const latestOutcome = await ctx.db
      .query("predictionSnapshotAssessments")
      .withIndex("by_snapshot_and_type", (q) =>
        q.eq("snapshotId", snapshot._id).eq("type", "outcome"),
      )
      .order("desc")
      .first();
    if (
      latestOutcome?.type === "outcome" &&
      latestOutcome.sourcePeriodEventId === args.periodEventId
    ) {
      await restoreEarliestEffectiveOutcome(ctx, snapshot);
    }
  }

  if ((page && !page.isDone) || (candidatePage && !candidatePage.isDone)) {
    await ctx.scheduler.runAfter(
      0,
      internal.internal.predictionSnapshots.continueCorrectionAssessments,
      {
        userId: args.userId,
        periodEventId: args.periodEventId,
        reason: args.reason,
        ...(args.sourceAuthorityVersion === undefined
          ? {}
          : { sourceAuthorityVersion: args.sourceAuthorityVersion }),
        cursor: page && !page.isDone ? page.continueCursor : null,
        candidateCursor:
          candidatePage && !candidatePage.isDone
            ? candidatePage.continueCursor
            : null,
      }
    );
  }
}
