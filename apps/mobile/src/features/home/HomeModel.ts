import type { CycleDashboardData } from "../cycle/CycleDashboardModel";

// Keep in lockstep with components/dashboard/cycleStateCopy.ts. The current
// web policy is intentionally unapproved/staff-only, so native must fail closed.
export const HOME_CYCLE_COPY_APPROVAL = "unapproved" as const;
export const HOME_CYCLE_COPY_EXPOSURE = "staff_only" as const;

export const NUDGE_OPTIONS = [
  { emoji: "💗", message: "Thinking of you" },
  { emoji: "🤗", message: "Sending a soft hug" },
  { emoji: "☕", message: "A small comfort check-in" },
  { emoji: "🌙", message: "Let us keep tonight gentle" },
  { emoji: "✨", message: "You have my attention" },
  { emoji: "🫶", message: "I am here with you" },
] as const;

export const PAIN_NOTE_PRIVACY_COPY =
  "This note stays private. Your partner can only see the pain score and severity you choose to share.";

export type NudgeEmoji = (typeof NUDGE_OPTIONS)[number]["emoji"];

export function getNudgeMessage(emoji: string): string {
  return NUDGE_OPTIONS.find((option) => option.emoji === emoji)?.message ?? "A gentle nudge";
}

export function canSendNudge(
  access: string,
  isOnline: boolean,
): boolean {
  return (access === "primary" || access === "partner") && isOnline;
}

export function canShowCalendarNutritionTips(
  state: CycleDashboardData["cycleStateV1"],
  approval: "unapproved" | "approved" = HOME_CYCLE_COPY_APPROVAL,
  exposure: "staff_only" | "ordinary_users" = HOME_CYCLE_COPY_EXPOSURE,
): boolean {
  return (
    state?.status === "estimated" &&
    approval === "approved" &&
    exposure === "ordinary_users"
  );
}

export function getHomeSupportPresentation(data: CycleDashboardData) {
  if (data.isPartnerView) {
    const legacySharedProjection =
      !data.cycleStateV1Exposed && !data.partnerPredictionV2Exposed;
    return {
      role: "partner" as const,
      pain: data.painData
        ? { score: data.painData.score, severity: data.painData.severity }
        : null,
      painTip:
        legacySharedProjection && data.painData && data.painData.score >= 4
          ? data.painTip ?? null
          : null,
      nutritionTips: [],
      nutritionTipsPhase: null,
    };
  }

  return {
    role: "primary" as const,
    pain: data.painData
      ? {
          score: data.painData.score,
          severity: data.painData.severity,
          tags: data.painData.tags,
          note: data.painData.note,
        }
      : null,
    painTip:
      data.painData && data.painData.score >= 4 ? data.painTip ?? null : null,
    nutritionTips: canShowCalendarNutritionTips(data.cycleStateV1)
      ? data.nutritionTips ?? []
      : [],
    nutritionTipsPhase: canShowCalendarNutritionTips(data.cycleStateV1)
      ? data.nutritionTipsPhase ?? null
      : null,
  };
}
