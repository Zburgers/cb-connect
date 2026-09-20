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
  predictionPointDate,
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
  /** Omitted keeps the Gate 2 configured path; null deliberately fails closed. */
  predictionBounds?: PredictionBounds | null;
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

  const pointDate = predictionPointDate(bounds);
  const daysUntilNextPeriod = Math.max(
    0,
    daysBetweenCalendarDates(targetDate, pointDate)
  );

  return {
    phase: state.phase,
    cycleDay: state.cycleDay,
    daysUntilNextPeriod,
    predictedNextPeriodStart: pointDate,
    predictedNextPeriodEnd: addCalendarDays(
      pointDate,
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
  const bounds =
    input.predictionBounds === undefined
      ? getPredictionBounds(latestFact, input.cycleLength)
      : input.predictionBounds;
  const eligibleFacts = predictionPeriods.map((period) =>
    toEligibleCycleFact(period, input.targetDate)
  );
  const estimatedCycleLength =
    latestFact && bounds?.version === 2
      ? daysBetweenCalendarDates(latestFact.startDate, bounds.pointDate)
      : input.cycleLength;
  const cycleStateV1 = reduceCycleState({
    targetDate: input.targetDate,
    timeZone: input.timeZone,
    paused: input.predictionPaused ?? false,
    eligibleFacts,
    bounds,
    cycleLength: estimatedCycleLength,
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
