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

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateDaysAgo(days: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
  return localDate(date);
}
