import { v } from "convex/values";
import { makeFunctionReference, paginationOptsValidator } from "convex/server";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  DEFAULT_TIME_ZONE,
  requireValidCalendarDate,
  resolveCalendarTimeZone,
  toCalendarDateInTimeZone,
} from "../_helpers/calendarDates";
import { readCyclePredictionData } from "../_helpers/cyclePredictionData";
import { addCalendarDays } from "../_helpers/cycleCalculations";
import { deriveCycleIntervals } from "../_helpers/cycleIntervals";
import { buildPeriodPrediction } from "../_helpers/periodPrediction";
import { isPeriodPredictionV2Enabled } from "../_helpers/periodPredictionFlag";
import { PREDICTION_CALIBRATION_VERSION } from "../_helpers/predictionIntervals";
import {
  currentPredictionSnapshotInput,
  predictionSnapshotMatchesCurrent,
} from "../_helpers/predictionSnapshotContract";
import {
  createNotificationDueWork,
  makeSourceAuthorityVersion,
  isCurrentNotificationScheduleFence,
  persistNotificationSourceAuthorityVersion,
} from "../_helpers/notificationSourceAuthority";
import { authorizeNotificationProjection } from "../_helpers/notificationPolicy";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";

const SCHEDULER_FLAG = "CB_CONNECT_NOTIFICATION_SCHEDULER_V1";
const PROJECTION_FLAG = "CB_CONNECT_NOTIFICATION_PROJECTION_V1";
const DELIVERY_FLAG = "CB_CONNECT_NOTIFICATION_DELIVERY_V1";
const DUE_WORK_PAGE_SIZE = 50;
const OWNER_PENDING_PAGE_SIZE = 100;
const SERVED_SNAPSHOT_LOOKBACK = 100;
const INDETERMINATE_SNAPSHOT_RETRY_DELAY_MS = 5 * 60 * 1_000;
const MAX_RUN_AT_DELAY_MS = 5 * 365 * 24 * 60 * 60 * 1_000;
const MINUTE_MS = 60 * 1_000;

type ScheduleKind = "prediction_window" | "late_boundary";
type ServedSnapshotResult =
  | {
      status: "current";
      user: Doc<"users">;
      snapshot: Doc<"predictionSnapshots">;
      scheduleState: Doc<"notificationScheduleState">;
      sourceAuthorityVersion: string;
      latestEligibleStartEventId?: Id<"periodEvents">;
    }
  | {
      status: "indeterminate";
      scheduleState: Doc<"notificationScheduleState">;
    }
  | { status: "unavailable" };

const wakeArgsValidator = v.object({
  workId: v.id("notificationDueWork"),
  generation: v.number(),
});

const wakeWorkRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:wakeDueWork",
);
const continueIndeterminateClaimCancellationRef =
  makeFunctionReference<"mutation">(
    "internal/notificationScheduler:continueIndeterminateClaimCancellation",
  );
const continueScheduleReconciliationRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:continueScheduleReconciliation",
);
const continueUnavailableScheduleCancellationRef =
  makeFunctionReference<"mutation">(
    "internal/notificationScheduler:continueUnavailableScheduleCancellation",
  );
const reconcileWorkRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:reconcileDueWork",
);

const scheduleCandidateIdsValidator = v.object({
  pendingPredictionId: v.union(v.id("notificationDueWork"), v.null()),
  claimedPredictionId: v.union(v.id("notificationDueWork"), v.null()),
  pendingLateId: v.union(v.id("notificationDueWork"), v.null()),
  claimedLateId: v.union(v.id("notificationDueWork"), v.null()),
});
const schedulePageProgressValidator = {
  pendingPredictionCursor: paginationOptsValidator.fields.cursor,
  pendingPredictionDone: v.boolean(),
  claimedPredictionCursor: paginationOptsValidator.fields.cursor,
  claimedPredictionDone: v.boolean(),
  pendingLateCursor: paginationOptsValidator.fields.cursor,
  pendingLateDone: v.boolean(),
  claimedLateCursor: paginationOptsValidator.fields.cursor,
  claimedLateDone: v.boolean(),
};
const currentScheduleContinuationArgsValidator = v.object({
  phase: v.literal("current"),
  userId: v.id("users"),
  contextFingerprint: v.string(),
  ...schedulePageProgressValidator,
  candidates: scheduleCandidateIdsValidator,
});
const unavailableScheduleContinuationArgsValidator = v.object({
  phase: v.literal("unavailable"),
  userId: v.id("users"),
  ...schedulePageProgressValidator,
});

type ScheduleCandidateIds = {
  pendingPredictionId: Id<"notificationDueWork"> | null;
  claimedPredictionId: Id<"notificationDueWork"> | null;
  pendingLateId: Id<"notificationDueWork"> | null;
  claimedLateId: Id<"notificationDueWork"> | null;
};
type SchedulePageProgress = {
  pendingPredictionCursor: string | null;
  pendingPredictionDone: boolean;
  claimedPredictionCursor: string | null;
  claimedPredictionDone: boolean;
  pendingLateCursor: string | null;
  pendingLateDone: boolean;
  claimedLateCursor: string | null;
  claimedLateDone: boolean;
};

function schedulerEnabled(): boolean {
  return process.env[SCHEDULER_FLAG] === "true";
}

function isSafeRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function workGeneration(sourceRevision: number): number {
  return Math.max(1, Math.min(sourceRevision, Number.MAX_SAFE_INTEGER - 1));
}

