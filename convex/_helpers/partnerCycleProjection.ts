import type { CycleState } from "./cycleState";
import {
  isValidPredictionBounds,
  type LegacyPredictionBounds,
  type PredictionBounds,
} from "./predictionBounds";
import type { PeriodPredictionV2 } from "./periodPrediction";
import type { PredictionQualityState } from "./predictionQuality";

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
  bounds: LegacyPredictionBounds;
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND";
};

type PartnerLateProjection = {
  version: 1;
  status: "late_or_uncertain";
  phase: null;
  evidence: "TIMING_UNCERTAINTY";
  cycleDay: null;
  bounds: LegacyPredictionBounds;
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

type PartnerPredictionTimingStatus = CycleState["status"];

export type PartnerPredictionProjectionContext = ProjectionContext & {
  partnerPredictionEnabled: boolean;
};

export type PartnerPredictionV2Projection = {
  version: 2;
  status: "estimated" | "paused" | "unavailable";
  timingStatus: PartnerPredictionTimingStatus;
  pointDate: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  quality: PredictionQualityState;
  basisBand: "limited" | "broader";
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

function isPartnerPredictionContext(
  value: unknown,
): value is PartnerPredictionProjectionContext {
  if (
    !isRecord(value) ||
    value.partnerPredictionEnabled !== true ||
    !isProjectionContext(value)
  ) {
    return false;
  }

  return (
    value.role === "partner" &&
    value.coupleStatus === "active" &&
    value.hasMembership &&
    value.sharingEnabled &&
    value.consentGranted
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

function isPeriodPredictionV2(value: unknown): value is PeriodPredictionV2 {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    value.source !== "period_prediction_v2"
  ) {
    return false;
  }

  if (
    value.status === "configured" ||
    value.status === "personalized" ||
    value.status === "limited_evidence"
  ) {
    return isValidPredictionBounds(value) && value.version === 2;
  }

  return (
    (value.status === "paused" || value.status === "unavailable") &&
    value.pointDate === null &&
    value.earliestDate === null &&
    value.latestDate === null &&
    value.probabilityLabel === null &&
    value.quality === "limited_evidence" &&
    Number.isSafeInteger(value.basisCount) &&
    (value.basisCount as number) >= 0
  );
}

export function isPrimaryCycleState(value: unknown): value is CycleState {
  return isCycleState(value);
}

export function projectPartnerPrediction(
  prediction: unknown,
  timingState: unknown,
  context: unknown,
): PartnerPredictionV2Projection | null {
  if (
    !isPartnerPredictionContext(context) ||
    !isCycleState(timingState) ||
    !isPeriodPredictionV2(prediction)
  ) {
    return null;
  }

  const isEstimated =
    prediction.status !== "paused" && prediction.status !== "unavailable";
  return {
    version: 2,
    status:
      prediction.status === "paused" || prediction.status === "unavailable"
        ? prediction.status
        : "estimated",
    timingStatus: timingState.status,
    pointDate: isEstimated ? prediction.pointDate : null,
    earliestDate: isEstimated ? prediction.earliestDate : null,
    latestDate: isEstimated ? prediction.latestDate : null,
    quality: isEstimated ? prediction.quality : "limited_evidence",
    basisBand: prediction.basisCount >= 3 ? "broader" : "limited",
  };
}

function copyBounds(bounds: PredictionBounds): PredictionBounds {
  return bounds.version === 1
    ? {
        version: bounds.version,
        source: bounds.source,
        expectedDate: bounds.expectedDate,
        earliestDate: bounds.earliestDate,
        latestDate: bounds.latestDate,
        reason: bounds.reason,
        basisCount: bounds.basisCount,
      }
    : {
        ...bounds,
        probabilityLabel: bounds.probabilityLabel
          ? { ...bounds.probabilityLabel }
          : null,
        reasonCodes: [...bounds.reasonCodes],
      };
}

function copyLegacyBounds(
  bounds: LegacyPredictionBounds,
): LegacyPredictionBounds {
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
      if (state.bounds.version !== 1) return null;
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyLegacyBounds(state.bounds),
        reason: state.reason,
      };
    case "late_or_uncertain":
      if (state.bounds.version !== 1) return null;
      return {
        version: state.version,
        status: state.status,
        phase: state.phase,
        evidence: state.evidence,
        cycleDay: state.cycleDay,
        bounds: copyLegacyBounds(state.bounds),
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
