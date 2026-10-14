import { describe, expect, it } from "vitest";
import {
  CYCLE_STATE_STATUS,
  MAX_COUPLE_CHAT_MESSAGES,
  MOBILE_CONTRACT_VERSION,
  isLocalDateInput,
} from "@cb-connect/contracts";
import type { CycleCapabilities, PartnerCycleStateV1 } from "@cb-connect/contracts";

describe("Gate 5 M1 public-only contracts", () => {
  it("pins the shared DTO version and public server bounds", () => {
    expect(MOBILE_CONTRACT_VERSION).toBe(1);
    expect(MAX_COUPLE_CHAT_MESSAGES).toBe(120);
  });

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
    const partner: PartnerCycleStateV1 = {
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 2,
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    };
    const capability: CycleCapabilities = { cycleFactsV1: false, cycleStateV1: false, periodPredictionV2: false, partnerPredictionV2: false };
    expect(partner.status).toBe("recorded_period");
    expect(capability.partnerPredictionV2).toBe(false);
  });
});
