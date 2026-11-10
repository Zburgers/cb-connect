import type { CycleDashboardData } from "../cycle/CycleDashboardModel";

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
  partnerPresent: boolean,
): boolean {
  return (access === "primary" || access === "partner") && isOnline && partnerPresent;
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
      painTip: legacySharedProjection ? data.painTip ?? null : null,
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
    nutritionTips: data.nutritionTips ?? [],
    nutritionTipsPhase: data.nutritionTipsPhase ?? null,
  };
}
