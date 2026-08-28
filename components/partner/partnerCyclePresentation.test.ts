import { describe, expect, test } from "vitest";

import {
  getPartnerCyclePresentation,
  isPartnerCycleStateExposed,
  type PartnerCyclePresentation,
} from "./partnerCyclePresentation";
import type { PartnerCycleProjection } from "@/convex/_helpers/partnerCycleProjection";

const bounds = {
  version: 1 as const,
  source: "legacy_configured" as const,
  expectedDate: "2026-09-28",
  earliestDate: "2026-09-25",
  latestDate: "2026-10-01",
  reason: "LEGACY_UNCALIBRATED_GRACE" as const,
  basisCount: 1 as const,
};

const recorded: PartnerCycleProjection = {
  version: 1,
  status: "recorded_period",
  phase: "menstruation",
  evidence: "RECORDED_EXACT",
  cycleDay: 2,
  reason: "CONFIRMED_EVENT_COVERS_TODAY",
};

const estimated: PartnerCycleProjection = {
  version: 1,
  status: "estimated",
  phase: "luteal",
  evidence: "CALENDAR_ESTIMATE",
  cycleDay: 25,
  bounds,
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
};

const late: PartnerCycleProjection = {
  version: 1,
  status: "late_or_uncertain",
  phase: null,
  evidence: "TIMING_UNCERTAINTY",
  cycleDay: null,
  bounds,
  reason: "AFTER_LATEST_BOUND",
};

const unknown: PartnerCycleProjection = {
  version: 1,
  status: "insufficient_data",
  phase: null,
  evidence: "UNAVAILABLE",
  cycleDay: null,
  reason: "NO_ELIGIBLE_FACT",
};

const paused: PartnerCycleProjection = {
  version: 1,
  status: "prediction_paused",
  phase: null,
  evidence: "USER_PAUSED",
  cycleDay: null,
  reason: "USER_PAUSED",
};

describe("partner cycle presentation", () => {
  test.each([
    ["authorized server exposure", true, true],
    ["server denied exposure", false, false],
    ["server exposure pending", undefined, false],
  ] as const)(
    "uses only the server exposure signal for %s",
    (_label, serverExposure, expected) => {
      expect(isPartnerCycleStateExposed(serverExposure)).toBe(expected);
    },
  );

  test("renders a privacy-safe empty state for no projection", () => {
    const result = getPartnerCyclePresentation(null);

    expect(result).toMatchObject({
      visible: false,
      emptyState: "Cycle details are not shared right now.",
      version: null,
      status: null,
      phase: null,
      cycleDay: null,
      bounds: null,
      reason: null,
      basisCount: null,
    });
    expect(result).not.toHaveProperty("eventId");
    expect(result).not.toHaveProperty("timezone");
  });

  test.each([
    ["recorded", recorded, "Recorded", "Recorded exact", "menstruation", 2],
    ["estimated", estimated, "Calendar estimate", "Calendar estimate", "luteal", 25],
  ] as const)(
    "preserves only approved phase fields for %s",
    (_label, projection, statusLabel, evidenceLabel, phase, cycleDay) => {
      const result = getPartnerCyclePresentation(projection);

      expect(result).toMatchObject({
        visible: true,
        emptyState: null,
        version: 1,
        status: projection.status,
        statusLabel,
        evidenceLabel,
        phase,
        phaseLabel: phase[0].toUpperCase() + phase.slice(1),
        cycleDay,
        reason: projection.reason,
      });
    },
  );

  test("copies safe bound dates and basis count without exposing bound metadata", () => {
    const result = getPartnerCyclePresentation(estimated);

    expect(result.bounds).toEqual({
      expectedDate: "2026-09-28",
      earliestDate: "2026-09-25",
      latestDate: "2026-10-01",
    });
    expect(result.basisCount).toBe(1);
    expect(result.bounds).not.toHaveProperty("source");
    expect(result.bounds).not.toHaveProperty("reason");
  });

  test.each([
    ["late", late, "Late", "Timing uncertainty", "AFTER_LATEST_BOUND"],
    ["unknown", unknown, "Unknown", "Unavailable", "NO_ELIGIBLE_FACT"],
    ["paused", paused, "Prediction paused", "User paused", "USER_PAUSED"],
  ] as const)(
    "renders %s without biological phase or cycle day",
    (_label, projection, statusLabel, evidenceLabel, reason) => {
      const result = getPartnerCyclePresentation(projection);

      expect(result).toMatchObject({
        visible: true,
        status: projection.status,
        statusLabel,
        evidenceLabel,
        phase: null,
        phaseLabel: null,
        cycleDay: null,
        reason,
      });
    },
  );

  test("maps no forbidden projection values even if runtime input is polluted", () => {
    const polluted = {
      ...estimated,
      coveringEventId: "private-event-id",
      notes: "private note",
      painTags: ["severe"],
      rawFacts: [{ startDate: "2026-09-01" }],
      timezone: "America/Los_Angeles",
      certainty: "high",
    } as unknown as PartnerCycleProjection;

    const result: PartnerCyclePresentation = getPartnerCyclePresentation(polluted);

    expect(result).not.toHaveProperty("coveringEventId");
    expect(result).not.toHaveProperty("notes");
    expect(result).not.toHaveProperty("painTags");
    expect(result).not.toHaveProperty("rawFacts");
    expect(result).not.toHaveProperty("timezone");
    expect(result).not.toHaveProperty("certainty");
  });
});
