import {
  requireValidCalendarDate,
  resolveCalendarTimeZone,
} from "./calendarDates";
import {
  daysBetweenCalendarDates,
  isValidPredictionBounds,
  type PredictionBounds,
} from "./predictionBounds";

export type CyclePhase =
  | "menstruation"
  | "follicular"
  | "ovulation"
  | "luteal";

export type EligibleCycleFact = {
  id: string;
  startDate: string;
  endDate?: string;
  coversTargetDate?: boolean;
};

export type CycleStateInput = {
  targetDate: string;
  timeZone?: string;
  paused: boolean;
  eligibleFacts: readonly EligibleCycleFact[];
  bounds: PredictionBounds | null;
  cycleLength: number;
  periodLength: number;
};

export type CycleState =
  | {
      version: 1;
      status: "recorded_period";
      phase: "menstruation";
      evidence: "RECORDED_EXACT";
      cycleDay: number;
      coveringEventId: string;
      reason: "CONFIRMED_EVENT_COVERS_TODAY";
    }
  | {
      version: 1;
      status: "estimated";
      phase: CyclePhase;
      evidence: "CALENDAR_ESTIMATE";
      cycleDay: number;
      bounds: PredictionBounds;
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND";
    }
  | {
      version: 1;
      status: "late_or_uncertain";
      phase: null;
      evidence: "TIMING_UNCERTAINTY";
      cycleDay: null;
      bounds: PredictionBounds;
      reason: "AFTER_LATEST_BOUND";
    }
  | {
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
    }
  | {
      version: 1;
      status: "prediction_paused";
      phase: null;
      evidence: "USER_PAUSED";
      cycleDay: null;
      reason: "USER_PAUSED";
    };

function isValidCalendarDate(value: string): boolean {
  try {
    requireValidCalendarDate(value, "Cycle date");
    return true;
  } catch {
    return false;
  }
}

function isUsableFact(fact: EligibleCycleFact): boolean {
  return (
    fact.id.length > 0 &&
    isValidCalendarDate(fact.startDate) &&
    (fact.endDate === undefined || isValidCalendarDate(fact.endDate)) &&
    (fact.endDate === undefined || fact.endDate >= fact.startDate)
  );
}

function coversTargetDate(
  fact: EligibleCycleFact,
  targetDate: string
): boolean {
  if (fact.startDate > targetDate) return false;
  if (fact.endDate !== undefined) {
    return targetDate <= fact.endDate;
  }
  return fact.coversTargetDate === true;
}

function getCycleDay(startDate: string, targetDate: string): number {
  return daysBetweenCalendarDates(startDate, targetDate) + 1;
}

function getEstimatedPhase(
  cycleDay: number,
  cycleLength: number,
  periodLength: number
): CyclePhase {
  if (cycleDay <= periodLength) return "menstruation";

  const midpoint = Math.floor(cycleLength / 2);
  if (cycleDay <= midpoint - 1) return "follicular";
  if (cycleDay <= midpoint + 2) return "ovulation";
  return "luteal";
}

function isValidCycleConfiguration(input: CycleStateInput): boolean {
  return (
    Number.isInteger(input.cycleLength) &&
    input.cycleLength > 0 &&
    Number.isInteger(input.periodLength) &&
    input.periodLength > 0 &&
    input.periodLength <= input.cycleLength
  );
}

function recordedState(
  fact: EligibleCycleFact,
  targetDate: string
): CycleState {
  return {
    version: 1,
    status: "recorded_period",
    phase: "menstruation",
    evidence: "RECORDED_EXACT",
    cycleDay: getCycleDay(fact.startDate, targetDate),
    coveringEventId: fact.id,
    reason: "CONFIRMED_EVENT_COVERS_TODAY",
  };
}

export function reduceCycleState(input: CycleStateInput): CycleState {
  if (input.paused) {
    return {
      version: 1,
      status: "prediction_paused",
      phase: null,
      evidence: "USER_PAUSED",
      cycleDay: null,
      reason: "USER_PAUSED",
    };
  }

  if (!isValidCalendarDate(input.targetDate)) {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "NO_ELIGIBLE_FACT",
    };
  }

  const facts = input.eligibleFacts.filter(isUsableFact);
  const coveringFact = facts
    .filter((fact) => coversTargetDate(fact, input.targetDate))
    .sort((left, right) =>
      right.startDate.localeCompare(left.startDate) ||
      right.id.localeCompare(left.id)
    )[0];
  if (coveringFact) return recordedState(coveringFact, input.targetDate);

  if (!input.timeZone) {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "MISSING_TIMEZONE",
    };
  }

  try {
    resolveCalendarTimeZone(input.timeZone);
  } catch {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "MISSING_TIMEZONE",
    };
  }

  if (facts.length === 0) {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "NO_ELIGIBLE_FACT",
    };
  }

  const latestFact = [...facts].sort(
    (left, right) =>
      right.startDate.localeCompare(left.startDate) ||
      right.id.localeCompare(left.id)
  )[0];
  if (latestFact.startDate > input.targetDate) {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "FUTURE_START",
    };
  }

  if (
    !isValidPredictionBounds(input.bounds) ||
    !isValidCycleConfiguration(input)
  ) {
    return {
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason: "INVALID_BOUNDS",
    };
  }

  if (input.targetDate > input.bounds.latestDate) {
    return {
      version: 1,
      status: "late_or_uncertain",
      phase: null,
      evidence: "TIMING_UNCERTAINTY",
      cycleDay: null,
      bounds: input.bounds,
      reason: "AFTER_LATEST_BOUND",
    };
  }

  const cycleDay = getCycleDay(latestFact.startDate, input.targetDate);
  return {
    version: 1,
    status: "estimated",
    phase: getEstimatedPhase(
      cycleDay,
      input.cycleLength,
      input.periodLength
    ),
    evidence: "CALENDAR_ESTIMATE",
    cycleDay,
    bounds: input.bounds,
    reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
  };
}
