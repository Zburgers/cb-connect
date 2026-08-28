import { expect, test } from "vitest";

import {
  findLatestPeriodStartDate,
  getPeriodEndProjection,
  getTimelinePhaseForDate,
  getTimelineStateForDate,
} from "./timelinePhases.ts";
import { buildCycleReadModel } from "./cycleReadModel";

const exactPeriod = {
  id: "period-1",
  startDate: "2026-05-01",
  endDate: "2026-05-05",
  startCertainty: "exact" as const,
  endCertainty: "exact" as const,
};

test("pain log on day 25 of a 28-day cycle resolves to luteal", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-25",
    [exactPeriod],
    28,
    5
  );

  expect(phase).toBe("luteal");
});

test("dates inside a logged period stay menstruation", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-03",
    [exactPeriod],
    28,
    5
  );

  expect(phase).toBe("menstruation");
});

test("mid-cycle dates resolve to ovulation", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-15",
    [exactPeriod],
    28,
    5
  );

  expect(phase).toBe("ovulation");
});

test("post-period pre-ovulation dates resolve to follicular", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-10",
    [exactPeriod],
    28,
    5
  );

  expect(phase).toBe("follicular");
});

test("exact coverage keeps a closed event Recorded through its observed end", () => {
  const state = getTimelineStateForDate(
    "2026-05-03",
    [{ ...exactPeriod, endDate: "2026-05-03" }],
    28,
    5,
  );

  expect(state).toMatchObject({
    phase: "menstruation",
    status: "recorded_period",
    evidence: "RECORDED_EXACT",
    reason: "CONFIRMED_EVENT_COVERS_TODAY",
  });
});

test("approximate end is coverage only on the exact observed start date", () => {
  const period = {
    ...exactPeriod,
    endCertainty: "approximate" as const,
  };

  expect(
    getTimelineStateForDate("2026-05-01", [period], 28, 5)
  ).toMatchObject({
    status: "recorded_period",
    evidence: "RECORDED_EXACT",
  });
  expect(
    getTimelineStateForDate("2026-05-03", [period], 28, 5)
  ).toMatchObject({
    status: "estimated",
    evidence: "CALENDAR_ESTIMATE",
  });
});

test("timeline and dashboard adapters agree for approximate-end coverage", () => {
  const period = {
    ...exactPeriod,
    endCertainty: "approximate" as const,
  };
  const dashboardState = buildCycleReadModel({
    targetDate: "2026-05-03",
    timeZone: "UTC",
    cycleLength: 28,
    periodLength: 5,
    periods: [period],
  }).cycleStateV1;
  const timelineState = getTimelineStateForDate(
    "2026-05-03",
    [period],
    28,
    5,
  );

  expect(timelineState).toMatchObject({
    status: dashboardState.status,
    evidence: dashboardState.evidence,
    reason: dashboardState.reason,
  });
});

test("dates after the latest configured bound are Late without a phase", () => {
  const state = getTimelineStateForDate(
    "2026-06-02",
    [exactPeriod],
    28,
    5,
  );

  expect(state).toMatchObject({
    phase: "unknown",
    status: "late_or_uncertain",
    evidence: "TIMING_UNCERTAINTY",
    reason: "AFTER_LATEST_BOUND",
  });
});

test.each([
  ["approximate", { startCertainty: "approximate" as const }],
  ["legacy unknown", { startCertainty: "legacy_unknown" as const, legacyReason: "duplicate" as const }],
  ["tombstoned", { tombstoneAt: 123 }],
])("%s facts remain Unknown rather than exact evidence", (_label, overrides) => {
  const state = getTimelineStateForDate(
    "2026-05-03",
    [{ ...exactPeriod, ...overrides }],
    28,
    5,
  );

  expect(state).toMatchObject({
    phase: "unknown",
    status: "insufficient_data",
    evidence: "UNAVAILABLE",
    reason: "NO_ELIGIBLE_FACT",
  });
});

test("latest period selection uses max startDate, not insertion order", () => {
  const latest = findLatestPeriodStartDate([
    { startDate: "2026-04-01", endDate: "2026-04-05" },
    { startDate: "2026-05-01", endDate: "2026-05-05" },
    { startDate: "2026-03-01", endDate: "2026-03-05" },
  ]);

  expect(latest).toBe("2026-05-01");
});

test("open periods expose a derived estimated end without mutation", () => {
  const period = { startDate: "2026-05-01" };

  expect(getPeriodEndProjection(period, 5)).toEqual({
    endDate: "2026-05-05",
    kind: "estimated",
  });
  expect(period).toEqual({ startDate: "2026-05-01" });
});

test("observed period ends remain explicitly observed", () => {
  expect(
    getPeriodEndProjection(
      { startDate: "2026-05-01", endDate: "2026-05-03" },
      5
    )
  ).toEqual({
    endDate: "2026-05-03",
    kind: "observed",
  });
});
