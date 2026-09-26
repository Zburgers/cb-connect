import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  PREDICTION_ESTIMATOR_IDS,
  type PredictionEstimatorId,
} from "./predictionEstimators";
import { PREDICTION_CALIBRATION_VERSION } from "./predictionIntervals";
import type { PeriodPredictionV2 } from "./periodPrediction";
import type { PredictionBoundsV2 } from "./predictionBounds";

export const DEFAULT_PREDICTION_SEGMENT_REF =
  "default_all_history_v1" as const;
export const PREDICTION_SNAPSHOT_FEATURE_VERSION = "period_prediction_v2";
export type PredictionSegmentRef =
  | Id<"cyclePredictionSegments">
  | typeof DEFAULT_PREDICTION_SEGMENT_REF;

export type CurrentPredictionSnapshotInput = {
  prediction: PeriodPredictionV2;
  inputCutoffAt: number;
  inputCutoffDate: string;
  latestInputUpdatedAt: number;
  predictionSegmentId: PredictionSegmentRef;
};

export function currentPredictionSnapshotInput(args: {
  prediction: PeriodPredictionV2;
  inputCutoffAt: number;
  inputCutoffDate: string;
  periodEvents: readonly Doc<"periodEvents">[];
  settings: Doc<"cycleSettings"> | null;
  activeSegment: Doc<"cyclePredictionSegments"> | null;
}): CurrentPredictionSnapshotInput {
  const latestInputUpdatedAt = args.periodEvents.reduce(
    (latest, event) => Math.max(latest, event.updatedAt),
    Math.max(
      args.settings?.lastUpdatedAt ?? 0,
      args.activeSegment?.createdAt ?? 0,
      args.activeSegment?.supersededAt ?? 0,
    ),
  );
  return {
    prediction: args.prediction,
    inputCutoffAt: args.inputCutoffAt,
    inputCutoffDate: args.inputCutoffDate,
    latestInputUpdatedAt,
    predictionSegmentId:
      args.activeSegment?._id ?? DEFAULT_PREDICTION_SEGMENT_REF,
  };
}

export function predictionSnapshotMatchesCurrent(
  snapshot: Doc<"predictionSnapshots">,
  current: CurrentPredictionSnapshotInput,
): boolean {
  const prediction = current.prediction;
  if (
    prediction.pointDate === null ||
    snapshot.displayStatus !== "visible" ||
    snapshot.contractVersion !== 2 ||
    snapshot.featureVersion !== PREDICTION_SNAPSHOT_FEATURE_VERSION ||
    snapshot.intervalMethodVersion !== PREDICTION_CALIBRATION_VERSION ||
    snapshot.inputCutoffAt < current.latestInputUpdatedAt ||
    snapshot.inputCutoffAt > current.inputCutoffAt ||
    snapshot.inputCutoffDate !== current.inputCutoffDate ||
    snapshot.predictionSegmentId !== current.predictionSegmentId
  ) {
    return false;
  }

  return (
    snapshot.status === prediction.status &&
    snapshot.pointDate === prediction.pointDate &&
    snapshot.earliestDate === prediction.earliestDate &&
    snapshot.latestDate === prediction.latestDate &&
    JSON.stringify(snapshot.probabilityLabel) ===
      JSON.stringify(prediction.probabilityLabel) &&
    snapshot.quality === prediction.quality &&
    snapshot.basisCount === prediction.basisCount &&
    snapshot.estimatorId === prediction.estimatorId &&
    snapshot.estimatorVersion === prediction.estimatorVersion &&
    snapshot.calibrationVersion === prediction.calibrationVersion &&
    JSON.stringify(snapshot.reasonCodes) ===
      JSON.stringify(prediction.reasonCodes)
  );
}

export async function readServedPeriodPrediction(
  ctx: QueryCtx,
  userId: Id<"users">,
  current: CurrentPredictionSnapshotInput,
): Promise<PeriodPredictionV2 | null> {
  if (current.prediction.pointDate === null) return current.prediction;
  const snapshot = await ctx.db
    .query("predictionSnapshots")
    .withIndex("by_user_and_generated_at", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (!snapshot || !predictionSnapshotMatchesCurrent(snapshot, current)) {
    return null;
  }
  return predictionFromSnapshot(snapshot);
}

export function predictionFromSnapshot(
  snapshot: Doc<"predictionSnapshots">,
): PredictionBoundsV2 | null {
  const estimatorId = PREDICTION_ESTIMATOR_IDS.find(
    (candidate) => candidate === snapshot.estimatorId,
  ) as PredictionEstimatorId | undefined;
  if (
    !estimatorId ||
    snapshot.contractVersion !== 2 ||
    snapshot.displayStatus !== "visible"
  ) {
    return null;
  }

  return {
    version: 2,
    source: "period_prediction_v2",
    status: snapshot.status,
    pointDate: snapshot.pointDate,
    earliestDate: snapshot.earliestDate,
    latestDate: snapshot.latestDate,
    probabilityLabel: snapshot.probabilityLabel,
    quality: snapshot.quality,
    basisCount: snapshot.basisCount,
    estimatorId,
    estimatorVersion: snapshot.estimatorVersion,
    calibrationVersion: snapshot.calibrationVersion,
    reasonCodes: snapshot.reasonCodes,
    snapshotId: snapshot._id,
  };
}
