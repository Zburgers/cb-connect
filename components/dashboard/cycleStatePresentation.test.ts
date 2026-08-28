import { describe, expect, test } from "vitest";

import {
  getCycleStatePresentation,
  type DashboardCycleInfo,
} from "./cycleStatePresentation";
import type { CycleState } from "@/convex/_helpers/cycleState";

const bounds = {
  version: 1 as const,
  source: "legacy_configured" as const,
  expectedDate: "2026-01-29",
  earliestDate: "2026-01-29",
  latestDate: "2026-02-01",
  reason: "LEGACY_UNCALIBRATED_GRACE" as const,
  basisCount: 1 as const,
};

const cycleInfo: DashboardCycleInfo = {
  phase: "luteal",
  cycleDay: 99,
  daysUntilNextPeriod: 4,
  predictedNextPeriodStart: "2026-01-29",
};

function presentation(state: CycleState) {
  return getCycleStatePresentation(state, cycleInfo);
}

describe("primary cycle-state presentation", () => {
  test("maps a Recorded state to an exact evidence label and state-owned phase", () => {
    const result = presentation({
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 3,
      coveringEventId: "private-event-id",
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    });

    expect(result).toMatchObject({
      statusLabel: "Recorded",
      evidenceLabel: "Recorded exact",
      phase: "menstruation",
      cycleDay: 3,
      daysUntilNextPeriod: 4,
      nextPeriodStart: "2026-01-29",
    });
    expect(result).not.toHaveProperty("coveringEventId");
  });

  test.each([
    ["menstruation", "Menstruation"],
    ["follicular", "Follicular"],
    ["ovulation", "Ovulation"],
    ["luteal", "Luteal"],
  ] as const)("labels %s as a Calendar estimate", (phase, phaseLabel) => {
    const result = presentation({
      version: 1,
      status: "estimated",
      phase,
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 14,
      bounds,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    });

    expect(result).toMatchObject({
      statusLabel: "Calendar estimate",
      evidenceLabel: "Calendar estimate",
      phase,
      phaseLabel,
      cycleDay: 14,
    });
  });

  test("gives estimated ovulation a disclaimer slot without claiming confirmation", () => {
    const result = presentation({
      version: 1,
      status: "estimated",
      phase: "ovulation",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 14,
      bounds,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    });

    expect(result.disclaimer).toContain("does not confirm ovulation");
  });

  test.each([
    [
      "late_or_uncertain",
      "Late",
      "TIMING_UNCERTAINTY",
      "AFTER_LATEST_BOUND",
    ],
    ["insufficient_data", "Unknown", "UNAVAILABLE", "NO_ELIGIBLE_FACT"],
    ["prediction_paused", "Prediction paused", "USER_PAUSED", "USER_PAUSED"],
  ] as const)(
    "renders %s without biological phase fields",
    (status, statusLabel, evidence, reason) => {
      const state =
        status === "late_or_uncertain"
          ? {
              version: 1 as const,
              status,
              phase: null,
              evidence,
              cycleDay: null,
              bounds,
              reason,
            }
          : status === "insufficient_data"
            ? {
                version: 1 as const,
                status,
                phase: null,
                evidence,
                cycleDay: null,
                reason,
              }
            : {
                version: 1 as const,
                status,
                phase: null,
                evidence,
                cycleDay: null,
                reason,
              };

      const result = presentation(state);

      expect(result).toMatchObject({
        statusLabel,
        phase: null,
        phaseLabel: null,
        cycleDay: null,
        daysUntilNextPeriod: null,
        nextPeriodStart: null,
        disclaimer: null,
      });
      expect(result.evidenceLabel).toBeTruthy();
    }
  );

  test("uses generic copy while ordinary-user cycle-state copy is unapproved", () => {
    const result = presentation({
      version: 1,
      status: "estimated",
      phase: "luteal",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 20,
      bounds,
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    });

    expect(result.copyKey).toBe("genericCheckIn");
    expect(result.title).toBe("What feels supportive today?");
  });

  test("does not derive browser semantics from mismatched legacy cycleInfo", () => {
    const result = getCycleStatePresentation(
      {
        version: 1,
        status: "late_or_uncertain",
        phase: null,
        evidence: "TIMING_UNCERTAINTY",
        cycleDay: null,
        bounds,
        reason: "AFTER_LATEST_BOUND",
      },
      {
        phase: "ovulation",
        cycleDay: 14,
        daysUntilNextPeriod: 0,
        predictedNextPeriodStart: "2026-01-29",
      }
    );

    expect(result.phase).toBeNull();
    expect(result.daysUntilNextPeriod).toBeNull();
    expect(result.nextPeriodStart).toBeNull();
  });
});
