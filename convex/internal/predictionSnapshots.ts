import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import { requireValidCalendarDate } from "../_helpers/calendarDates";
import { isStartAnchorEligible } from "../_helpers/cycleFactEligibility";
import { daysBetweenCalendarDates } from "../_helpers/predictionBounds";

const MAX_REASON_CODES = 16;
const CORRECTION_PAGE_SIZE = 100;

const qualityValidator = v.union(
  v.literal("high"),
  v.literal("moderate"),
  v.literal("low"),
  v.literal("timing_less_predictable"),
  v.literal("limited_evidence")
);

const reasonCodeValidator = v.union(
  v.literal("ELEVATED_CALIBRATION_RISK"),
  v.literal("INSUFFICIENT_CALIBRATION"),
  v.literal("RECENT_TIMING_VARIABLE"),
  v.literal("SPARSE_HISTORY"),
  v.literal("LIMITED_HISTORY"),
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

export const createSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    generatedAt: v.number(),
    inputCutoffAt: v.number(),
    inputCutoffDate: v.string(),
    estimatorId: v.string(),
    estimatorVersion: v.string(),
    intervalMethodVersion: v.string(),
    calibrationVersion: v.string(),
    pointDate: v.string(),
    earliestDate: v.string(),
    latestDate: v.string(),
    quality: qualityValidator,
    qualityScoreV1: v.union(v.number(), v.null()),
    basisCount: v.number(),
    reasonCodes: v.array(reasonCodeValidator),
    displayStatus: v.union(v.literal("shadow"), v.literal("visible")),
    predictionSegmentId: v.id("cyclePredictionSegments"),
    featureVersion: v.string(),
    contractVersion: v.number(),
  },
  returns: v.object({ snapshotId: v.id("predictionSnapshots") }),
  handler: async (ctx, args) => {
    requireTimestamp(args.generatedAt, "GENERATED_AT");
    requireTimestamp(args.inputCutoffAt, "INPUT_CUTOFF_AT");
    if (args.inputCutoffAt > args.generatedAt) {
      throw new Error("PREDICTION_SNAPSHOT_CUTOFF_AFTER_GENERATION");
    }
    requireValidCalendarDate(args.inputCutoffDate, "Input cutoff date");
    requireValidCalendarDate(args.pointDate, "Prediction point date");
    requireValidCalendarDate(args.earliestDate, "Prediction earliest date");
    requireValidCalendarDate(args.latestDate, "Prediction latest date");
    if (
      args.earliestDate > args.pointDate ||
      args.pointDate > args.latestDate
    ) {
      throw new Error("PREDICTION_SNAPSHOT_INVALID_WINDOW");
    }
    if (
      !Number.isSafeInteger(args.basisCount) ||
      args.basisCount < 0 ||
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
    requireBoundedText(args.estimatorVersion, "ESTIMATOR_VERSION", 128);
    requireBoundedText(
      args.intervalMethodVersion,
      "INTERVAL_METHOD_VERSION",
      128
    );
    requireBoundedText(args.calibrationVersion, "CALIBRATION_VERSION", 128);
    requireBoundedText(args.featureVersion, "FEATURE_VERSION", 64);

    const [user, segment] = await Promise.all([
      ctx.db.get("users", args.userId),
      ctx.db.get("cyclePredictionSegments", args.predictionSegmentId),
    ]);
    const segmentWasActiveAtCutoff =
      segment?.status === "active" &&
      segment.supersededAt === undefined;
    const segmentWasSupersededAfterCutoff =
      segment?.status === "superseded" &&
      segment.supersededAt !== undefined &&
      args.inputCutoffAt < segment.supersededAt;
    if (!user || user.role !== "primary") {
      throw new Error("PREDICTION_SNAPSHOT_PRIMARY_USER_REQUIRED");
    }
    if (
      !segment ||
      segment.userId !== args.userId ||
      segment.createdAt > args.inputCutoffAt ||
      (!segmentWasActiveAtCutoff && !segmentWasSupersededAfterCutoff)
    ) {
      throw new Error("PREDICTION_SNAPSHOT_SEGMENT_NOT_ACTIVE_AT_CUTOFF");
    }

    const snapshotId = await ctx.db.insert("predictionSnapshots", {
      userId: args.userId,
      generatedAt: args.generatedAt,
      inputCutoffAt: args.inputCutoffAt,
      inputCutoffDate: args.inputCutoffDate,
      estimatorId: args.estimatorId,
      estimatorVersion: args.estimatorVersion,
      intervalMethodVersion: args.intervalMethodVersion,
      calibrationVersion: args.calibrationVersion,
      pointDate: args.pointDate,
      earliestDate: args.earliestDate,
      latestDate: args.latestDate,
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
    return { snapshotId };
  },
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
      !isStartAnchorEligible(event) ||
      event.startDate <= snapshot.inputCutoffDate ||
      event.createdAt <= snapshot.inputCutoffAt ||
      event.primaryCorrectionVersion !== undefined
    ) {
      throw new Error("PREDICTION_SNAPSHOT_OUTCOME_NOT_ELIGIBLE");
    }

    const [existingOutcome, existingSupersession] = await Promise.all([
      ctx.db
        .query("predictionSnapshotAssessments")
        .withIndex("by_snapshot_and_type", (q) =>
          q.eq("snapshotId", args.snapshotId).eq("type", "outcome")
        )
        .first(),
      ctx.db
        .query("predictionSnapshotAssessments")
        .withIndex("by_snapshot_and_type", (q) =>
          q.eq("snapshotId", args.snapshotId).eq("type", "superseded")
        )
        .first(),
    ]);
    if (existingOutcome || existingSupersession) {
      throw new Error("PREDICTION_SNAPSHOT_ALREADY_ASSESSED");
    }

    const signedErrorDays = daysBetweenCalendarDates(
      snapshot.pointDate,
      event.startDate
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
      reason: "eligible_outcome",
      recordedAt: Date.now(),
    });
    return { assessmentId, signedErrorDays, absoluteErrorDays, insideWindow };
  },
});

