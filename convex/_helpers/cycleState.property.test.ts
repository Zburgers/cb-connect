import { describe, expect, test } from "vitest";

import { createLegacyPredictionBounds } from "./predictionBounds";
import {
  reduceCycleState,
  type CycleStateInput,
  type EligibleCycleFact,
} from "./cycleState";

type PropertyCase = {
  seed: number;
  label: string;
  input: CycleStateInput;
};

function fact(
  id: string,
  startDate: string,
  overrides: Partial<EligibleCycleFact> = {}
): EligibleCycleFact {
  return { id, startDate, ...overrides };
}

function stateInput(
  overrides: Partial<CycleStateInput> = {}
): CycleStateInput {
  return {
    targetDate: "2026-01-12",
    timeZone: "UTC",
    paused: false,
    eligibleFacts: [fact("fixture-open", "2026-01-01")],
    bounds: createLegacyPredictionBounds({
      expectedDate: "2026-01-15",
      graceDays: 3,
    }),
    cycleLength: 28,
    periodLength: 5,
    ...overrides,
  };
}

const orderedExactCases = [
  {
    seed: 1101,
    label: "ordered exact facts",
    facts: [
      fact("fixture-older", "2026-01-05", { endDate: "2026-01-09" }),
      fact("fixture-newer", "2026-01-07", { endDate: "2026-01-13" }),
    ],
  },
  {
    seed: 1102,
    label: "reverse-ordered exact facts",
    facts: [
      fact("fixture-newer", "2026-01-07", { endDate: "2026-01-13" }),
      fact("fixture-older", "2026-01-05", { endDate: "2026-01-09" }),
    ],
  },
] as const;

describe("cycle state deterministic property invariants", () => {
  test.each(orderedExactCases)(
    "$label (seed $seed) selects the latest exact fact covering the target",
    ({ facts }) => {
      expect(
        reduceCycleState(
          stateInput({
            targetDate: "2026-01-10",
            eligibleFacts: facts,
            bounds: null,
            timeZone: undefined,
          })
        )
      ).toMatchObject({
        status: "recorded_period",
        evidence: "RECORDED_EXACT",
        coveringEventId: "fixture-newer",
        cycleDay: 4,
      });
    }
  );

  test("pause precedence is stable for incomplete, estimated, and recorded inputs", () => {
    const pausedCases: PropertyCase[] = [
      {
        seed: 1201,
        label: "paused with no eligible history",
        input: stateInput({ eligibleFacts: [], paused: true }),
      },
      {
        seed: 1202,
        label: "paused with an open estimated fact",
        input: stateInput({ paused: true }),
      },
      {
        seed: 1203,
        label: "paused with an exact covering fact",
        input: stateInput({
          paused: true,
          eligibleFacts: [
            fact("fixture-covered", "2026-01-10", {
              endDate: "2026-01-14",
            }),
          ],
        }),
      },
      {
        seed: 1204,
        label: "paused with malformed date and timezone",
        input: stateInput({
          paused: true,
          targetDate: "not-a-calendar-date",
          timeZone: undefined,
          bounds: null,
        }),
      },
    ];

    for (const { seed, label, input } of pausedCases) {
      expect(
        reduceCycleState(input),
        `${label} (seed ${seed})`
      ).toEqual({
        version: 1,
        status: "prediction_paused",
        phase: null,
        evidence: "USER_PAUSED",
        cycleDay: null,
        reason: "USER_PAUSED",
      });
    }
  });

  test("an exact fact outranks estimates and does not require prediction inputs", () => {
    const state = reduceCycleState(
      stateInput({
        targetDate: "2026-01-10",
        eligibleFacts: [
          fact("fixture-exact", "2026-01-08", { endDate: "2026-01-12" }),
        ],
        timeZone: undefined,
        bounds: null,
      })
    );

    expect(state).toMatchObject({
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      coveringEventId: "fixture-exact",
    });
  });

  test("an open fact never becomes an observation without explicit coverage", () => {
    const cases: PropertyCase[] = [
      {
        seed: 1301,
        label: "open fact at the first estimated day",
        input: stateInput({ targetDate: "2026-01-02" }),
      },
      {
        seed: 1302,
        label: "open fact during a later estimated phase",
        input: stateInput({ targetDate: "2026-01-12" }),
      },
    ];

    for (const { seed, label, input } of cases) {
      const state = reduceCycleState(input);
      expect(state, `${label} (seed ${seed})`).toMatchObject({
        status: "estimated",
        evidence: "CALENDAR_ESTIMATE",
      });
      expect(state.status).not.toBe("recorded_period");
      expect(state.evidence).not.toBe("RECORDED_EXACT");
      expect("coveringEventId" in state).toBe(false);
    }
  });

  test("correction and tombstone snapshots only use the active pure inputs", () => {
    const snapshots: PropertyCase[] = [
      {
        seed: 1401,
        label: "original active exact fact",
        input: stateInput({
          targetDate: "2026-01-12",
          eligibleFacts: [
            fact("fixture-corrected", "2026-01-08", {
              endDate: "2026-01-14",
            }),
          ],
        }),
      },
      {
        seed: 1402,
        label: "corrected active fact no longer covers target",
        input: stateInput({
          targetDate: "2026-01-12",
          eligibleFacts: [
            fact("fixture-corrected", "2026-01-08", {
              endDate: "2026-01-10",
            }),
          ],
        }),
      },
      {
        seed: 1403,
        label: "tombstoned fact omitted from eligible snapshot",
        input: stateInput({
          targetDate: "2026-01-12",
          eligibleFacts: [],
        }),
      },
    ];

    expect(reduceCycleState(snapshots[0].input)).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
    });
    expect(reduceCycleState(snapshots[1].input)).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
    });
    expect(reduceCycleState(snapshots[2].input)).toMatchObject({
      status: "insufficient_data",
      evidence: "UNAVAILABLE",
      reason: "NO_ELIGIBLE_FACT",
    });
  });

  test.each([
    {
      seed: 1501,
      label: "leap-day overrun",
      startDate: "2024-02-28",
      expectedDate: "2024-02-29",
      targetDate: "2024-03-01",
    },
    {
      seed: 1502,
      label: "year-rollover overrun",
      startDate: "2024-12-31",
      expectedDate: "2025-01-01",
      targetDate: "2025-01-02",
    },
    {
      seed: 1503,
      label: "long-range overrun",
      startDate: "2026-01-01",
      expectedDate: "2026-01-10",
      targetDate: "2027-01-01",
    },
  ])(
    "$label (seed $seed) never wraps a date after latest bound to cycle day one",
    ({ startDate, expectedDate, targetDate }) => {
      const state = reduceCycleState(
        stateInput({
          targetDate,
          eligibleFacts: [fact("fixture-late", startDate)],
          bounds: createLegacyPredictionBounds({
            expectedDate,
            graceDays: 0,
          }),
        })
      );

      expect(state).toMatchObject({
        status: "late_or_uncertain",
        evidence: "TIMING_UNCERTAINTY",
        phase: null,
        cycleDay: null,
        reason: "AFTER_LATEST_BOUND",
      });
    }
  );
});
