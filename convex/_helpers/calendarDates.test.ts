import { describe, expect, test } from "vitest";

import {
  nextCalendarDayBoundary,
  requirePastOrTodayCalendarDate,
  resolveCalendarTimeZone,
  toCalendarDateInTimeZone,
} from "./calendarDates";

describe("calendar dates", () => {
  const instant = new Date("2026-08-04T18:45:00.000Z");

  test("uses the user's timezone instead of the backend runtime timezone", () => {
    expect(toCalendarDateInTimeZone(instant, "Asia/Kolkata")).toBe("2026-08-05");
    expect(toCalendarDateInTimeZone(instant, "UTC")).toBe("2026-08-04");

    expect(() =>
      requirePastOrTodayCalendarDate(
        "2026-08-05",
        "Start date",
        "Asia/Kolkata",
        instant
      )
    ).not.toThrow();
    expect(() =>
      requirePastOrTodayCalendarDate("2026-08-05", "Start date", "UTC", instant)
    ).toThrow("Start date cannot be in the future");
  });

  test("rejects an invalid IANA timezone", () => {
    expect(() =>
      requirePastOrTodayCalendarDate(
        "2026-08-04",
        "Start date",
        "Not/AZone",
        instant
      )
    ).toThrow("Time zone must be a valid IANA time zone");
  });

  test("requires an explicit timezone for identified-user calendar authority", () => {
    expect(() => resolveCalendarTimeZone()).toThrow(
      "Time zone is required for an identified user"
    );
    expect(() => resolveCalendarTimeZone("")).toThrow(
      "Time zone is required for an identified user"
    );
  });

  test("handles Kolkata and Los Angeles local-midnight boundaries", () => {
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-08-04T18:29:59.999Z"),
        "Asia/Kolkata"
      )
    ).toBe("2026-08-04");
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-08-04T18:30:00.000Z"),
        "Asia/Kolkata"
      )
    ).toBe("2026-08-05");

    expect(
      toCalendarDateInTimeZone(
        new Date("2026-08-05T06:59:59.999Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-08-04");
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-08-05T07:00:00.000Z"),
        "America/Los_Angeles"
      )
    ).toBe("2026-08-05");
  });

  test("finds the account-local day boundary across DST", () => {
    const beforeMidnight = new Date("2026-03-09T03:00:00.000Z");
    const boundary = nextCalendarDayBoundary(beforeMidnight, "America/New_York");
    expect(boundary).toBe(Date.parse("2026-03-09T04:00:00.000Z"));
    expect(toCalendarDateInTimeZone(new Date(boundary - 1), "America/New_York")).toBe("2026-03-08");
    expect(toCalendarDateInTimeZone(new Date(boundary), "America/New_York")).toBe("2026-03-09");
  });

  test("keeps date-only values stable across DST transitions", () => {
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-03-08T06:59:59.999Z"),
        "America/New_York"
      )
    ).toBe("2026-03-08");
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-03-08T07:00:00.000Z"),
        "America/New_York"
      )
    ).toBe("2026-03-08");

    expect(
      toCalendarDateInTimeZone(
        new Date("2026-11-01T05:59:59.999Z"),
        "America/New_York"
      )
    ).toBe("2026-11-01");
    expect(
      toCalendarDateInTimeZone(
        new Date("2026-11-01T06:00:00.000Z"),
        "America/New_York"
      )
    ).toBe("2026-11-01");
  });
});
