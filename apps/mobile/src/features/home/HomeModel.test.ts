import { describe, expect, it } from "vitest";
import type { CycleDashboardData } from "../cycle/CycleDashboardModel";
import {
  CYCLE_STATE_COPY_APPROVAL,
  CYCLE_STATE_COPY_EXPOSURE,
} from "../../../../../components/dashboard/cycleStateCopy";
import {
  canSendNudge,
  canShowCalendarNutritionTips,
  getHomeSupportPresentation,
  getNudgeMessage,
  HOME_CYCLE_COPY_APPROVAL,
  HOME_CYCLE_COPY_EXPOSURE,
  NUDGE_OPTIONS,
  PAIN_NOTE_PRIVACY_COPY,
} from "./HomeModel";

const base: CycleDashboardData = {
  hasData: true,
  isPartnerView: false,
  cycleStateV1: null,
  cycleStateV1Exposed: false,
  partnerPredictionV2Exposed: false,
  partnerPredictionV2CanEnsureSnapshot: false,
};

describe("Android Home and nudge contracts", () => {
  it("keeps the same six emoji messages as web Home", () => {
    expect(NUDGE_OPTIONS).toEqual([
      { emoji: "💗", message: "Thinking of you" },
      { emoji: "🤗", message: "Sending a soft hug" },
      { emoji: "☕", message: "A small comfort check-in" },
      { emoji: "🌙", message: "Let us keep tonight gentle" },
      { emoji: "✨", message: "You have my attention" },
      { emoji: "🫶", message: "I am here with you" },
    ]);
    for (const option of NUDGE_OPTIONS) expect(getNudgeMessage(option.emoji)).toBe(option.message);
    expect(getNudgeMessage("invalid")).toBe("A gentle nudge");
  });

  it("allows a linked sender to nudge an offline partner when connected", () => {
    expect(canSendNudge("primary", true)).toBe(true);
    expect(canSendNudge("partner", true)).toBe(true);
    expect(canSendNudge("unlinked_primary", true)).toBe(false);
    expect(canSendNudge("primary", false)).toBe(false);
  });

  it("fails closed for phase nutrition unless copy is approved for ordinary users", () => {
    expect(HOME_CYCLE_COPY_APPROVAL).toBe(CYCLE_STATE_COPY_APPROVAL);
    expect(HOME_CYCLE_COPY_EXPOSURE).toBe(CYCLE_STATE_COPY_EXPOSURE);
    expect(canShowCalendarNutritionTips({ status: "estimated" } as never)).toBe(false);
    expect(canShowCalendarNutritionTips({ status: "estimated" } as never, "approved", "staff_only")).toBe(false);
    expect(canShowCalendarNutritionTips({ status: "estimated" } as never, "unapproved", "ordinary_users")).toBe(false);
    expect(canShowCalendarNutritionTips({ status: "estimated" } as never, "approved", "ordinary_users")).toBe(true);
    expect(canShowCalendarNutritionTips({ status: "prediction_paused" } as never, "approved", "ordinary_users")).toBe(false);
  });

  it("shows primary support content only when applicable", () => {
    const data: CycleDashboardData = {
      ...base,
      painData: { score: 6, severity: "moderate", tags: ["cramps"], note: "private" },
      painTip: { _id: "tip", title: "Take a gentle pause", suggestions: ["Rest"], safetyNote: "Seek help if needed." },
      nutritionTipsPhase: "follicular",
      cycleStateV1: { status: "estimated" } as never,
      nutritionTips: [{ _id: "food", foodItem: "Oats", reasoning: "Comforting" }],
    };
    expect(getHomeSupportPresentation(data)).toMatchObject({
      role: "primary",
      pain: { score: 6, tags: ["cramps"], note: "private" },
      painTip: { title: "Take a gentle pause" },
      nutritionTipsPhase: null,
      nutritionTips: [],
    });
    expect(getHomeSupportPresentation({
      ...data,
      painData: { score: 3, severity: "mild" },
    }).painTip).toBeNull();
  });

  it("keeps partner Home limited to the server-shared pain score and severity", () => {
    const support = getHomeSupportPresentation({
      ...base,
      isPartnerView: true,
      cycleStateV1Exposed: true,
      partnerPredictionV2Exposed: true,
      painData: { score: 7, severity: "severe", tags: ["cramps"], note: "private note" },
      painTip: { _id: "tip", title: "private tip", suggestions: ["private"], safetyNote: "private" },
      nutritionTipsPhase: "menstruation",
      nutritionTips: [{ _id: "food", foodItem: "private food", reasoning: "private reason" }],
    });
    expect(support).toEqual({
      role: "partner",
      pain: { score: 7, severity: "severe" },
      painTip: null,
      nutritionTips: [],
      nutritionTipsPhase: null,
    });
  });

  it("allows only the server-authorized legacy partner support tip", () => {
    const support = getHomeSupportPresentation({
      ...base,
      isPartnerView: true,
      cycleStateV1Exposed: false,
      partnerPredictionV2Exposed: false,
      painData: { score: 7, severity: "severe", tags: ["cramps"], note: "private note" },
      painTip: { _id: "tip", title: "Take a gentle pause", suggestions: ["Offer warmth"], safetyNote: "Call for help if severe." },
      nutritionTipsPhase: "menstruation",
      nutritionTips: [{ _id: "food", foodItem: "private food", reasoning: "private reason" }],
    });
    expect(support).toEqual({
      role: "partner",
      pain: { score: 7, severity: "severe" },
      painTip: { _id: "tip", title: "Take a gentle pause", suggestions: ["Offer warmth"], safetyNote: "Call for help if severe." },
      nutritionTips: [],
      nutritionTipsPhase: null,
    });
  });

  it("keeps partner pain guidance hidden when consent leaves the shared signal absent", () => {
    const support = getHomeSupportPresentation({
      ...base,
      isPartnerView: true,
      cycleStateV1Exposed: false,
      partnerPredictionV2Exposed: false,
      painData: null,
      painTip: { _id: "tip", title: "private tip", suggestions: ["private"], safetyNote: "private" },
    });
    expect(support.pain).toBeNull();
    expect(support.painTip).toBeNull();
  });

  it("makes the owner-only pain note boundary clear", () => {
    expect(PAIN_NOTE_PRIVACY_COPY).toContain("stays private");
    expect(PAIN_NOTE_PRIVACY_COPY).toContain("pain score and severity");
  });
});

it("wires Home nudges to the bounded Convex APIs and transient presence", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./HomeNudges.tsx", import.meta.url), "utf8");
  expect(source).toContain("api.queries.nudges.latestReceived");
  expect(source).toContain("api.mutations.nudges.send");
  expect(source).toContain("api.mutations.nudges.markSeen");
  expect(source).toContain("api.queries.presence.getPartnerPresence");
  expect(source).toContain("presence.expiresAt > now");
  expect(source).toContain('linked ? {} : "skip"');
  expect(source).not.toMatch(/AsyncStorage|SecureStore|FileSystem/);
});
