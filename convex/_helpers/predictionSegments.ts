import { requireValidCalendarDate } from "./calendarDates";
import { isStartAnchorEligible } from "./cycleFactEligibility";
import type { CycleIntervalEvent } from "./cycleIntervals";

type PredictionSegmentBoundary = { startDate: string } | null | undefined;

export function isEligiblePredictionSegmentStart(
  event: CycleIntervalEvent,
  cutoffAt: number,
  cutoffDate: string,
): boolean {
  try {
    requireValidCalendarDate(event.startDate, "Prediction segment start date");
  } catch {
    return false;
  }

  return (
    isStartAnchorEligible(event) &&
    event.confirmationStatus !== "unreviewed" &&
    Number.isFinite(event.createdAt) &&
    Number.isFinite(event.updatedAt) &&
    event.createdAt <= cutoffAt &&
    event.updatedAt <= cutoffAt &&
    event.startDate <= cutoffDate
  );
}

export function filterHistoryForPredictionSegment<
  T extends { startDate: string },
>(history: readonly T[], segment: PredictionSegmentBoundary = undefined): T[] {
  return segment
    ? history.filter((fact) => fact.startDate >= segment.startDate)
    : [...history];
}
