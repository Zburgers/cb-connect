export const DEFAULT_TIME_ZONE = "UTC";

export function resolveCalendarTimeZone(timeZone?: string): string {
  const resolved = timeZone ?? DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: resolved }).format();
  } catch {
    throw new Error("Time zone must be a valid IANA time zone");
  }

  return resolved;
}

export function toCalendarDateInTimeZone(
  date: Date,
  timeZone = DEFAULT_TIME_ZONE
): string {
  const resolvedTimeZone = resolveCalendarTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

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

export function requirePastOrTodayCalendarDate(
  date: string,
  label: string,
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date()
) {
  requireValidCalendarDate(date, label);
  if (date > toCalendarDateInTimeZone(now, timeZone)) {
    throw new Error(`${label} cannot be in the future`);
  }
}
