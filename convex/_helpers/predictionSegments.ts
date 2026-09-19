type PredictionSegmentBoundary = { startDate: string } | null | undefined;

export function filterHistoryForPredictionSegment<
  T extends { startDate: string },
>(history: readonly T[], segment: PredictionSegmentBoundary = undefined): T[] {
  return segment
    ? history.filter((fact) => fact.startDate >= segment.startDate)
    : [...history];
}
