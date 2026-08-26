import { requireValidCalendarDate } from "./calendarDates";

const DEFAULT_LEGACY_GRACE_DAYS = 3;

export type PredictionBounds = {
  version: 1;
  source: "legacy_configured";
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
  reason: "LEGACY_UNCALIBRATED_GRACE";
  basisCount: 1;
};

export type LegacyPredictionBoundsInput = {
  expectedDate: string;
  graceDays?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseCalendarDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date: string, days: number): string {
  const result = parseCalendarDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    requireValidCalendarDate(value, "Prediction bound date");
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createLegacyPredictionBounds(
  input: LegacyPredictionBoundsInput
): PredictionBounds {
  const graceDays = input.graceDays ?? DEFAULT_LEGACY_GRACE_DAYS;
  if (!isCalendarDate(input.expectedDate)) {
    throw new Error("Expected date must be a valid date");
  }
  if (!Number.isInteger(graceDays) || graceDays < 0) {
    throw new Error("Grace days must be a nonnegative integer");
  }

  return {
    version: 1,
    source: "legacy_configured",
    expectedDate: input.expectedDate,
    earliestDate: input.expectedDate,
    latestDate: addCalendarDays(input.expectedDate, graceDays),
    reason: "LEGACY_UNCALIBRATED_GRACE",
    basisCount: 1,
  };
}

export function isValidPredictionBounds(
  value: unknown
): value is PredictionBounds {
  if (!isRecord(value)) return false;
  if (
    value.version !== 1 ||
    value.source !== "legacy_configured" ||
    value.reason !== "LEGACY_UNCALIBRATED_GRACE" ||
    value.basisCount !== 1
  ) {
    return false;
  }

  const expectedDate = value.expectedDate;
  const earliestDate = value.earliestDate;
  const latestDate = value.latestDate;
  if (
    !isCalendarDate(expectedDate) ||
    !isCalendarDate(earliestDate) ||
    !isCalendarDate(latestDate)
  ) {
    return false;
  }

  return (
    earliestDate <= expectedDate && expectedDate <= latestDate
  );
}

export function daysBetweenCalendarDates(
  startDate: string,
  endDate: string
): number {
  return Math.floor(
    (parseCalendarDate(endDate).getTime() -
      parseCalendarDate(startDate).getTime()) /
      MS_PER_DAY
  );
}
