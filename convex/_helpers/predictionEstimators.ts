export const PREDICTION_ESTIMATOR_IDS = [
  "configured_v1",
  "all_mean_v1",
  "all_median_v1",
  "last3_mean_v1",
  "last3_median_v1",
  "recency_exp_h3_v1",
] as const;

export type PredictionEstimatorId = (typeof PREDICTION_ESTIMATOR_IDS)[number];

export const PROMOTION_CANDIDATE_ESTIMATOR_IDS = [
  "all_mean_v1",
  "last3_mean_v1",
  "last3_median_v1",
  "recency_exp_h3_v1",
] as const satisfies readonly PredictionEstimatorId[];

export type PromotionCandidateEstimatorId =
  (typeof PROMOTION_CANDIDATE_ESTIMATOR_IDS)[number];

export type PredictionEstimatorReasonCode =
  | "LIMITED_HISTORY"
  | "USER_CONFIGURED_BASELINE";

export type PredictionEstimatorInput = {
  configuredCycleLength: number;
  intervalsOldestToNewest: readonly number[];
};

export type PredictionEstimatorResult = {
  estimatorId: PredictionEstimatorId;
  estimatorVersion: 1;
  pointCycleLength: number;
  basisCount: number;
  personalizationEligible: boolean;
  reasonCodes: PredictionEstimatorReasonCode[];
};

const MIN_PERSONALIZED_INTERVALS = 3;

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

function mean(values: readonly number[]): number {
  return roundHalfUp(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  return roundHalfUp(value);
}

function recencyWeightedMean(values: readonly number[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const age = values.length - 1 - index;
    const weight = 2 ** (-age / 3);
    weightedSum += values[index] * weight;
    weightSum += weight;
  }
  return roundHalfUp(weightedSum / weightSum);
}

export function estimatePredictionCandidate(
  estimatorId: PredictionEstimatorId,
  input: PredictionEstimatorInput,
): PredictionEstimatorResult {
  if (
    !Number.isFinite(input.configuredCycleLength) ||
    input.configuredCycleLength < 21 ||
    input.configuredCycleLength > 40
  ) {
    throw new Error("Configured cycle length must be between 21 and 40 days");
  }
  if (
    input.intervalsOldestToNewest.some(
      (interval) => !Number.isSafeInteger(interval) || interval <= 0,
    )
  ) {
    throw new Error("Cycle intervals must be positive whole days");
  }

  const intervals = input.intervalsOldestToNewest;
  const recentThree = intervals.slice(-3);
  const reasonCodes: PredictionEstimatorReasonCode[] = [];
  const personalizationEligible =
    estimatorId !== "configured_v1" &&
    intervals.length >= MIN_PERSONALIZED_INTERVALS;
  let pointCycleLength = input.configuredCycleLength;
  let basisCount = 0;

  if (estimatorId === "configured_v1") {
    reasonCodes.push("USER_CONFIGURED_BASELINE");
  } else {
    const basis =
      estimatorId === "last3_mean_v1" || estimatorId === "last3_median_v1"
        ? recentThree
        : intervals;
    basisCount = basis.length;

    if (basis.length === 0) {
      reasonCodes.push("USER_CONFIGURED_BASELINE");
    } else if (
      estimatorId === "all_mean_v1" ||
      estimatorId === "last3_mean_v1"
    ) {
      pointCycleLength = mean(basis);
    } else if (
      estimatorId === "all_median_v1" ||
      estimatorId === "last3_median_v1"
    ) {
      pointCycleLength = median(basis);
    } else {
      pointCycleLength = recencyWeightedMean(basis);
    }
  }

  if (intervals.length < MIN_PERSONALIZED_INTERVALS) {
    reasonCodes.unshift("LIMITED_HISTORY");
  }

  return {
    estimatorId,
    estimatorVersion: 1,
    pointCycleLength,
    basisCount,
    personalizationEligible,
    reasonCodes,
  };
}
