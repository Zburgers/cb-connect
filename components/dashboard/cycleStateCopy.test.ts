import { describe, expect, test } from "vitest";

import {
  CYCLE_STATE_COPY_APPROVAL,
  CYCLE_STATE_COPY_EXPOSURE,
  CYCLE_STATE_COPY_KEYS,
  cycleStateCopy,
  getSupportCopy,
  getPublicSupportCopy,
  getCycleStateCopy,
  canExposeCycleStateCopy,
} from "./cycleStateCopy";

describe("cycle state copy contract", () => {
  test("defines every evidence-aware copy key", () => {
    expect(CYCLE_STATE_COPY_KEYS).toEqual([
      "recorded",
      "calendarEstimate",
      "late",
      "unknown",
      "paused",
      "estimatedOvulationDisclaimer",
      "genericCheckIn",
    ]);

    for (const key of CYCLE_STATE_COPY_KEYS) {
      expect(getCycleStateCopy(key)).toEqual(cycleStateCopy[key]);
    }
  });

  test("defaults copy approval to unapproved and exposure to staff only", () => {
    expect(CYCLE_STATE_COPY_APPROVAL).toBe("unapproved");
    expect(CYCLE_STATE_COPY_EXPOSURE).toBe("staff_only");
    expect(canExposeCycleStateCopy("staff")).toBe(true);
    expect(canExposeCycleStateCopy("ordinary_user")).toBe(false);
  });

  test("fails closed when ordinary-user exposure is requested without approval", () => {
    expect(
      canExposeCycleStateCopy("ordinary_user", "unapproved", "ordinary_users")
    ).toBe(false);
    expect(
      canExposeCycleStateCopy("ordinary_user", "approved", "ordinary_users")
    ).toBe(true);
  });

  test.each([
    ["late", "late"],
    ["unknown", "unknown"],
    ["paused", "paused"],
  ] as const)("uses generic check-in guidance for %s", (state, expectedKey) => {
    expect(getSupportCopy({ state }).key).toBe(expectedKey);
    expect(getSupportCopy({ state }).copy).toEqual(cycleStateCopy[expectedKey]);
  });

  test("an explicit report takes precedence over a calendar estimate", () => {
    expect(
      getSupportCopy({
        state: "calendar_estimate",
        explicitReport: {
          source: "user_report",
          text: "Reported pain today",
        },
      }).key
    ).toBe("recorded");
  });

  test("ordinary-user copy fails closed to generic guidance until approved", () => {
    expect(getPublicSupportCopy({ state: "calendar_estimate" }).key).toBe(
      "genericCheckIn"
    );
    expect(
      getPublicSupportCopy({
        state: "calendar_estimate",
        explicitReport: {
          source: "user_report",
          text: "Reported pain today",
        },
      }).key
    ).toBe("recorded");
  });

  test("does not promote arbitrary strings or non-user reports to Recorded", () => {
    expect(
      getPublicSupportCopy({
        state: "calendar_estimate",
        explicitReport: "pain_reported" as never,
      }).key
    ).toBe("genericCheckIn");
    expect(
      getPublicSupportCopy({
        state: "calendar_estimate",
        explicitReport: {
          source: "seeded_tip",
          text: "Reported pain today",
        } as never,
      }).key
    ).toBe("genericCheckIn");
  });

  test("does not label a phase tip as Recorded without an explicit report", () => {
    expect(getPublicSupportCopy({ state: "recorded" }).key).toBe(
      "genericCheckIn"
    );
    expect(
      getPublicSupportCopy({ state: "calendar_estimate" }).copy.label
    ).not.toBe("Recorded");
    expect(
      getPublicSupportCopy({
        state: "recorded",
        explicitReport: {
          source: "user_report",
          text: "Reported pain today",
        },
      }).copy.label
    ).toBe("Recorded");
  });

  test("does not present calendar timing as biological confirmation", () => {
    const text = Object.values(cycleStateCopy)
      .flatMap((copy) => Object.values(copy))
      .join(" ")
      .toLowerCase();

    expect(text).not.toMatch(/confirmed ovulation|fertile days|fertility window/);
    expect(cycleStateCopy.estimatedOvulationDisclaimer.text).toContain(
      "does not confirm ovulation"
    );
  });
});
