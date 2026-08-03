import { describe, expect, test } from "vitest";

import {
  requirePastOrTodayCalendarDate,
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
});
