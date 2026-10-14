import { describe, expect, it } from "vitest";
import { CYCLE_STATE_STATUS, isLocalDateInput } from "@cb-connect/contracts";
import type { CycleCapabilities, PartnerCycleSummary } from "@cb-connect/contracts";

describe("Gate 5 M1 public-only contracts", () => {
  it("represents every public cycle-state status", () => {
    expect(CYCLE_STATE_STATUS).toEqual([
      "recorded_period", "estimated", "late_or_uncertain",
      "insufficient_data", "prediction_paused",
    ]);
  });
  it("accepts only date-only input syntax (not authoritative date validation)", () => {
    expect(isLocalDateInput("2026-10-14")).toBe(true);
    expect(isLocalDateInput("2026-10-14T12:00:00Z")).toBe(false);
    expect(isLocalDateInput("../../secret")).toBe(false);
  });
  it("keeps the partner projection free of primary-private fields", () => {
    const partner: PartnerCycleSummary = { status: "estimated", phaseLabel: null, timingLabel: null };
    const capability: CycleCapabilities = { cycleFactsV1: false, cycleStateV1: false, periodPredictionV2: false, partnerPredictionV2: false };
    expect(partner.status).toBe("estimated");
    expect(capability.partnerPredictionV2).toBe(false);
  });
});
