import { describe, expect, it } from "vitest";
import { formatReminderTime, parseReminderTime } from "./reminderTime";

describe("account-local reminder clock", () => {
  it("round-trips an HH:mm wall-clock value without a timezone conversion", () => {
    const selected = parseReminderTime("08:35", "UTC");

    expect(selected).not.toBeNull();
    expect(formatReminderTime(selected!, "UTC")).toBe("08:35");
  });

  it("keeps the same account-local clock across seasonal date changes", () => {
    const winter = parseReminderTime("08:35", "UTC", new Date("2026-01-15T12:00:00Z"));
    const summer = parseReminderTime("08:35", "UTC", new Date("2026-07-15T12:00:00Z"));

    expect(formatReminderTime(winter!, "UTC")).toBe("08:35");
    expect(formatReminderTime(summer!, "UTC")).toBe("08:35");
  });

  it.each(["Asia/Kolkata", "America/Los_Angeles", "Europe/London"])(
    "round-trips the account clock in %s even when it differs from the device zone",
    (timeZone) => {
      const selected = parseReminderTime("08:35", timeZone, new Date("2026-06-15T12:00:00Z"));

      expect(selected).not.toBeNull();
      expect(formatReminderTime(selected!, timeZone)).toBe("08:35");
    },
  );

  it("keeps a valid account-local clock when the device date falls in a DST gap", () => {
    const selected = parseReminderTime("02:30", "America/New_York", new Date("2026-03-08T17:00:00Z"));

    expect(selected).not.toBeNull();
    expect(formatReminderTime(selected!, "America/New_York")).toBe("02:30");
  });

  it.each(["8:35", "24:00", "12:60", "08:35Z", ""])(
    "rejects invalid reminder time %s",
    (value) => {
      expect(parseReminderTime(value, "UTC")).toBeNull();
    },
  );
});
