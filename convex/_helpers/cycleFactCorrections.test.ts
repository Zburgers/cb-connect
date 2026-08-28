import { describe, expect, test } from "vitest";

import { resolveCycleFactCorrection } from "./cycleFactCorrections";

describe("cycle fact correction certainty", () => {
  test("promotes start and end certainty independently", () => {
    expect(
      resolveCycleFactCorrection({
        existingStartCertainty: "approximate",
        existingEndCertainty: "approximate",
        existingEndDate: "2026-08-04",
        correctedEndDate: "2026-08-05",
        promoteStartCertainty: true,
        promoteEndCertainty: false,
      } as never)
    ).toEqual({
      startCertainty: "exact",
      endCertainty: "approximate",
      legacyReason: undefined,
    });
  });

  test("preserves approximate certainty when correcting an open fact", () => {
    expect(
      resolveCycleFactCorrection({
        existingStartCertainty: "approximate",
        existingEndDate: undefined,
        correctedEndDate: "2026-08-05",
        promoteStartCertainty: false,
        promoteEndCertainty: false,
      })
    ).toEqual({
      startCertainty: "approximate",
      endCertainty: "approximate",
      legacyReason: undefined,
    });
  });

  test("preserves legacy unknown certainty and reason by default", () => {
    expect(
      resolveCycleFactCorrection({
        existingStartCertainty: "legacy_unknown",
        existingEndCertainty: "legacy_unknown",
        existingEndDate: "2026-08-04",
        existingLegacyReason: "missing_provenance",
        correctedEndDate: "2026-08-05",
        promoteStartCertainty: false,
        promoteEndCertainty: false,
      })
    ).toEqual({
      startCertainty: "legacy_unknown",
      endCertainty: "legacy_unknown",
      legacyReason: "missing_provenance",
    });
  });

  test("promotes both sides only after explicit confirmation", () => {
    expect(
      resolveCycleFactCorrection({
        existingStartCertainty: "approximate",
        existingEndCertainty: "approximate",
        existingEndDate: "2026-08-04",
        existingLegacyReason: undefined,
        correctedEndDate: "2026-08-05",
        promoteStartCertainty: true,
        promoteEndCertainty: true,
      })
    ).toEqual({
      startCertainty: "exact",
      endCertainty: "exact",
      legacyReason: undefined,
    });
  });
});
