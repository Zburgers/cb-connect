import { describe, expect, test } from "vitest";

import { addCalendarDays } from "./cycleCalculations";
import {
  deriveCycleIntervals,
  type CycleIntervalEvent,
  type CycleIntervalSegment,
} from "./cycleIntervals";

const cutoff = { cutoffAt: 1_000, cutoffDate: "2027-01-01" };

function event(
  startDate: string,
  overrides: Partial<CycleIntervalEvent> = {},
): CycleIntervalEvent {
  return {
    startDate,
    startCertainty: "exact",
    source: "self",
    confirmationStatus: "confirmed",
    authorityVersion: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function eventsForIntervals(
  lengths: number[],
  overrides: Partial<CycleIntervalEvent> = {},
): CycleIntervalEvent[] {
  let startDate = "2026-01-01";
  return [
    event(startDate, overrides),
    ...lengths.map((length) => {
      startDate = addCalendarDays(startDate, length);
      return event(startDate, overrides);
    }),
  ];
}

describe("deriveCycleIntervals", () => {
  test("derives stable and variable start-to-start calendar days", () => {
    const stable = deriveCycleIntervals(
      eventsForIntervals([28, 29, 28]),
      cutoff,
    );
    const variable = deriveCycleIntervals(
      eventsForIntervals([24, 35, 28]),
      cutoff,
    );

    expect(stable.intervals.map((interval) => interval.lengthDays)).toEqual([
      28, 29, 28,
    ]);
    expect(stable.eligibleIntervalCount).toBe(3);
    expect(stable.reasonCodes).not.toContain("LIMITED_HISTORY");
    expect(variable.intervals.map((interval) => interval.lengthDays)).toEqual([
      24, 35, 28,
    ]);
    expect(variable.intervals.every((interval) => interval.included)).toBe(
      true,
    );
  });

  test.each([
    [
      "approximate",
      { startCertainty: "approximate" as const },
      "APPROXIMATE_DATE",
    ],
    [
      "legacy unknown",
      { startCertainty: "legacy_unknown" as const },
      "LEGACY_UNKNOWN",
    ],
    [
      "unreviewed legacy",
      { confirmationStatus: "unreviewed" as const },
      "LEGACY_UNKNOWN",
    ],
    ["tombstoned", { tombstoneAt: 2 }, "TOMBSTONED"],
  ])(
    "excludes a %s anchor while retaining the next eligible interval",
    (_label, override, reason) => {
      const result = deriveCycleIntervals(
        [
          event("2026-01-01"),
          event("2026-01-29", override),
          event("2026-02-26"),
        ],
        cutoff,
      );

      expect(result.intervals.map((interval) => interval.lengthDays)).toEqual([
        56,
      ]);
      expect(result.reasonCodes).toContain(reason);
    },
  );

  test("accepts an exact partner-assisted anchor and preserves endpoint provenance", () => {
    const result = deriveCycleIntervals(
      [
        event("2026-01-01"),
        event("2026-01-29", { source: "partner_assist" }),
        event("2026-02-26"),
      ],
      cutoff,
    );

    expect(result.eligibleAnchorCount).toBe(3);
    expect(result.intervals[0]).toMatchObject({
      from: { provenance: "self" },
      to: { provenance: "partner_assist" },
      included: true,
      reasonCodes: ["PARTNER_ASSISTED"],
    });
    expect(result.intervals[1].reasonCodes).toContain("PARTNER_ASSISTED");
  });

  test("retains correction versions and marks corrected inputs", () => {
    const result = deriveCycleIntervals(
      [
        event("2026-01-01"),
        event("2026-01-29", {
          authorityVersion: 2,
          primaryCorrectionVersion: 2,
          updatedAt: 10,
        }),
        event("2026-02-26"),
      ],
      cutoff,
    );

    expect(result.intervals[0].to).toMatchObject({
      authorityVersion: 2,
      primaryCorrectionVersion: 2,
    });
    expect(
      result.intervals.every((interval) =>
        interval.reasonCodes.includes("RECENT_CORRECTION"),
      ),
    ).toBe(true);
    expect(result.reasonCodes).toContain("RECENT_CORRECTION");
  });

  test.each([
    ["primary", "self" as const],
    ["partner-assisted", "partner_assist" as const],
  ])(
    "does not treat ordinary %s period completion as a correction",
    (_label, source) => {
      const periods = eventsForIntervals([28, 29]);
      const completedPeriod = periods[1];
      periods[1] = {
        ...completedPeriod,
        source,
        endDate: addCalendarDays(completedPeriod.startDate, 4),
        endCertainty: "exact",
        authorityVersion: 2,
        updatedAt: 10,
      };

      const result = deriveCycleIntervals(periods, cutoff);

      expect(result.reasonCodes).not.toContain("RECENT_CORRECTION");
      expect(
        result.intervals.every(
          (interval) => !interval.reasonCodes.includes("RECENT_CORRECTION"),
        ),
      ).toBe(true);
    },
  );

  test("uses the segment active at the cutoff and restores earlier history", () => {
    const segments: CycleIntervalSegment[] = [
      {
        startDate: "2026-01-29",
        status: "superseded",
        createdAt: 20,
        supersededAt: 50,
      },
      {
        startDate: "2026-02-26",
        status: "superseded",
        createdAt: 50,
        supersededAt: 100,
      },
      { startDate: "2026-01-01", status: "active", createdAt: 100 },
    ];
    const events = eventsForIntervals([28, 28, 28, 28]);

    const beforeChange = deriveCycleIntervals(events, {
      cutoffAt: 40,
      cutoffDate: "2027-01-01",
      segments,
    });
    const current = deriveCycleIntervals(events, {
      cutoffAt: 60,
      cutoffDate: "2027-01-01",
      segments,
    });
    const restored = deriveCycleIntervals(events, {
      cutoffAt: 120,
      cutoffDate: "2027-01-01",
      segments,
    });

    expect(beforeChange.basis.segmentCreatedAt).toBe(20);
    expect(beforeChange.eligibleIntervalCount).toBe(3);
    expect(beforeChange.reasonCodes).toContain("CONTEXT_SEGMENT");
    expect(current.basis).toMatchObject({
      segmentCreatedAt: 50,
      segmentStartDate: "2026-02-26",
    });
    expect(current.eligibleIntervalCount).toBe(2);
    expect(current.reasonCodes).toContain("LIMITED_HISTORY");
    expect(restored.basis.segmentCreatedAt).toBe(100);
    expect(restored.eligibleIntervalCount).toBe(4);
  });

  test("flags a possible missing log only after three preceding eligible intervals", () => {
    const shortBasis = deriveCycleIntervals(
      eventsForIntervals([28, 29, 58, 28]),
      cutoff,
    );
    const sufficientBasis = deriveCycleIntervals(
      eventsForIntervals([28, 29, 28, 58, 28]),
      cutoff,
    );

    expect(shortBasis.intervals.map((interval) => interval.lengthDays)).toEqual(
      [28, 29, 58, 28],
    );
    expect(shortBasis.reasonCodes).not.toContain("POSSIBLE_MISSING_LOG");
    expect(sufficientBasis.intervals[3]).toMatchObject({
      lengthDays: 58,
      included: true,
      reasonCodes: ["POSSIBLE_MISSING_LOG"],
    });
    expect(
      sufficientBasis.intervals.map((interval) => interval.lengthDays),
    ).toEqual([28, 29, 28, 58, 28]);
  });

  test("keeps later facts and corrections out of an earlier cutoff", () => {
    const result = deriveCycleIntervals(
      [
        event("2026-01-01"),
        event("2026-01-29", { updatedAt: 200 }),
        event("2026-02-26", { createdAt: 200, updatedAt: 200 }),
      ],
      { cutoffAt: 100, cutoffDate: "2026-02-01" },
    );

    expect(result.eligibleAnchorCount).toBe(1);
    expect(result.intervals).toEqual([]);
    expect(result.latestEligibleStartDate).toBe("2026-01-01");
    expect(result.reasonCodes).toContain("AFTER_CUTOFF");
    expect(result.reasonCodes).toContain("LIMITED_HISTORY");
  });

  test("returns limited-history metadata without inventing an interval", () => {
    const result = deriveCycleIntervals([event("2026-01-01")], cutoff);

    expect(result).toMatchObject({
      eligibleAnchorCount: 1,
      eligibleIntervalCount: 0,
      latestEligibleStartDate: "2026-01-01",
      reasonCodes: ["LIMITED_HISTORY"],
      intervals: [],
    });
  });
});
