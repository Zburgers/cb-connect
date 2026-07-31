import { toCalendarDateString } from "./cycleCalculations";

export function requireValidCalendarDate(date: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${label} must be a valid date`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${label} must be a valid date`);
  }
}

export function requirePastOrTodayCalendarDate(date: string, label: string) {
  requireValidCalendarDate(date, label);
  if (date > toCalendarDateString()) {
    throw new Error(`${label} cannot be in the future`);
  }
}
