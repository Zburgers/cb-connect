import { expect, test } from "vitest";

import {
  findLatestPeriodStartDate,
  getPeriodEndProjection,
  getTimelinePhaseForDate,
} from "./timelinePhases.ts";

test("pain log on day 25 of a 28-day cycle resolves to luteal", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-25",
    [{ startDate: "2026-05-01", endDate: "2026-05-05" }],
    28,
    5
  );

  expect(phase).toBe("luteal");
});

test("dates inside a logged period stay menstruation", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-03",
    [{ startDate: "2026-05-01", endDate: "2026-05-05" }],
    28,
    5
  );

  expect(phase).toBe("menstruation");
});

test("mid-cycle dates resolve to ovulation", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-15",
    [{ startDate: "2026-05-01", endDate: "2026-05-05" }],
    28,
    5
  );

  expect(phase).toBe("ovulation");
});

test("post-period pre-ovulation dates resolve to follicular", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-10",
    [{ startDate: "2026-05-01", endDate: "2026-05-05" }],
    28,
    5
  );

  expect(phase).toBe("follicular");
});

test("explicit short end dates stop menstruation fallback from overrunning", () => {
  const phase = getTimelinePhaseForDate(
    "2026-05-05",
    [{ startDate: "2026-05-01", endDate: "2026-05-03" }],
    28,
    5
  );

  expect(phase).toBe("follicular");
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
