import {
  MIN_CALIBRATION_RESIDUALS,
  type PredictionVariability,
} from "./predictionIntervals";

export type PredictionQualityState =
  | "high"
  | "moderate"
  | "low"
  | "timing_less_predictable"
  | "limited_evidence";

export type PredictionQualityReasonCode =
  | "ELEVATED_CALIBRATION_RISK"
  | "INSUFFICIENT_CALIBRATION"
  | "RECENT_TIMING_VARIABLE"
  | "SPARSE_HISTORY";

export type PredictionQuality = {
  quality: PredictionQualityState;
  qualityScoreV1: number | null;
  reasonCodes: PredictionQualityReasonCode[];
};

export type DerivePredictionQualityInput = {
  calibrationRiskDecile: number | null;
  calibrationOutcomeCount: number;
  historyCount: number;
  variabilityBand: PredictionVariability;
};

export function derivePredictionQuality(
  input: DerivePredictionQualityInput,
): PredictionQuality {
  if (
    !Number.isSafeInteger(input.calibrationOutcomeCount) ||
    input.calibrationOutcomeCount < 0 ||
    !Number.isSafeInteger(input.historyCount) ||
    input.historyCount < 0 ||
    (input.calibrationRiskDecile !== null &&
      (!Number.isInteger(input.calibrationRiskDecile) ||
        input.calibrationRiskDecile < 0 ||
        input.calibrationRiskDecile > 9))
  ) {
    throw new Error("Prediction calibration quality inputs are invalid");
  }

  const reasonCodes = new Set<PredictionQualityReasonCode>();
  if (input.historyCount < 3) reasonCodes.add("SPARSE_HISTORY");
  if (
    input.calibrationOutcomeCount < MIN_CALIBRATION_RESIDUALS ||
    input.calibrationRiskDecile === null ||
    input.historyCount < 3
  ) {
    reasonCodes.add("INSUFFICIENT_CALIBRATION");
    return {
      quality: "limited_evidence",
      qualityScoreV1: null,
      reasonCodes: [...reasonCodes].sort(),
    };
  }

  const qualityScoreV1 = 100 - input.calibrationRiskDecile * 10;
  if (input.variabilityBand === "high") {
    reasonCodes.add("RECENT_TIMING_VARIABLE");
    return {
      quality: "timing_less_predictable",
      qualityScoreV1,
      reasonCodes: [...reasonCodes].sort(),
    };
  }

  const quality = input.calibrationRiskDecile <= 1
    ? "high"
    : input.calibrationRiskDecile <= 5
      ? "moderate"
      : "low";
  if (input.calibrationRiskDecile >= 6) {
    reasonCodes.add("ELEVATED_CALIBRATION_RISK");
  }
  return {
    quality,
    qualityScoreV1,
    reasonCodes: [...reasonCodes].sort(),
  };
}
