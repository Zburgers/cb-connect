import { describe, expect, test } from "vitest";
import { derivePredictionQuality } from "./predictionQuality";

describe("prediction quality diagnostics", () => {
  test("maps higher calibration risk deciles to lower internal scores", () => {
    const results = Array.from({ length: 10 }, (_, calibrationRiskDecile) =>
      derivePredictionQuality({
        calibrationRiskDecile,
        calibrationOutcomeCount: 20,
        historyCount: 7,
        variabilityBand: "stable",
      }),
    );

    expect(results.map((result) => result.qualityScoreV1)).toEqual([
      100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
    ]);
    expect(results[0].quality).toBe("high");
    expect(results[5].quality).toBe("moderate");
    expect(results[9].quality).toBe("low");
  });

  test("marks sparse calibration as limited evidence with no numeric score", () => {
    const result = derivePredictionQuality({
      calibrationRiskDecile: 0,
      calibrationOutcomeCount: 19,
      historyCount: 7,
      variabilityBand: "stable",
    });

    expect(result.quality).toBe("limited_evidence");
    expect(result.qualityScoreV1).toBeNull();
    expect(result.reasonCodes).toContain("INSUFFICIENT_CALIBRATION");
  });

  test("lowers ordinal quality for high variability without abstaining", () => {
    const result = derivePredictionQuality({
      calibrationRiskDecile: 0,
      calibrationOutcomeCount: 20,
      historyCount: 7,
      variabilityBand: "high",
    });

    expect(result.quality).toBe("timing_less_predictable");
    expect(result.qualityScoreV1).toBe(100);
    expect(result.reasonCodes).toContain("RECENT_TIMING_VARIABLE");
  });

  test("keeps sparse histories in limited evidence", () => {
    const result = derivePredictionQuality({
      calibrationRiskDecile: 1,
      calibrationOutcomeCount: 20,
      historyCount: 2,
      variabilityBand: "moderate",
    });

    expect(result.quality).toBe("limited_evidence");
    expect(result.reasonCodes).toContain("SPARSE_HISTORY");
  });
});
