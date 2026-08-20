export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal";

export type PredictionBounds = {
  version: 1;
  source: "legacy_configured";
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
  reason: "LEGACY_UNCALIBRATED_GRACE";
  basisCount: number;
};

type RecordedPeriodState = {
  version: 1;
  status: "recorded_period";
  phase: "menstruation";
  evidence: "RECORDED_EXACT";
  cycleDay: number;
  reason: "CONFIRMED_EVENT_COVERS_TODAY";
};

type EstimatedState = {
  version: 1;
  status: "estimated";
  phase: CyclePhase;
  evidence: "CALENDAR_ESTIMATE";
  cycleDay: number;
  bounds: PredictionBounds;
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND";
};

type LateState = {
  version: 1;
  status: "late_or_uncertain";
  phase: null;
  evidence: "TIMING_UNCERTAINTY";
  cycleDay: null;
  bounds: PredictionBounds;
  reason: "AFTER_LATEST_BOUND";
};

type InsufficientDataState = {
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

type PausedState = {
  version: 1;
  status: "prediction_paused";
  phase: null;
  evidence: "USER_PAUSED";
  cycleDay: null;
  reason: "USER_PAUSED";
};

export type CycleStateLike =
  | RecordedPeriodState
  | EstimatedState
  | LateState
  | InsufficientDataState
  | PausedState;

export type ProjectionContext = {
  role: "primary" | "partner";
  coupleStatus: "active" | "revoked";
  hasMembership: boolean;
  sharingEnabled: boolean;
  consentGranted: boolean;
};

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

function copySafeState(state: CycleStateLike): CycleStateLike {
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
  }
}

export function projectCycleState(
  state: CycleStateLike | null,
  context: ProjectionContext
): CycleStateLike | null {
  if (!state || context.coupleStatus !== "active" || !context.hasMembership) {
    return null;
  }

  const partnerHasConsent =
    context.role === "partner" &&
    context.sharingEnabled &&
    context.consentGranted;

  if (context.role === "partner" && !partnerHasConsent) {
    return null;
  }

  return copySafeState(state);
}
