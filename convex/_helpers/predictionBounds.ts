import { requireValidCalendarDate } from "./calendarDates";
import type { PredictionQualityState } from "./predictionQuality";
import {
  PREDICTION_ESTIMATOR_IDS,
  type PredictionEstimatorId,
} from "./predictionEstimators";

const DEFAULT_LEGACY_GRACE_DAYS = 3;
const PREDICTION_V2_REASON_CODES = [
  "ELEVATED_CALIBRATION_RISK",
  "USER_CONFIGURED_BASELINE",
  "PERSONALIZATION_NOT_APPROVED",
  "LIMITED_HISTORY",
  "INSUFFICIENT_CALIBRATION",
  "SPARSE_HISTORY",
  "RECENT_TIMING_VARIABLE",
  "USER_PAUSED",
  "NO_ELIGIBLE_FACT",
  "INVALID_CONFIGURATION",
  "APPROXIMATE_DATE",
  "LEGACY_UNKNOWN",
  "POSSIBLE_MISSING_LOG",
  "CONTEXT_SEGMENT",
  "RECENT_CORRECTION",
  "PARTNER_ASSISTED",
  "TOMBSTONED",
  "AFTER_CUTOFF",
  "INVALID_DATE",
  "NON_POSITIVE_INTERVAL",
] as const;
const predictionV2ReasonCodeSet = new Set<string>(PREDICTION_V2_REASON_CODES);

export type LegacyPredictionBounds = {
  version: 1;
  source: "legacy_configured";
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
  reason: "LEGACY_UNCALIBRATED_GRACE";
  basisCount: 1;
};

export type PredictionV2ReasonCode =
  (typeof PREDICTION_V2_REASON_CODES)[number];

export type ApprovedPredictionProbabilityLabel = {
  level: 80;
  calibrationStatus: "approved";
  calibrationVersion: string;
};

export type PredictionBoundsV2 = {
  version: 2;
  source: "period_prediction_v2";
  status: "configured" | "personalized" | "limited_evidence";
  pointDate: string;
  earliestDate: string;
  latestDate: string;
  probabilityLabel: ApprovedPredictionProbabilityLabel | null;
  quality: PredictionQualityState;
  basisCount: number;
  estimatorId: PredictionEstimatorId;
  estimatorVersion: number;
  calibrationVersion: string | null;
  reasonCodes: PredictionV2ReasonCode[];
  snapshotId?: string;
};

export type PredictionBounds = LegacyPredictionBounds | PredictionBoundsV2;

export type LegacyPredictionBoundsInput = {
  expectedDate: string;
  graceDays?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseCalendarDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date: string, days: number): string {
  const result = parseCalendarDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    requireValidCalendarDate(value, "Prediction bound date");
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createLegacyPredictionBounds(
  input: LegacyPredictionBoundsInput
): PredictionBounds {
  const graceDays = input.graceDays ?? DEFAULT_LEGACY_GRACE_DAYS;
  if (!isCalendarDate(input.expectedDate)) {
    throw new Error("Expected date must be a valid date");
  }
  if (!Number.isInteger(graceDays) || graceDays < 0) {
    throw new Error("Grace days must be a nonnegative integer");
  }

  return {
    version: 1,
    source: "legacy_configured",
    expectedDate: input.expectedDate,
    earliestDate: input.expectedDate,
    latestDate: addCalendarDays(input.expectedDate, graceDays),
    reason: "LEGACY_UNCALIBRATED_GRACE",
    basisCount: 1,
  };
}

export function isValidPredictionBounds(
  value: unknown
): value is PredictionBounds {
  if (!isRecord(value)) return false;
  if (value.version === 1) {
    if (
      value.source !== "legacy_configured" ||
      value.reason !== "LEGACY_UNCALIBRATED_GRACE" ||
      value.basisCount !== 1
    ) {
      return false;
    }

    const expectedDate = value.expectedDate;
    const earliestDate = value.earliestDate;
    const latestDate = value.latestDate;
    return (
      isCalendarDate(expectedDate) &&
      isCalendarDate(earliestDate) &&
      isCalendarDate(latestDate) &&
      earliestDate <= expectedDate &&
      expectedDate <= latestDate
    );
  }

  const pointDate = value.pointDate;
  const earliestDate = value.earliestDate;
  const latestDate = value.latestDate;
  const calibrationVersion = value.calibrationVersion;
  if (
    value.version !== 2 ||
    value.source !== "period_prediction_v2" ||
    !["configured", "personalized", "limited_evidence"].includes(
      value.status as string,
    ) ||
    !isCalendarDate(pointDate) ||
    !isCalendarDate(earliestDate) ||
    !isCalendarDate(latestDate) ||
    earliestDate > pointDate ||
    pointDate > latestDate ||
    ![
      "high",
      "moderate",
      "low",
      "timing_less_predictable",
      "limited_evidence",
    ].includes(value.quality as string) ||
    !Number.isSafeInteger(value.basisCount) ||
    (value.basisCount as number) < 0 ||
    !PREDICTION_ESTIMATOR_IDS.includes(value.estimatorId as PredictionEstimatorId) ||
    !Number.isSafeInteger(value.estimatorVersion) ||
    (value.estimatorVersion as number) < 1 ||
    !Array.isArray(value.reasonCodes) ||
    !value.reasonCodes.every(
      (reason) =>
        typeof reason === "string" &&
        predictionV2ReasonCodeSet.has(reason),
    ) ||
    new Set(value.reasonCodes).size !== value.reasonCodes.length ||
    (calibrationVersion !== null &&
      (typeof calibrationVersion !== "string" ||
        calibrationVersion.trim().length === 0 ||
        calibrationVersion.length > 128))
  ) {
    return false;
  }

  const probabilityLabel = value.probabilityLabel;
  if (probabilityLabel !== null) {
    if (
      !isRecord(probabilityLabel) ||
      probabilityLabel.level !== 80 ||
      probabilityLabel.calibrationStatus !== "approved" ||
      typeof probabilityLabel.calibrationVersion !== "string" ||
      probabilityLabel.calibrationVersion.trim().length === 0 ||
      probabilityLabel.calibrationVersion.length > 128 ||
      probabilityLabel.calibrationVersion !== calibrationVersion
    ) {
      return false;
    }
  }

  return (
    value.snapshotId === undefined ||
    (typeof value.snapshotId === "string" &&
      value.snapshotId.trim().length > 0 &&
      value.snapshotId.length <= 128)
  );
}

export function predictionPointDate(bounds: PredictionBounds): string {
  return bounds.version === 1 ? bounds.expectedDate : bounds.pointDate;
}

export function daysBetweenCalendarDates(
  startDate: string,
  endDate: string
): number {
  return Math.floor(
    (parseCalendarDate(endDate).getTime() -
      parseCalendarDate(startDate).getTime()) /
      MS_PER_DAY
  );
}
