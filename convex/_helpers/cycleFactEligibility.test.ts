import { describe, expect, test } from "vitest";

import {
  getCycleFactReadLabel,
  isHistoryVisible,
  isPredictionEligible,
  selectLatestPredictionFact,
} from "./cycleFactEligibility.ts";

const exact = {
  id: "exact",
  startDate: "2026-07-01",
  startCertainty: "exact" as const,
};

describe("cycle fact read eligibility", () => {
  test.each([
    [exact, "exact", true, true],
    [
      { ...exact, startCertainty: "approximate" as const },
      "approximate",
      true,
      false,
    ],
    [
      {
        ...exact,
        startCertainty: "legacy_unknown" as const,
        legacyReason: "missing_provenance" as const,
      },
      "legacy_unknown",
      true,
      false,
    ],
    [
      {
        ...exact,
        legacyReason: "overlap" as const,
      },
      "legacy_unknown",
      true,
      false,
    ],
    [
      { ...exact, tombstoneAt: 1 },
      "exact",
      false,
      false,
    ],
  ])(
    "classifies %s as %s, visible=%s, predictionEligible=%s",
    (period, label, visible, eligible) => {
      expect(getCycleFactReadLabel(period)).toBe(label);
      expect(isHistoryVisible(period)).toBe(visible);
      expect(isPredictionEligible(period)).toBe(eligible);
    }
  );

  test("only the newest eligible exact fact enters prediction", () => {
    expect(
      selectLatestPredictionFact([
        { ...exact, startDate: "2026-07-01" },
        {
          ...exact,
          id: "approximate",
          startDate: "2026-08-01",
          startCertainty: "approximate",
        },
        {
          ...exact,
          id: "tombstoned",
          startDate: "2026-09-01",
          tombstoneAt: 2,
        },
        {
          ...exact,
          id: "newest-exact",
          startDate: "2026-08-15",
        },
      ])
    ).toMatchObject({ id: "newest-exact", startDate: "2026-08-15" });
  });

  test("does not treat an approximate end as exact evidence", () => {
    const period = {
      ...exact,
      endDate: "2026-07-05",
      endCertainty: "approximate" as const,
    };
    expect(getCycleFactReadLabel(period)).toBe("approximate");
    expect(isPredictionEligible(period)).toBe(false);
  });

  test("uses an exact start for prediction even when the end is approximate", () => {
    expect(
      isPredictionEligible({
        ...exact,
        endDate: "2026-07-05",
        endCertainty: "approximate",
      })
    ).toBe(true);
  });
});
