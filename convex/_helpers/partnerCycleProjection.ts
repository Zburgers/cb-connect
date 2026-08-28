import type { CycleState } from "./cycleState";
import {
  isValidPredictionBounds,
  type PredictionBounds,
} from "./predictionBounds";

type CyclePhase = Extract<CycleState, { status: "estimated" }>["phase"];

type PartnerRecordedProjection = {
  version: 1;
  status: "recorded_period";
  phase: "menstruation";
  evidence: "RECORDED_EXACT";
  cycleDay: number;
  reason: "CONFIRMED_EVENT_COVERS_TODAY";
};

type PartnerEstimatedProjection = {
  version: 1;
  status: "estimated";
  phase: CyclePhase;
  evidence: "CALENDAR_ESTIMATE";
  cycleDay: number;
  bounds: PredictionBounds;
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND";
};

type PartnerLateProjection = {
  version: 1;
  status: "late_or_uncertain";
  phase: null;
  evidence: "TIMING_UNCERTAINTY";
  cycleDay: null;
  bounds: PredictionBounds;
  reason: "AFTER_LATEST_BOUND";
};

type PartnerInsufficientProjection = {
  version: 1;
  status: "insufficient_data";
  phase: null;
  evidence: "UNAVAILABLE";
  cycleDay: null;
  reason:
    | "NO_ELIGIBLE_FACT"
    | "FUTURE_START"
    | "INVALID_BOUNDS"
    | "MISSING_TIMEZONE";
};

type PartnerPausedProjection = {
  version: 1;
  status: "prediction_paused";
  phase: null;
  evidence: "USER_PAUSED";
  cycleDay: null;
  reason: "USER_PAUSED";
};

export type PartnerCycleProjection =
  | PartnerRecordedProjection
  | PartnerEstimatedProjection
  | PartnerLateProjection
  | PartnerInsufficientProjection
  | PartnerPausedProjection;

export type ProjectionContext = {
  role: "primary" | "partner";
  coupleStatus: "pending" | "active" | "revoked";
  hasMembership: boolean;
  sharingEnabled: boolean;
  consentGranted: boolean;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isCyclePhase(value: unknown): value is CyclePhase {
  return (
    value === "menstruation" ||
    value === "follicular" ||
    value === "ovulation" ||
    value === "luteal"
  );
}

function isCycleDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isProjectionContext(value: unknown): value is ProjectionContext {
  if (!isRecord(value)) return false;

  return (
    (value.role === "primary" || value.role === "partner") &&
    (value.coupleStatus === "pending" ||
      value.coupleStatus === "active" ||
      value.coupleStatus === "revoked") &&
    typeof value.hasMembership === "boolean" &&
    typeof value.sharingEnabled === "boolean" &&
    typeof value.consentGranted === "boolean"
  );
}

function isCycleState(value: unknown): value is CycleState {
  if (!isRecord(value) || value.version !== 1) return false;

  switch (value.status) {
    case "recorded_period":
      return (
        value.phase === "menstruation" &&
        value.evidence === "RECORDED_EXACT" &&
        isCycleDay(value.cycleDay) &&
        typeof value.coveringEventId === "string" &&
        value.coveringEventId.length > 0 &&
        value.reason === "CONFIRMED_EVENT_COVERS_TODAY"
      );
    case "estimated":
      return (
        isCyclePhase(value.phase) &&
        value.evidence === "CALENDAR_ESTIMATE" &&
        isCycleDay(value.cycleDay) &&
        isValidPredictionBounds(value.bounds) &&
        value.reason === "ELIGIBLE_FACT_WITHIN_LATEST_BOUND"
      );
    case "late_or_uncertain":
      return (
        value.phase === null &&
        value.evidence === "TIMING_UNCERTAINTY" &&
        value.cycleDay === null &&
        isValidPredictionBounds(value.bounds) &&
        value.reason === "AFTER_LATEST_BOUND"
      );
    case "insufficient_data":
      return (
        value.phase === null &&
        value.evidence === "UNAVAILABLE" &&
        value.cycleDay === null &&
        (value.reason === "NO_ELIGIBLE_FACT" ||
          value.reason === "FUTURE_START" ||
          value.reason === "INVALID_BOUNDS" ||
          value.reason === "MISSING_TIMEZONE")
      );
    case "prediction_paused":
      return (
        value.phase === null &&
        value.evidence === "USER_PAUSED" &&
        value.cycleDay === null &&
        value.reason === "USER_PAUSED"
      );
    default:
      return false;
  }
}

export function isPrimaryCycleState(value: unknown): value is CycleState {
  return isCycleState(value);
}

function copyBounds(bounds: PredictionBounds): PredictionBounds {
  return {
    version: bounds.version,
    source: bounds.source,
    expectedDate: bounds.expectedDate,
    earliestDate: bounds.earliestDate,
    latestDate: bounds.latestDate,
    reason: bounds.reason,
    basisCount: bounds.basisCount,
  };
}

function copyPrimaryState(state: CycleState): CycleState | null {
  switch (state.status) {
    case "recorded_period":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        coveringEventId: state.coveringEventId,
        reason: state.reason,
      };
    case "estimated":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyBounds(state.bounds),
        reason: state.reason,
      };
    case "late_or_uncertain":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyBounds(state.bounds),
        reason: state.reason,
      };
    case "insufficient_data":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        reason: state.reason,
      };
    case "prediction_paused":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        reason: state.reason,
      };
    default:
      return null;
  }
}

function copyPartnerState(state: CycleState): PartnerCycleProjection | null {
  switch (state.status) {
    case "recorded_period":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        reason: state.reason,
      };
    case "estimated":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyBounds(state.bounds),
        reason: state.reason,
      };
    case "late_or_uncertain":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyBounds(state.bounds),
        reason: state.reason,
      };
    case "insufficient_data":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        reason: state.reason,
      };
    case "prediction_paused":
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        reason: state.reason,
      };
    default:
      return null;
  }
}

export function projectCycleState(
  state: CycleState | null,
  context: ProjectionContext
): CycleState | PartnerCycleProjection | null {
  if (
    !isCycleState(state) ||
    !isProjectionContext(context) ||
    context.coupleStatus !== "active" ||
    !context.hasMembership
  ) {
    return null;
  }

  if (context.role === "primary") {
    return copyPrimaryState(state);
  }

  if (context.role === "partner") {
    if (!context.sharingEnabled || !context.consentGranted) return null;
    return copyPartnerState(state);
  }

  return null;
}
