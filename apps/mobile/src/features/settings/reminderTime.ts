const REMINDER_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localDateTimeParts(date: Date, formatter: Intl.DateTimeFormat): Record<string, number> {
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter(({ type }) => ["year", "month", "day", "hour", "minute"].includes(type))
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function makeLocalFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Creates a picker value whose clock matches the account-local HH:mm value. */
export function parseReminderTime(value: string, timeZone: string, referenceDate = new Date()): Date | null {
  if (!REMINDER_TIME_PATTERN.test(value)) return null;

  try {
    const formatter = makeLocalFormatter(timeZone);
    const reference = localDateTimeParts(referenceDate, formatter);
    const [hours, minutes] = value.split(":").map(Number);
    const startDay = Date.UTC(reference.year, reference.month - 1, reference.day);

    // A selected clock can fall in a DST gap on the current local date. The
    // picker needs an instant carrier, so use the next local date containing it.
    for (let dayOffset = 0; dayOffset <= 370; dayOffset += 1) {
      const day = new Date(startDay + dayOffset * 86_400_000);
      const requested = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes);
      let candidate = requested;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const parts = localDateTimeParts(new Date(candidate), formatter);
        const rendered = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
        if (rendered === requested) return new Date(candidate);
        candidate += requested - rendered;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** Extracts the account-local clock from the picker instant without using the device zone. */
export function formatReminderTime(date: Date, timeZone: string): string {
  const parts = localDateTimeParts(date, makeLocalFormatter(timeZone));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
