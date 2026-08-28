import {
  isExactCoverageEligible,
  isStartAnchorEligible,
  selectLatestPredictionFact,
  type CycleFactLike,
} from "./cycleFactEligibility";
import {
  reduceCycleState,
  type CycleState,
  type EligibleCycleFact,
} from "./cycleState";
import {
  createLegacyPredictionBounds,
  daysBetweenCalendarDates,
  type PredictionBounds,
} from "./predictionBounds";
import { addCalendarDays } from "./cycleCalculations";

export type CycleReadModelPeriod = CycleFactLike;

export type CycleReadModelInput = {
  targetDate: string;
  timeZone?: string;
  cycleLength: number;
  periodLength: number;
  predictionPaused?: boolean;
  periods: readonly CycleReadModelPeriod[];
};

export type CycleReadModelCycleInfo = {
  phase: Extract<CycleState, { phase: string }>["phase"];
  cycleDay: number;
  daysUntilNextPeriod: number;
  predictedNextPeriodStart: string;
  predictedNextPeriodEnd: string;
  phaseDescription: string;
};

export type CycleReadModel = {
  cycleStateV1: CycleState;
  cycleInfo: CycleReadModelCycleInfo | null;
};

function toEligibleCycleFact(
  period: CycleReadModelPeriod,
  targetDate: string
): EligibleCycleFact {
  const exactCoverage = isExactCoverageEligible(period, targetDate);

  return {
    id: period.id ?? "",
    startDate: period.startDate,
    ...(exactCoverage && period.endDate !== undefined
      ? { endDate: period.endDate }
      : {}),
    ...(exactCoverage && period.startDate === targetDate
      ? { coversTargetDate: true }
      : {}),
  };
}

function getPredictionBounds(
  latestFact: CycleReadModelPeriod | null,
  cycleLength: number
): PredictionBounds | null {
  if (!latestFact) return null;

  try {
    return createLegacyPredictionBounds({
      expectedDate: addCalendarDays(latestFact.startDate, cycleLength),
    });
  } catch {
    return null;
  }
}

function projectCycleInfo(
  state: CycleState,
  targetDate: string,
  periodLength: number,
  bounds: PredictionBounds | null
): CycleReadModelCycleInfo | null {
  if (
    (state.status !== "recorded_period" && state.status !== "estimated") ||
    !bounds
  ) {
    return null;
  }

  const daysUntilNextPeriod = Math.max(
    0,
    daysBetweenCalendarDates(targetDate, bounds.expectedDate)
  );

  return {
    phase: state.phase,
    cycleDay: state.cycleDay,
    daysUntilNextPeriod,
    predictedNextPeriodStart: bounds.expectedDate,
    predictedNextPeriodEnd: addCalendarDays(
      bounds.expectedDate,
      periodLength - 1
    ),
    phaseDescription:
      state.status === "recorded_period"
        ? "Recorded period"
        : "Calendar estimate",
  };
}

export function buildCycleReadModel(
  input: CycleReadModelInput
): CycleReadModel {
  const predictionPeriods = input.periods.filter(isStartAnchorEligible);
  const latestFact = selectLatestPredictionFact([...predictionPeriods]);
  const bounds = getPredictionBounds(latestFact, input.cycleLength);
  const eligibleFacts = predictionPeriods.map((period) =>
    toEligibleCycleFact(period, input.targetDate)
  );
  const cycleStateV1 = reduceCycleState({
    targetDate: input.targetDate,
    timeZone: input.timeZone,
    paused: input.predictionPaused ?? false,
    eligibleFacts,
    bounds,
    cycleLength: input.cycleLength,
    periodLength: input.periodLength,
  });

  return {
    cycleStateV1,
    cycleInfo: projectCycleInfo(
      cycleStateV1,
      input.targetDate,
      input.periodLength,
      bounds
    ),
  };
}
