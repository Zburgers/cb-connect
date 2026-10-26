import type {
  NotificationEventType,
  NotificationInboxItemDTO,
  NotificationPurpose,
} from "@cb-connect/contracts";

type EventPresentation = Readonly<{ title: string; body: string; route: "messages" | "settings" }>;

const eventPresentations: Partial<Record<NotificationEventType, EventPresentation>> = {
  "partner_linked.v1": {
    title: "Connection update",
    body: "Review your connection settings.",
    route: "settings",
  },
  "partner_message.v1": {
    title: "Message activity",
    body: "Messages are unavailable in this mobile build.",
    route: "messages",
  },
  "partner_nudge.v1": {
    title: "A nudge is ready",
    body: "Messages are unavailable in this mobile build.",
    route: "messages",
  },
  "partner_chat_cleared.v1": {
    title: "Chat updated",
    body: "Messages are unavailable in this mobile build.",
    route: "messages",
  },
  "connected_since_updated.v1": {
    title: "Connection setting updated",
    body: "Review settings for the current details.",
    route: "settings",
  },
};

const purposeLabels: Record<NotificationPurpose, string> = {
  assisted_period_start: "Assisted period start",
  assisted_period_end: "Assisted period end",
  period_window_approaching: "Period window reminder",
  late_status: "Late status reminder",
  pain_check_in: "Pain check-in",
  partner_linked: "Connection updates",
  partner_message: "Message activity",
  partner_nudge: "Partner nudges",
  partner_chat_cleared: "Chat updates",
  connected_since_updated: "Connection setting updates",
};

export const primaryNotificationPurposes: readonly NotificationPurpose[] = [
  "assisted_period_start",
  "assisted_period_end",
  "period_window_approaching",
  "late_status",
  "pain_check_in",
  "partner_linked",
  "partner_message",
  "partner_nudge",
  "partner_chat_cleared",
  "connected_since_updated",
];

export const partnerNotificationPurposes: readonly NotificationPurpose[] = [
  "partner_linked",
  "partner_message",
  "partner_nudge",
  "partner_chat_cleared",
  "connected_since_updated",
];

export function getNotificationPurposeLabel(purpose: NotificationPurpose): string {
  return purposeLabels[purpose];
}

export function getVisibleNotificationPurposes(role: "primary" | "partner") {
  return role === "primary" ? primaryNotificationPurposes : partnerNotificationPurposes;
}

export function isInboxItemUnread(item: NotificationInboxItemDTO): boolean {
  return item.readAt === undefined;
}

export function getInboxPresentation(item: NotificationInboxItemDTO): EventPresentation | null {
  if (!/^g4-static-v[12]$/.test(item.templateVersion)) return null;
  const presentation = eventPresentations[item.eventType];
  return presentation && item.route === presentation.route ? presentation : null;
}