function formatLocalMinute(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ["year", "month", "day", "hour", "minute"].includes(part.type),
      )
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function offsetAt(instant: number, timeZone: string): number {
  const roundedInstant = Math.floor(instant / MINUTE_MS) * MINUTE_MS;
  const localMinute = formatLocalMinute(roundedInstant, timeZone);
  const [date, time] = localMinute.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return (localAsUtc - roundedInstant) / MINUTE_MS;
}

/** Resolves DST gaps to the first valid local minute and folds to the earlier instant. */
export function resolveLocalReminderInstant(
  localDay: string,
  localReminderTime: string,
  timeZone: string,
): number {
  requireValidCalendarDate(localDay, "Reminder day");
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(localReminderTime)) {
    throw new Error("Local reminder time must use 24-hour HH:mm format");
  }
  const zone = resolveCalendarTimeZone(timeZone);
  const [year, month, day] = localDay.split("-").map(Number);
  const [hour, minute] = localReminderTime.split(":").map(Number);
  const requestedLocalMinute = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set<number>();
  for (let deltaHours = -36; deltaHours <= 36; deltaHours += 6) {
    offsets.add(offsetAt(requestedLocalMinute + deltaHours * 60 * MINUTE_MS, zone));
  }

  for (let gapMinutes = 0; gapMinutes <= 180; gapMinutes += 1) {
    const targetLocalMinute = requestedLocalMinute + gapMinutes * MINUTE_MS;
    const matches: number[] = [];
    for (const offsetMinutes of offsets) {
      const candidate = targetLocalMinute - offsetMinutes * MINUTE_MS;
      if (
        formatLocalMinute(candidate, zone) ===
        formatLocalMinute(targetLocalMinute, "UTC")
      ) {
        matches.push(candidate);
      }
    }
    if (matches.length > 0) return Math.min(...matches);
  }

  throw new Error("Unable to resolve local reminder time");
}

function makeSourceVersion(
  sourceRevision: number,
  snapshot: Doc<"predictionSnapshots">,
): string {
  return makeSourceAuthorityVersion({
    sourceRevision,
    servedCycleContract: "cycle-read-model-v1",
    servedPredictionContract: "prediction-serving-v2",
    estimatorMethodVersion: `${snapshot.estimatorId}-v${snapshot.estimatorVersion}`,
    calibrationMethodVersion: snapshot.calibrationVersion,
  });
}

async function readCurrentServedSnapshot(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<ServedSnapshotResult> {
  if (!isPeriodPredictionV2Enabled()) return { status: "unavailable" };
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "primary") return { status: "unavailable" };
  const [predictionData, settings, scheduleState] = await Promise.all([
    readCyclePredictionData(ctx, userId, user),
    ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
    ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
  ]);
  if (!scheduleState || !isSafeRevision(scheduleState.sourceRevision)) {
    return { status: "unavailable" };
  }

  const snapshots = await ctx.db
    .query("predictionSnapshots")
    .withIndex("by_user_and_generated_at", (q) => q.eq("userId", userId))
    .order("desc")
    .take(SERVED_SNAPSHOT_LOOKBACK);
  const snapshot = snapshots.find(
    (candidate) =>
      candidate.displayStatus === "visible" &&
      candidate.featureVersion === "period_prediction_v2" &&
      candidate.intervalMethodVersion === PREDICTION_CALIBRATION_VERSION,
  );
  if (!snapshot) {
    return snapshots.length === SERVED_SNAPSHOT_LOOKBACK
      ? { status: "indeterminate" as const, scheduleState }
      : { status: "unavailable" as const };
  }
  const servedIntervals = deriveCycleIntervals(
    predictionData.periodEvents.map((period) => ({
      ...period,
      id: String(period._id),
    })),
    {
      cutoffAt: snapshot.inputCutoffAt,
      cutoffDate: snapshot.inputCutoffDate,
      segments: predictionData.activeSegment
        ? [predictionData.activeSegment]
        : [],
    },
  );
  const cycleIntervals = predictionData.historyComplete
    ? servedIntervals
    : {
        ...servedIntervals,
        reasonCodes: [...new Set([
          ...servedIntervals.reasonCodes,
          "LIMITED_HISTORY" as const,
        ])].sort(),
      };

  const prediction = buildPeriodPrediction({
    cycleIntervals,
    historyComplete: predictionData.historyComplete,
    configuredCycleLength: settings?.cycleLength ?? 28,
    predictionPaused: settings?.predictionPaused ?? false,
  });
  if (prediction.pointDate === null) return { status: "unavailable" };

  const current = currentPredictionSnapshotInput({
    prediction,
    inputCutoffAt: snapshot.inputCutoffAt,
    inputCutoffDate: snapshot.inputCutoffDate,
    periodEvents: predictionData.periodEvents,
    settings,
    activeSegment: predictionData.activeSegment,
  });
  if (!predictionSnapshotMatchesCurrent(snapshot, current)) {
    return { status: "unavailable" };
  }
  const sourceAuthorityVersion = makeSourceVersion(
    scheduleState.sourceRevision,
    snapshot,
  );
  const persistedScheduleState = await persistNotificationSourceAuthorityVersion(
    ctx,
    userId,
    sourceAuthorityVersion,
  );
  if (!persistedScheduleState) return { status: "unavailable" };
  return {
    status: "current",
    user,
    snapshot,
    scheduleState: persistedScheduleState,
    sourceAuthorityVersion,
    ...(servedIntervals.latestEligibleStartEventId
      ? {
          latestEligibleStartEventId:
            ctx.db.normalizeId(
              "periodEvents",
              servedIntervals.latestEligibleStartEventId,
            ) ?? undefined,
        }
      : {}),
  };
}

