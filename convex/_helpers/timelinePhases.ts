import {
  addCalendarDays,
  calculateCycleInfo,
  type CyclePhase,
} from "./cycleCalculations.ts";

export type TimelinePhase = CyclePhase | "private" | "unknown";

export interface PeriodLike {
  startDate: string;
  endDate?: string;
}

export type PeriodEndProjection = {
  endDate: string;
  kind: "observed" | "estimated";
};

function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

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

function getRecordedPeriodLength(period: PeriodLike, fallbackPeriodLength: number): number {
  if (!period.endDate) {
    return fallbackPeriodLength;
  }

  const dayCount =
    Math.floor(
      (parseCalendarDate(period.endDate).getTime() -
        parseCalendarDate(period.startDate).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;

  return Math.max(dayCount, 1);
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

export function getTimelinePhaseForDate(
  targetDate: string,
  periods: PeriodLike[],
  cycleLength: number,
  periodLength: number
): CyclePhase | "unknown" {
  let latestPeriod: PeriodLike | null = null;
  let latestPeriodStartDate: string | null = null;

  for (const period of periods) {
    const effectiveEndDate = getPeriodEndProjection(period, periodLength).endDate;

    if (targetDate >= period.startDate && targetDate <= effectiveEndDate) {
      return "menstruation";
    }

    if (period.startDate <= targetDate) {
      if (!latestPeriodStartDate || period.startDate > latestPeriodStartDate) {
        latestPeriod = period;
        latestPeriodStartDate = period.startDate;
      }
    }
  }

  if (!latestPeriodStartDate || !latestPeriod) {
    return "unknown";
  }

  const effectivePeriodLength =
    latestPeriod.endDate && targetDate > latestPeriod.endDate
      ? getRecordedPeriodLength(latestPeriod, periodLength)
      : periodLength;

  return calculateCycleInfo(
    latestPeriodStartDate,
    cycleLength,
    effectivePeriodLength,
    targetDate
  ).phase;
}
