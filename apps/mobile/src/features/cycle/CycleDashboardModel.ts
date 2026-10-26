import type {
  CycleCapabilities,
  CycleStateV1,
  PartnerPredictionV2,
  PrimaryPredictionV2,
  PredictionV2ReasonCode,
} from "@cb-connect/contracts";

export type CycleDashboardData = {
  hasData: boolean;
  isPartnerView: boolean;
  message?: string;
  cycleStateV1: CycleStateV1 | null;
  cycleStateV1Exposed: boolean;
  periodPredictionV2?: PrimaryPredictionV2;
  partnerPredictionV2?: PartnerPredictionV2;
  partnerPredictionV2Exposed: boolean;
};

export type CycleCard = {
  status: string;
  title: string;
  details: string[];
  disclaimer?: string;
};

export type CycleDashboardPresentation = {
  role: "primary" | "partner";
  message: string;
  state: CycleCard | null;
  prediction: CycleCard | null;
};

const phaseLabels = {
  menstruation: "Menstruation",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
} as const;

const qualityLabels = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  timing_less_predictable: "Timing less predictable",
  limited_evidence: "Limited evidence",
} as const;

const reasonCopy: Partial<Record<PredictionV2ReasonCode, string>> = {
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
  NO_ELIGIBLE_FACT: "Record an exact period start to get an estimated range.",
  INVALID_CONFIGURATION:
    "Check your cycle settings before using an estimated range.",
  APPROXIMATE_DATE: "Some recorded dates are approximate.",
  LEGACY_UNKNOWN: "Some older dates lack confirmation details.",
  POSSIBLE_MISSING_LOG:
    "A long recorded gap may include an unlogged period; it stays in the history and widens the range.",
  CONTEXT_SEGMENT: "Uses the private prediction baseline you chose.",
  RECENT_CORRECTION: "A recent date correction makes timing less certain.",
  PARTNER_ASSISTED:
    "Includes a period start recorded with your partner's help.",
  TOMBSTONED: "Removed period records are excluded.",
  INVALID_DATE: "Review the dates in your period log before continuing.",
  NON_POSITIVE_INTERVAL: "Some recorded dates do not form a usable interval.",
};

export function formatCycleCalendarDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dateRange(start: string, end: string): string | null {
  if (start > end) return null;
  const formattedStart = formatCycleCalendarDate(start);
  const formattedEnd = formatCycleCalendarDate(end);
  if (!formattedStart || !formattedEnd) return null;
  return formattedStart === formattedEnd
    ? formattedStart
    : `${formattedStart}–${formattedEnd}`;
}

function cycleStateCard(state: CycleStateV1): CycleCard {
  switch (state.status) {
    case "recorded_period":
      return {
        status: "Recorded",
        title: "Menstruation recorded today",
        details: [`Cycle day ${state.cycleDay}`],
      };
    case "estimated": {
      const bounds = state.bounds;
      const range = dateRange(bounds.earliestDate, bounds.latestDate);
      return {
        status: "Calendar estimate",
        title: `${phaseLabels[state.phase]} · cycle day ${state.cycleDay}`,
        details: [
          "This phase is a calendar estimate.",
          ...(range ? [`Estimated period window: ${range}`] : []),
        ],
        ...(state.phase === "ovulation"
          ? {
              disclaimer:
                "Calendar timing is an estimate and does not confirm ovulation.",
            }
          : {}),
      };
    }
    case "late_or_uncertain": {
      const range = dateRange(
        state.bounds.earliestDate,
        state.bounds.latestDate,
      );
      return {
        status: "Late",
        title: "Timing is uncertain",
        details: [
          "The current calendar estimate has passed.",
          ...(range ? [`Estimated period window: ${range}`] : []),
        ],
      };
    }
    case "insufficient_data":
      return {
        status: "Unknown",
        title: "Not enough information",
        details: ["There is not enough information for a phase estimate."],
      };
    case "prediction_paused":
      return {
        status: "Prediction paused",
        title: "Calendar estimates are paused",
        details: [],
      };
  }
}

