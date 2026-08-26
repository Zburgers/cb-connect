import { describe, expect, test } from "vitest";

import { createLegacyPredictionBounds } from "./predictionBounds";
import {
  reduceCycleState,
  type CycleStateInput,
  type EligibleCycleFact,
} from "./cycleState";

const bounds = createLegacyPredictionBounds({ expectedDate: "2026-03-10" });

function fact(
  overrides: Partial<EligibleCycleFact> = {}
): EligibleCycleFact {
  return {
    id: "period-1",
    startDate: "2026-02-10",
    ...overrides,
  };
}

function input(overrides: Partial<CycleStateInput> = {}): CycleStateInput {
  return {
    targetDate: "2026-02-15",
    timeZone: "UTC",
    paused: false,
    eligibleFacts: [fact()],
    bounds,
    cycleLength: 28,
    periodLength: 5,
    ...overrides,
  };
}

describe("cycle state", () => {
  test.each([
    ["no eligible history", [], "NO_ELIGIBLE_FACT"],
    ["ineligible history is not supplied as eligible", [], "NO_ELIGIBLE_FACT"],
  ])("returns Unknown for the supplied history case", (_label, eligibleFacts, reason) => {
    expect(
      reduceCycleState(input({ eligibleFacts }))
    ).toMatchObject({
      version: 1,
      status: "insufficient_data",
      phase: null,
      evidence: "UNAVAILABLE",
      cycleDay: null,
      reason,
    });
  });

  test("returns Unknown when the latest eligible start is in the future", () => {
    expect(
      reduceCycleState(
        input({
          targetDate: "2026-03-10",
          eligibleFacts: [fact({ startDate: "2026-03-11" })],
        })
      )
    ).toMatchObject({
      status: "insufficient_data",
      reason: "FUTURE_START",
      cycleDay: null,
    });
  });

  test.each([
    ["menstruation", "2026-02-10", 1],
    ["follicular", "2026-02-15", 6],
    ["ovulation", "2026-02-23", 14],
    ["luteal", "2026-02-26", 17],
  ] as const)("estimates each phase with calendar evidence", (phase, targetDate, cycleDay) => {
    expect(
      reduceCycleState(input({ targetDate }))
    ).toMatchObject({
      version: 1,
      status: "estimated",
      phase,
      evidence: "CALENDAR_ESTIMATE",
      cycleDay,
      bounds,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    });
  });

  test("keeps a closed exact event covering today as Recorded", () => {
    expect(
      reduceCycleState(
        input({
          targetDate: "2026-02-12",
          eligibleFacts: [
            fact({ startDate: "2026-02-10", endDate: "2026-02-14" }),
          ],
        })
      )
    ).toEqual({
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 3,
      coveringEventId: "period-1",
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    });
  });

  test("allows an open event to be Recorded only with explicit coverage", () => {
    expect(
      reduceCycleState(
        input({
          targetDate: "2026-02-12",
          eligibleFacts: [fact({ coversTargetDate: true })],
        })
      ).status
    ).toBe("recorded_period");
  });

  test("does not turn an open event into Recorded from periodLength", () => {
    expect(
      reduceCycleState(
        input({
          targetDate: "2026-02-18",
          eligibleFacts: [fact()],
          periodLength: 5,
        })
      )
    ).toMatchObject({
      status: "estimated",
      phase: "follicular",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 9,
    });
  });

  test("keeps the final bound estimated", () => {
    expect(
      reduceCycleState(input({ targetDate: "2026-03-13" }))
    ).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 32,
    });
  });

  test("returns Late the day after the latest bound without a phase or cycle day", () => {
    expect(
      reduceCycleState(input({ targetDate: "2026-03-14" }))
    ).toEqual({
      version: 1,
      status: "late_or_uncertain",
      phase: null,
      evidence: "TIMING_UNCERTAINTY",
      cycleDay: null,
      bounds,
      reason: "AFTER_LATEST_BOUND",
    });
  });

  test("never wraps a late date back to cycle day one", () => {
    const state = reduceCycleState(input({ targetDate: "2027-01-01" }));
    expect(state.status).toBe("late_or_uncertain");
    expect(state.cycleDay).toBeNull();
    expect(state.phase).toBeNull();
  });

  test("Paused takes precedence over every other state", () => {
    expect(
      reduceCycleState(input({ paused: true }))
    ).toEqual({
      version: 1,
      status: "prediction_paused",
      phase: null,
      evidence: "USER_PAUSED",
      cycleDay: null,
      reason: "USER_PAUSED",
    });
  });

  test("Recorded takes precedence over missing timezone", () => {
    expect(
      reduceCycleState(
        input({
          timeZone: undefined,
          targetDate: "2026-02-12",
          eligibleFacts: [fact({ endDate: "2026-02-14" })],
        })
      ).status
    ).toBe("recorded_period");
  });

  test("returns Unknown when the local timezone is missing", () => {
    expect(
      reduceCycleState(input({ timeZone: undefined }))
    ).toMatchObject({
      status: "insufficient_data",
      reason: "MISSING_TIMEZONE",
      cycleDay: null,
    });
  });

  test.each(["Not/AZone"])(
    "returns Unknown instead of Estimated or Late for an invalid IANA timezone",
    (timeZone) => {
      for (const targetDate of ["2026-02-15", "2026-03-14"]) {
        expect(
          reduceCycleState(input({ timeZone, targetDate }))
        ).toMatchObject({
          status: "insufficient_data",
          phase: null,
          cycleDay: null,
          reason: "MISSING_TIMEZONE",
        });
      }
    }
  );

  test("returns Unknown before checking event coverage for a malformed target date", () => {
    expect(
      reduceCycleState(
        input({
          targetDate: "2026-02-12-not-a-date",
          eligibleFacts: [
            fact({ startDate: "2026-02-10", endDate: "2026-02-14" }),
          ],
        })
      )
    ).toMatchObject({
      status: "insufficient_data",
      phase: null,
      cycleDay: null,
      reason: "NO_ELIGIBLE_FACT",
    });
  });

  test("returns Unknown for invalid bounds", () => {
    expect(
      reduceCycleState(
        input({
          bounds: {
            ...bounds,
            latestDate: "2026-03-09",
          },
        })
      )
    ).toMatchObject({
      status: "insufficient_data",
      reason: "INVALID_BOUNDS",
      cycleDay: null,
    });
  });

  test("keeps leap-day and year-rollover arithmetic calendar based", () => {
    const rolloverBounds = createLegacyPredictionBounds({
      expectedDate: "2025-01-05",
    });
    expect(
      reduceCycleState(
        input({
          targetDate: "2025-01-01",
          eligibleFacts: [fact({ startDate: "2024-12-31" })],
          bounds: rolloverBounds,
        })
      )
    ).toMatchObject({
      status: "estimated",
      cycleDay: 2,
      phase: "menstruation",
    });
  });
});
