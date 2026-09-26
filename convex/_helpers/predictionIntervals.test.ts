import { describe, expect, test } from "vitest";
import {
  buildPredictionIntervals,
  MIN_CALIBRATION_RESIDUALS,
  PREDICTION_CALIBRATION_VERSION,
} from "./predictionIntervals";

const residuals = (spread: number) =>
  Array.from({ length: 21 }, (_, index) => index - spread);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const calendarDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

describe("calibrated prediction intervals", () => {
  test("widens monotonically with variability and keeps the 80% window outside 50%", () => {
    const byVariability = {
      stable: residuals(10),
      moderate: residuals(20),
      high: residuals(30),
    };
    const intervalFor = (variabilityBand: "stable" | "moderate" | "high") =>
      buildPredictionIntervals({
        pointDate: "2024-02-28",
        variabilityBand,
        calibrationResiduals: [
          ...byVariability.stable,
          ...byVariability.moderate,
          ...byVariability.high,
        ],
        calibrationResidualsByVariability: byVariability,
      });

    const stable = intervalFor("stable");
    const moderate = intervalFor("moderate");
    const high = intervalFor("high");
    const width = (window: typeof stable.window80) =>
      Date.parse(`${window.latestDate}T00:00:00Z`) -
      Date.parse(`${window.earliestDate}T00:00:00Z`);

    expect(width(moderate.window80)).toBeGreaterThanOrEqual(width(stable.window80));
    expect(width(high.window80)).toBeGreaterThanOrEqual(width(moderate.window80));
    expect(calendarDay(stable.window80.earliestDate)).toBeLessThanOrEqual(
      calendarDay(stable.window50.earliestDate),
    );
    expect(calendarDay(stable.window80.latestDate)).toBeGreaterThanOrEqual(
      calendarDay(stable.window50.latestDate),
    );
    expect(stable.window80.pointDate).toBe("2024-02-28");
    expect(stable.empiricalTargetCoverageLevel).toBeNull();
  });

  test("uses prior personal residuals only after five and widens for an outlier", () => {
    const baseline = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals: [],
      personalResiduals: [0, 0, 0, 0, 0],
    });
    const withOutlier = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals: [],
      personalResiduals: [0, 0, 0, 0, 0, 10],
    });
    const tooFew = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals: [],
      personalResiduals: [0, 0, 0, 10],
    });

    expect(baseline.calibrationSource).toBe("personal_walk_forward");
    expect(calendarDay(withOutlier.window80.latestDate)).toBeGreaterThan(
      calendarDay(baseline.window80.latestDate),
    );
    expect(withOutlier.window80.pointDate).toBe(baseline.window80.pointDate);
    expect(tooFew.calibrationSource).toBe("none");
    expect(tooFew.personalResidualCount).toBe(4);
    expect(tooFew.empiricalTargetCoverageLevel).toBeNull();
    expect(tooFew.reasonCodes).toContain("INSUFFICIENT_CALIBRATION");
  });

  test("preserves asymmetric residuals and persistent shifts around the point", () => {
    const interval = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "moderate",
      calibrationResiduals: [],
      personalResiduals: [-1, 0, 0, 0, 4, 4, 5, 5, 6],
    });

    expect(interval.window80.earliestDate).toBe("2023-12-31");
    expect(interval.window80.latestDate).toBe("2024-01-07");
    expect(interval.window80.pointDate).toBe("2024-01-01");
  });

  test("widens for correction, missing-log, and context-boundary reasons", () => {
    const calibrationResiduals = Array(21).fill(0);
    const baseline = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals,
    });
    const contextual = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      historyCount: 2,
      calibrationResiduals,
      context: {
        approximateLegacyAdjacent: true,
        partnerAssisted: true,
        possibleMissingLog: true,
        recentCorrection: true,
        segmentBoundary: true,
      },
    });

    expect(calendarDay(contextual.window80.earliestDate)).toBe(
      calendarDay(baseline.window80.earliestDate) - 5 * MS_PER_DAY,
    );
    expect(calendarDay(contextual.window80.latestDate)).toBe(
      calendarDay(baseline.window80.latestDate) + 5 * MS_PER_DAY,
    );
    expect(contextual.window80.pointDate).toBe(baseline.window80.pointDate);
    expect(contextual.reasonCodes).toContain("APPROXIMATE_LEGACY_ADJACENCY");
    expect(contextual.reasonCodes).toContain("PARTNER_ASSISTED");
    expect(contextual.reasonCodes).toContain("POSSIBLE_MISSING_LOG");
    expect(contextual.reasonCodes).toContain("RECENT_CORRECTION");
    expect(contextual.reasonCodes).toContain("CONTEXT_BOUNDARY");
    expect(contextual.reasonCodes).toContain("SPARSE_HISTORY");
  });

  test("requires enough calibration residuals before attaching 80% language", () => {
    const insufficient = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals: Array(MIN_CALIBRATION_RESIDUALS - 1).fill(0),
      approvedTargetCoverageLevel: 80,
    });
    const calibrated = buildPredictionIntervals({
      pointDate: "2024-01-01",
      variabilityBand: "stable",
      calibrationResiduals: Array(MIN_CALIBRATION_RESIDUALS).fill(0),
      approvedTargetCoverageLevel: 80,
    });

    expect(insufficient.empiricalTargetCoverageLevel).toBeNull();
    expect(calibrated.empiricalTargetCoverageLevel).toBe(80);
    expect(calibrated.calibrationVersion).toBe(PREDICTION_CALIBRATION_VERSION);
  });

  test("uses calendar dates across leap day without timezone arithmetic", () => {
    const interval = buildPredictionIntervals({
      pointDate: "2024-02-28",
      variabilityBand: "stable",
      calibrationResiduals: Array.from({ length: 21 }, (_, index) =>
        index % 2 === 0 ? -2 : 2,
      ),
    });

    expect(interval.window80.earliestDate).toBe("2024-02-26");
    expect(interval.window80.latestDate).toBe("2024-03-01");
  });
});