function desiredDueAt(
  kind: ScheduleKind,
  snapshot: Doc<"predictionSnapshots">,
  reminderTime: string,
  timeZone: string,
): number {
  const localDay = designatedLocalDay(kind, snapshot);
  return resolveLocalReminderInstant(localDay, reminderTime, timeZone);
}

function designatedLocalDay(
  kind: ScheduleKind,
  snapshot: Doc<"predictionSnapshots">,
): string {
  return kind === "prediction_window"
    ? addCalendarDays(snapshot.pointDate, -3)
    : addCalendarDays(snapshot.latestDate, 1);
}

function isExpiredLocalDay(
  kind: ScheduleKind,
  snapshot: Doc<"predictionSnapshots">,
  timeZone: string,
  now: number,
): boolean {
  const today = toCalendarDateInTimeZone(new Date(now), timeZone);
  return designatedLocalDay(kind, snapshot) < today;
}

async function readSchedulePreferences(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const [predictionWindow, lateStatus] = await Promise.all([
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", userId).eq("purpose", "period_window_approaching"),
      )
      .unique(),
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", userId).eq("purpose", "late_status"),
      )
      .unique(),
  ]);
  return { predictionWindow, lateStatus };
}

async function readScheduleWorkPage(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  kind: ScheduleKind,
  state: "pending" | "claimed",
  cursor: string | null,
) {
  return await ctx.db
    .query("notificationDueWork")
    .withIndex(
      "by_owner_and_kind_and_state_and_due_at_and_generation_and_source_authority_version_and_reminder_window_version",
      (q) =>
        q
          .eq("ownerUserId", userId)
          .eq("kind", kind)
          .eq("state", state),
    )
    .paginate({ numItems: OWNER_PENDING_PAGE_SIZE, cursor });
}

async function cancelActiveKind(
  ctx: MutationCtx,
  rows: readonly Doc<"notificationDueWork">[],
  kind: ScheduleKind,
  now: number,
) {
  for (const row of rows) {
    if (
      row.kind === kind &&
      (row.state === "pending" || row.state === "claimed")
    ) {
      await ctx.db.patch(row._id, { state: "cancelled", updatedAt: now });
    }
  }
}

async function reconcileKind(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    kind: ScheduleKind;
    enabled: boolean;
    localReminderTime?: string;
    reminderWindowVersion?: number;
    snapshot: Doc<"predictionSnapshots">;
    generation: number;
    sourceAuthorityVersion: string;
    timeZone: string;
    pending: readonly Doc<"notificationDueWork">[];
    claimed: readonly Doc<"notificationDueWork">[];
    now: number;
  },
) {
  const pendingKind = args.pending.filter((row) => row.kind === args.kind);
  const claimedKind = args.claimed.filter((row) => row.kind === args.kind);
  const computedDueAt =
    args.enabled &&
    args.localReminderTime &&
    Number.isSafeInteger(args.reminderWindowVersion) &&
    (args.reminderWindowVersion ?? 0) > 0
      ? desiredDueAt(
          args.kind,
          args.snapshot,
          args.localReminderTime,
          args.timeZone,
        )
      : null;
  const dueAt =
    computedDueAt !== null &&
    !isExpiredLocalDay(args.kind, args.snapshot, args.timeZone, args.now)
      ? computedDueAt
      : null;
  const supportedRunAt =
    dueAt !== null && dueAt <= args.now + MAX_RUN_AT_DELAY_MS;
  const currentClaimedWork = claimedKind.find(
    (row) =>
      supportedRunAt &&
      row.dueAt === dueAt &&
      row.generation === args.generation &&
      row.sourceAuthorityVersion === args.sourceAuthorityVersion &&
      row.reminderWindowVersion === args.reminderWindowVersion,
  );
  const alreadyClaimed = currentClaimedWork !== undefined;
  const reusable = alreadyClaimed
    ? undefined
    : pendingKind.find(
        (row) =>
          supportedRunAt &&
          row.dueAt === dueAt &&
          row.generation === args.generation &&
          row.sourceAuthorityVersion === args.sourceAuthorityVersion &&
          row.reminderWindowVersion === args.reminderWindowVersion,
      );
  for (const row of [...pendingKind, ...claimedKind]) {
    const currentClaim = row._id === currentClaimedWork?._id;
    if (row._id !== reusable?._id && !currentClaim) {
      await ctx.db.patch(row._id, { state: "cancelled", updatedAt: args.now });
    }
  }
  if (alreadyClaimed || !supportedRunAt || dueAt === null) return;
  if (reusable) {
    if (isIndeterminateSnapshotRetryDeferred(reusable, args.now)) {
      await ctx.scheduler.runAt(Math.max(dueAt, args.now), wakeWorkRef, {
        workId: reusable._id,
        generation: reusable.generation,
      });
    }
    return;
  }

  // Continuations can miss earlier inserts.
  const [pendingAtFence, claimedAtFence] = await Promise.all(
    (["pending", "claimed"] as const).map((state) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex(
          "by_owner_and_kind_and_state_and_due_at_and_generation_and_source_authority_version_and_reminder_window_version",
          (q) =>
            q
              .eq("ownerUserId", args.userId)
              .eq("kind", args.kind)
              .eq("state", state)
              .eq("dueAt", dueAt)
              .eq("generation", args.generation)
              .eq("sourceAuthorityVersion", args.sourceAuthorityVersion)
              .eq("reminderWindowVersion", args.reminderWindowVersion),
        )
        .first(),
    ),
  );
  if (pendingAtFence || claimedAtFence) return;

  const workId = await createNotificationDueWork(ctx, {
    ownerUserId: args.userId,
    kind: args.kind,
    state: "pending",
    dueAt,
    generation: args.generation,
    sourceAuthorityVersion: args.sourceAuthorityVersion,
    reminderWindowVersion: args.reminderWindowVersion!,
    createdAt: args.now,
    updatedAt: args.now,
  });
  await ctx.scheduler.runAt(Math.max(dueAt, args.now), wakeWorkRef, {
    workId,
    generation: args.generation,
  });
}

