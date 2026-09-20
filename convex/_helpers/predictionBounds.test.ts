import { describe, expect, test } from "vitest";

import {
  createLegacyPredictionBounds,
  isValidPredictionBounds,
  type PredictionBoundsV2,
} from "./predictionBounds";

describe("prediction bounds", () => {
  const v2Bounds: PredictionBoundsV2 = {
    version: 2,
    source: "period_prediction_v2",
    status: "limited_evidence",
    pointDate: "2026-03-10",
    earliestDate: "2026-03-07",
    latestDate: "2026-03-13",
    probabilityLabel: null,
    quality: "limited_evidence",
    basisCount: 4,
    estimatorId: "configured_v1",
    estimatorVersion: 1,
    calibrationVersion: null,
    reasonCodes: ["USER_CONFIGURED_BASELINE", "INSUFFICIENT_CALIBRATION"],
  };

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

  test("accepts a valid V2 bounds contract and requires approved calibration for a label", () => {
    expect(isValidPredictionBounds(v2Bounds)).toBe(true);
    expect(
      isValidPredictionBounds({
        ...v2Bounds,
        probabilityLabel: {
          level: 80,
          calibrationStatus: "approved",
          calibrationVersion: "calibration-v1",
        },
      }),
    ).toBe(false);
    expect(
      isValidPredictionBounds({
        ...v2Bounds,
        calibrationVersion: "calibration-v1",
        probabilityLabel: {
          level: 80,
          calibrationStatus: "approved",
          calibrationVersion: "calibration-v1",
        },
      }),
    ).toBe(true);
  });

  test("rejects invalid bound dates and metadata", () => {
    const cases: unknown[] = [
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
      { ...v2Bounds, pointDate: "2026-03-06" },
      { ...v2Bounds, quality: "unapproved" },
      { ...v2Bounds, reasonCodes: ["NOT_A_REASON"] },
    ];

    for (const bounds of cases) {
      expect(isValidPredictionBounds(bounds)).toBe(false);
    }
  });
});
