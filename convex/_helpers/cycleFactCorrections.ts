import type {
  CycleFactCertainty,
  LegacyCycleFactReason,
} from "./cycleFactSemantics";

export type CycleFactCorrectionInput = {
  existingStartCertainty: CycleFactCertainty;
  existingEndCertainty?: CycleFactCertainty;
  existingEndDate?: string;
  existingLegacyReason?: LegacyCycleFactReason;
  correctedEndDate?: string;
  correctedEndCertainty?: CycleFactCertainty;
  promoteStartCertainty: boolean;
  promoteEndCertainty: boolean;
};

export type CycleFactCorrection = {
  startCertainty: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  legacyReason?: LegacyCycleFactReason;
};

export function resolveCycleFactCorrection(
  input: CycleFactCorrectionInput
): CycleFactCorrection {
  const startCertainty = input.promoteStartCertainty
    ? "exact"
    : input.existingStartCertainty;
  const endCertainty =
    input.correctedEndDate === undefined
      ? undefined
      : input.existingEndDate === undefined
        ? input.promoteEndCertainty
          ? "exact"
          : input.correctedEndCertainty ?? "approximate"
        : input.promoteEndCertainty
          ? "exact"
          : input.existingEndCertainty ?? "legacy_unknown";
  const hasUnknownField =
    startCertainty === "legacy_unknown" ||
    (input.correctedEndDate !== undefined &&
      endCertainty === "legacy_unknown");
  const legacyReason =
    input.existingLegacyReason === "missing_provenance" && !hasUnknownField
      ? undefined
      : input.existingLegacyReason ??
        (hasUnknownField ? "missing_provenance" : undefined);

  return { startCertainty, endCertainty, legacyReason };
}
