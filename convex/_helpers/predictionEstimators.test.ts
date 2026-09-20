import { describe, expect, test } from "vitest";

import {
  estimatePredictionCandidate,
  PREDICTION_ESTIMATOR_IDS,
  type PredictionEstimatorId,
} from "./predictionEstimators";

function estimate(
  estimatorId: PredictionEstimatorId,
  intervalsOldestToNewest: number[],
  configuredCycleLength = 28,
) {
  return estimatePredictionCandidate(estimatorId, {
    configuredCycleLength,
    intervalsOldestToNewest,
  });
}

describe("estimatePredictionCandidate", () => {
  test("exposes only the frozen versioned candidates", () => {
    expect(PREDICTION_ESTIMATOR_IDS).toEqual([
      "configured_v1",
      "all_mean_v1",
      "all_median_v1",
      "last3_mean_v1",
      "last3_median_v1",
      "recency_exp_h3_v1",
    ]);
  });

  test("reports configured length as a non-personalized baseline", () => {
    expect(estimate("configured_v1", [28, 29, 31], 32)).toMatchObject({
      estimatorId: "configured_v1",
      estimatorVersion: 1,
      pointCycleLength: 32,
      basisCount: 0,
      personalizationEligible: false,
      reasonCodes: ["USER_CONFIGURED_BASELINE"],
    });
  });

  test("computes all-history mean and odd/even medians with half-up rounding", () => {
    expect(estimate("all_mean_v1", [28, 29, 28])).toMatchObject({
      pointCycleLength: 28,
      basisCount: 3,
      personalizationEligible: true,
    });
    expect(estimate("all_median_v1", [28, 35, 29]).pointCycleLength).toBe(29);
    expect(estimate("all_mean_v1", [28, 29]).pointCycleLength).toBe(29);
    expect(estimate("all_median_v1", [28, 29, 34, 35]).pointCycleLength).toBe(
      32,
    );
  });

  test("uses the most recent up-to-three intervals for rolling candidates", () => {
    expect(estimate("last3_mean_v1", [27, 28, 31, 35])).toMatchObject({
      pointCycleLength: 31,
      basisCount: 3,
      personalizationEligible: true,
    });
    expect(estimate("last3_median_v1", [27, 28, 31, 35])).toMatchObject({
      pointCycleLength: 31,
      basisCount: 3,
      personalizationEligible: true,
    });
  });

  test("uses the frozen three-interval exponential half-life weights", () => {
    expect(estimate("recency_exp_h3_v1", [20, 40, 20]).pointCycleLength).toBe(
      27,
    );
    expect(estimate("recency_exp_h3_v1", [28, 32, 35])).toMatchObject({
      pointCycleLength: 32,
      basisCount: 3,
      personalizationEligible: true,
    });
  });

  test("preserves a long observed interval while robust candidates resist one outlier", () => {
    const intervals = [28, 29, 58, 28];

    expect(estimate("all_mean_v1", intervals).pointCycleLength).toBe(36);
    expect(estimate("all_median_v1", intervals).pointCycleLength).toBe(29);
    expect(estimate("last3_median_v1", intervals).pointCycleLength).toBe(29);
  });

  test("lets recent candidates follow a persistent shift", () => {
    const intervals = [28, 28, 28, 35, 36, 36];

    expect(estimate("all_median_v1", intervals).pointCycleLength).toBe(32);
    expect(estimate("last3_median_v1", intervals).pointCycleLength).toBe(36);
  });

  test("marks sparse estimates ineligible for personalization", () => {
    expect(estimate("all_mean_v1", [31, 33])).toMatchObject({
      pointCycleLength: 32,
      basisCount: 2,
      personalizationEligible: false,
      reasonCodes: ["LIMITED_HISTORY"],
    });
    expect(estimate("configured_v1", [31, 33]).pointCycleLength).toBe(28);
  });

  test("falls back to the configured point when no intervals exist", () => {
    expect(estimate("all_median_v1", [], 31)).toMatchObject({
      pointCycleLength: 31,
      basisCount: 0,
      personalizationEligible: false,
      reasonCodes: ["LIMITED_HISTORY", "USER_CONFIGURED_BASELINE"],
    });
  });

  test("rejects invalid configuration and interval values", () => {
    expect(() => estimate("configured_v1", [], Number.NaN)).toThrow();
    expect(() => estimate("all_mean_v1", [28, 0])).toThrow();
    expect(() => estimate("all_mean_v1", [28, 29.5])).toThrow();
  });
});