async function cancelAllActiveScheduleWork(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
) {
  await cancelUnavailableSchedulePage(ctx, userId, now, {
    pendingPredictionCursor: null,
    pendingPredictionDone: false,
    claimedPredictionCursor: null,
    claimedPredictionDone: false,
    pendingLateCursor: null,
    pendingLateDone: false,
    claimedLateCursor: null,
    claimedLateDone: false,
  });
}

async function cancelUnavailableSchedulePage(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  progress: SchedulePageProgress,
) {
  const [pendingPrediction, claimedPrediction, pendingLate, claimedLate] =
    await Promise.all([
    progress.pendingPredictionDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "prediction_window",
          "pending",
          progress.pendingPredictionCursor,
        ),
    progress.claimedPredictionDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "prediction_window",
          "claimed",
          progress.claimedPredictionCursor,
        ),
    progress.pendingLateDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "late_boundary",
          "pending",
          progress.pendingLateCursor,
        ),
    progress.claimedLateDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "late_boundary",
          "claimed",
          progress.claimedLateCursor,
        ),
  ]);
  await cancelActiveKind(ctx, pendingPrediction?.page ?? [], "prediction_window", now);
  await cancelActiveKind(ctx, claimedPrediction?.page ?? [], "prediction_window", now);
  await cancelActiveKind(ctx, pendingLate?.page ?? [], "late_boundary", now);
  await cancelActiveKind(ctx, claimedLate?.page ?? [], "late_boundary", now);

  const nextProgress = {
    pendingPredictionCursor: pendingPrediction?.isDone
      ? null
      : (pendingPrediction?.continueCursor ?? progress.pendingPredictionCursor),
    pendingPredictionDone:
      progress.pendingPredictionDone || (pendingPrediction?.isDone ?? false),
    claimedPredictionCursor: claimedPrediction?.isDone
      ? null
      : (claimedPrediction?.continueCursor ?? progress.claimedPredictionCursor),
    claimedPredictionDone:
      progress.claimedPredictionDone || (claimedPrediction?.isDone ?? false),
    pendingLateCursor: pendingLate?.isDone
      ? null
      : (pendingLate?.continueCursor ?? progress.pendingLateCursor),
    pendingLateDone: progress.pendingLateDone || (pendingLate?.isDone ?? false),
    claimedLateCursor: claimedLate?.isDone
      ? null
      : (claimedLate?.continueCursor ?? progress.claimedLateCursor),
    claimedLateDone: progress.claimedLateDone || (claimedLate?.isDone ?? false),
  };
  if (
    !nextProgress.pendingPredictionDone ||
    !nextProgress.claimedPredictionDone ||
    !nextProgress.pendingLateDone ||
    !nextProgress.claimedLateDone
  ) {
    if (
      (!nextProgress.pendingPredictionDone &&
        nextProgress.pendingPredictionCursor === null) ||
      (!nextProgress.claimedPredictionDone &&
        nextProgress.claimedPredictionCursor === null) ||
      (!nextProgress.pendingLateDone && nextProgress.pendingLateCursor === null) ||
      (!nextProgress.claimedLateDone && nextProgress.claimedLateCursor === null)
    ) {
      throw new Error("Active schedule work page must provide a continuation cursor");
    }
    await ctx.scheduler.runAfter(0, continueUnavailableScheduleCancellationRef, {
      phase: "unavailable",
      userId,
      ...nextProgress,
    });
  }
}

export const continueUnavailableScheduleCancellation = internalMutation({
  args: unavailableScheduleContinuationArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await readCurrentServedSnapshot(ctx, args.userId);
    if (current.status === "current") {
      await reconcileUserSchedule(ctx, args.userId);
    } else if (current.status === "indeterminate") {
      await cancelClaimedScheduleWork(ctx, args.userId, Date.now());
    } else {
      await cancelUnavailableSchedulePage(ctx, args.userId, Date.now(), args);
    }
    return null;
  },
});

