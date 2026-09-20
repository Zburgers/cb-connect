import type { PeriodPredictionV2 } from "@/convex/_helpers/periodPrediction";
import type { PredictionV2ReasonCode } from "@/convex/_helpers/predictionBounds";

export type PredictionPresentation = {
  status: "active" | "paused" | "unavailable";
  statusLabel: string;
  qualityLabel: string;
  pointText: string | null;
  rangeLabel: string | null;
  rangeText: string | null;
  basisText: string | null;
  explanations: string[];
};

const QUALITY_LABELS = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  timing_less_predictable: "Timing less predictable",
  limited_evidence: "Limited evidence",
} as const;

const REASON_COPY: Partial<Record<PredictionV2ReasonCode, string>> = {
  ELEVATED_CALIBRATION_RISK: "Past estimates have varied more than expected.",
  USER_CONFIGURED_BASELINE: "Uses the cycle length you set.",
  PERSONALIZATION_NOT_APPROVED:
    "A personalized estimate is not available for this history yet.",
  LIMITED_HISTORY: "There is limited eligible cycle history.",
  INSUFFICIENT_CALIBRATION:
    "A calibrated probability range is not available yet.",
  SPARSE_HISTORY: "There are only a few eligible intervals.",
  RECENT_TIMING_VARIABLE:
    "Recent cycle timing has varied, so the range is wider.",
  USER_PAUSED: "Predictions are paused in Settings.",
  NO_ELIGIBLE_FACT:
    "Record an exact period start to get an estimated range.",
  INVALID_CONFIGURATION:
    "Check your cycle settings before using an estimated range.",
  APPROXIMATE_DATE: "Some recorded dates are approximate.",
  LEGACY_UNKNOWN: "Some older dates lack confirmation details.",
  POSSIBLE_MISSING_LOG:
    "A long recorded gap may include an unlogged period; it stays in the history and widens the range.",
  CONTEXT_SEGMENT: "Uses the private prediction baseline you chose.",
  RECENT_CORRECTION: "A recent date correction makes timing less certain.",
  PARTNER_ASSISTED: "Includes a period start recorded with your partner's help.",
  TOMBSTONED: "Removed period records are excluded.",
  INVALID_DATE: "Review the dates in your period log before continuing.",
  NON_POSITIVE_INTERVAL: "Some recorded dates do not form a usable interval.",
};

export function formatPredictionCalendarDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (date.toISOString().slice(0, 10) !== value) return null;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateRange(startDate: string, endDate: string): string | null {
  const start = formatPredictionCalendarDate(startDate);
  const end = formatPredictionCalendarDate(endDate);
  if (!start || !end) return null;
  return start === end ? start : `${start}–${end}`;
}

function hasApprovedProbabilityLabel(
  prediction: Pick<PeriodPredictionV2, "probabilityLabel" | "calibrationVersion">,
): boolean {
  const label = prediction.probabilityLabel;
  return (
    label?.level === 80 &&
    label.calibrationStatus === "approved" &&
    typeof prediction.calibrationVersion === "string" &&
    prediction.calibrationVersion.trim().length > 0 &&
    label.calibrationVersion === prediction.calibrationVersion
  );
}

function basisText(basisCount: number): string {
  if (!Number.isSafeInteger(basisCount) || basisCount <= 0) {
    return "No eligible intervals yet; this uses the cycle length in Settings.";
  }
  return `Based on ${basisCount} eligible start-to-start interval${basisCount === 1 ? "" : "s"}.`;
}

function explanationsFor(
  reasonCodes: readonly PredictionV2ReasonCode[],
): string[] {
  return [...new Set(reasonCodes.flatMap((reason) =>
    REASON_COPY[reason] ? [REASON_COPY[reason]!] : [],
  ))];
}

export function getPredictionPresentation(
  prediction: PeriodPredictionV2,
): PredictionPresentation {
  if (prediction.status === "paused") {
    return {
      status: "paused",
      statusLabel: "Predictions are paused",
      qualityLabel: "Prediction paused",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      basisText: null,
      explanations: explanationsFor(prediction.reasonCodes),
    };
  }

  if (prediction.status === "unavailable") {
    return {
      status: "unavailable",
      statusLabel: "No estimated range yet",
      qualityLabel: "Limited evidence",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      basisText: null,
      explanations: explanationsFor(prediction.reasonCodes),
    };
  }

  if (
    prediction.pointDate === null ||
    prediction.earliestDate === null ||
    prediction.latestDate === null
  ) {
    return {
      status: "unavailable",
      statusLabel: "No estimated range yet",
      qualityLabel: "Limited evidence",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      basisText: null,
      explanations: ["Review the dates in your period log before continuing."],
    };
  }

  const point = formatPredictionCalendarDate(prediction.pointDate);
  const range = formatDateRange(prediction.earliestDate, prediction.latestDate);
  if (!point || !range) {
    return {
      status: "unavailable",
      statusLabel: "No estimated range yet",
      qualityLabel: "Limited evidence",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      basisText: null,
      explanations: ["Review the dates in your period log before continuing."],
    };
  }

  return {
    status: "active",
    statusLabel: "Period timing estimate",
    qualityLabel: QUALITY_LABELS[prediction.quality],
    pointText: `Estimated around ${point}`,
    rangeLabel: hasApprovedProbabilityLabel(prediction)
      ? "80% likely range"
      : "Estimated range",
    rangeText: range,
    basisText: basisText(prediction.basisCount),
    explanations: explanationsFor(prediction.reasonCodes),
  };
}
