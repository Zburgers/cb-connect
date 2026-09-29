import { describe, expect, test } from "vitest";

import {
  notificationEventEnvelopeValidator,
  notificationEventDefinitions,
  notificationEventTypes,
} from "./notificationTypes";

const expectedEvents = [
  {
    type: "assisted_period_start.v1",
    purpose: "assisted_period_start",
    producer: "accepted_period_start",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "while_authority_is_current_and_primary_has_access",
    idempotencyComponents: ["type", "periodEventId", "authorityVersion", "primaryId"],
    cancellationConditions: ["authority_corrected_or_deleted", "primary_access_revoked"],
  },
  {
    type: "assisted_period_end.v1",
    purpose: "assisted_period_end",
    producer: "accepted_period_end",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "while_authority_is_current_and_primary_has_access",
    idempotencyComponents: ["type", "periodEventId", "authorityVersion", "primaryId"],
    cancellationConditions: ["authority_corrected_or_deleted", "primary_access_revoked"],
  },
  {
    type: "period_window_approaching.v1",
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
  },
  {
    type: "late_status.v1",
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
  },
  {
    type: "pain_check_in.v1",
    purpose: "pain_check_in",
    producer: "explicit_primary_request",
    recipient: "primary",
    privacyClass: "primary_private_health",
    validity: "selected_local_day_while_request_is_active",
    idempotencyComponents: ["type", "requestId", "requestVersion", "primaryId"],
    cancellationConditions: ["request_edited", "request_cancelled", "request_revoked"],
  },
  {
    type: "partner_linked.v1",
    purpose: "partner_linked",
    producer: "active_link_transition",
    recipient: "each_link_member_separately",
    privacyClass: "account_relationship_sensitive",
    validity: "while_link_generation_is_active",
    idempotencyComponents: ["type", "coupleId", "linkGeneration", "recipientId"],
    cancellationConditions: ["link_revoked"],
  },
  {
    type: "partner_message.v1",
    purpose: "partner_message",
    producer: "new_couple_message",
    recipient: "other_active_member",
    privacyClass: "relationship_private_free_text_source",
    validity: "while_message_and_active_link_exist",
    idempotencyComponents: ["type", "messageId", "recipientId"],
    cancellationConditions: ["message_deleted", "chat_cleared", "link_revoked"],
  },
  {
    type: "partner_nudge.v1",
    purpose: "partner_nudge",
    producer: "new_nudge",
    recipient: "nudge_receiver",
    privacyClass: "relationship_private_emoji_source",
    validity: "while_nudge_is_unseen_and_link_is_active",
    idempotencyComponents: ["type", "nudgeId", "receiverId"],
    cancellationConditions: ["nudge_seen", "link_revoked"],
  },
  {
    type: "partner_chat_cleared.v1",
    purpose: "partner_chat_cleared",
    producer: "explicit_chat_clear_transition",
    recipient: "other_active_member",
    privacyClass: "account_relationship_sensitive",
    validity: "until_newer_chat_state_or_link_revocation",
    idempotencyComponents: ["type", "coupleId", "clearOperationId", "recipientId"],
    cancellationConditions: ["newer_chat_state", "link_revoked"],
  },
  {
    type: "connected_since_updated.v1",
    purpose: "connected_since_updated",
    producer: "explicit_connected_since_update",
    recipient: "other_active_member",
    privacyClass: "account_relationship_sensitive",
    validity: "until_setting_version_changes_or_link_revocation",
    idempotencyComponents: ["type", "coupleId", "settingVersion", "recipientId"],
    cancellationConditions: ["newer_setting_version", "link_revoked"],
  },
] as const;

describe("G4-EVENT-V1 event catalog", () => {
  test("freezes the complete version, recipient, privacy, validity, key, and channel matrix", () => {
    expect([...notificationEventTypes]).toEqual(expectedEvents.map(({ type }) => type));

    for (const event of expectedEvents) {
      expect(notificationEventDefinitions[event.type]).toEqual({
        ...event,
        version: 1,
        allowedChannels: ["in_app"],
      });
    }
  });

  test("keeps destinations and rendered or source content out of domain event definitions", () => {
    for (const definition of Object.values(notificationEventDefinitions)) {
      expect(definition).not.toHaveProperty("destination");
      expect(definition).not.toHaveProperty("payload");
      expect(definition).not.toHaveProperty("message");
      expect(definition).not.toHaveProperty("body");
    }

    expect(Object.keys(notificationEventEnvelopeValidator.fields).sort()).toEqual(
      [
        "allowedChannel",
        "eventType",
        "eventVersion",
        "idempotencyKey",
        "ownerUserId",
        "privacyClass",
        "producerKind",
        "purpose",
        "recipientScope",
        "recipientUserId",
        "sourceAuthorityVersion",
        "sourceReference",
        "validityRule",
      ].sort(),
    );
  });
});
