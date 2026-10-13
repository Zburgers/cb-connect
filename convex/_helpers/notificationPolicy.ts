import {
  notificationEventDefinitions,
  type NotificationEventType,
} from "./notificationTypes";
import {
  isEventChannelAllowed,
  type NotificationDeliveryChannel,
} from "./notificationDelivery";

export type NotificationPolicyFlags = {
  projectionEnabled?: boolean;
  deliveryEnabled?: boolean;
};

export type NotificationPolicyControls = {
  globalDenied?: boolean;
  channelDenied?: boolean;
  purposeDenied?: boolean;
};

export type NotificationPolicyDenial =
  | "external_channel_denied"
  | "event_channel_denied"
  | "content_not_approved"
  | "feature_disabled"
  | "global_denied"
  | "channel_denied"
  | "purpose_denied"
  | "purpose_mismatch"
  | "preference_disabled"
  | "recipient_mismatch"
  | "stale_source"
  | "stale_generation";

export type NotificationPolicyResult =
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason: NotificationPolicyDenial };

export type NotificationPolicyRequest = {
  eventType: NotificationEventType;
  purpose: (typeof notificationEventDefinitions)[NotificationEventType]["purpose"];
  channel: NotificationDeliveryChannel;
  recipientUserId: string;
  currentRecipientUserId: string | null;
  sourceAuthorityVersion: string;
  currentSourceAuthorityVersion: string | null;
  expectedGeneration: number;
  currentGeneration: number;
  purposeEnabled: boolean;
  /** D-011 approval is explicit and applies only to the Late event and copy. */
  lateContentApproved?: boolean;
  flags?: NotificationPolicyFlags;
  controls?: NotificationPolicyControls;
};

const deny = (reason: NotificationPolicyDenial): NotificationPolicyResult => ({
  allowed: false,
  reason,
});

/** Pure projection authorization; every absent execution flag is treated as false. */
export function authorizeNotificationProjection(
  request: NotificationPolicyRequest,
): NotificationPolicyResult {
  const definition = notificationEventDefinitions[request.eventType];
  if (request.channel !== "in_app") return deny("external_channel_denied");
  if (!isEventChannelAllowed(request.eventType, request.channel)) {
    return deny("event_channel_denied");
  }

  if (
    request.flags?.projectionEnabled !== true ||
    request.flags?.deliveryEnabled !== true
  ) {
    return deny("feature_disabled");
  }

  if (request.purpose !== definition.purpose) return deny("purpose_mismatch");
  if (request.eventType === "late_status.v1" && request.lateContentApproved !== true) {
    return deny("content_not_approved");
  }
  if (request.controls?.globalDenied === true) return deny("global_denied");
  if (request.controls?.channelDenied === true) return deny("channel_denied");
  if (request.controls?.purposeDenied === true) return deny("purpose_denied");
  if (!request.purposeEnabled) return deny("preference_disabled");
  if (
    !request.recipientUserId ||
    request.currentRecipientUserId === null ||
    request.recipientUserId !== request.currentRecipientUserId
  ) {
    return deny("recipient_mismatch");
  }
  if (
    !request.sourceAuthorityVersion ||
    request.currentSourceAuthorityVersion === null ||
    request.sourceAuthorityVersion !== request.currentSourceAuthorityVersion
  ) {
    return deny("stale_source");
  }
  if (
    !Number.isSafeInteger(request.expectedGeneration) ||
    request.expectedGeneration < 0 ||
    !Number.isSafeInteger(request.currentGeneration) ||
    request.currentGeneration < 0 ||
    request.expectedGeneration !== request.currentGeneration
  ) {
    return deny("stale_generation");
  }

  return { allowed: true, reason: "allowed" };
}
