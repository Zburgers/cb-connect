import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";
import { ensurePartnerMessageEvent } from "./messages";

afterEach(() => vi.unstubAllEnvs());

describe("couple message state", () => {
  test("preserves exactly 80 legacy unread messages when sequencing begins", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { linkedAt: 0 });
      for (let i = 1; i <= 80; i += 1) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          senderId: primaryId,
          body: `Legacy ${i}`,
          createdAt: i,
        });
      }
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 80,
      });
    });

    await asPrimary.mutation(api.mutations.messages.send, { body: "First sequenced" });
    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 81,
    });

    const page = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    const latestLegacy = page.find((message) => message.body === "Legacy 80");
    expect(latestLegacy).toBeDefined();
    await asPartner.mutation(api.mutations.messages.markReadThrough, {
      messageId: latestLegacy!._id,
    });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 1,
    });
    const state = await t.run(async (ctx) =>
      ctx.db
        .query("coupleChatStates")
        .withIndex("by_couple_and_user", (q) =>
          q.eq("coupleId", coupleId).eq("userId", partnerId)
        )
        .unique(),
    );
    expect(state).toMatchObject({
      lastMessageSequence: 81,
      legacySequenceBase: 80,
      legacyUnreadCount: 0,
      unreadCount: 1,
    });
  });

  test("increments only the recipient unread counter", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Hello" });

    const states = await t.run(async (ctx) =>
      await ctx.db.query("coupleChatStates").withIndex("by_couple_and_user", (q) => q.eq("coupleId", coupleId)).collect()
    );
    expect(states).toEqual([expect.objectContaining({ userId: partnerId, unreadCount: 1 })]);
    expect(states.some((state) => state.userId === primaryId)).toBe(false);

    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId });
    const summary = await asPartner.query(api.queries.messages.unreadSummary, {});
    expect(summary.unreadCount).toBe(0);
  });

  test("keeps the old acknowledgement endpoint compatible", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Rolling deploy" });

    await asPartner.mutation(api.mutations.messages.markRead, { messageId });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 0,
    });
  });

  test("delivery and read acknowledgements remain monotonic", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Status" });

    await asPartner.mutation(api.mutations.messages.markDelivered, { messageId });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId });
    const afterRead = await t.run(async (ctx) => ctx.db.get(messageId));
    await asPartner.mutation(api.mutations.messages.markDelivered, { messageId });
    const afterSecondDelivery = await t.run(async (ctx) => ctx.db.get(messageId));

    expect(afterRead?.deliveredAt).toBeDefined();
    expect(afterRead?.readAt).toBeDefined();
    expect(afterSecondDelivery?.deliveredAt).toBe(afterRead?.deliveredAt);
    expect(afterSecondDelivery?.readAt).toBe(afterRead?.readAt);
  });

  test("keeps legacy chat rows visible within the active relationship", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId, partnerId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      const couple = await ctx.db.get(coupleId);
      await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: partnerId,
        body: "Legacy active message",
        createdAt: couple!.linkedAt! + 1,
      });
    });

    await expect(
      asPrimary.query(api.queries.messages.listForCouple, {}),
    ).resolves.toEqual([expect.objectContaining({ body: "Legacy active message" })]);
  });

  test("rejects acknowledgements from a user outside the couple", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId, primaryId } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Private" });
    const outsiderId = await t.run(async (ctx) => ctx.db.insert("users", {
      clerkId: "outsider-clerk",
      email: "outsider@example.test",
      name: "Outsider",
      role: "partner",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    }));
    expect(outsiderId).not.toBe(primaryId);
    expect(coupleId).toBeDefined();
    await expect(t.withIdentity({ subject: "outsider-clerk" }).mutation(api.mutations.messages.markReadThrough, { messageId }))
      .rejects.toThrow("You are not linked to a couple");
  });

  test("fails closed for message reads and writes when duplicate partners exist", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId } = await seedActiveCouple(t);
    const duplicatePartnerId = await seedUser(t, {
      clerkId: "duplicate-chat-partner",
      name: "Duplicate Partner",
      role: "partner",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: duplicatePartnerId,
        role: "partner",
        sharingPain: false,
        sharingPhase: false,
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
    });

    await expect(
      asPrimary.query(api.queries.messages.listForCouple, {}),
    ).rejects.toThrow("You are not linked to a couple");
    await expect(
      asPartner.mutation(api.mutations.messages.send, { body: "Private" }),
    ).rejects.toThrow("You are not linked to a couple");
  });

  test("replacement partners cannot read the previous relationship chat", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId } = await seedActiveCouple(t);
    const oldMessageId = await asPartner.mutation(api.mutations.messages.send, {
      body: "Previous relationship message",
    });
    await asPrimary.mutation(api.mutations.messages.react, {
      messageId: oldMessageId,
      emoji: "💗",
    });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    await seedUser(t, {
      clerkId: "replacement-chat-partner",
      name: "Replacement Partner",
      role: "partner",
    });
    const asReplacementPartner = t.withIdentity({ subject: "replacement-chat-partner" });
    await asReplacementPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
      code: pairing.code,
    });
    const linkedAt = await t.run(async (ctx) => {
      const couple = await ctx.db.get(coupleId);
      await ctx.db.patch(oldMessageId, { createdAt: couple!.linkedAt! });
      return couple!.linkedAt!;
    });
    expect(await t.run(async (ctx) => (await ctx.db.get(oldMessageId))?.createdAt)).toBe(linkedAt);

    await expect(
      asReplacementPartner.query(api.queries.messages.listForCouple, {}),
    ).resolves.toEqual([]);
    await expect(
      asPrimary.query(api.queries.messages.listForCouple, {}),
    ).resolves.toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.get(oldMessageId))).not.toBeNull();
    await expect(
      asPrimary.mutation(api.mutations.messages.markRead, { messageId: oldMessageId }),
    ).rejects.toThrow("Message not found");
    await expect(
      asPrimary.mutation(api.mutations.messages.markDelivered, { messageId: oldMessageId }),
    ).rejects.toThrow("Message not found");
    await expect(
      asPrimary.mutation(api.mutations.messages.react, {
        messageId: oldMessageId,
        emoji: "✨",
      }),
    ).rejects.toThrow("Message not found");

    const currentMessageId = await asReplacementPartner.mutation(api.mutations.messages.send, {
      body: "Current relationship message",
    });
    await asPrimary.mutation(api.mutations.messages.react, {
      messageId: currentMessageId,
      emoji: "✨",
    });
    const messages = await asPrimary.query(api.queries.messages.listForCouple, {});
    expect(messages.map((message) => message.body)).toEqual([
      "Current relationship message",
    ]);

    const clearResult = await asPrimary.mutation(api.mutations.messages.clear, {});
    expect(clearResult.clearedAt).toBeGreaterThan(0);
    expect(await t.run(async (ctx) => ctx.db.get(oldMessageId))).not.toBeNull();
    expect(
      await t.run(async (ctx) => Boolean((await ctx.db.get(currentMessageId))?.clearedAt)),
    ).toBe(false);
    await expect(asPrimary.query(api.queries.messages.listForCouple, {})).resolves.toEqual([]);
    const currentReactions = await t.run(async (ctx) =>
      ctx.db
        .query("coupleMessageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", currentMessageId))
        .collect(),
    );
    expect(currentReactions).toHaveLength(1);
    const oldReactions = await t.run(async (ctx) =>
      ctx.db
        .query("coupleMessageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", oldMessageId))
        .collect(),
    );
    expect(oldReactions).toHaveLength(1);

    const nextMessageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: "After clear",
    });
    expect((await asPrimary.query(api.queries.messages.listForCouple, {})).map((message) => message._id))
      .toEqual([nextMessageId]);
    await expect(
      asPrimary.mutation(api.mutations.messages.react, {
        messageId: currentMessageId,
        emoji: "✨",
      }),
    ).rejects.toThrow("Message not found");
  });

  test("a stale boundary acknowledgement preserves later unread messages", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const first = await asPrimary.mutation(api.mutations.messages.send, { body: "First" });
    const second = await asPrimary.mutation(api.mutations.messages.send, { body: "Second" });

    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: second });
    await asPrimary.mutation(api.mutations.messages.send, { body: "Third" });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: first });

    const summary = await asPartner.query(api.queries.messages.unreadSummary, {});
    expect(summary.unreadCount).toBe(1);
  });

  test("a stale legacy acknowledgement cannot decrement post-migration unread state", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const legacyMessage = await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { linkedAt: 0 });
      const messageId = await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "Legacy unread",
        createdAt: 1,
      });
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 1,
      });
      return messageId;
    });

    const migrationBoundary = await asPrimary.mutation(api.mutations.messages.send, { body: "New" });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: migrationBoundary });
    await asPrimary.mutation(api.mutations.messages.send, { body: "After boundary" });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: legacyMessage });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 1,
    });
  });

  test("the latest visible legacy message acknowledges a backlog larger than the page", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { linkedAt: 0 });
      for (let i = 1; i <= 125; i++) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          senderId: primaryId,
          body: `Legacy ${i}`,
          createdAt: i,
        });
      }
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 125,
      });
    });

    const page = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    expect(page).toHaveLength(80);
    await asPartner.mutation(api.mutations.messages.markReadThrough, {
      messageId: page.at(-1)!._id,
    });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 0,
    });
    const readPage = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    expect(readPage.every((message) => message.readAt !== null)).toBe(true);
  });

  test("a legacy decrement survives a later sequenced send", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const [firstLegacy, secondLegacy] = await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { linkedAt: 0 });
      const first = await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "Legacy first",
        createdAt: 1,
      });
      const second = await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "Legacy second",
        createdAt: 2,
      });
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 2,
      });
      return [first, second] as const;
    });

    await asPrimary.mutation(api.mutations.messages.send, { body: "First sequenced" });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: firstLegacy });
    await asPrimary.mutation(api.mutations.messages.send, { body: "Second sequenced" });

    const [summary, state, second] = await Promise.all([
      asPartner.query(api.queries.messages.unreadSummary, {}),
      t.run(async (ctx) =>
        ctx.db
          .query("coupleChatStates")
          .withIndex("by_couple_and_user", (q) =>
            q.eq("coupleId", coupleId).eq("userId", partnerId)
          )
          .first(),
      ),
      t.run(async (ctx) => ctx.db.get(secondLegacy)),
    ]);
    expect(second?.readAt).toBeUndefined();
    expect(state).toMatchObject({ legacyUnreadCount: 1, unreadCount: 3 });
    expect(summary.unreadCount).toBe(3);
  });

  test("a new read boundary projects onto legacy messages in the visible page", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { linkedAt: 0 });
      for (const [body, createdAt] of [["Legacy one", 1], ["Legacy two", 2]] as const) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          senderId: primaryId,
          body,
          createdAt,
        });
      }
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 2,
      });
    });

    const boundary = await asPrimary.mutation(api.mutations.messages.send, { body: "Sequenced" });
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: boundary });

    const messages = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    expect(messages).toHaveLength(3);
    expect(messages.every((message) => message.readAt !== null)).toBe(true);
  });

  test("clear advances an existing cursor before the next message", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.messages.send, { body: "Unread before clear" });
    await asPartner.mutation(api.mutations.messages.clear, {});
    await asPrimary.mutation(api.mutations.messages.send, { body: "Unread after clear" });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 1,
    });
  });

  test("concurrent send and older acknowledgement retain the newer unread", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const first = await asPrimary.mutation(api.mutations.messages.send, { body: "First" });

    await Promise.all([
      asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: first }),
      asPrimary.mutation(api.mutations.messages.send, { body: "Concurrent" }),
    ]);

    const summary = await asPartner.query(api.queries.messages.unreadSummary, {});
    expect(summary.unreadCount).toBe(1);
  });

  test("one latest-page boundary acknowledges the older pages too", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    let latest: Id<"coupleMessages"> | undefined;
    for (let i = 0; i < 125; i++) {
      latest = await asPrimary.mutation(api.mutations.messages.send, { body: `Message ${i}` });
    }

    const page = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    expect(page).toHaveLength(80);
    expect(latest).toBeDefined();
    expect(page.at(-1)?._id).toBe(latest);
    await asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: latest! });

    expect(await asPartner.query(api.queries.messages.unreadSummary, {})).toMatchObject({
      unreadCount: 0,
    });
    const readPage = await asPartner.query(api.queries.messages.listForCouple, { limit: 80 });
    expect(readPage.every((message) => message.isMine || message.readAt !== null)).toBe(true);
  });

  test("read cursors advance monotonically across two sessions", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, partnerId } = await seedActiveCouple(t);
    const first = await asPrimary.mutation(api.mutations.messages.send, { body: "First" });
    const second = await asPrimary.mutation(api.mutations.messages.send, { body: "Second" });
    const secondSession = t.withIdentity({ subject: "partner-clerk" });

    await Promise.all([
      asPartner.mutation(api.mutations.messages.markReadThrough, { messageId: second }),
      secondSession.mutation(api.mutations.messages.markReadThrough, { messageId: first }),
    ]);

    const state = await t.run(async (ctx) =>
      ctx.db.query("coupleChatStates")
        .withIndex("by_couple_and_user", (q) =>
          q.eq("coupleId", coupleId).eq("userId", partnerId)
        )
        .first(),
    );
    expect(state).toMatchObject({ lastReadSequence: 2, unreadCount: 0 });
  });

  test("toggles reactions and returns grouped counts", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "React" });

    await asPrimary.mutation(api.mutations.messages.react, { messageId, emoji: "💗" });
    await asPartner.mutation(api.mutations.messages.react, { messageId, emoji: "💗" });
    let listed = await asPrimary.query(api.queries.messages.listForCouple, { limit: 10 });
    expect(listed[0].reactions).toEqual([{ emoji: "💗", count: 2, isMine: true }]);

    await asPartner.mutation(api.mutations.messages.react, { messageId, emoji: "✨" });
    listed = await asPrimary.query(api.queries.messages.listForCouple, { limit: 10 });
    expect(listed[0].reactions).toEqual([
      { emoji: "💗", count: 1, isMine: true },
      { emoji: "✨", count: 1, isMine: false },
    ]);

    await asPrimary.mutation(api.mutations.messages.react, { messageId, emoji: "💗" });
    listed = await asPrimary.query(api.queries.messages.listForCouple, { limit: 10 });
    expect(listed[0].reactions).toEqual([{ emoji: "✨", count: 1, isMine: false }]);
  });

  test("creates one content-free recipient event for each accepted send", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const privateBody = "private-chat-preview-must-not-enter-notification-storage";

    const firstMessageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: privateBody,
    });
    const secondMessageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: privateBody,
    });
    const messages = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(firstMessageId), ctx.db.get(secondMessageId)]),
    );
    const events = await t.run(async (ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_recipient_and_created_at", (q) =>
          q.eq("recipientUserId", partnerId),
        )
        .collect(),
    );

    expect(new Set([firstMessageId, secondMessageId]).size).toBe(2);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.eventType)).toEqual([
      "partner_message.v1",
      "partner_message.v1",
    ]);
    expect(events.map((event) => event.sourceReference)).toEqual([
      `message:${firstMessageId}`,
      `message:${secondMessageId}`,
    ]);
    expect(events.map((event) => event.sourceAuthorityVersion)).toEqual(
      messages.map(
        (message) => `relationship-membership:${message!.relationshipMembershipId}`,
      ),
    );
    expect(events.map((event) => event.recipientUserId)).toEqual([
      partnerId,
      partnerId,
    ]);
    expect(events.map((event) => event.recipientScope)).toEqual([
      "other_active_member",
      "other_active_member",
    ]);
    expect(events.map((event) => event.purpose)).toEqual([
      "partner_message",
      "partner_message",
    ]);
    expect(events.map((event) => event.producerKind)).toEqual([
      "new_couple_message",
      "new_couple_message",
    ]);
    expect(events.map((event) => event.privacyClass)).toEqual([
      "relationship_private_free_text_source",
      "relationship_private_free_text_source",
    ]);
    expect(events.map((event) => event.validityRule)).toEqual([
      "while_message_and_active_link_exist",
      "while_message_and_active_link_exist",
    ]);
    expect(events.map((event) => event.ownerUserId)).toEqual([
      primaryId,
      primaryId,
    ]);
    expect(events.map((event) => event.idempotencyKey)).toEqual([
      makeEventIdempotencyKey("partner_message.v1", {
        messageId: String(firstMessageId),
        recipientId: String(partnerId),
      }),
      makeEventIdempotencyKey("partner_message.v1", {
        messageId: String(secondMessageId),
        recipientId: String(partnerId),
      }),
    ]);
    expect(new Set(events.map((event) => event.idempotencyKey)).size).toBe(2);
    expect(events.every((event) => event.allowedChannel === "in_app")).toBe(true);
    expect(JSON.stringify(events)).not.toContain(privateBody);
    const notificationLog = await t.run(async (ctx) =>
      ctx.db.query("notificationLog").collect(),
    );
    const deliveries = await t.run(async (ctx) =>
      ctx.db.query("notificationDeliveries").collect(),
    );
    const inboxItems = await t.run(async (ctx) =>
      ctx.db.query("notificationInboxItems").collect(),
    );
    const senderEvents = await t.run(async (ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_recipient_and_created_at", (q) =>
          q.eq("recipientUserId", primaryId),
        )
        .collect(),
    );
    expect(notificationLog).toHaveLength(0);
    expect(deliveries).toHaveLength(0);
    expect(inboxItems).toHaveLength(0);
    expect(senderEvents).toHaveLength(0);
  });

  test("binds message identities to the source row and partner generation in both directions", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.messages.send, { body: "Primary message" });
    await asPartner.mutation(api.mutations.messages.send, { body: "Partner message" });

    const messages = await t.run((ctx) => ctx.db.query("coupleMessages").collect());
    const events = await t.run((ctx) => ctx.db.query("notificationEvents").collect());
    expect(events).toHaveLength(2);
    for (const message of messages) {
      const recipientUserId = message.senderId === primaryId ? partnerId : primaryId;
      const event = events.find((candidate) => candidate.sourceReference === `message:${message._id}`);
      expect(event?.sourceIdentity).toEqual({
        eventType: "partner_message.v1",
        sourceId: message._id,
        coupleId,
        relationshipMembershipId: message.relationshipMembershipId,
        ownerUserId: message.senderId,
        recipientUserId,
      });
      expect(event).toMatchObject({ ownerUserId: message.senderId, recipientUserId });
    }
  });

  test("replaying a message event returns the existing event without duplicating it", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: "Replay the accepted message event",
    });
    const message = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(message?.relationshipMembershipId).toBeDefined();

    const idempotencyKey = makeEventIdempotencyKey("partner_message.v1", {
      messageId: String(messageId),
      recipientId: String(partnerId),
    });
    const originalEvent = await t.run(async (ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
        .unique(),
    );
    expect(originalEvent).not.toBeNull();

    const replay = await t.run(async (ctx) => {
      const eventId = await ensurePartnerMessageEvent(ctx, {
        messageId,
        recipientId: partnerId,
      });
      const events = await ctx.db
        .query("notificationEvents")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
        .collect();
      return { eventId, events };
    });

    expect(replay.eventId).toBe(originalEvent!._id);
    expect(replay.events).toEqual([originalEvent]);
  });

  test("rejects a same-key replay whose source identity changed", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: "Identity replay source",
    });
    const anotherMessageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: "Different identity source",
    });
    const message = await t.run((ctx) => ctx.db.get(messageId));
    const idempotencyKey = makeEventIdempotencyKey("partner_message.v1", {
      messageId: String(messageId),
      recipientId: String(partnerId),
    });
    const event = await t.run((ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
        .unique(),
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(event!._id, {
        sourceIdentity: {
          eventType: "partner_message.v1",
          sourceId: anotherMessageId,
          coupleId: message!.coupleId,
          relationshipMembershipId: message!.relationshipMembershipId!,
          ownerUserId: primaryId,
          recipientUserId: partnerId,
        },
      });
    });

    await expect(
      t.run((ctx) =>
        ensurePartnerMessageEvent(ctx, {
          messageId,
          recipientId: partnerId,
        }),
      ),
    ).rejects.toThrow("Notification event key conflicts with its message source");
  });

  test("stores no message event when the outbox flag is off", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "");
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.messages.send, { body: "Dark outbox" });

    const events = await t.run(async (ctx) =>
      ctx.db.query("notificationEvents").collect(),
    );
    expect(events).toHaveLength(0);
  });

  test("a revoked partner cannot create another recipient event", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, partnerId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.messages.send, { body: "Before revoke" });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await expect(
      asPartner.mutation(api.mutations.messages.send, { body: "After revoke" }),
    ).rejects.toThrow("You are not linked to a couple");
    const events = await t.run(async (ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_recipient_and_created_at", (q) =>
          q.eq("recipientUserId", partnerId),
        )
        .collect(),
    );
    expect(events).toHaveLength(1);
  });

  test("chat clear hides messages without deleting their source events", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } =
      await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, {
      body: "Clear preserves history",
    });

    const clearResult = await asPrimary.mutation(api.mutations.messages.clear, {});

    const message = await t.run(async (ctx) => ctx.db.get(messageId));
    const events = await t.run(async (ctx) =>
      ctx.db
        .query("notificationEvents")
        .withIndex("by_recipient_and_created_at", (q) =>
          q.eq("recipientUserId", partnerId),
        )
        .collect(),
    );
    const couple = await t.run(async (ctx) => ctx.db.get(coupleId));
    expect(message).not.toBeNull();
    expect(couple?.chatClearedAt).toBeGreaterThanOrEqual(message!.createdAt);
    await expect(
      asPrimary.query(api.queries.messages.listForCouple, {}),
    ).resolves.toEqual([]);
    await expect(
      asPartner.query(api.queries.messages.listForCouple, {}),
    ).resolves.toEqual([]);
    const messageEvents = events.filter(
      (event) => event.eventType === "partner_message.v1",
    );
    const clearEvent = events.find(
      (event) => event.eventType === "partner_chat_cleared.v1",
    );
    const partnerMembershipId = await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      return membership!._id;
    });
    expect(messageEvents).toHaveLength(1);
    expect(messageEvents[0].sourceReference).toBe(`message:${messageId}`);
    expect(couple?.chatClearedBy).toBe(primaryId);
    expect(clearEvent).toMatchObject({
      purpose: "partner_chat_cleared",
      producerKind: "explicit_chat_clear_transition",
      sourceReference: `couple-chat:${coupleId}`,
      sourceAuthorityVersion: `chat-clear:${clearResult.clearedAt}`,
      ownerUserId: primaryId,
      recipientUserId: partnerId,
      recipientScope: "other_active_member",
      sourceIdentity: {
        eventType: "partner_chat_cleared.v1",
        sourceId: coupleId,
        coupleId,
        relationshipMembershipId: partnerMembershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        clearOperationVersion: clearResult.clearedAt,
      },
      privacyClass: "account_relationship_sensitive",
      validityRule: "until_newer_chat_state_or_link_revocation",
      idempotencyKey: makeEventIdempotencyKey("partner_chat_cleared.v1", {
        coupleId: String(coupleId),
        clearOperationId: `chat-clear:${clearResult.clearedAt}`,
        relationshipMembershipId: String(partnerMembershipId),
        recipientId: String(partnerId),
      }),
      allowedChannel: "in_app",
    });
    expect(JSON.stringify(events)).not.toContain("Clear preserves history");
    expect(JSON.stringify(events)).not.toContain("Primary Person");
    expect(JSON.stringify(events)).not.toContain("Partner Person");
    const notificationLog = await t.run(async (ctx) =>
      ctx.db.query("notificationLog").collect(),
    );
    expect(notificationLog).toHaveLength(0);
  });
});
