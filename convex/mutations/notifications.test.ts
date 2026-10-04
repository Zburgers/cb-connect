import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import {
  notificationControlValidator,
  notificationInAppAttemptValidator,
  notificationInAppDeliveryValidator,
  painReminderRequestValidator,
} from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

function enableOutboxProjection() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_INBOX_V1", "true");
}

function indexDefinitions(table: unknown) {
  return (table as unknown as {
    indexes: Array<{ indexDescriptor: string; fields: string[] }>;
  }).indexes;
}

describe("notification persistence", () => {
  test("deduplicates an in-app event, delivery, and inbox item under concurrent writes", async () => {
    enableOutboxProjection();
    const t = convexTest(schema, modules);
    const { asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "partner_message",
      inAppEnabled: true,
    });

    const messageId = await t.run((ctx) =>
      ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "Private message body must not be copied",
        createdAt: 1_800_000_000_000,
      }),
    );
    const event = {
      eventType: "partner_message.v1" as const,
      eventVersion: 1 as const,
      purpose: "partner_message" as const,
      producerKind: "new_couple_message" as const,
      sourceReference: `message:${messageId}`,
      sourceAuthorityVersion: "link-generation:1",
      ownerUserId: primaryId,
      recipientUserId: partnerId,
      recipientScope: "other_active_member" as const,
      privacyClass: "relationship_private_free_text_source" as const,
      validityRule: "while_message_and_active_link_exist" as const,
      idempotencyKey: makeEventIdempotencyKey("partner_message.v1", {
        messageId: String(messageId),
        recipientId: String(partnerId),
      }),
      allowedChannel: "in_app" as const,
    };
    const args = {
      envelope: event,
      route: "messages" as const,
      templateVersion: "g4-static-v1",
      renderIdentity: {
        templateVersion: "g4-static-v1",
        locale: "en",
        variableSchemaVersion: "g4-v1",
        payloadHash: "test-static-message-v1",
      },
      createdAt: 1_800_000_000_000,
      notBefore: 1_800_000_000_000,
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        t.mutation(internal.mutations.notifications.ensureInAppRecords, args),
      ),
    );

    expect(new Set(results.map((result) => result.eventId)).size).toBe(1);
    expect(new Set(results.map((result) => result.deliveryId)).size).toBe(1);
    expect(new Set(results.map((result) => result.inboxItemId)).size).toBe(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { channel: "in_app", state: "pending", providerOutcome: "none" },
      ]);
      expect(await ctx.db.query("notificationInboxItems").collect()).toMatchObject([
        { recipientUserId: partnerId, state: "current", route: "messages" },
      ]);
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
    });

    await t.run(async (ctx) => {
      const delivery = await ctx.db.query("notificationDeliveries").first();
      if (!delivery) throw new Error("Expected the private in-app delivery");

      await ctx.db.patch(delivery._id, {
        state: "retry_wait",
        nextAttemptAt: 1_800_000_000_100,
        updatedAt: 1_800_000_000_100,
      });
      await ctx.db.patch(delivery._id, {
        state: "failed_permanent",
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        updatedAt: 1_800_000_000_200,
      });
    });
  });

  test("does not create new storage while the absent outbox flag is off", async () => {
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const result = await t.mutation(
      internal.mutations.notifications.ensureInAppRecords,
      {
        envelope: {
          eventType: "partner_message.v1",
          eventVersion: 1,
          purpose: "partner_message",
          producerKind: "new_couple_message",
          sourceReference: "message:opaque",
          sourceAuthorityVersion: "link-generation:1",
          ownerUserId: primaryId,
          recipientUserId: partnerId,
          recipientScope: "other_active_member",
          privacyClass: "relationship_private_free_text_source",
          validityRule: "while_message_and_active_link_exist",
          idempotencyKey: "event:v1:opaque",
          allowedChannel: "in_app",
        },
          route: "messages",
          templateVersion: "g4-static-v1",
          renderIdentity: {
            templateVersion: "g4-static-v1",
            locale: "en",
            variableSchemaVersion: "g4-v1",
            payloadHash: "test-static-message-v1",
          },
          createdAt: 1_800_000_000_000,
        notBefore: 1_800_000_000_000,
      },
    );

    expect(result).toMatchObject({ status: "disabled" });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("advances only the changed purpose schedule version and clears local time explicitly", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const write = (localReminderTime?: string | null) =>
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "pain_check_in",
        inAppEnabled: true,
        ...(localReminderTime === undefined ? {} : { localReminderTime }),
      });

    await write();
    await write();
    let row = await t.run((ctx) =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "pain_check_in"),
        )
        .unique(),
    );
    expect(row?.reminderWindowVersion).toBe(1);

    await write("09:30");
    await write(null);
    row = await t.run((ctx) =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "pain_check_in"),
        )
        .unique(),
    );
    expect(row?.reminderWindowVersion).toBe(3);
    expect(row?.localReminderTime).toBeUndefined();
    await t.run(async (ctx) => {
      const unrelated = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "partner_message"),
        )
        .unique();
      expect(unrelated).toBeNull();
    });
  });

  test("rejects external-channel fields on new preference and persistence paths", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const args = {
      envelope: {
        eventType: "partner_message.v1" as const,
        eventVersion: 1 as const,
        purpose: "partner_message" as const,
        producerKind: "new_couple_message" as const,
        sourceReference: "message:opaque",
        sourceAuthorityVersion: "link-generation:1",
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        recipientScope: "other_active_member" as const,
        privacyClass: "relationship_private_free_text_source" as const,
        validityRule: "while_message_and_active_link_exist" as const,
        idempotencyKey: "event:v1:opaque",
        allowedChannel: "in_app" as const,
      },
      route: "messages" as const,
      templateVersion: "g4-static-v1",
      renderIdentity: {
        templateVersion: "g4-static-v1",
        locale: "en",
        variableSchemaVersion: "g4-v1",
        payloadHash: "test-static-message-v1",
      },
      createdAt: 1_800_000_000_000,
      notBefore: 1_800_000_000_000,
    };

    await expect(
      t.mutation(internal.mutations.notifications.ensureInAppRecords, {
        ...args,
        channel: "discord",
      } as never),
    ).rejects.toThrow();
    await expect(
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "partner_message",
        inAppEnabled: true,
        channel: "discord",
      } as never),
    ).rejects.toThrow();
  });

  test("bounds due-work reads to pending rows at or before the supplied time", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "pending",
        dueAt: 10,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "pending",
        dueAt: 20,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "completed",
        dueAt: 5,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const rows = await t.query(internal.queries.notifications.getDueWork, {
      now: 10,
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].dueAt).toBe(10);
  });

  test("keeps pain requests minimal and schedule authority unbackfilled", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationScheduleState").collect()).toHaveLength(0);
    });
  });

  test("freezes strict in-app, deny-only, content-free storage shapes", () => {
    expect(Object.keys(notificationInAppDeliveryValidator.fields)).not.toContain(
      "providerMessageId",
    );
    expect(
      Object.keys(notificationInAppAttemptValidator.fields.result.fields),
    ).toEqual(["kind"]);
    expect(Object.keys(notificationControlValidator.fields).sort()).toEqual([
      "key",
      "operatorReference",
      "scope",
      "updatedAt",
      "version",
    ]);
    expect(Object.keys(painReminderRequestValidator.fields).sort()).toEqual([
      "createdAt",
      "ownerUserId",
      "painLogId",
      "requestVersion",
      "selectedLocalDay",
      "state",
      "updatedAt",
    ]);
    expect(indexDefinitions(schema.tables.notificationDueWork)).toContainEqual({
      indexDescriptor: "by_state_and_due_at",
      fields: ["state", "dueAt"],
    });
    expect(indexDefinitions(schema.tables.notificationScheduleState)).toContainEqual({
      indexDescriptor: "by_user_id",
      fields: ["userId"],
    });
    expect(indexDefinitions(schema.tables.notificationDeliveries)).toContainEqual({
      indexDescriptor: "by_state_and_expires_at",
      fields: ["state", "expiresAt"],
    });
  });
});
