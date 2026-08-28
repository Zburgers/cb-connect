import type { CycleFactCertainty } from "./cycleFactSemantics";

export interface CycleFactLike {
  id?: string;
  startDate: string;
  endDate?: string;
  startCertainty?: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  legacyReason?: string;
  tombstoneAt?: number;
}

export type CycleFactReadLabel = "exact" | "approximate" | "legacy_unknown";
export type PredictionSelectionMode = "legacy" | "cycle_facts_v1";

export function getCycleFactReadLabel(
  period: CycleFactLike
): CycleFactReadLabel {
  // A legacy reason is an explicit signal that the row's provenance is not
  // trustworthy, even if a later writer populated exact-looking certainty
  // fields. Keep the user-visible label conservative for malformed or
  // partially annotated historical rows.
  if (period.legacyReason !== undefined) {
    return "legacy_unknown";
  }
  if (
    period.startCertainty === "approximate" ||
    period.endCertainty === "approximate"
  ) {
    return "approximate";
  }
  if (
    period.startCertainty === "exact" &&
    (period.endDate === undefined || period.endCertainty === "exact")
  ) {
    return "exact";
  }
  return "legacy_unknown";
}

export function isHistoryVisible(period: CycleFactLike): boolean {
  return period.tombstoneAt === undefined;
}

export function isStartAnchorEligible(period: CycleFactLike): boolean {
  return (
    isHistoryVisible(period) &&
    period.legacyReason === undefined &&
    period.startCertainty === "exact"
  );
}

export function isExactCoverageEligible(
  period: CycleFactLike,
  date: string = period.startDate
): boolean {
  if (!isStartAnchorEligible(period)) return false;
  if (date <= period.startDate) return true;
  return (
    period.endDate !== undefined &&
    period.endCertainty === "exact" &&
    date <= period.endDate
  );
}

export function selectLatestPredictionFact<T extends CycleFactLike>(
  periods: T[]
): T | null {
  let latest: T | null = null;
  for (const period of periods) {
    if (!isStartAnchorEligible(period)) continue;
    if (!latest || period.startDate > latest.startDate) {
      latest = period;
    }
  }
  return latest;
}

export function selectPredictionAnchor<T extends CycleFactLike>(
  periods: T[],
  mode: PredictionSelectionMode
): T | null {
  if (mode === "legacy") {
    return periods.find(isHistoryVisible) ?? null;
  }

  let latest: T | null = null;
  for (const period of periods) {
    if (!isStartAnchorEligible(period)) continue;
    if (!latest || period.startDate > latest.startDate) {
      latest = period;
    }
  }
  return latest;
}
