import { addCalendarDays } from "./cycleCalculations";
import { requireValidCalendarDate } from "./calendarDates";

export const PREDICTION_CALIBRATION_VERSION =
  "empirical-residual-quantiles-v1" as const;
export const MIN_CALIBRATION_RESIDUALS = 20;
export const MIN_PERSONAL_RESIDUALS = 5;

export type PredictionVariabilityBand = "stable" | "moderate" | "high";
export type PredictionVariability = PredictionVariabilityBand | "unavailable";
export type PredictionCalibrationSource =
  | "calibration_partition"
  | "calibration_and_personal"
  | "personal_walk_forward"
  | "none";
export type PredictionIntervalReasonCode =
  | "APPROXIMATE_LEGACY_ADJACENCY"
  | "CONTEXT_BOUNDARY"
  | "INSUFFICIENT_CALIBRATION"
  | "PARTNER_ASSISTED"
  | "POSSIBLE_MISSING_LOG"
  | "PERSONAL_RESIDUAL_BLEND"
  | "PERSONAL_RESIDUALS_USED"
  | "RECENT_CORRECTION"
  | "RECENT_TIMING_VARIABLE"
  | "SPARSE_HISTORY";

export type PredictionDateWindow = {
  earliestDate: string;
  pointDate: string;
  latestDate: string;
};

export type PredictionIntervals = {
  window50: PredictionDateWindow;
  window80: PredictionDateWindow;
  calibrationSource: PredictionCalibrationSource;
  calibrationVersion: typeof PREDICTION_CALIBRATION_VERSION;
  calibrationOutcomeCount: number;
  personalResidualCount: number;
  empiricalTargetCoverageLevel: 80 | null;
  reasonCodes: PredictionIntervalReasonCode[];
};

export type BuildPredictionIntervalsInput = {
  pointDate: string;
  variabilityBand: PredictionVariability;
  historyCount?: number;
  context?: {
    approximateLegacyAdjacent?: boolean;
    partnerAssisted?: boolean;
    possibleMissingLog?: boolean;
    recentCorrection?: boolean;
    segmentBoundary?: boolean;
  };
  /** Residuals are target start date minus walk-forward point date, in days. */
  calibrationResiduals: readonly number[];
  calibrationResidualsByVariability?: Partial<
    Record<PredictionVariabilityBand, readonly number[]>
  >;
  personalResiduals?: readonly number[];
  approvedTargetCoverageLevel?: 80 | null;
};

type DayOffsets = { lower: number; upper: number };

const MIN_PERSONAL_BLEND_COUNT = MIN_PERSONAL_RESIDUALS;
const CALIBRATION_TAILS = {
  50: [0.25, 0.75],
  80: [0.1, 0.9],
} as const;

function requireResiduals(values: readonly number[], label: string): void {
  if (values.some((value) => !Number.isSafeInteger(value))) {
    throw new Error(`${label} must contain whole-day residuals`);
  }
}

function quantile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  return sorted[lowerIndex] +
    (sorted[Math.min(lowerIndex + 1, sorted.length - 1)] - sorted[lowerIndex]) *
      fraction;
}

function rawOffsets(values: readonly number[], coverage: 50 | 80): DayOffsets {
  const [lowerProbability, upperProbability] = CALIBRATION_TAILS[coverage];
  return {
    lower: Math.min(0, Math.floor(quantile(values, lowerProbability))),
    upper: Math.max(0, Math.ceil(quantile(values, upperProbability))),
  };
}

function mixOffsets(
  calibration: DayOffsets,
  personal: DayOffsets,
  personalCount: number,
): DayOffsets {
  const personalWeight = personalCount / (personalCount + 10);
  return {
    lower:
      calibration.lower * (1 - personalWeight) +
      personal.lower * personalWeight,
    upper:
      calibration.upper * (1 - personalWeight) +
      personal.upper * personalWeight,
  };
}

function dateWindow(pointDate: string, offsets: DayOffsets): PredictionDateWindow {
  const lower = Math.min(0, Math.floor(offsets.lower));
  const upper = Math.max(0, Math.ceil(offsets.upper));
  return {
    earliestDate: addCalendarDays(pointDate, lower),
    pointDate,
    latestDate: addCalendarDays(pointDate, upper),
  };
}

function calibrationForBand(
  input: BuildPredictionIntervalsInput,
): { residuals: readonly number[]; outcomeCount: number } | null {
  const bandResiduals =
    input.variabilityBand === "unavailable"
      ? undefined
      : input.calibrationResidualsByVariability?.[input.variabilityBand];
  if (bandResiduals && bandResiduals.length >= MIN_CALIBRATION_RESIDUALS) {
    return { residuals: bandResiduals, outcomeCount: bandResiduals.length };
  }
  if (input.calibrationResiduals.length >= MIN_CALIBRATION_RESIDUALS) {
    return {
      residuals: input.calibrationResiduals,
      outcomeCount: input.calibrationResiduals.length,
    };
  }
  return null;
}