async function cancelClaimedScheduleWork(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  progress: {
    predictionCursor: string | null;
    predictionDone: boolean;
    lateCursor: string | null;
    lateDone: boolean;
  } = {
    predictionCursor: null,
    predictionDone: false,
    lateCursor: null,
    lateDone: false,
  },
) {
  const current = await readCurrentServedSnapshot(ctx, userId);
  if (current.status === "current") return;

  const [predictionPage, latePage] = await Promise.all([
    progress.predictionDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "prediction_window",
          "claimed",
          progress.predictionCursor,
        ),
    progress.lateDone
      ? null
      : readScheduleWorkPage(
          ctx,
          userId,
          "late_boundary",
          "claimed",
          progress.lateCursor,
        ),
  ]);
  for (const row of [
    ...(predictionPage?.page ?? []),
    ...(latePage?.page ?? []),
  ]) {
    await ctx.db.patch(row._id, { state: "cancelled", updatedAt: now });
  }
  const nextProgress = {
    predictionCursor: predictionPage?.isDone
      ? null
      : (predictionPage?.continueCursor ?? progress.predictionCursor),
    predictionDone: progress.predictionDone || (predictionPage?.isDone ?? false),
    lateCursor: latePage?.isDone
      ? null
      : (latePage?.continueCursor ?? progress.lateCursor),
    lateDone: progress.lateDone || (latePage?.isDone ?? false),
  };
  if (!nextProgress.predictionDone || !nextProgress.lateDone) {
    if (
      (!nextProgress.predictionDone && nextProgress.predictionCursor === null) ||
      (!nextProgress.lateDone && nextProgress.lateCursor === null)
    ) {
      throw new Error(
        "Claimed schedule work page must provide a continuation cursor",
      );
    }
    await ctx.scheduler.runAfter(0, continueIndeterminateClaimCancellationRef, {
      userId,
      ...nextProgress,
    });
  }
}

export const continueIndeterminateClaimCancellation = internalMutation({
  args: {
    userId: v.id("users"),
    predictionCursor: paginationOptsValidator.fields.cursor,
    predictionDone: v.boolean(),
    lateCursor: paginationOptsValidator.fields.cursor,
    lateDone: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await cancelClaimedScheduleWork(ctx, args.userId, Date.now(), args);
    return null;
  },
});

/**
 * Frozen N5b/N8 same-transaction entry point for current served V2 schedule work.
 * Domain writers advance source authority first, then call this helper with the
 * same MutationCtx so invalidation and replacement work commit atomically.
 */
function candidateIdKey(
  kind: ScheduleKind,
  state: "pending" | "claimed",
): keyof ScheduleCandidateIds {
  if (kind === "prediction_window") {
    return state === "pending" ? "pendingPredictionId" : "claimedPredictionId";
  }
  return state === "pending" ? "pendingLateId" : "claimedLateId";
}

function expectedDueAt(
  kind: ScheduleKind,
  snapshot: Doc<"predictionSnapshots">,
  preference: Doc<"notificationPreferences"> | null,
  timeZone: string,
  now: number,
): number | null {
  if (
    !preference?.inAppEnabled ||
    !preference.localReminderTime ||
    !Number.isSafeInteger(preference.reminderWindowVersion) ||
    preference.reminderWindowVersion <= 0
  ) {
    return null;
  }
  const dueAt = desiredDueAt(
    kind,
    snapshot,
    preference.localReminderTime,
    timeZone,
  );
  if (
    isExpiredLocalDay(kind, snapshot, timeZone, now) ||
    (schedulerEnabled() && dueAt > now + MAX_RUN_AT_DELAY_MS)
  ) {
    return null;
  }
  return dueAt;
}

async function inspectSchedulePage(
  ctx: MutationCtx,
  rows: readonly Doc<"notificationDueWork">[],
  state: "pending" | "claimed",
  args: {
    candidates: ScheduleCandidateIds;
    expectedDueAt: Record<ScheduleKind, number | null>;
    generation: number;
    sourceAuthorityVersion: string;
    reminderWindowVersion: Record<ScheduleKind, number | undefined>;
    now: number;
  },
): Promise<void> {
  for (const row of rows) {
    if (row.kind !== "prediction_window" && row.kind !== "late_boundary") {
      continue;
    }
    const candidateKey = candidateIdKey(row.kind, state);
    const isCurrent =
      row.dueAt === args.expectedDueAt[row.kind] &&
      row.generation === args.generation &&
      row.sourceAuthorityVersion === args.sourceAuthorityVersion &&
      row.reminderWindowVersion === args.reminderWindowVersion[row.kind];
    if (!isCurrent || args.candidates[candidateKey] !== null) {
      await ctx.db.patch(row._id, { state: "cancelled", updatedAt: args.now });
    } else {
      args.candidates[candidateKey] = row._id;
    }
  }
}

async function activeCandidates(
  ctx: MutationCtx,
  ...ids: Array<Id<"notificationDueWork"> | null>
) {
  const uniqueIds = [...new Set(ids.filter((id) => id !== null))];
  const rows = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  return {
    pending: rows.filter(
      (row): row is Doc<"notificationDueWork"> => row?.state === "pending",
    ),
    claimed: rows.filter(
      (row): row is Doc<"notificationDueWork"> => row?.state === "claimed",
    ),
  };
}

