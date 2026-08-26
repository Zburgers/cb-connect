import { describe, expect, test } from "vitest";

import {
  buildCycleReadModel,
  type CycleReadModelInput,
} from "./cycleReadModel";

function period(
  overrides: Partial<CycleReadModelInput["periods"][number]> = {}
) {
  return {
    id: "period-1",
    startDate: "2026-01-01",
    startCertainty: "exact" as const,
    ...overrides,
  };
}

function input(
  overrides: Partial<CycleReadModelInput> = {}
): CycleReadModelInput {
  return {
    targetDate: "2026-01-03",
    timeZone: "UTC",
    cycleLength: 28,
    periodLength: 5,
    predictionPaused: false,
    periods: [period()],
    ...overrides,
  };
}

describe("authoritative cycle dashboard read model", () => {
  test("keeps an exact closed three-day period Recorded on its final day", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-03",
        periods: [
          period({
            endDate: "2026-01-03",
            endCertainty: "exact",
          }),
        ],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
      cycleDay: 3,
      coveringEventId: "period-1",
    });
    expect(result.cycleInfo).toMatchObject({
      phase: "menstruation",
      cycleDay: 3,
    });
  });

  test("does not turn a still-open day-six event into Recorded", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-06",
        periods: [period()],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 6,
    });
    expect(result.cycleStateV1).not.toHaveProperty("coveringEventId");
  });

  test("records an exact open start on its observed start date without inventing an end", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-01",
        periods: [period()],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
      cycleDay: 1,
    });
    expect(result.cycleStateV1).toHaveProperty("coveringEventId", "period-1");
    expect(result.cycleStateV1).not.toHaveProperty("endDate");
  });

  test("records an exact start with an approximate end only on its start date", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-01",
        periods: [
          period({
            endDate: "2026-01-03",
            endCertainty: "approximate",
          }),
        ],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
      cycleDay: 1,
    });
  });

  test("does not treat an approximate end as exact coverage after the start", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-03",
        periods: [
          period({
            endDate: "2026-01-05",
            endCertainty: "approximate",
          }),
        ],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 3,
    });
    expect(result.cycleStateV1).not.toHaveProperty("coveringEventId");
  });

  test("uses the latest eligible exact fact, not approximate or tombstoned facts", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-01-12",
        periods: [
          period({ id: "exact-old" }),
          period({
            id: "approximate-new",
            startDate: "2026-01-10",
            startCertainty: "approximate",
          }),
          period({
            id: "tombstoned-newest",
            startDate: "2026-01-11",
            tombstoneAt: 123,
          }),
        ],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 12,
    });
    expect(result.cycleStateV1).not.toMatchObject({
      coveringEventId: "approximate-new",
    });
  });

  test("paused state suppresses the legacy phase projection", () => {
    const result = buildCycleReadModel(
      input({ predictionPaused: true })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "prediction_paused",
      evidence: "USER_PAUSED",
    });
    expect(result.cycleInfo).toBeNull();
  });

  test("returns Late on the local calendar day after the configured bound", () => {
    const result = buildCycleReadModel(
      input({
        targetDate: "2026-02-02",
        periods: [period({ startDate: "2026-01-01" })],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "late_or_uncertain",
      evidence: "TIMING_UNCERTAINTY",
      cycleDay: null,
    });
    expect(result.cycleInfo).toBeNull();
  });

  test("returns Unknown when no exact fact is eligible", () => {
    const result = buildCycleReadModel(
      input({
        periods: [
          period({
            startCertainty: "approximate",
            endDate: "2026-01-03",
            endCertainty: "approximate",
          }),
        ],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "insufficient_data",
      evidence: "UNAVAILABLE",
      reason: "NO_ELIGIBLE_FACT",
    });
    expect(result.cycleInfo).toBeNull();
  });

  test("fails closed for a malformed exact fact without throwing", () => {
    const result = buildCycleReadModel(
      input({
        periods: [period({ startDate: "not-a-date" })],
      })
    );

    expect(result.cycleStateV1).toMatchObject({
      status: "insufficient_data",
      reason: "NO_ELIGIBLE_FACT",
    });
    expect(result.cycleInfo).toBeNull();
  });
});
