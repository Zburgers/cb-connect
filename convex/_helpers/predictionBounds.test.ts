import { describe, expect, test } from "vitest";

import {
  createLegacyPredictionBounds,
  isValidPredictionBounds,
  type PredictionBounds,
} from "./predictionBounds";

describe("prediction bounds", () => {
  test("creates a version-one legacy bound with a three-day grace", () => {
    expect(
      createLegacyPredictionBounds({ expectedDate: "2026-03-10" })
    ).toEqual({
      version: 1,
      source: "legacy_configured",
      expectedDate: "2026-03-10",
      earliestDate: "2026-03-10",
      latestDate: "2026-03-13",
      reason: "LEGACY_UNCALIBRATED_GRACE",
      basisCount: 1,
    });
  });

  test("keeps a caller-provided legacy grace deterministic", () => {
    expect(
      createLegacyPredictionBounds({ expectedDate: "2024-12-31", graceDays: 2 })
        .latestDate
    ).toBe("2025-01-02");
  });

  test("rejects invalid bound dates and metadata", () => {
    const cases: PredictionBounds[] = [
      {
        version: 1,
        source: "legacy_configured",
        expectedDate: "2026-03-10",
        earliestDate: "2026-03-11",
        latestDate: "2026-03-13",
        reason: "LEGACY_UNCALIBRATED_GRACE",
        basisCount: 1,
      },
      {
        version: 1,
        source: "legacy_configured",
        expectedDate: "2026-03-10",
        earliestDate: "2026-03-10",
        latestDate: "2026-03-09",
        reason: "LEGACY_UNCALIBRATED_GRACE",
        basisCount: 1,
      },
      {
        version: 1,
        source: "legacy_configured",
        expectedDate: "2026-02-30",
        earliestDate: "2026-02-30",
        latestDate: "2026-03-05",
        reason: "LEGACY_UNCALIBRATED_GRACE",
        basisCount: 1,
      },
      {
        version: 2 as 1,
        source: "legacy_configured",
        expectedDate: "2026-03-10",
        earliestDate: "2026-03-10",
        latestDate: "2026-03-13",
        reason: "LEGACY_UNCALIBRATED_GRACE",
        basisCount: 1,
      },
    ];

    for (const bounds of cases) {
      expect(isValidPredictionBounds(bounds)).toBe(false);
    }
  });
});
