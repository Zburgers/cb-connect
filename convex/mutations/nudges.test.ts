import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import { makeDeliveryIdempotencyKey, makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

describe("nudge notification outbox", () => {
  test("emits one receiver-scoped event per accepted nudge without adding an unread item", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, partnerId } = await seedActiveCouple(t);

    await t.run((ctx) =>
      ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 3,
      }),
    );
    const unreadBefore = await asPartner.query(api.queries.messages.unreadSummary, {});

    const primaryNudgeId = await asPrimary.mutation(api.mutations.nudges.send, {
      emoji: "💗",
    });
    const partnerNudgeId = await asPartner.mutation(api.mutations.nudges.send, {
      emoji: "🤗",
    });
    const nudgeIds = [primaryNudgeId, partnerNudgeId];

    const nudges = await t.run((ctx) => ctx.db.query("nudges").collect());
    const events = await t.run((ctx) => ctx.db.query("notificationEvents").collect());
    expect(nudges.map((nudge) => nudge._id).sort()).toEqual([...nudgeIds].sort());
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.sourceReference).sort()).toEqual(
      nudgeIds.map((nudgeId) => `nudge:${nudgeId}`).sort(),
    );
    for (const event of events) {
      const nudgeId = event.sourceReference.slice("nudge:".length);
      const nudge = nudges.find((candidate) => String(candidate._id) === nudgeId);
      expect(nudge).toBeDefined();
      expect(event).toMatchObject({
        eventType: "partner_nudge.v1",
        eventVersion: 1,
        purpose: "partner_nudge",
        producerKind: "new_nudge",
        sourceAuthorityVersion: `relationship-membership:${nudge!.relationshipMembershipId}`,
        ownerUserId: nudge!.senderId,
        recipientUserId: nudge!.receiverId,
        recipientScope: "nudge_receiver",
        privacyClass: "relationship_private_emoji_source",
        validityRule: "while_nudge_is_unseen_and_link_is_active",
        idempotencyKey: makeEventIdempotencyKey("partner_nudge.v1", {
          nudgeId,
          receiverId: String(nudge!.receiverId),
        }),
        allowedChannel: "in_app",
      });
      expect(event).not.toHaveProperty("emoji");
      expect(event).not.toHaveProperty("message");
      expect(event).not.toHaveProperty("senderName");
    }

    await expect(asPartner.query(api.queries.nudges.latestReceived, {})).resolves.toMatchObject({
      _id: primaryNudgeId,
    });
    await expect(asPrimary.query(api.queries.nudges.latestReceived, {})).resolves.toMatchObject({
      _id: partnerNudgeId,
    });
    expect(
      await asPartner.query(api.queries.messages.unreadSummary, {}),
    ).toEqual(unreadBefore);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("seen acknowledgements cancel projection work without deleting the event", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId, partnerId } = await seedActiveCouple(t);
    const nudgeId = await asPrimary.mutation(api.mutations.nudges.send, {
      emoji: "✨",
    });
    const event = await t.run((ctx) => ctx.db.query("notificationEvents").unique());
    if (!event) throw new Error("Expected an outbox event for the accepted nudge");

    const workIds = await t.run(async (ctx) => {
      const now = 1_800_000_000_000;
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        eventId: event._id,
        recipientUserId: partnerId,
        channel: "in_app",
        stableDestinationId: String(partnerId),
        logicalKey: makeDeliveryIdempotencyKey(
          String(event._id),
          "in_app",
          String(partnerId),
        ),
        notBefore: now,
        state: "pending",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 0,
        claimGeneration: 0,
        renderIdentity: {
          templateVersion: "g4-static-v1",
          locale: "en",
          variableSchemaVersion: "g4-v1",
          payloadHash: "static-nudge-v1",
        },
        createdAt: now,
        updatedAt: now,
      });
      const inboxItemId = await ctx.db.insert("notificationInboxItems", {
        eventId: event._id,
        recipientUserId: partnerId,
        idempotencyKey: `inbox:v1:${event._id}`,
        templateVersion: "g4-static-v1",
        route: "messages",
        state: "current",
        createdAt: now,
      });
      const dueWorkId = await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "delivery",
        state: "pending",
        dueAt: now,
        generation: 1,
        eventId: event._id,
        deliveryId,
        createdAt: now,
        updatedAt: now,
      });
      return { deliveryId, inboxItemId, dueWorkId };
    });

    await asPartner.mutation(api.mutations.nudges.markSeen, { nudgeId });
    const firstSeenAt = await t.run(async (ctx) => {
      const nudge = await ctx.db.get(nudgeId);
      const delivery = await ctx.db.get(workIds.deliveryId);
      const item = await ctx.db.get(workIds.inboxItemId);
      const dueWork = await ctx.db.get(workIds.dueWorkId);
      expect(nudge?.seenAt).toBeDefined();
      expect(delivery).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
        cancellationReason: "source_changed",
      });
      expect(item?.state).toBe("hidden");
      expect(dueWork).toMatchObject({ state: "cancelled", generation: 2 });
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      return nudge!.seenAt;
    });

    await asPartner.mutation(api.mutations.nudges.markSeen, { nudgeId });
    await t.run(async (ctx) => {
      expect((await ctx.db.get(nudgeId))?.seenAt).toBe(firstSeenAt);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
    });
  });

  test("revocation blocks new nudges while retaining old event history and hiding the realtime nudge", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.nudges.send, { emoji: "🫶" });

    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await expect(
      asPrimary.mutation(api.mutations.nudges.send, { emoji: "🌙" }),
    ).rejects.toThrow("not linked");
    await expect(asPartner.query(api.queries.nudges.latestReceived, {})).resolves.toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("nudges").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("keeps accepted nudges working while the outbox flag is off", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);

    const nudgeId = await asPrimary.mutation(api.mutations.nudges.send, {
      emoji: "☕",
    });

    await expect(asPartner.query(api.queries.nudges.latestReceived, {})).resolves.toMatchObject({
      _id: nudgeId,
      emoji: "☕",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });
});