function primaryPredictionCard(prediction: PrimaryPredictionV2): CycleCard {
  if (prediction.status === "paused") {
    return {
      status: "Prediction paused",
      title: "Predictions are paused",
      details: prediction.reasonCodes.flatMap((reason) =>
        reasonCopy[reason] ? [reasonCopy[reason]!] : [],
      ),
    };
  }
  if (prediction.status === "unavailable") {
    return {
      status: "No estimate",
      title: "No estimated range yet",
      details: prediction.reasonCodes.flatMap((reason) =>
        reasonCopy[reason] ? [reasonCopy[reason]!] : [],
      ),
    };
  }

  const pointDate = prediction.pointDate;
  const earliestDate = prediction.earliestDate;
  const latestDate = prediction.latestDate;
  if (!pointDate || !earliestDate || !latestDate) {
    return {
      status: "No estimate",
      title: "No estimated range yet",
      details: ["Review the dates in your period log before continuing."],
    };
  }
  const point = formatCycleCalendarDate(pointDate);
  const range = dateRange(earliestDate, latestDate);
  if (!point || !range) {
    return {
      status: "No estimate",
      title: "No estimated range yet",
      details: ["Review the dates in your period log before continuing."],
    };
  }
  const approvedProbability =
    prediction.probabilityLabel?.level === 80 &&
    prediction.probabilityLabel.calibrationStatus === "approved" &&
    typeof prediction.calibrationVersion === "string" &&
    prediction.calibrationVersion.trim().length > 0 &&
    prediction.calibrationVersion ===
      prediction.probabilityLabel.calibrationVersion;
  const basis =
    prediction.basisCount > 0 && Number.isSafeInteger(prediction.basisCount)
      ? `Based on ${prediction.basisCount} eligible start-to-start interval${prediction.basisCount === 1 ? "" : "s"}.`
      : "No eligible intervals yet; this uses the cycle length in Settings.";
  return {
    status: "Period timing estimate",
    title: `Estimated around ${point}`,
    details: [
      `${approvedProbability ? "80% likely" : "Estimated"} range: ${range}`,
      `Estimate quality: ${qualityLabels[prediction.quality]}`,
      basis,
      ...new Set(
        prediction.reasonCodes.flatMap((reason) =>
          reasonCopy[reason] ? [reasonCopy[reason]!] : [],
        ),
      ),
    ],
  };
}

function partnerPredictionCard(prediction: PartnerPredictionV2): CycleCard {
  const timing = {
    recorded_period: "A period is recorded today.",
    estimated: "Cycle timing is estimated.",
    late_or_uncertain: "Timing is later than the current estimate.",
    insufficient_data:
      "There is not enough cycle information for a timing update.",
    prediction_paused: "Predictions are paused.",
  }[prediction.timingStatus];
  const point = prediction.pointDate
    ? formatCycleCalendarDate(prediction.pointDate)
    : null;
  const range =
    prediction.earliestDate && prediction.latestDate
      ? dateRange(prediction.earliestDate, prediction.latestDate)
      : null;
  return {
    status: {
      estimated: "Estimated next period",
      paused: "Prediction paused",
      unavailable: "No estimate available",
    }[prediction.status],
    title: point ? `Estimated around ${point}` : timing,
    details: [
      ...(range ? [`Estimated window: ${range}`] : []),
      `Estimate quality: ${qualityLabels[prediction.quality]}`,
      prediction.basisBand === "broader"
        ? "Based on a broader cycle history."
        : "Based on limited cycle history.",
    ],
  };
}

export function getCycleDashboardPresentation(
  data: CycleDashboardData | undefined,
  capabilities: CycleCapabilities | undefined,
): CycleDashboardPresentation | null {
  if (!data || !capabilities) return null;
  const role = data.isPartnerView ? "partner" : "primary";
  const state =
    capabilities.cycleStateV1 && data.cycleStateV1Exposed && data.cycleStateV1
      ? cycleStateCard(data.cycleStateV1)
      : null;
  const prediction =
    role === "primary"
      ? capabilities.periodPredictionV2 && data.periodPredictionV2
        ? primaryPredictionCard(data.periodPredictionV2)
        : null
      : capabilities.partnerPredictionV2 &&
          data.partnerPredictionV2Exposed &&
          data.partnerPredictionV2
        ? partnerPredictionCard(data.partnerPredictionV2)
        : null;
  return {
    role,
    message:
      state || prediction
        ? ""
        : (data.message ?? "Cycle details are not available yet."),
    state,
    prediction,
  };
}