async function reconcileCurrentSchedulePage(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    contextFingerprint: string | null;
    progress: SchedulePageProgress;
    candidates: ScheduleCandidateIds;
  },
): Promise<void> {
  const now = Date.now();
  const current = await readCurrentServedSnapshot(ctx, args.userId);
  if (current.status === "indeterminate") {
    await cancelClaimedScheduleWork(ctx, args.userId, now);
    return;
  }
  if (current.status !== "current") {
    await cancelAllActiveScheduleWork(ctx, args.userId, now);
    return;
  }

  const { predictionWindow, lateStatus } = await readSchedulePreferences(
    ctx,
    args.userId,
  );
  const timeZone = resolveCalendarTimeZone(
    current.user.timeZone ?? DEFAULT_TIME_ZONE,
  );
  const generation = workGeneration(current.scheduleState.sourceRevision);
  const dueAt = {
    prediction_window: current.latestEligibleStartEventId
      ? expectedDueAt(
          "prediction_window",
          current.snapshot,
          predictionWindow,
          timeZone,
          now,
        )
      : null,
    late_boundary: expectedDueAt(
      "late_boundary",
      current.snapshot,
      lateStatus,
      timeZone,
      now,
    ),
  };
  const contextFingerprint = JSON.stringify({
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    generation,
    timeZone,
    localDay: toCalendarDateInTimeZone(new Date(now), timeZone),
    schedulerEnabled: schedulerEnabled(),
    dueAt,
    predictionWindow: predictionWindow
      ? [
          predictionWindow.inAppEnabled,
          predictionWindow.localReminderTime,
          predictionWindow.reminderWindowVersion,
        ]
      : null,
    lateStatus: lateStatus
      ? [lateStatus.inAppEnabled, lateStatus.localReminderTime, lateStatus.reminderWindowVersion]
      : null,
  });
  if (
    args.contextFingerprint !== null &&
    args.contextFingerprint !== contextFingerprint
  ) {
    await reconcileUserSchedule(ctx, args.userId);
    return;
  }

  const [
    pendingPrediction,
    claimedPrediction,
    pendingLate,
    claimedLate,
  ] = await Promise.all([
    args.progress.pendingPredictionDone
      ? null
      : readScheduleWorkPage(
          ctx,
          args.userId,
          "prediction_window",
          "pending",
          args.progress.pendingPredictionCursor,
        ),
    args.progress.claimedPredictionDone
      ? null
      : readScheduleWorkPage(
          ctx,
          args.userId,
          "prediction_window",
          "claimed",
          args.progress.claimedPredictionCursor,
        ),
    args.progress.pendingLateDone
      ? null
      : readScheduleWorkPage(
          ctx,
          args.userId,
          "late_boundary",
          "pending",
          args.progress.pendingLateCursor,
        ),
    args.progress.claimedLateDone
      ? null
      : readScheduleWorkPage(
          ctx,
          args.userId,
          "late_boundary",
          "claimed",
          args.progress.claimedLateCursor,
        ),
  ]);
  const reminderWindowVersion = {
    prediction_window: predictionWindow?.reminderWindowVersion,
    late_boundary: lateStatus?.reminderWindowVersion,
  };
  await inspectSchedulePage(ctx, pendingPrediction?.page ?? [], "pending", {
    candidates: args.candidates,
    expectedDueAt: dueAt,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    reminderWindowVersion,
    now,
  });
  await inspectSchedulePage(ctx, claimedPrediction?.page ?? [], "claimed", {
    candidates: args.candidates,
    expectedDueAt: dueAt,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    reminderWindowVersion,
    now,
  });
  await inspectSchedulePage(ctx, pendingLate?.page ?? [], "pending", {
    candidates: args.candidates,
    expectedDueAt: dueAt,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    reminderWindowVersion,
    now,
  });
  await inspectSchedulePage(ctx, claimedLate?.page ?? [], "claimed", {
    candidates: args.candidates,
    expectedDueAt: dueAt,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    reminderWindowVersion,
    now,
  });

  const progress = {
    pendingPredictionCursor: pendingPrediction?.isDone
      ? null
      : (pendingPrediction?.continueCursor ?? args.progress.pendingPredictionCursor),
    pendingPredictionDone:
      args.progress.pendingPredictionDone ||
      (pendingPrediction?.isDone ?? false),
    claimedPredictionCursor: claimedPrediction?.isDone
      ? null
      : (claimedPrediction?.continueCursor ?? args.progress.claimedPredictionCursor),
    claimedPredictionDone:
      args.progress.claimedPredictionDone ||
      (claimedPrediction?.isDone ?? false),
    pendingLateCursor: pendingLate?.isDone
      ? null
      : (pendingLate?.continueCursor ?? args.progress.pendingLateCursor),
    pendingLateDone:
      args.progress.pendingLateDone || (pendingLate?.isDone ?? false),
    claimedLateCursor: claimedLate?.isDone
      ? null
      : (claimedLate?.continueCursor ?? args.progress.claimedLateCursor),
    claimedLateDone:
      args.progress.claimedLateDone || (claimedLate?.isDone ?? false),
  };
  if (
    !progress.pendingPredictionDone ||
    !progress.claimedPredictionDone ||
    !progress.pendingLateDone ||
    !progress.claimedLateDone
  ) {
    if (
      (!progress.pendingPredictionDone &&
        progress.pendingPredictionCursor === null) ||
      (!progress.claimedPredictionDone &&
        progress.claimedPredictionCursor === null) ||
      (!progress.pendingLateDone && progress.pendingLateCursor === null) ||
      (!progress.claimedLateDone && progress.claimedLateCursor === null)
    ) {
      throw new Error("Schedule work page must provide a continuation cursor");
    }
    await ctx.scheduler.runAfter(0, continueScheduleReconciliationRef, {
      phase: "current",
      userId: args.userId,
      contextFingerprint,
      ...progress,
      candidates: args.candidates,
    });
    return;
  }

  if (!schedulerEnabled()) return;
  const predictionCandidates = await activeCandidates(
    ctx,
    args.candidates.pendingPredictionId,
    args.candidates.claimedPredictionId,
  );
  await reconcileKind(ctx, {
    userId: args.userId,
    kind: "prediction_window",
    enabled:
      predictionWindow?.inAppEnabled === true &&
      current.latestEligibleStartEventId !== undefined,
    localReminderTime: predictionWindow?.localReminderTime,
    reminderWindowVersion: predictionWindow?.reminderWindowVersion,
    snapshot: current.snapshot,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    timeZone,
    pending: predictionCandidates.pending,
    claimed: predictionCandidates.claimed,
    now,
  });
  const lateCandidates = await activeCandidates(
    ctx,
    args.candidates.pendingLateId,
    args.candidates.claimedLateId,
  );
  await reconcileKind(ctx, {
    userId: args.userId,
    kind: "late_boundary",
    enabled: lateStatus?.inAppEnabled === true,
    localReminderTime: lateStatus?.localReminderTime,
    reminderWindowVersion: lateStatus?.reminderWindowVersion,
    snapshot: current.snapshot,
    generation,
    sourceAuthorityVersion: current.sourceAuthorityVersion,
    timeZone,
    pending: lateCandidates.pending,
    claimed: lateCandidates.claimed,
    now,
  });
}

