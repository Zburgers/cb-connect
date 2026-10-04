import { describe, expect, test } from "vitest";

import { authorizeNotificationProjection } from "./notificationPolicy";

const validRequest = {
  eventType: "partner_message.v1" as const,
  purpose: "partner_message" as const,
  channel: "in_app" as const,
  recipientUserId: "users:2",
  currentRecipientUserId: "users:2",
  sourceAuthorityVersion: "g4-source-v1:[3,\"cycle-read-model-v1\",null,null,null]",
  currentSourceAuthorityVersion: "g4-source-v1:[3,\"cycle-read-model-v1\",null,null,null]",
  expectedGeneration: 7,
  currentGeneration: 7,
  purposeEnabled: true,
  flags: {
    projectionEnabled: true,
    deliveryEnabled: true,
  },
  controls: {},
};

describe("N2c notification authorization", () => {
  test("absent flags fail closed even when a stored preference is enabled", () => {
    expect(
      authorizeNotificationProjection({
        ...validRequest,
        flags: undefined,
      }),
    ).toEqual({ allowed: false, reason: "feature_disabled" });
  });

  test("allows current recipient, source and generation only on the in-app channel", () => {
    expect(authorizeNotificationProjection(validRequest)).toEqual({
      allowed: true,
      reason: "allowed",
    });
    expect(
      authorizeNotificationProjection({
        ...validRequest,
        channel: "discord",
      }),
    ).toEqual({ allowed: false, reason: "external_channel_denied" });
  });

  test.each([
    [{ globalDenied: true }, "global_denied"],
    [{ channelDenied: true }, "channel_denied"],
    [{ purposeDenied: true }, "purpose_denied"],
  ] as const)("honors deny-only controls %j", (controls, reason) => {
    expect(
      authorizeNotificationProjection({ ...validRequest, controls }),
    ).toEqual({ allowed: false, reason });
  });

  test("requires the event's current recipient and purpose preference", () => {
    expect(
      authorizeNotificationProjection({
        ...validRequest,
        currentRecipientUserId: "users:3",
      }),
    ).toEqual({ allowed: false, reason: "recipient_mismatch" });
    expect(
      authorizeNotificationProjection({ ...validRequest, purposeEnabled: false }),
    ).toEqual({ allowed: false, reason: "preference_disabled" });
  });

  test("rejects superseded source authority and stale work generations", () => {
    expect(
      authorizeNotificationProjection({
        ...validRequest,
        currentSourceAuthorityVersion: "g4-source-v1:[4,\"cycle-read-model-v1\",null,null,null]",
      }),
    ).toEqual({ allowed: false, reason: "stale_source" });
    expect(
      authorizeNotificationProjection({ ...validRequest, currentGeneration: 8 }),
    ).toEqual({ allowed: false, reason: "stale_generation" });
  });

  test("projection enablement alone cannot bypass the global delivery gate", () => {
    expect(
      authorizeNotificationProjection({
        ...validRequest,
        flags: { projectionEnabled: true },
      }),
    ).toEqual({ allowed: false, reason: "feature_disabled" });
  });

  test("event purpose must match the catalog before applying purpose policy", () => {
    expect(
      authorizeNotificationProjection({ ...validRequest, purpose: "partner_nudge" }),
    ).toEqual({ allowed: false, reason: "purpose_mismatch" });
  });

  test("Late projection requires explicit D-011 content approval", () => {
    const lateRequest = {
      ...validRequest,
      eventType: "late_status.v1" as const,
      purpose: "late_status" as const,
    };

    expect(authorizeNotificationProjection(lateRequest)).toEqual({
      allowed: false,
      reason: "content_not_approved",
    });
    expect(
      authorizeNotificationProjection({ ...lateRequest, lateContentApproved: false }),
    ).toEqual({ allowed: false, reason: "content_not_approved" });
    expect(
      authorizeNotificationProjection({ ...lateRequest, lateContentApproved: true }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });
});
