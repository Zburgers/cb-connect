import type {
  CyclePhase,
  CycleState,
} from "@/convex/_helpers/cycleState";
import {
  cycleStateCopy,
  getPublicSupportCopy,
  type CycleStateCopyKey,
  type CycleStateCopyState,
} from "./cycleStateCopy";

export type DashboardCycleInfo = {
  phase: string;
  cycleDay: number;
  daysUntilNextPeriod: number;
  predictedNextPeriodStart: string;
};

export type CycleStatePresentation = {
  statusLabel: "Recorded" | "Calendar estimate" | "Late" | "Unknown" | "Prediction paused";
  evidenceLabel: string;
  phase: CyclePhase | null;
  phaseLabel: string | null;
  cycleDay: number | null;
  daysUntilNextPeriod: number | null;
  nextPeriodStart: string | null;
  copyKey: CycleStateCopyKey;
  title: string;
  text: string;
  disclaimer: string | null;
};

function phaseLabel(phase: CyclePhase | null): string | null {
  if (!phase) return null;
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function getCopyState(state: CycleState): CycleStateCopyState {
  switch (state.status) {
    case "recorded_period":
      return "recorded";
    case "estimated":
      return "calendar_estimate";
    case "late_or_uncertain":
      return "late";
    case "insufficient_data":
      return "unknown";
    case "prediction_paused":
      return "paused";
  }
}

function getStatusLabel(state: CycleState): CycleStatePresentation["statusLabel"] {
  switch (state.status) {
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

function getEvidenceLabel(state: CycleState): string {
  switch (state.evidence) {
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

export function getCycleStatePresentation(
  state: CycleState,
  cycleInfo: DashboardCycleInfo | null = null
): CycleStatePresentation {
  const copy = getPublicSupportCopy({ state: getCopyState(state) });
  const hasPhaseProjection =
    state.status === "recorded_period" || state.status === "estimated";
  const disclaimer =
    state.status === "estimated" && state.phase === "ovulation"
      ? cycleStateCopy.estimatedOvulationDisclaimer.text
      : null;

  return {
    statusLabel: getStatusLabel(state),
    evidenceLabel: getEvidenceLabel(state),
    phase: hasPhaseProjection ? state.phase : null,
    phaseLabel: hasPhaseProjection ? phaseLabel(state.phase) : null,
    cycleDay: hasPhaseProjection ? state.cycleDay : null,
    daysUntilNextPeriod: hasPhaseProjection
      ? cycleInfo?.daysUntilNextPeriod ?? null
      : null,
    nextPeriodStart: hasPhaseProjection
      ? cycleInfo?.predictedNextPeriodStart ?? null
      : null,
    copyKey: copy.key,
    title: copy.copy.title,
    text: copy.copy.text,
    disclaimer,
  };
}

export function getCycleStateCopyState(state: CycleState): CycleStateCopyState {
  return getCopyState(state);
}