export const continueScheduleReconciliation = internalMutation({
  args: currentScheduleContinuationArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    await reconcileCurrentSchedulePage(ctx, {
      userId: args.userId,
      contextFingerprint: args.contextFingerprint,
      progress: args,
      candidates: args.candidates,
    });
    return null;
  },
});

export async function reconcileUserSchedule(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  await reconcileCurrentSchedulePage(ctx, {
    userId,
    contextFingerprint: null,
    progress: {
      pendingPredictionCursor: null,
      pendingPredictionDone: false,
      claimedPredictionCursor: null,
      claimedPredictionDone: false,
      pendingLateCursor: null,
      pendingLateDone: false,
      claimedLateCursor: null,
      claimedLateDone: false,
    },
    candidates: {
      pendingPredictionId: null,
      claimedPredictionId: null,
      pendingLateId: null,
      claimedLateId: null,
    },
  });
}

function eventForKind(kind: ScheduleKind) {
  return kind === "prediction_window"
    ? {
        eventType: "period_window_approaching.v1" as const,
        purpose: "period_window_approaching" as const,
      }
    : { eventType: "late_status.v1" as const, purpose: "late_status" as const };
}

function isIndeterminateSnapshotRetryDeferred(
  work: Doc<"notificationDueWork">,
  now: number,
): boolean {
  return (
    work.updatedAt > work.createdAt &&
    now - work.updatedAt < INDETERMINATE_SNAPSHOT_RETRY_DELAY_MS
  );
}