export async function appendPrimaryCorrectionAssessments(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    periodEventId: Id<"periodEvents">;
    sourceAuthorityVersion?: number;
  }
) {
  if (
    args.sourceAuthorityVersion !== undefined &&
    (!Number.isSafeInteger(args.sourceAuthorityVersion) ||
      args.sourceAuthorityVersion < 0)
  ) {
    throw new Error("PREDICTION_SNAPSHOT_INVALID_SOURCE_AUTHORITY_VERSION");
  }

  await appendPrimaryCorrectionPage(ctx, args, null);
}

export const continuePrimaryCorrection = internalMutation({
  args: {
    userId: v.id("users"),
    periodEventId: v.id("periodEvents"),
    sourceAuthorityVersion: v.optional(v.number()),
    cursor: v.string(),
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
    await appendPrimaryCorrectionPage(ctx, args, args.cursor);
    return null;
  },
});

async function appendPrimaryCorrectionPage(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    periodEventId: Id<"periodEvents">;
    sourceAuthorityVersion?: number;
  },
  cursor: string | null
) {
  // ponytail: process 100 outcomes per transaction; cursor jobs handle larger corrections.
  const page = await ctx.db
    .query("predictionSnapshotAssessments")
    .withIndex("by_source_period_event_and_type", (q) =>
      q
        .eq("sourcePeriodEventId", args.periodEventId)
        .eq("type", "outcome")
    )
    .paginate({ numItems: CORRECTION_PAGE_SIZE, cursor });

  const recordedAt = Date.now();
  for (const assessment of page.page) {
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
      reason: "primary_correction",
      recordedAt,
    });
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.internal.predictionSnapshots.continuePrimaryCorrection,
      {
        userId: args.userId,
        periodEventId: args.periodEventId,
        ...(args.sourceAuthorityVersion === undefined
          ? {}
          : { sourceAuthorityVersion: args.sourceAuthorityVersion }),
        cursor: page.continueCursor,
      }
    );
  }
}
