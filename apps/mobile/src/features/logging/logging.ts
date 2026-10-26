export function loggingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "START_SAVED_END_FAILED") return "The start was saved as open, but its end was not saved. Review history before retrying.";
  if (/DUPLICATE_EXACT_START|EXACT_INTERVAL_OVERLAP|PERIOD_HISTORY_TOO_DENSE/.test(message)) {
    return "This period overlaps another recorded period. Review your history and try a corrected date.";
  }
  if (/FUTURE|future|past or today/i.test(message)) return "Choose today or an earlier date.";
  if (/STALE_AUTHORITY_VERSION|AUTHORITY_VERSION_REQUIRED/.test(message)) {
    return "This entry changed. Refresh history before correcting it.";
  }
  if (/END_CERTAINTY_REQUIRED/.test(message)) return "Choose whether the end date is exact or approximate.";
  if (/offline|network|websocket/i.test(message)) return "You’re offline. Nothing was saved; reconnect and try again.";
  if (/sharing|permission|authorized|allowed|role|partner/i.test(message)) {
    return "This action is not available for this account or shared history.";
  }
  return "Could not save this entry. Check the dates and try again.";
}

export function periodSuccessMessage(hasOpenPeriod: boolean, hasEndDate: boolean): string {
  if (hasOpenPeriod) return "Period end confirmed.";
  return hasEndDate ? "Period start and end saved." : "Period start saved as open.";
}

export function localDate(date = new Date(), timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateDaysAgo(days: number, from = new Date(), timeZone = "UTC"): string {
  const [year, month, day] = localDate(from, timeZone).split("-").map(Number);
  return localDate(new Date(Date.UTC(year, month - 1, day - days)), "UTC");
}
