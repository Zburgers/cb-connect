import { describe, expect, test } from "vitest";

import type { PeriodPredictionV2 } from "@/convex/_helpers/periodPrediction";
import { getPredictionPresentation } from "./predictionPresentation";

const prediction: PeriodPredictionV2 = {
  version: 2,
  source: "period_prediction_v2",
  status: "limited_evidence",
  pointDate: "2026-09-21",
  earliestDate: "2026-09-18",
  latestDate: "2026-09-25",
  probabilityLabel: null,
  quality: "timing_less_predictable",
  basisCount: 4,
  estimatorId: "configured_v1",
  estimatorVersion: 1,
  calibrationVersion: null,
  reasonCodes: [
    "POSSIBLE_MISSING_LOG",
    "PERSONALIZATION_NOT_APPROVED",
    "RECENT_TIMING_VARIABLE",
  ],
};

describe("primary period prediction presentation", () => {
  test("uses estimate and estimated-range language without a probability label", () => {
    const result = getPredictionPresentation(prediction);

    expect(result).toMatchObject({
      status: "active",
      statusLabel: "Period timing estimate",
      qualityLabel: "Timing less predictable",
      pointText: "Estimated around Sep 21, 2026",
      rangeLabel: "Estimated range",
      rangeText: "Sep 18, 2026–Sep 25, 2026",
      basisText: "Based on 4 eligible start-to-start intervals.",
    });
    expect(result.explanations).toContain(
      "A long recorded gap may include an unlogged period; it stays in the history and widens the range.",
    );
  });

  test("uses calibrated probability language only for an approved matching version", () => {
    const result = getPredictionPresentation({
      ...prediction,
      probabilityLabel: {
        level: 80,
        calibrationStatus: "approved",
        calibrationVersion: "bench-v1",
      },
      calibrationVersion: "bench-v1",
    });

    expect(result.rangeLabel).toBe("80% likely range");
  });

  test("fails closed to estimated wording when calibration versions mismatch", () => {
    const result = getPredictionPresentation({
      ...prediction,
      probabilityLabel: {
        level: 80,
        calibrationStatus: "approved",
        calibrationVersion: "bench-v1",
      },
      calibrationVersion: "bench-v2",
    });

    expect(result.rangeLabel).toBe("Estimated range");
  });

  test("paused and unavailable predictions never receive dates", () => {
    const paused = getPredictionPresentation({
      version: 2,
      source: "period_prediction_v2",
      status: "paused",
      pointDate: null,
      earliestDate: null,
      latestDate: null,
      probabilityLabel: null,
      quality: "limited_evidence",
      basisCount: 2,
      estimatorId: "configured_v1",
      estimatorVersion: 1,
      calibrationVersion: null,
      reasonCodes: ["USER_PAUSED"],
    });
    const unavailable = getPredictionPresentation({
      version: 2,
      source: "period_prediction_v2",
      status: "unavailable",
      pointDate: null,
      earliestDate: null,
      latestDate: null,
      probabilityLabel: null,
      quality: "limited_evidence",
      basisCount: 0,
      estimatorId: "configured_v1",
      estimatorVersion: 1,
      calibrationVersion: null,
      reasonCodes: ["NO_ELIGIBLE_FACT"],
    });

    expect(paused).toMatchObject({
      status: "paused",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      explanations: ["Predictions are paused in Settings."],
    });
    expect(unavailable).toMatchObject({
      status: "unavailable",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
      explanations: ["Record an exact period start to get an estimated range."],
    });
  });

  test("rejects malformed calendar dates instead of rendering them", () => {
    const result = getPredictionPresentation({
      ...prediction,
      pointDate: "2026-02-30",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      pointText: null,
      rangeLabel: null,
      rangeText: null,
    });
  });
});
