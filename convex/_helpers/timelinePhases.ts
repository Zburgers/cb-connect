import { addCalendarDays, type CyclePhase } from "./cycleCalculations.ts";
import {
  createLegacyPredictionBounds,
} from "./predictionBounds";
import {
  reduceCycleState,
  type CycleState,
} from "./cycleState";
import {
  isExactCoverageEligible,
  isStartAnchorEligible,
  selectLatestPredictionFact,
  type CycleFactLike,
} from "./cycleFactEligibility";

export type TimelinePhase = CyclePhase | "private" | "unknown";

export interface PeriodLike extends CycleFactLike {
  _id?: string;
  coversTargetDate?: boolean;
}

export type TimelineStateMetadata = {
  status: CycleState["status"];
  evidence: CycleState["evidence"];
  reason: CycleState["reason"];
};

export type TimelineState = TimelineStateMetadata & {
  phase: TimelinePhase;
};

export type PeriodEndProjection = {
  endDate: string;
  kind: "observed" | "estimated";
};

export function getPeriodEndProjection(
  period: PeriodLike,
  periodLength: number
): PeriodEndProjection {
  if (period.endDate) {
    return { endDate: period.endDate, kind: "observed" };
  }
  return {
    endDate: addCalendarDays(period.startDate, periodLength - 1),
    kind: "estimated",
  };
}

export function findLatestPeriodStartDate(periods: PeriodLike[]): string | null {
  let latestStartDate: string | null = null;

  for (const period of periods) {
    if (!latestStartDate || period.startDate > latestStartDate) {
      latestStartDate = period.startDate;
    }
  }

  return latestStartDate;
}

function toEligibleFact(period: PeriodLike, index: number, targetDate: string) {
  const exactCoverage = isExactCoverageEligible(period, targetDate);

  return {
    id: period.id ?? period._id ?? `timeline-period-${index}`,
    startDate: period.startDate,
    ...(exactCoverage && period.endDate !== undefined
      ? { endDate: period.endDate }
      : {}),
    ...(exactCoverage && period.startDate === targetDate
      ? { coversTargetDate: true }
      : {}),
  };
}

function phaseForState(state: CycleState): TimelinePhase {
  if (state.status === "recorded_period" || state.status === "estimated") {
    return state.phase;
  }
  return "unknown";
}

export function getTimelineStateForDate(
  targetDate: string,
  periods: PeriodLike[],
  cycleLength: number,
  periodLength: number,
  timeZone = "UTC",
): TimelineState {
  const eligiblePeriods = periods.filter(isStartAnchorEligible);
  const latestPeriod = selectLatestPredictionFact(eligiblePeriods);
  const bounds = latestPeriod
    ? createLegacyPredictionBounds({
        expectedDate: addCalendarDays(latestPeriod.startDate, cycleLength),
      })
    : null;
  const state = reduceCycleState({
    targetDate,
    timeZone,
    paused: false,
    eligibleFacts: eligiblePeriods.map((period, index) =>
      toEligibleFact(period, index, targetDate)
    ),
    bounds,
    cycleLength,
    periodLength,
  });

  return {
    phase: phaseForState(state),
    status: state.status,
    evidence: state.evidence,
    reason: state.reason,
  };
}

export function getTimelinePhaseForDate(
  targetDate: string,
  periods: PeriodLike[],
  cycleLength: number,
  periodLength: number
): CyclePhase | "unknown" {
  const state = getTimelineStateForDate(
    targetDate,
    periods,
    cycleLength,
    periodLength,
  );
  return state.phase === "private" ? "unknown" : state.phase;
}
