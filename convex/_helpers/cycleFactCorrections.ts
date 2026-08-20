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
  promoteCertainty: boolean;
};

export type CycleFactCorrection = {
  startCertainty: CycleFactCertainty;
  endCertainty?: CycleFactCertainty;
  legacyReason?: LegacyCycleFactReason;
};

export function resolveCycleFactCorrection(
  input: CycleFactCorrectionInput
): CycleFactCorrection {
  if (input.promoteCertainty) {
    return {
      startCertainty: "exact",
      endCertainty: input.correctedEndDate === undefined ? undefined : "exact",
      legacyReason: undefined,
    };
  }

  const startCertainty = input.existingStartCertainty;
  const endCertainty =
    input.correctedEndDate === undefined
      ? undefined
      : input.existingEndDate === undefined
        ? startCertainty
        : input.existingEndCertainty ?? "legacy_unknown";
  const legacyReason =
    input.existingLegacyReason ??
    (startCertainty === "legacy_unknown" ||
    (input.existingEndDate !== undefined && endCertainty === "legacy_unknown")
      ? "missing_provenance"
      : undefined);

  return { startCertainty, endCertainty, legacyReason };
}
