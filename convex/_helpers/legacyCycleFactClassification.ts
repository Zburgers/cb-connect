import type {
  CycleFactCertainty,
  LegacyCycleFactReason,
} from "./cycleFactSemantics";

export type LegacyClassificationReason = LegacyCycleFactReason;

export type LegacyClassificationRow = {
  id?: string;
  _id?: string;
  startDate: string;
  endDate?: string;
  startCertainty?: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  legacyReason?: LegacyClassificationReason;
  source?: "self" | "partner_assist" | "system";
  tombstoneAt?: number;
};

export type RawConflictFacts = {
  duplicate: boolean;
  overlap: boolean;
};

function intervalsOverlap(
  left: Pick<LegacyClassificationRow, "startDate" | "endDate">,
  right: Pick<LegacyClassificationRow, "startDate" | "endDate">
): boolean {
  const leftEnd = left.endDate ?? "9999-12-31";
  const rightEnd = right.endDate ?? "9999-12-31";
  return left.startDate <= rightEnd && right.startDate <= leftEnd;
}

export function deriveRawConflictFacts(
  period: LegacyClassificationRow,
  rows: LegacyClassificationRow[]
): RawConflictFacts {
  const peers = rows.filter(
    (candidate) => {
      const sameRow =
        period._id !== undefined && candidate._id !== undefined
          ? period._id === candidate._id
          : period.id !== undefined && candidate.id !== undefined
            ? period.id === candidate.id
            : candidate === period;
      return !sameRow && candidate.tombstoneAt === undefined;
    }
  );
  return {
    duplicate: peers.some(
      (candidate) => candidate.startDate === period.startDate
    ),
    overlap: peers.some((candidate) => intervalsOverlap(candidate, period)),
  };
}

export function classifyLegacyCycleFact(
  period: LegacyClassificationRow,
  conflicts: RawConflictFacts
): LegacyClassificationReason | null {
  if (period.tombstoneAt !== undefined) return null;
  if (conflicts.duplicate) return "duplicate";
  if (conflicts.overlap) return "overlap";
  if (
    period.legacyReason !== undefined &&
    period.legacyReason !== "duplicate" &&
    period.legacyReason !== "overlap"
  ) {
    return period.legacyReason;
  }
  if (period.source === "system") return "inferred_end";
  if (
    period.startCertainty === undefined ||
    (period.endDate !== undefined && period.endCertainty === undefined)
  ) {
    return "missing_provenance";
  }
  if (
    period.startCertainty === "legacy_unknown" ||
    period.endCertainty === "legacy_unknown"
  ) {
    return "unprovable";
  }
  return null;
}
