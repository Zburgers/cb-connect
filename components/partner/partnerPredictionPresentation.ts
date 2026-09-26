import { formatPredictionCalendarDate } from "../dashboard/predictionPresentation";
import type { PartnerPredictionV2Projection } from "../../convex/_helpers/partnerCycleProjection";

export type PartnerPredictionPresentation = {
  statusLabel: string;
  timingLabel: string;
  pointText: string | null;
  rangeText: string | null;
  qualityLabel: string;
  basisText: string;
  careHeading: string;
  careSuggestions: readonly string[];
};

export function shouldEnsurePartnerPredictionSnapshot(
  enabled: boolean,
  hasData: boolean,
  prediction: PartnerPredictionV2Projection | null | undefined,
): boolean {
  return enabled && hasData && prediction?.status !== "estimated";
}

const CARE_SUGGESTIONS = [
  "Ask what kind of support would feel helpful today.",
  "Check in before offering help.",
] as const;

export function getPartnerPredictionPresentation(
  prediction: PartnerPredictionV2Projection | null,
): PartnerPredictionPresentation | null {
  if (!prediction) return null;

  const point = prediction.pointDate
    ? formatPredictionCalendarDate(prediction.pointDate)
    : null;
  const start = prediction.earliestDate
    ? formatPredictionCalendarDate(prediction.earliestDate)
    : null;
  const end = prediction.latestDate
    ? formatPredictionCalendarDate(prediction.latestDate)
    : null;

  return {
    statusLabel: {
      estimated: "Estimated next period",
      paused: "Prediction paused",
      unavailable: "No estimate available",
    }[prediction.status],
    timingLabel: {
      recorded_period: "A period is recorded today.",
      estimated: "Cycle timing is estimated.",
      late_or_uncertain: "Timing is later than the current estimate.",
      insufficient_data:
        "There is not enough cycle information for a timing update.",
      prediction_paused: "Predictions are paused.",
    }[prediction.timingStatus],
    pointText: point,
    rangeText: start && end ? (start === end ? start : `${start}–${end}`) : null,
    qualityLabel: {
      high: "High",
      moderate: "Moderate",
      low: "Low",
      timing_less_predictable: "Timing less predictable",
      limited_evidence: "Limited evidence",
    }[prediction.quality],
    basisText:
      prediction.basisBand === "broader"
        ? "Based on a broader cycle history"
        : "Based on limited cycle history",
    careHeading: "Ideas, not assumptions.",
    careSuggestions: CARE_SUGGESTIONS,
  };
}
