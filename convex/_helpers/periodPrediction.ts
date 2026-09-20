import { addCalendarDays } from "./cycleCalculations";
import { requireValidCalendarDate } from "./calendarDates";
import type {
  CycleIntervalDerivation,
  CycleIntervalReasonCode,
} from "./cycleIntervals";
import { estimatePredictionCandidate } from "./predictionEstimators";
import {
  buildPredictionIntervals,
  type PredictionIntervalReasonCode,
} from "./predictionIntervals";
import { derivePredictionQuality } from "./predictionQuality";
import {
  createLegacyPredictionBounds,
  type PredictionBoundsV2,
  type PredictionV2ReasonCode,
} from "./predictionBounds";

type InactivePeriodPredictionV2 = {
  version: 2;
  source: "period_prediction_v2";
  status: "paused" | "unavailable";
  pointDate: null;
  earliestDate: null;
  latestDate: null;
  probabilityLabel: null;
  quality: "limited_evidence";
  basisCount: number;
  estimatorId: "configured_v1";
  estimatorVersion: 1;
  calibrationVersion: null;
  reasonCodes: PredictionV2ReasonCode[];
};

export type PeriodPredictionV2 =
  | PredictionBoundsV2
  | InactivePeriodPredictionV2;

export type BuildPeriodPredictionInput = {
  cycleIntervals: CycleIntervalDerivation | null;
  configuredCycleLength: number;
  predictionPaused: boolean;
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function observedSpreadDays(
  intervals: readonly number[],
  configuredCycleLength: number,
): { bufferDays: number; madDays: number } {
  if (intervals.length === 0) return { bufferDays: 0, madDays: 0 };

  const typicalLength = median(intervals);
  const madDays = Math.ceil(
    median(intervals.map((length) => Math.abs(length - typicalLength))),
  );
  return {
    bufferDays: Math.ceil(
      Math.max(madDays, Math.abs(typicalLength - configuredCycleLength)),
    ),
    madDays,
  };
}

function addIntervalReason(
  reasons: Set<PredictionV2ReasonCode>,
  reason: PredictionIntervalReasonCode,
): void {
  switch (reason) {
    case "APPROXIMATE_LEGACY_ADJACENCY":
      reasons.add("APPROXIMATE_DATE");
      break;
    case "CONTEXT_BOUNDARY":
      reasons.add("CONTEXT_SEGMENT");
      break;
    case "INSUFFICIENT_CALIBRATION":
    case "PARTNER_ASSISTED":
    case "POSSIBLE_MISSING_LOG":
    case "RECENT_CORRECTION":
    case "RECENT_TIMING_VARIABLE":
    case "SPARSE_HISTORY":
      reasons.add(reason);
      break;
    case "PERSONAL_RESIDUAL_BLEND":
    case "PERSONAL_RESIDUALS_USED":
      break;
  }
}

function inactivePrediction(
  status: InactivePeriodPredictionV2["status"],
  basisCount: number,
  reasonCodes: PredictionV2ReasonCode[],
): InactivePeriodPredictionV2 {
  return {
    version: 2,
    source: "period_prediction_v2",
    status,
    pointDate: null,
    earliestDate: null,
    latestDate: null,
    probabilityLabel: null,
    quality: "limited_evidence",
    basisCount,
    estimatorId: "configured_v1",
    estimatorVersion: 1,
    calibrationVersion: null,
    reasonCodes: [...new Set(reasonCodes)].sort(),
  };
}

export function buildPeriodPrediction(
  input: BuildPeriodPredictionInput,
): PeriodPredictionV2 {
  const historyCount = input.cycleIntervals?.eligibleIntervalCount ?? 0;
  if (input.predictionPaused) {
    return inactivePrediction("paused", historyCount, ["USER_PAUSED"]);
  }

  const latestStartDate = input.cycleIntervals?.latestEligibleStartDate;
  if (!latestStartDate) {
    return inactivePrediction("unavailable", historyCount, [
      ...(input.cycleIntervals?.reasonCodes ?? []),
      "NO_ELIGIBLE_FACT",
    ]);
  }

  let estimate: ReturnType<typeof estimatePredictionCandidate>;
  let pointDate: string;
  try {
    estimate = estimatePredictionCandidate("configured_v1", {
      configuredCycleLength: input.configuredCycleLength,
      intervalsOldestToNewest:
        input.cycleIntervals?.intervals
          .filter((interval) => interval.included)
          .map((interval) => interval.lengthDays) ?? [],
    });
  } catch {
    return inactivePrediction("unavailable", historyCount, [
      "INVALID_CONFIGURATION",
    ]);
  }

  try {
    pointDate = addCalendarDays(latestStartDate, estimate.pointCycleLength);
    requireValidCalendarDate(pointDate, "Prediction point date");
  } catch {
    return inactivePrediction("unavailable", historyCount, ["INVALID_DATE"]);
  }

  const intervalReasonCodes = new Set<CycleIntervalReasonCode>(
    input.cycleIntervals?.reasonCodes ?? [],
  );
  const { bufferDays, madDays } = observedSpreadDays(
    input.cycleIntervals?.intervals
      .filter((interval) => interval.included)
      .map((interval) => interval.lengthDays) ?? [],
    estimate.pointCycleLength,
  );
  let intervalResult: ReturnType<typeof buildPredictionIntervals>;
  let earliestDate: string;
  let latestDate: string;
  try {
    intervalResult = buildPredictionIntervals({
      pointDate,
      variabilityBand: "unavailable",
      historyCount,
      calibrationResiduals: [],
      personalResiduals: [],
      approvedTargetCoverageLevel: null,
      context: {
        possibleMissingLog: intervalReasonCodes.has("POSSIBLE_MISSING_LOG"),
        partnerAssisted: intervalReasonCodes.has("PARTNER_ASSISTED"),
        recentCorrection: intervalReasonCodes.has("RECENT_CORRECTION"),
        segmentBoundary: intervalReasonCodes.has("CONTEXT_SEGMENT"),
      },
    });

    // ponytail: personal dispersion and baseline drift only widen; freeze cohort bands after D-013 approval.
    const configuredGrace = createLegacyPredictionBounds({
      expectedDate: pointDate,
    });
    const lowerBound =
      intervalResult.window80.earliestDate < configuredGrace.earliestDate
        ? intervalResult.window80.earliestDate
        : configuredGrace.earliestDate;
    const upperBound =
      intervalResult.window80.latestDate > configuredGrace.latestDate
        ? intervalResult.window80.latestDate
        : configuredGrace.latestDate;
    earliestDate = addCalendarDays(lowerBound, -bufferDays);
    latestDate = addCalendarDays(upperBound, bufferDays);
    requireValidCalendarDate(earliestDate, "Prediction earliest date");
    requireValidCalendarDate(latestDate, "Prediction latest date");
  } catch {
    return inactivePrediction("unavailable", historyCount, ["INVALID_DATE"]);
  }

  const quality = derivePredictionQuality({
    calibrationRiskDecile: null,
    calibrationOutcomeCount: 0,
    historyCount,
    variabilityBand: "unavailable",
    observedSpreadDays: madDays,
  });
  const reasonCodes = new Set<PredictionV2ReasonCode>([
    ...estimate.reasonCodes,
    ...quality.reasonCodes,
    ...input.cycleIntervals!.reasonCodes,
  ]);
  for (const reason of intervalResult.reasonCodes) {
    addIntervalReason(reasonCodes, reason);
  }
  if (historyCount >= 3) reasonCodes.add("PERSONALIZATION_NOT_APPROVED");

  const status = historyCount < 3 ? "configured" : "limited_evidence";
  return {
    version: 2,
    source: "period_prediction_v2",
    status,
    pointDate,
    earliestDate,
    latestDate,
    probabilityLabel: null,
    quality: quality.quality,
    basisCount: historyCount,
    estimatorId: estimate.estimatorId,
    estimatorVersion: estimate.estimatorVersion,
    calibrationVersion: null,
    reasonCodes: [...reasonCodes].sort(),
  };
}
