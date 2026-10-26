import type { AccessState } from "../../navigation/accessResolver";

export type CoupleRole = "primary" | "partner";

export function canRenderPartnerViews(
  access: AccessState,
  role: CoupleRole | null,
  isActive: boolean,
  revoking = false,
) {
  return isActive && !revoking && access === role;
}

export function canLoadPartnerCycleProjection(
  access: AccessState,
  role: CoupleRole | null,
  isActive: boolean,
  sharingPhase: boolean,
) {
  return access === "partner" && role === "partner" && isActive && sharingPhase;
}

export function orderMessagesForDisplay<T>(messagesNewestFirst: readonly T[]) {
  return [...messagesNewestFirst].reverse();
}

export function latestUnreadPartnerMessage<T extends { isMine: boolean; readAt: number | null }>(
  messagesNewestFirst: readonly T[],
  isAtBottom: boolean,
) {
  if (!isAtBottom) return null;
  const latest = messagesNewestFirst[0];
  return latest && !latest.isMine && latest.readAt === null ? latest : null;
}