export const wakeDueWork = internalMutation({
  args: wakeArgsValidator.fields,
  returns: v.object({
    status: v.union(
      v.literal("stale"),
      v.literal("paused"),
      v.literal("future"),
      v.literal("blocked"),
      v.literal("ready"),
    ),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const work = await ctx.db.get(args.workId);
    if (
      !work ||
      work.state !== "pending" ||
      work.generation !== args.generation ||
      (work.kind !== "prediction_window" && work.kind !== "late_boundary")
    ) {
      return { status: "stale" as const };
    }
    if (!schedulerEnabled()) return { status: "paused" as const };
    const current = await readCurrentServedSnapshot(ctx, work.ownerUserId);
    if (current.status === "indeterminate") {
      if (isIndeterminateSnapshotRetryDeferred(work, Date.now())) {
        return { status: "blocked" as const, reason: "served_snapshot_indeterminate" };
      }
      const now = Date.now();
      await ctx.db.patch(work._id, { updatedAt: now });
      await ctx.scheduler.runAfter(
        INDETERMINATE_SNAPSHOT_RETRY_DELAY_MS,
        wakeWorkRef,
        { workId: work._id, generation: args.generation },
      );
      return { status: "blocked" as const, reason: "served_snapshot_indeterminate" };
    }
    if (
      current.status !== "current" ||
      workGeneration(current.scheduleState.sourceRevision) !== args.generation
    ) {
      await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
      return { status: "stale" as const };
    }
    const { predictionWindow, lateStatus } = await readSchedulePreferences(
      ctx,
      work.ownerUserId,
    );
    const preference =
      work.kind === "prediction_window" ? predictionWindow : lateStatus;
    if (
      !isCurrentNotificationScheduleFence(
        work,
        current.scheduleState,
        preference,
      )
    ) {
      await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
      return { status: "stale" as const };
    }
    const timeZone = resolveCalendarTimeZone(
      current.user.timeZone ?? DEFAULT_TIME_ZONE,
    );
    const currentDueAt =
      preference?.inAppEnabled && preference.localReminderTime
        ? desiredDueAt(
            work.kind,
            current.snapshot,
            preference.localReminderTime,
            timeZone,
          )
        : null;
    const expired = isExpiredLocalDay(
      work.kind,
      current.snapshot,
      timeZone,
      Date.now(),
    );
    if (currentDueAt !== work.dueAt || expired) {
      await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
      return { status: "stale" as const };
    }
    const today = toCalendarDateInTimeZone(new Date(), timeZone);
    if (today < designatedLocalDay(work.kind, current.snapshot)) {
      return { status: "future" as const };
    }
    if (work.dueAt > Date.now()) return { status: "future" as const };

    const definition = eventForKind(work.kind);
    const authorization = authorizeNotificationProjection({
      ...definition,
      channel: "in_app",
      recipientUserId: work.ownerUserId,
      currentRecipientUserId: current.user._id,
      sourceAuthorityVersion: work.sourceAuthorityVersion ?? "",
      currentSourceAuthorityVersion: current.sourceAuthorityVersion,
      expectedGeneration: args.generation,
      currentGeneration: workGeneration(current.scheduleState.sourceRevision),
      purposeEnabled: preference?.inAppEnabled === true,
      flags: {
        projectionEnabled: process.env[PROJECTION_FLAG] === "true",
        deliveryEnabled: process.env[DELIVERY_FLAG] === "true",
      },
    });
    if (!authorization.allowed) {
      await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
      return { status: "blocked" as const, reason: authorization.reason };
    }
    if (work.kind === "prediction_window") {
      if (
        !preference ||
        !Number.isSafeInteger(preference.reminderWindowVersion) ||
        preference.reminderWindowVersion <= 0
      ) {
        await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
        return { status: "stale" as const, reason: "missing_reminder_window_fence" };
      }
      const anchorId = current.latestEligibleStartEventId;
      if (!anchorId) {
        await ctx.db.patch(work._id, { state: "cancelled", updatedAt: Date.now() });
        return { status: "stale" as const, reason: "missing_prediction_anchor" };
      }
      const dueLocalDay = designatedLocalDay("prediction_window", current.snapshot);
      const now = Date.now();
      const event = await ctx.runMutation(
        internal.mutations.notifications.ensureInAppRecords,
        {
          envelope: {
            eventType: "period_window_approaching.v1",
            eventVersion: 1,
            purpose: "period_window_approaching",
            producerKind: "current_served_v2_snapshot",
            sourceReference: `period:${String(anchorId)}`,
            sourceAuthorityVersion: current.sourceAuthorityVersion,
            ownerUserId: work.ownerUserId,
            recipientUserId: work.ownerUserId,
            recipientScope: "primary",
            privacyClass: "primary_private_inferred_health",
            validityRule: "designated_due_local_day_while_snapshot_is_current",
            idempotencyKey: makeEventIdempotencyKey(
              "period_window_approaching.v1",
              {
                primaryId: String(work.ownerUserId),
                latestEligibleStartEventId: String(anchorId),
                sourceAuthorityVersion: current.sourceAuthorityVersion,
                dueLocalDay,
                reminderWindowVersion: String(
                  preference.reminderWindowVersion,
                ),
              },
            ),
            allowedChannel: "in_app",
            sourceIdentity: {
              eventType: "period_window_approaching.v1",
              primaryId: work.ownerUserId,
              latestEligibleStartEventId: anchorId,
              sourceAuthorityVersion: current.sourceAuthorityVersion,
              reminderWindowVersion: preference.reminderWindowVersion,
              dueLocalDay,
            },
          },
          route: "periods",
          templateVersion: "g4-static-v1",
          renderIdentity: {
            templateVersion: "g4-static-v1",
            locale: "en",
            variableSchemaVersion: "g4-no-variables-v1",
            payloadHash: "d011-blocked",
          },
          createdAt: now,
          notBefore: work.dueAt,
          expiresAt: resolveLocalReminderInstant(
            addCalendarDays(dueLocalDay, 1),
            "00:00",
            timeZone,
          ),
        },
      );
      if (event.status === "stale") {
        await ctx.db.patch(work._id, { state: "cancelled", updatedAt: now });
        return { status: "stale" as const, reason: "source_changed_before_insert" };
      }
      if (event.status === "disabled" || event.eventId === null) {
        return { status: "blocked" as const, reason: "outbox_disabled" };
      }
    }
    await ctx.db.patch(work._id, { state: "claimed", updatedAt: Date.now() });
    return { status: "ready" as const };
  },
});

export const reconcileDueWork = internalMutation({
  args: {
    kind: v.optional(
      v.union(v.literal("prediction_window"), v.literal("late_boundary")),
    ),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    if (!schedulerEnabled()) return { scheduled: 0 };
    const now = Date.now();
    let scheduled = 0;
    const kinds: ScheduleKind[] = args.kind
      ? [args.kind]
      : ["prediction_window", "late_boundary"];
    for (const kind of kinds) {
      const page = await ctx.runQuery(
        internal.queries.notifications.getDueWorkByKind,
        {
          kind,
          now,
          limit: DUE_WORK_PAGE_SIZE,
          cursor: args.kind === kind ? (args.cursor ?? null) : null,
        },
      );
      for (const work of page.page) {
        if (isIndeterminateSnapshotRetryDeferred(work, now)) continue;
        await ctx.scheduler.runAt(now, wakeWorkRef, {
          workId: work._id,
          generation: work.generation,
        });
        scheduled += 1;
      }
      if (!page.isDone) {
        if (page.continueCursor === null) {
          throw new Error("Due-work page must provide a continuation cursor");
        }
        await ctx.scheduler.runAfter(
          0,
          reconcileWorkRef,
          { kind, cursor: page.continueCursor },
        );
      }
    }
    return { scheduled };
  },
});
