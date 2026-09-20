import { describe, expect, test } from "vitest";

import {
  deriveCycleIntervals,
  type CycleIntervalEvent,
} from "./cycleIntervals";
import { addCalendarDays } from "./cycleCalculations";
import { buildPeriodPrediction } from "./periodPrediction";

const cutoffAt = 1_000_000;
const day = (date: string) => Date.parse(`${date}T00:00:00Z`);

function history(
  lengths: readonly number[],
  options: {
    segmentStartIndex?: number;
    partnerAssistIndex?: number;
    correctionIndex?: number;
  } = {},
) {
  const periods: CycleIntervalEvent[] = [
    {
      startDate: "2024-01-01",
      startCertainty: "exact" as const,
      source: "self" as const,
      confirmationStatus: "confirmed" as const,
      authorityVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  for (const [index, length] of lengths.entries()) {
    const previous = periods[periods.length - 1];
    periods.push({
      startDate: addCalendarDays(previous.startDate, length),
      startCertainty: "exact" as const,
      source:
        index + 1 === options.partnerAssistIndex
          ? ("partner_assist" as const)
          : ("self" as const),
      confirmationStatus: "confirmed" as const,
      authorityVersion: 1,
      ...(index + 1 === options.correctionIndex
        ? { primaryCorrectionVersion: 1 }
        : {}),
      createdAt: index + 2,
      updatedAt: index + 2,
    });
  }

  return deriveCycleIntervals(periods, {
    cutoffAt,
    cutoffDate: "2026-12-31",
    ...(options.segmentStartIndex === undefined
      ? {}
      : {
          segments: [
            {
              startDate: periods[options.segmentStartIndex].startDate,
              status: "active" as const,
              createdAt: cutoffAt - 1,
            },
          ],
        }),
  });
}

function predict(
  lengths: readonly number[],
  options?: Parameters<typeof history>[1],
) {
  return buildPeriodPrediction({
    cycleIntervals: history(lengths, options),
    configuredCycleLength: 28,
    predictionPaused: false,
  });
}

describe("versioned personal period prediction contract", () => {
  test("one start uses the configured baseline and does not label personalization", () => {
    const result = predict([]);

    expect(result).toMatchObject({
      version: 2,
      status: "configured",
      pointDate: "2024-01-29",
      estimatorId: "configured_v1",
      basisCount: 0,
      reasonCodes: expect.arrayContaining([
        "USER_CONFIGURED_BASELINE",
        "LIMITED_HISTORY",
      ]),
      probabilityLabel: null,
    });
  });

  test.each([2, 3])(
    "handles %i eligible intervals at the threshold",
    (count) => {
      const result = predict(Array(count).fill(28));

      expect(result.status).toBe(count < 3 ? "configured" : "limited_evidence");
      expect(result.status).not.toBe("personalized");
      expect(result.basisCount).toBe(count);
      expect(result.probabilityLabel).toBeNull();
    },
  );

  test.each([4, 6])(
    "keeps %i intervals limited until D-013 approves promotion",
    (count) => {
      const result = predict(Array(count).fill(28));

      expect(result.status).toBe("limited_evidence");
      expect(result.estimatorId).toBe("configured_v1");
      expect(result.reasonCodes).toContain("PERSONALIZATION_NOT_APPROVED");
    },
  );

  test("keeps a stable history on the configured point with the legacy uncalibrated grace", () => {
    const result = predict([28, 28, 28, 28, 28]);

    expect(result).toMatchObject({
      status: "limited_evidence",
      earliestDate: result.pointDate,
      latestDate: addCalendarDays(result.pointDate!, 3),
      quality: "limited_evidence",
      probabilityLabel: null,
    });
  });

  test("widens for robust timing variation without claiming coverage", () => {
    const stable = predict([28, 28, 28, 28, 28]);
    const variable = predict([24, 34, 26, 36, 23]);
    const width = (result: typeof stable) =>
      day(result.latestDate!) - day(result.earliestDate!);

    expect(variable.pointDate).toBe(
      addCalendarDays(
        history([24, 34, 26, 36, 23]).latestEligibleStartDate!,
        28,
      ),
    );
    expect(width(variable)).toBeGreaterThan(width(stable));
    expect(variable.quality).toBe("limited_evidence");
    expect(variable.reasonCodes).toContain("RECENT_TIMING_VARIABLE");
    expect(variable.probabilityLabel).toBeNull();
  });

  test("a single outlier does not replace the configured point estimate", () => {
    const result = predict([28, 28, 28, 56]);

    expect(result.estimatorId).toBe("configured_v1");
    expect(result.pointDate).toBe(
      addCalendarDays(history([28, 28, 28, 56]).latestEligibleStartDate!, 28),
    );
    expect(result.reasonCodes).toContain("POSSIBLE_MISSING_LOG");
    expect(result.probabilityLabel).toBeNull();
  });

  test("a persistent shift widens the configured range but does not silently move its point", () => {
    const stable = predict([28, 28, 28, 28]);
    const shifted = predict([30, 30, 30, 30]);

    expect(shifted.pointDate).toBe(
      addCalendarDays(history([30, 30, 30, 30]).latestEligibleStartDate!, 28),
    );
    expect(day(shifted.latestDate!) - day(shifted.earliestDate!)).toBeGreaterThan(
      day(stable.latestDate!) - day(stable.earliestDate!),
    );
    expect(shifted.reasonCodes).toContain("USER_CONFIGURED_BASELINE");
  });

  test("accepts a partner-assisted anchor and names the provenance", () => {
    const result = predict([28, 28, 28, 28], { partnerAssistIndex: 2 });

    expect(result.status).toBe("limited_evidence");
    expect(result.reasonCodes).toContain("PARTNER_ASSISTED");
  });

  test("uses only history on or after the active segment boundary", () => {
    const result = predict([28, 28, 28, 28, 28], { segmentStartIndex: 3 });

    expect(result.basisCount).toBe(2);
    expect(result.status).toBe("configured");
    expect(result.reasonCodes).toContain("CONTEXT_SEGMENT");
  });

  test("widens the next prediction after a primary correction marker", () => {
    const result = predict([28, 28, 28, 28], { correctionIndex: 3 });

    expect(result.reasonCodes).toContain("RECENT_CORRECTION");
    expect(result.probabilityLabel).toBeNull();
  });

  test("marks paused and empty histories without inventing dates", () => {
    const emptyHistory = deriveCycleIntervals([], {
      cutoffAt,
      cutoffDate: "2026-12-31",
    });
    const paused = buildPeriodPrediction({
      cycleIntervals: history([]),
      configuredCycleLength: 28,
      predictionPaused: true,
    });
    const unavailable = buildPeriodPrediction({
      cycleIntervals: emptyHistory,
      configuredCycleLength: 28,
      predictionPaused: false,
    });

    expect(paused).toMatchObject({
      status: "paused",
      pointDate: null,
      probabilityLabel: null,
    });
    expect(unavailable).toMatchObject({
      status: "unavailable",
      pointDate: null,
      reasonCodes: expect.arrayContaining(["NO_ELIGIBLE_FACT"]),
    });
  });

  test("refuses a prediction when the cycle history read was truncated", () => {
    const result = buildPeriodPrediction({
      cycleIntervals: history([28, 28, 28, 28]),
      historyComplete: false,
      configuredCycleLength: 28,
      predictionPaused: false,
    });

    expect(result.status).toBe("unavailable");
    expect(result.pointDate).toBeNull();
    expect(result.reasonCodes).toContain("LIMITED_HISTORY");
  });

  test("keeps every active point inside its returned uncalibrated range", () => {
    for (const result of [
      predict([]),
      predict([28, 28, 28]),
      predict([24, 34, 26, 36, 23]),
      predict([28, 28, 28, 56]),
    ]) {
      expect(result.earliestDate! <= result.pointDate!).toBe(true);
      expect(result.pointDate! <= result.latestDate!).toBe(true);
      expect(result.probabilityLabel).toBeNull();
    }
  });
});
