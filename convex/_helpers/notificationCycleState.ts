import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { toCalendarDateInTimeZone } from "./calendarDates";
import { deriveCycleIntervals } from "./cycleIntervals";
import { readCyclePredictionData } from "./cyclePredictionData";
import { buildCycleReadModel } from "./cycleReadModel";
import { isCycleStateV1ExposedToUser } from "./cycleStateExposure";
import type { CycleState } from "./cycleState";
import type { PredictionBounds } from "./predictionBounds";
import { makeSourceAuthorityVersion } from "./notificationSourceAuthority";
import { isPeriodPredictionV2Enabled } from "./periodPredictionFlag";
import { buildPeriodPrediction } from "./periodPrediction";
import { PREDICTION_CALIBRATION_VERSION } from "./predictionIntervals";
import {
  currentPredictionSnapshotInput,
  predictionFromSnapshot,
  predictionSnapshotMatchesCurrent,
} from "./predictionSnapshotContract";

export type CurrentNotificationCycleState = {
  state: CycleState;
  localDay: string;
  sourceRevision: number;
  sourceAuthorityVersion: string;
  latestEligibleStartEventId?: Id<"periodEvents">;
};

function isSafeRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Reads the primary's current served V2 bounds and reduces them through the
 * shared dashboard cycle model at the supplied instant. Reusing the snapshot's
 * original cutoff lets the local clock cross its bound without a write or a
 * snapshot/dashboard refresh; authoritative input changes still stale the
 * snapshot through the shared contract check. Missing, stale, paused or
 * unavailable V2 bounds are passed as null so the shared reducer fails closed.
 */
export async function readCurrentNotificationCycleState(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  now: number = Date.now(),
): Promise<CurrentNotificationCycleState | null> {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Notification cycle-state time must be a non-negative safe integer");
  }
  if (!isPeriodPredictionV2Enabled()) return null;

  const user = await ctx.db.get(primaryId);
  if (
    !user ||
    user.role !== "primary" ||
    !isCycleStateV1ExposedToUser(user, user)
  ) {
    return null;
  }

  const [predictionData, settings, scheduleState, snapshot] = await Promise.all([
    readCyclePredictionData(ctx, primaryId, user),
    ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", primaryId))
      .unique(),
    ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
      .unique(),
    ctx.db
      .query("predictionSnapshots")
      .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
      .order("desc")
      .first(),
  ]);
  if (!scheduleState || !isSafeRevision(scheduleState.sourceRevision)) {
    return null;
  }

  let predictionBounds: PredictionBounds | null = null;
  let latestEligibleStartEventId: Id<"periodEvents"> | undefined;
  let sourceAuthorityVersion = makeSourceAuthorityVersion({
    sourceRevision: scheduleState.sourceRevision,
    servedCycleContract: "cycle-read-model-v1",
    servedPredictionContract: null,
    estimatorMethodVersion: null,
    calibrationMethodVersion: null,
  });
  if (
    snapshot &&
    snapshot.displayStatus === "visible" &&
    snapshot.featureVersion === "period_prediction_v2" &&
    snapshot.intervalMethodVersion === PREDICTION_CALIBRATION_VERSION
  ) {
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
    const current = currentPredictionSnapshotInput({
      prediction,
      inputCutoffAt: snapshot.inputCutoffAt,
      inputCutoffDate: snapshot.inputCutoffDate,
      periodEvents: predictionData.periodEvents,
      settings,
      activeSegment: predictionData.activeSegment,
    });
    if (predictionSnapshotMatchesCurrent(snapshot, current)) {
      predictionBounds = predictionFromSnapshot(snapshot);
      if (predictionBounds) {
        const latestStartId = servedIntervals.latestEligibleStartEventId;
        latestEligibleStartEventId = latestStartId
          ? ctx.db.normalizeId("periodEvents", latestStartId) ?? undefined
          : undefined;
        sourceAuthorityVersion = makeSourceAuthorityVersion({
          sourceRevision: scheduleState.sourceRevision,
          servedCycleContract: "cycle-read-model-v1",
          servedPredictionContract: "prediction-serving-v2",
          estimatorMethodVersion: `${snapshot.estimatorId}-v${snapshot.estimatorVersion}`,
          calibrationMethodVersion: snapshot.calibrationVersion,
        });
      }
    }
  }

  const localDay = toCalendarDateInTimeZone(
    new Date(now),
    user.timeZone ?? "UTC",
  );
  const readModel = buildCycleReadModel({
    targetDate: localDay,
    timeZone: user.timeZone,
    cycleLength: settings?.cycleLength ?? 28,
    periodLength: settings?.periodLength ?? 5,
    predictionPaused: settings?.predictionPaused ?? false,
    predictionBounds,
    periods: predictionData.periodEvents.map((period) => ({
      id: period._id,
      startDate: period.startDate,
      endDate: period.endDate,
      startCertainty: period.startCertainty,
      endCertainty: period.endCertainty,
      legacyReason: period.legacyReason,
      tombstoneAt: period.tombstoneAt,
    })),
  });

  return {
    state: readModel.cycleStateV1,
    localDay,
    sourceRevision: scheduleState.sourceRevision,
    sourceAuthorityVersion,
    ...(latestEligibleStartEventId ? { latestEligibleStartEventId } : {}),
  };
}
