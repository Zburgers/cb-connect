import { describe, expect, test } from "vitest";

import { createLegacyPredictionBounds } from "./predictionBounds";
import { reduceCycleState, type CycleStateInput } from "./cycleState";

type TimezoneCase = {
  seed: number;
  label: string;
  timeZone: string;
  startDate: string;
  targetDate: string;
  expectedCycleDay: number;
};

const timezoneCases: TimezoneCase[] = [
  {
    seed: 2101,
    label: "Asia/Kolkata across leap day",
    timeZone: "Asia/Kolkata",
    startDate: "2024-02-28",
    targetDate: "2024-02-29",
    expectedCycleDay: 2,
  },
  {
    seed: 2102,
    label: "Los Angeles spring DST boundary",
    timeZone: "America/Los_Angeles",
    startDate: "2026-03-07",
    targetDate: "2026-03-08",
    expectedCycleDay: 2,
  },
  {
    seed: 2103,
    label: "Los Angeles fall DST boundary",
    timeZone: "America/Los_Angeles",
    startDate: "2026-10-31",
    targetDate: "2026-11-01",
    expectedCycleDay: 2,
  },
  {
    seed: 2104,
    label: "positive UTC offset across year rollover",
    timeZone: "Etc/GMT-5",
    startDate: "2024-12-31",
    targetDate: "2025-01-01",
    expectedCycleDay: 2,
  },
  {
    seed: 2105,
    label: "negative UTC offset across year rollover",
    timeZone: "Etc/GMT+8",
    startDate: "2024-12-31",
    targetDate: "2025-01-01",
    expectedCycleDay: 2,
  },
];

function inputForTimezoneCase(testCase: TimezoneCase): CycleStateInput {
  return {
    targetDate: testCase.targetDate,
    timeZone: testCase.timeZone,
    paused: false,
    eligibleFacts: [
      {
        id: "fixture-timezone",
        startDate: testCase.startDate,
      },
    ],
    bounds: createLegacyPredictionBounds({
      expectedDate: testCase.targetDate,
      graceDays: 0,
    }),
    cycleLength: 28,
    periodLength: 5,
  };
}

describe("cycle state timezone and calendar invariants", () => {
  test.each(timezoneCases)(
    "$label (seed $seed) preserves local calendar-day arithmetic",
    (testCase) => {
      expect(reduceCycleState(inputForTimezoneCase(testCase))).toMatchObject({
        status: "estimated",
        evidence: "CALENDAR_ESTIMATE",
        cycleDay: testCase.expectedCycleDay,
      });
    }
  );

  test("the same explicit local date has stable state across supported offsets", () => {
    const baseInput = inputForTimezoneCase({
      seed: 2201,
      label: "stable local date",
      timeZone: "UTC",
      startDate: "2026-03-08",
      targetDate: "2026-03-09",
      expectedCycleDay: 2,
    });

    const states = [
      "UTC",
      "Asia/Kolkata",
      "America/Los_Angeles",
      "Etc/GMT-5",
      "Etc/GMT+8",
    ].map((timeZone) =>
      reduceCycleState({ ...baseInput, timeZone })
    );

    expect(states).toEqual(
      states.map(() => ({
        version: 1,
        status: "estimated",
        phase: "menstruation",
        evidence: "CALENDAR_ESTIMATE",
        cycleDay: 2,
        bounds: baseInput.bounds,
        reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
      }))
    );
  });
});
