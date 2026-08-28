import type { PartnerCycleProjection } from "@/convex/_helpers/partnerCycleProjection";

type PartnerStatusLabel =
  | "Recorded"
  | "Calendar estimate"
  | "Late"
  | "Unknown"
  | "Prediction paused";

type PartnerBoundsPresentation = {
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
};

export type PartnerCyclePresentation = {
  visible: boolean;
  emptyState: string | null;
  version: 1 | null;
  status: PartnerCycleProjection["status"] | null;
  statusLabel: PartnerStatusLabel | null;
  phase: "menstruation" | "follicular" | "ovulation" | "luteal" | null;
  phaseLabel: string | null;
  evidenceLabel: string | null;
  cycleDay: number | null;
  bounds: PartnerBoundsPresentation | null;
  reason: PartnerCycleProjection["reason"] | null;
  basisCount: number | null;
};

export function isPartnerCycleStateExposed(
  serverExposure: boolean | null | undefined,
): boolean {
  return serverExposure === true;
}

const EMPTY_PRESENTATION: PartnerCyclePresentation = {
  visible: false,
  emptyState: "Cycle details are not shared right now.",
  version: null,
  status: null,
  statusLabel: null,
  phase: null,
  phaseLabel: null,
  evidenceLabel: null,
  cycleDay: null,
  bounds: null,
  reason: null,
  basisCount: null,
};

function phaseLabel(
  phase: PartnerCyclePresentation["phase"],
): string | null {
  return phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : null;
}

function evidenceLabel(
  evidence: PartnerCycleProjection["evidence"],
): string {
  switch (evidence) {
    case "RECORDED_EXACT":
      return "Recorded exact";
    case "CALENDAR_ESTIMATE":
      return "Calendar estimate";
    case "TIMING_UNCERTAINTY":
      return "Timing uncertainty";
    case "UNAVAILABLE":
      return "Unavailable";
    case "USER_PAUSED":
      return "User paused";
  }
}

function statusLabel(
  status: PartnerCycleProjection["status"],
): PartnerStatusLabel {
  switch (status) {
    case "recorded_period":
      return "Recorded";
    case "estimated":
      return "Calendar estimate";
    case "late_or_uncertain":
      return "Late";
    case "insufficient_data":
      return "Unknown";
    case "prediction_paused":
      return "Prediction paused";
  }
}

function copyBounds(
  projection: Extract<
    PartnerCycleProjection,
    { status: "estimated" | "late_or_uncertain" }
  >,
): PartnerBoundsPresentation {
  return {
    expectedDate: projection.bounds.expectedDate,
    earliestDate: projection.bounds.earliestDate,
    latestDate: projection.bounds.latestDate,
  };
}

export function getPartnerCyclePresentation(
  projection: PartnerCycleProjection | null,
): PartnerCyclePresentation {
  if (!projection) {
    return { ...EMPTY_PRESENTATION };
  }

  switch (projection.status) {
    case "recorded_period":
      return {
        visible: true,
        emptyState: null,
        version: projection.version,
        status: projection.status,
        statusLabel: statusLabel(projection.status),
        phase: projection.phase,
        phaseLabel: phaseLabel(projection.phase),
        evidenceLabel: evidenceLabel(projection.evidence),
        cycleDay: projection.cycleDay,
        bounds: null,
        reason: projection.reason,
        basisCount: null,
      };
    case "estimated":
    case "late_or_uncertain":
      return {
        visible: true,
        emptyState: null,
        version: projection.version,
        status: projection.status,
        statusLabel: statusLabel(projection.status),
        phase: projection.phase,
        phaseLabel: phaseLabel(projection.phase),
        evidenceLabel: evidenceLabel(projection.evidence),
        cycleDay: projection.cycleDay,
        bounds: copyBounds(projection),
        reason: projection.reason,
        basisCount: projection.bounds.basisCount,
      };
    case "insufficient_data":
    case "prediction_paused":
      return {
        visible: true,
        emptyState: null,
        version: projection.version,
        status: projection.status,
        statusLabel: statusLabel(projection.status),
        phase: null,
        phaseLabel: null,
        evidenceLabel: evidenceLabel(projection.evidence),
        cycleDay: null,
        bounds: null,
        reason: projection.reason,
        basisCount: null,
      };
  }
}
