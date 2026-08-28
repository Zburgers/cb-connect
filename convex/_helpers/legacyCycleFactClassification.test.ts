import { describe, expect, test } from "vitest";

import { classifyLegacyCycleFact } from "./legacyCycleFactClassification";

const exactRow = {
  startDate: "2026-01-01",
  endDate: "2026-01-05",
  startCertainty: "exact" as const,
  endCertainty: "exact" as const,
};

describe("legacy cycle fact classification", () => {
  test.each([
    [{ duplicate: true, overlap: true }, "duplicate"],
    [{ duplicate: false, overlap: true }, "overlap"],
    [{ duplicate: false, overlap: false }, null],
  ])("uses raw conflict facts before stored labels", (conflicts, reason) => {
    expect(
      classifyLegacyCycleFact(
        { ...exactRow, legacyReason: "duplicate" },
        conflicts
      )
    ).toBe(reason);
  });

  test("falls back to non-conflict provenance reasons", () => {
    expect(
      classifyLegacyCycleFact(
        { ...exactRow, legacyReason: "inferred_end" },
        { duplicate: false, overlap: false }
      )
    ).toBe("inferred_end");
    expect(
      classifyLegacyCycleFact(
        { ...exactRow, source: "system" },
        { duplicate: false, overlap: false }
      )
    ).toBe("inferred_end");
  });

  test("ignores tombstones and labels clean exact rows as clean", () => {
    expect(
      classifyLegacyCycleFact(
        { ...exactRow, tombstoneAt: 1 },
        { duplicate: true, overlap: true }
      )
    ).toBeNull();
    expect(
      classifyLegacyCycleFact(exactRow, { duplicate: false, overlap: false })
    ).toBeNull();
  });
});