function riskEnvelope(
  band: PredictionVariability,
  calibrationResidualsByVariability: BuildPredictionIntervalsInput["calibrationResidualsByVariability"],
  coverage: 50 | 80,
): DayOffsets {
  const offsets: DayOffsets = { lower: 0, upper: 0 };
  if (!calibrationResidualsByVariability || band === "unavailable") return offsets;

  const precedingBands: PredictionVariabilityBand[] =
    band === "moderate" ? ["stable"] : band === "high" ? ["stable", "moderate"] : [];
  for (const precedingBand of precedingBands) {
    const residuals = calibrationResidualsByVariability[precedingBand];
    if (residuals && residuals.length >= MIN_CALIBRATION_RESIDUALS) {
      const prior = rawOffsets(residuals, coverage);
      offsets.lower = Math.min(offsets.lower, prior.lower);
      offsets.upper = Math.max(offsets.upper, prior.upper);
    }
  }
  return offsets;
}

export function buildPredictionIntervals(
  input: BuildPredictionIntervalsInput,
): PredictionIntervals {
  requireValidCalendarDate(input.pointDate, "Prediction point date");
  requireResiduals(input.calibrationResiduals, "Calibration residuals");
  const personalResiduals = input.personalResiduals ?? [];
  requireResiduals(personalResiduals, "Personal residuals");
  for (const band of ["stable", "moderate", "high"] as const) {
    requireResiduals(
      input.calibrationResidualsByVariability?.[band] ?? [],
      `${band} calibration residuals`,
    );
  }
  if (
    input.approvedTargetCoverageLevel !== undefined &&
    input.approvedTargetCoverageLevel !== null &&
    input.approvedTargetCoverageLevel !== 80
  ) {
    throw new Error("Only the preregistered 80% target is supported");
  }

  const calibration = calibrationForBand(input);
  const personalUsable = personalResiduals.length >= MIN_PERSONAL_BLEND_COUNT;
  const source: PredictionCalibrationSource = calibration
    ? personalUsable
      ? "calibration_and_personal"
      : "calibration_partition"
    : personalUsable
      ? "personal_walk_forward"
      : "none";
  const reasonCodes = new Set<PredictionIntervalReasonCode>();
  if (input.variabilityBand === "high") reasonCodes.add("RECENT_TIMING_VARIABLE");
  if (input.historyCount !== undefined && input.historyCount < 3) {
    reasonCodes.add("SPARSE_HISTORY");
  }
  if (input.context?.approximateLegacyAdjacent) {
    reasonCodes.add("APPROXIMATE_LEGACY_ADJACENCY");
  }
  if (input.context?.partnerAssisted) reasonCodes.add("PARTNER_ASSISTED");
  if (input.context?.possibleMissingLog) reasonCodes.add("POSSIBLE_MISSING_LOG");
  if (input.context?.recentCorrection) reasonCodes.add("RECENT_CORRECTION");
  if (input.context?.segmentBoundary) reasonCodes.add("CONTEXT_BOUNDARY");
  if (!calibration) reasonCodes.add("INSUFFICIENT_CALIBRATION");
  if (personalUsable) {
    reasonCodes.add(
      calibration ? "PERSONAL_RESIDUAL_BLEND" : "PERSONAL_RESIDUALS_USED",
    );
  }

  const offsets = (coverage: 50 | 80): DayOffsets => {
    const calibrated = calibration
      ? rawOffsets(calibration.residuals, coverage)
      : null;
    const personal = personalUsable ? rawOffsets(personalResiduals, coverage) : null;
    let result = !calibration && !personalUsable
      ? { lower: 0, upper: 0 }
      : calibrated && personal
        ? mixOffsets(calibrated, personal, personalResiduals.length)
        : calibrated ?? personal ?? { lower: 0, upper: 0 };

    if (calibration) {
      const floor = riskEnvelope(
        input.variabilityBand,
        input.calibrationResidualsByVariability,
        coverage,
      );
      result = {
        lower: Math.min(result.lower, floor.lower),
        upper: Math.max(result.upper, floor.upper),
      };
    }
    const contextWideningDays =
      Number(input.historyCount !== undefined && input.historyCount < 3) +
      Number(input.context?.approximateLegacyAdjacent === true) +
      Number(input.context?.possibleMissingLog === true) +
      Number(input.context?.recentCorrection === true) +
      Number(input.context?.segmentBoundary === true);
    // ponytail: one day per risk flag is a conservative heuristic; stratify residuals when cohorts grow.
    result = {
      lower: result.lower - contextWideningDays,
      upper: result.upper + contextWideningDays,
    };
    return result;
  };

  const window50Offsets = offsets(50);
  const window80Offsets = offsets(80);
  const window80 = {
    lower: Math.min(window80Offsets.lower, window50Offsets.lower),
    upper: Math.max(window80Offsets.upper, window50Offsets.upper),
  };
  const coverageLevel = input.approvedTargetCoverageLevel === 80 && calibration
    ? 80
    : null;

  return {
    window50: dateWindow(input.pointDate, window50Offsets),
    window80: dateWindow(input.pointDate, window80),
    calibrationSource: source,
    calibrationVersion: PREDICTION_CALIBRATION_VERSION,
    calibrationOutcomeCount: calibration?.outcomeCount ?? 0,
    personalResidualCount: personalResiduals.length,
    empiricalTargetCoverageLevel: coverageLevel,
    reasonCodes: [...reasonCodes].sort(),
  };
}
