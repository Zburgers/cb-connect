import { describe, expect, test } from "vitest";
import { defineSchema, defineTable } from "convex/server";
import { convexTest } from "convex-test";

import {
  assertValidNotificationEventWrite,
  notificationEventEnvelopeValidator,
  notificationEventPersistedEnvelopeValidator,
  notificationEventDefinitions,
  notificationEventTypes,
  notificationEventWriteValidator,
  notificationSourceIdentityValidator,
  type NotificationEventType,
  type NotificationEventWrite,
  type NotificationSourceIdentity,
} from "./notificationTypes";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { makeSourceAuthorityVersion } from "./notificationSourceAuthority";

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
    idempotencyComponents: [
      "type",
      "coupleId",
      "clearOperationId",
      "relationshipMembershipId",
      "recipientId",
    ],
    cancellationConditions: ["newer_chat_state", "link_revoked"],
  },
  {
    type: "connected_since_updated.v1",
    purpose: "connected_since_updated",
    producer: "explicit_connected_since_update",
    recipient: "other_active_member",
    privacyClass: "account_relationship_sensitive",
    validity: "until_setting_version_changes_or_link_revocation",
    idempotencyComponents: [
      "type",
      "coupleId",
      "settingVersion",
      "relationshipMembershipId",
      "recipientId",
    ],
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

const primaryId = "1users" as Id<"users">;
const ownerId = "2users" as Id<"users">;
const recipientId = "3users" as Id<"users">;
const coupleId = "1couples" as Id<"couples">;
const relationshipMembershipId = "1coupleMembers" as Id<"coupleMembers">;
const sourceAuthorityVersion = makeSourceAuthorityVersion({
  sourceRevision: 1,
  servedCycleContract: "cycle-state-v1",
  servedPredictionContract: "prediction-v2",
  estimatorMethodVersion: "estimator-v1",
  calibrationMethodVersion: null,
});

const sourceIdentities: Record<NotificationEventType, NotificationSourceIdentity> = {
  "assisted_period_start.v1": {
    eventType: "assisted_period_start.v1",
    sourceId: "1periodEvents" as Id<"periodEvents">,
    authorityVersion: 1,
    primaryId,
  },
  "assisted_period_end.v1": {
    eventType: "assisted_period_end.v1",
    sourceId: "2periodEvents" as Id<"periodEvents">,
    authorityVersion: 1,
    primaryId,
  },
  "period_window_approaching.v1": {
    eventType: "period_window_approaching.v1",
    primaryId,
    latestEligibleStartEventId: "3periodEvents" as Id<"periodEvents">,
    sourceAuthorityVersion,
    reminderWindowVersion: 1,
    dueLocalDay: "2026-10-06",
  },
  "late_status.v1": {
    eventType: "late_status.v1",
    primaryId,
    latestEligibleStartEventId: "3periodEvents" as Id<"periodEvents">,
    sourceAuthorityVersion,
    reminderWindowVersion: 1,
    localDay: "2026-10-06",
  },
  "pain_check_in.v1": {
    eventType: "pain_check_in.v1",
    requestId: "1painReminderRequests" as Id<"painReminderRequests">,
    painLogId: "1painLogs" as Id<"painLogs">,
    requestVersion: 1,
    primaryId,
    selectedLocalDay: "2026-10-06",
  },
  "partner_linked.v1": {
    eventType: "partner_linked.v1",
    sourceId: relationshipMembershipId,
    coupleId,
    relationshipMembershipId,
    ownerUserId: ownerId,
    recipientUserId: recipientId,
  },
  "partner_message.v1": {
    eventType: "partner_message.v1",
    sourceId: "1coupleMessages" as Id<"coupleMessages">,
    coupleId,
    relationshipMembershipId,
    ownerUserId: ownerId,
    recipientUserId: recipientId,
  },
  "partner_nudge.v1": {
    eventType: "partner_nudge.v1",
    sourceId: "1nudges" as Id<"nudges">,
    coupleId,
    relationshipMembershipId,
    ownerUserId: ownerId,
    recipientUserId: recipientId,
  },
  "partner_chat_cleared.v1": {
    eventType: "partner_chat_cleared.v1",
    sourceId: coupleId,
    coupleId,
    relationshipMembershipId,
    ownerUserId: ownerId,
    recipientUserId: recipientId,
    clearOperationVersion: 1,
  },
  "connected_since_updated.v1": {
    eventType: "connected_since_updated.v1",
    sourceId: coupleId,
    coupleId,
    relationshipMembershipId,
    ownerUserId: ownerId,
    recipientUserId: recipientId,
    settingVersion: 1,
  },
};

function expectedSourceAuthorityVersion(identity: NotificationSourceIdentity): string {
  switch (identity.eventType) {
    case "assisted_period_start.v1":
    case "assisted_period_end.v1":
      return `period-authority:${identity.authorityVersion}`;
    case "period_window_approaching.v1":
    case "late_status.v1":
      return identity.sourceAuthorityVersion;
    case "pain_check_in.v1":
      return `pain-reminder-request:v${identity.requestVersion}`;
    case "partner_linked.v1":
    case "partner_message.v1":
    case "partner_nudge.v1":
      return `relationship-membership:${identity.relationshipMembershipId}`;
    case "partner_chat_cleared.v1":
      return `chat-clear:${identity.clearOperationVersion}`;
    case "connected_since_updated.v1":
      return `connected-since-setting:${identity.settingVersion}`;
  }
}

function makeEventWrite(
  identity: NotificationSourceIdentity,
  overrides: Record<string, unknown> = {},
): NotificationEventWrite {
  const eventType = overrides.eventType ?? identity.eventType;
  const definition =
    notificationEventDefinitions[eventType as NotificationEventType];
  const ownerUserId = "primaryId" in identity ? identity.primaryId : identity.ownerUserId;
  const recipientUserId =
    "primaryId" in identity ? identity.primaryId : identity.recipientUserId;

  return {
    eventType,
    eventVersion: 1,
    purpose: definition.purpose,
    producerKind: definition.producer,
    sourceReference: `source:${identity.eventType}`,
    sourceAuthorityVersion: expectedSourceAuthorityVersion(identity),
    ownerUserId,
    recipientUserId,
    recipientScope: definition.recipient,
    privacyClass: definition.privacyClass,
    validityRule: definition.validity,
    idempotencyKey: `event:v1:${identity.eventType}`,
    allowedChannel: "in_app",
    sourceIdentity: identity,
    ...overrides,
  } as NotificationEventWrite;
}

const newEventSchema = defineSchema({
  eventWrites: defineTable(notificationEventWriteValidator),
});

const modules = import.meta.glob("../**/*.ts");

async function insertNewWrite(write: NotificationEventWrite) {
  return convexTest(newEventSchema, modules).run((ctx) =>
    ctx.db.insert("eventWrites", write),
  );
}

async function assertWriteGuard(write: unknown) {
  return convexTest(schema, modules).run(async (ctx) =>
    assertValidNotificationEventWrite(ctx, write),
  );
}

describe("typed event source identity contract", () => {
  test("accepts a matching typed identity for every catalog event on new writes", async () => {
    for (const eventType of notificationEventTypes) {
      const identity = sourceIdentities[eventType];
      const write = makeEventWrite(identity);

      await expect(insertNewWrite(write)).resolves.toBeDefined();
      await expect(assertWriteGuard(write)).resolves.toBeNull();
    }
    expect(notificationEventWriteValidator.fields.sourceIdentity.isOptional).toBe("required");
    expect(notificationSourceIdentityValidator.kind).toBe("union");
  });

  test.each([
    ["envelope", "constructor"], ["sourceIdentity", "constructor"],
    ["envelope", "toString"], ["sourceIdentity", "toString"],
    ["envelope", "__proto__"], ["sourceIdentity", "__proto__"],
  ])("%s rejects unexpected own %s fields at the write guard", async (location, field) => {
    const valid = makeEventWrite(sourceIdentities["partner_message.v1"]);
    const write = location === "envelope"
      ? { ...valid, [field]: "unexpected" }
      : { ...valid, sourceIdentity: { ...valid.sourceIdentity, [field]: "unexpected" } };
    await expect(assertWriteGuard(JSON.parse(JSON.stringify(write)))).rejects.toThrow(
      "Notification event does not match frozen write shape",
    );
  });

  test("rejects a numeric partner message source ID at the write guard", async () => {
    const identity = sourceIdentities["partner_message.v1"];
    const malformed = makeEventWrite(identity, {
      sourceIdentity: { ...identity, sourceId: 123 },
    });

    await expect(insertNewWrite(malformed)).rejects.toThrow();
    await expect(assertWriteGuard(malformed)).rejects.toThrow(
      "Notification event does not match frozen write shape",
    );
  });

  test("rejects a valid nudges ID as a partner message source ID at the write guard", async () => {
    const t = convexTest(schema, modules);
    const nudgeId = await t.run(async (ctx) =>
      ctx.db.insert("nudges", {
        coupleId,
        senderId: ownerId,
        receiverId: recipientId,
        emoji: "✨",
        message: "test",
        createdAt: 1,
      }),
    );
    const identity = sourceIdentities["partner_message.v1"];
    const malformed = makeEventWrite(identity, {
      sourceIdentity: {
        ...identity,
        sourceId: nudgeId as unknown as Id<"coupleMessages">,
      },
    });

    await expect(
      t.run(async (ctx) => assertValidNotificationEventWrite(ctx, malformed)),
    ).rejects.toThrow("Notification event does not match frozen write shape");
  });

  test("rejects a null partner message couple ID at the write guard", async () => {
    const identity = sourceIdentities["partner_message.v1"];
    const malformed = makeEventWrite(identity, {
      sourceIdentity: { ...identity, coupleId: null },
    });

    await expect(insertNewWrite(malformed)).rejects.toThrow();
    await expect(assertWriteGuard(malformed)).rejects.toThrow(
      "Notification event does not match frozen write shape",
    );
  });

  test("rejects missing required envelope fields at the write guard", async () => {
    const malformed = makeEventWrite(sourceIdentities["partner_message.v1"], {
      sourceReference: undefined,
    });

    await expect(insertNewWrite(malformed)).rejects.toThrow();
    await expect(assertWriteGuard(malformed)).rejects.toThrow(
      "Notification event does not match frozen write shape",
    );
  });

  test("rejects malformed, wrong-kind, wrong-source, wrong-owner and wrong-recipient identities", async () => {
    const valid = makeEventWrite(sourceIdentities["partner_message.v1"]);

    const missingIdentity = { ...valid, sourceIdentity: undefined } as unknown as NotificationEventWrite;
    await expect(insertNewWrite(missingIdentity)).rejects.toThrow();
    await expect(assertWriteGuard(missingIdentity)).rejects.toThrow();
    const malformedIdentity = {
      ...valid,
      sourceIdentity: { ...valid.sourceIdentity, unexpected: true },
    } as unknown as NotificationEventWrite;
    await expect(insertNewWrite(malformedIdentity)).rejects.toThrow();
    await expect(assertWriteGuard(malformedIdentity)).rejects.toThrow();
    const wrongSourceTable = {
      ...valid,
      sourceIdentity: {
        ...sourceIdentities["partner_message.v1"],
        sourceId: "1nudges",
      },
    } as unknown as NotificationEventWrite;
    await expect(insertNewWrite(wrongSourceTable)).rejects.toThrow();

    await convexTest(schema, modules).run(async (ctx) => {
      const guard = (write: unknown) => assertValidNotificationEventWrite(ctx, write);

      expect(() =>
        guard(
          makeEventWrite(sourceIdentities["partner_message.v1"], {
            sourceIdentity: sourceIdentities["partner_nudge.v1"],
          }),
        ),
      ).toThrow();
      expect(() =>
        guard(
          makeEventWrite(sourceIdentities["partner_message.v1"], {
            purpose: "pain_check_in",
          }),
        ),
      ).toThrow();
      expect(() =>
        guard(
          makeEventWrite(sourceIdentities["partner_message.v1"], { ownerUserId: recipientId }),
        ),
      ).toThrow();
      expect(() =>
        guard(
          makeEventWrite(
            {
              ...sourceIdentities["partner_linked.v1"],
              sourceId: "2coupleMembers" as Id<"coupleMembers">,
            } as Extract<NotificationSourceIdentity, { eventType: "partner_linked.v1" }>,
          ),
        ),
      ).toThrow();
      expect(() =>
        guard(
          makeEventWrite(
            {
              ...sourceIdentities["partner_chat_cleared.v1"],
              sourceId: "2couples" as Id<"couples">,
            } as Extract<
              NotificationSourceIdentity,
              { eventType: "partner_chat_cleared.v1" }
            >,
          ),
        ),
      ).toThrow();
      expect(() =>
        guard(
          makeEventWrite(sourceIdentities["partner_message.v1"], { recipientUserId: ownerId }),
        ),
      ).toThrow();
      const selfDirectedMessage = {
        ...sourceIdentities["partner_message.v1"],
        recipientUserId: ownerId,
      } as Extract<NotificationSourceIdentity, { eventType: "partner_message.v1" }>;
      expect(() => guard(makeEventWrite(selfDirectedMessage))).toThrow();
      expect(() =>
        guard(
          makeEventWrite(sourceIdentities["partner_message.v1"], {
            sourceAuthorityVersion: "relationship-membership:coupleMembers:other",
          }),
        ),
      ).toThrow();
      const scheduledIdentity = sourceIdentities["period_window_approaching.v1"];
      const malformedScheduledIdentity = {
        ...scheduledIdentity,
        sourceAuthorityVersion: "g4-source-v1:not-a-canonical-tuple",
      };
      expect(() => guard(makeEventWrite(malformedScheduledIdentity))).toThrow();
    });
  });

  test("requires every identity version to be a positive safe integer", async () => {
    const numericVersions = [
      { eventType: "assisted_period_start.v1", field: "authorityVersion" },
      { eventType: "period_window_approaching.v1", field: "reminderWindowVersion" },
      { eventType: "pain_check_in.v1", field: "requestVersion" },
      { eventType: "partner_chat_cleared.v1", field: "clearOperationVersion" },
      { eventType: "connected_since_updated.v1", field: "settingVersion" },
    ] as const;
    const invalidVersions = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const { eventType, field } of numericVersions) {
      for (const version of invalidVersions) {
        const identity = { ...sourceIdentities[eventType] } as Record<string, unknown>;
        identity[field] = version;
        await expect(
          assertWriteGuard(makeEventWrite(identity as unknown as NotificationSourceIdentity)),
        ).rejects.toThrow();
      }
      const identity = { ...sourceIdentities[eventType] } as Record<string, unknown>;
      identity[field] = Number.MAX_SAFE_INTEGER;
      await expect(
        assertWriteGuard(makeEventWrite(identity as unknown as NotificationSourceIdentity)),
      ).resolves.toBeNull();
    }
  });

  test("keeps persisted pre-amendment envelopes readable without backfilling identity", async () => {
    const identity = sourceIdentities["partner_message.v1"];
    const { sourceIdentity: _sourceIdentity, ...legacyEnvelope } = makeEventWrite(identity);
    const t = convexTest(schema, modules);

    const id = await t.run((ctx) =>
      ctx.db.insert("notificationEvents", { ...legacyEnvelope, createdAt: 1 }),
    );
    const persisted = await t.run((ctx) => ctx.db.get(id));
    expect(persisted).not.toHaveProperty("sourceIdentity");
    expect(notificationEventPersistedEnvelopeValidator.fields.sourceIdentity.isOptional).toBe("optional");
    expect(notificationEventEnvelopeValidator.fields).not.toHaveProperty("sourceIdentity");
    expect(notificationEventWriteValidator.fields.sourceIdentity.isOptional).toBe("required");

    const legacyClearId = await t.run((ctx) =>
      ctx.db.insert("couples", {
        createdAt: 1,
        chatClearedAt: 2,
        status: "active",
      }),
    );
    const legacyClear = await t.run((ctx) => ctx.db.get(legacyClearId));
    expect(legacyClear).not.toHaveProperty("chatClearedBy");

    const attributedClearId = await t.run((ctx) =>
      ctx.db.insert("couples", {
        createdAt: 1,
        chatClearedAt: 2,
        chatClearedBy: primaryId,
        status: "active",
      }),
    );
    expect(await t.run((ctx) => ctx.db.get(attributedClearId))).toHaveProperty(
      "chatClearedBy",
      primaryId,
    );
  });
});
