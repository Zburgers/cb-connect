import { v } from "convex/values";

export const notificationEventTypes = [
  "assisted_period_start.v1",
  "assisted_period_end.v1",
  "period_window_approaching.v1",
  "late_status.v1",
  "pain_check_in.v1",
  "partner_linked.v1",
  "partner_message.v1",
  "partner_nudge.v1",
  "partner_chat_cleared.v1",
  "connected_since_updated.v1",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export const notificationEventDefinitions = {
  "assisted_period_start.v1": {
    type: "assisted_period_start.v1",
    version: 1,
    purpose: "assisted_period_start",
    producer: "accepted_period_start",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "while_authority_is_current_and_primary_has_access",
    idempotencyComponents: ["type", "periodEventId", "authorityVersion", "primaryId"],
    cancellationConditions: ["authority_corrected_or_deleted", "primary_access_revoked"],
    allowedChannels: ["in_app"],
  },
  "assisted_period_end.v1": {
    type: "assisted_period_end.v1",
    version: 1,
    purpose: "assisted_period_end",
    producer: "accepted_period_end",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "while_authority_is_current_and_primary_has_access",
    idempotencyComponents: ["type", "periodEventId", "authorityVersion", "primaryId"],
    cancellationConditions: ["authority_corrected_or_deleted", "primary_access_revoked"],
    allowedChannels: ["in_app"],
  },
  "period_window_approaching.v1": {
    type: "period_window_approaching.v1",
    version: 1,
    purpose: "period_window_approaching",
    producer: "current_served_v2_snapshot",
    recipient: "primary",
    privacyClass: "primary_private_inferred_health",
    validity: "designated_due_local_day_while_snapshot_is_current",
    idempotencyComponents: [
      "type",
      "primaryId",
      "latestEligibleStartEventId",
      "sourceAuthorityVersion",
      "dueLocalDay",
      "reminderWindowVersion",
    ],
    cancellationConditions: [
      "new_start",
      "correction_or_tombstone",
      "pause",
      "timezone_change",
      "stale_snapshot",
      "preference_off",
    ],
    allowedChannels: ["in_app"],
  },
  "late_status.v1": {
    type: "late_status.v1",
    version: 1,
    purpose: "late_status",
    producer: "approved_served_late_state",
    recipient: "primary",
    privacyClass: "primary_private_inferred_health",
    validity: "while_current_late_state_is_valid",
    idempotencyComponents: [
      "type",
      "primaryId",
      "sourceAuthorityVersion",
      "localDay",
      "reminderWindowVersion",
    ],
    cancellationConditions: ["late_state_changed", "pause", "source_changed", "preference_off"],
    allowedChannels: ["in_app"],
  },
  "pain_check_in.v1": {
    type: "pain_check_in.v1",
    version: 1,
    purpose: "pain_check_in",
    producer: "explicit_primary_request",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "selected_local_day_while_request_is_active",
    idempotencyComponents: ["type", "requestId", "requestVersion", "primaryId"],
    cancellationConditions: ["request_edited", "request_cancelled", "request_revoked"],
    allowedChannels: ["in_app"],
  },
  "partner_linked.v1": {
    type: "partner_linked.v1",
    version: 1,
    purpose: "partner_linked",
    producer: "active_link_transition",
    recipient: "each_link_member_separately",
    privacyClass: "account_relationship_sensitive",
    validity: "while_link_generation_is_active",
    idempotencyComponents: ["type", "coupleId", "linkGeneration", "recipientId"],
    cancellationConditions: ["link_revoked"],
    allowedChannels: ["in_app"],
  },
  "partner_message.v1": {
    type: "partner_message.v1",
    version: 1,
    purpose: "partner_message",
    producer: "new_couple_message",
    recipient: "other_active_member",
    privacyClass: "relationship_private_free_text_source",
    validity: "while_message_and_active_link_exist",
    idempotencyComponents: ["type", "messageId", "recipientId"],
    cancellationConditions: ["message_deleted", "chat_cleared", "link_revoked"],
    allowedChannels: ["in_app"],
  },
  "partner_nudge.v1": {
    type: "partner_nudge.v1",
    version: 1,
    purpose: "partner_nudge",
    producer: "new_nudge",
    recipient: "nudge_receiver",
    privacyClass: "relationship_private_emoji_source",
    validity: "while_nudge_is_unseen_and_link_is_active",
    idempotencyComponents: ["type", "nudgeId", "receiverId"],
    cancellationConditions: ["nudge_seen", "link_revoked"],
    allowedChannels: ["in_app"],
  },
  "partner_chat_cleared.v1": {
    type: "partner_chat_cleared.v1",
    version: 1,
    purpose: "partner_chat_cleared",
    producer: "explicit_chat_clear_transition",
    recipient: "other_active_member",
    privacyClass: "account_relationship_sensitive",
    validity: "until_newer_chat_state_or_link_revocation",
    idempotencyComponents: ["type", "coupleId", "clearOperationId", "recipientId"],
    cancellationConditions: ["newer_chat_state", "link_revoked"],
    allowedChannels: ["in_app"],
  },
  "connected_since_updated.v1": {
    type: "connected_since_updated.v1",
    version: 1,
    purpose: "connected_since_updated",
    producer: "explicit_connected_since_update",
    recipient: "other_active_member",
    privacyClass: "account_relationship_sensitive",
    validity: "until_setting_version_changes_or_link_revocation",
    idempotencyComponents: ["type", "coupleId", "settingVersion", "recipientId"],
    cancellationConditions: ["newer_setting_version", "link_revoked"],
    allowedChannels: ["in_app"],
  },
} as const satisfies Record<
  NotificationEventType,
  {
    type: NotificationEventType;
    version: 1;
    purpose: string;
    producer: string;
    recipient: string;
    privacyClass: string;
    validity: string;
    idempotencyComponents: readonly string[];
    cancellationConditions: readonly string[];
    allowedChannels: readonly ["in_app"];
  }
>;

const eventTypeValidator = v.union(
  v.literal("assisted_period_start.v1"),
  v.literal("assisted_period_end.v1"),
  v.literal("period_window_approaching.v1"),
  v.literal("late_status.v1"),
  v.literal("pain_check_in.v1"),
  v.literal("partner_linked.v1"),
  v.literal("partner_message.v1"),
  v.literal("partner_nudge.v1"),
  v.literal("partner_chat_cleared.v1"),
  v.literal("connected_since_updated.v1"),
);

const purposeValidator = v.union(
  v.literal("assisted_period_start"),
  v.literal("assisted_period_end"),
  v.literal("period_window_approaching"),
  v.literal("late_status"),
  v.literal("pain_check_in"),
  v.literal("partner_linked"),
  v.literal("partner_message"),
  v.literal("partner_nudge"),
  v.literal("partner_chat_cleared"),
  v.literal("connected_since_updated"),
);

const privacyClassValidator = v.union(
  v.literal("primary_private_health"),
  v.literal("primary_private_inferred_health"),
  v.literal("account_relationship_sensitive"),
  v.literal("relationship_private_free_text_source"),
  v.literal("relationship_private_emoji_source"),
);

const recipientScopeValidator = v.union(
  v.literal("primary"),
  v.literal("each_link_member_separately"),
  v.literal("other_active_member"),
  v.literal("nudge_receiver"),
);

const producerKindValidator = v.union(
  v.literal("accepted_period_start"),
  v.literal("accepted_period_end"),
  v.literal("current_served_v2_snapshot"),
  v.literal("approved_served_late_state"),
  v.literal("explicit_primary_request"),
  v.literal("active_link_transition"),
  v.literal("new_couple_message"),
  v.literal("new_nudge"),
  v.literal("explicit_chat_clear_transition"),
  v.literal("explicit_connected_since_update"),
);

const validityRuleValidator = v.union(
  v.literal("while_authority_is_current_and_primary_has_access"),
  v.literal("designated_due_local_day_while_snapshot_is_current"),
  v.literal("while_current_late_state_is_valid"),
  v.literal("selected_local_day_while_request_is_active"),
  v.literal("while_link_generation_is_active"),
  v.literal("while_message_and_active_link_exist"),
  v.literal("while_nudge_is_unseen_and_link_is_active"),
  v.literal("until_newer_chat_state_or_link_revocation"),
  v.literal("until_setting_version_changes_or_link_revocation"),
);

/**
 * Strict, content-free event envelope shared by the outbox schema and writers.
 * Recipient identity is a CB Connect user; destination resolution belongs to a delivery.
 */
export const notificationEventEnvelopeValidator = v.object({
  eventType: eventTypeValidator,
  eventVersion: v.literal(1),
  purpose: purposeValidator,
  producerKind: producerKindValidator,
  sourceReference: v.string(),
  sourceAuthorityVersion: v.string(),
  ownerUserId: v.id("users"),
  recipientUserId: v.id("users"),
  recipientScope: recipientScopeValidator,
  privacyClass: privacyClassValidator,
  validityRule: validityRuleValidator,
  idempotencyKey: v.string(),
  allowedChannel: v.literal("in_app"),
});
