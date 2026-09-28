import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

describe("couple message state", () => {
  test("increments only the recipient unread counter", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Hello" });

    const states = await t.run(async (ctx) =>
      await ctx.db.query("coupleChatStates").withIndex("by_couple_and_user", (q) => q.eq("coupleId", coupleId)).collect()
    );
    expect(states).toEqual([expect.objectContaining({ userId: partnerId, unreadCount: 1 })]);
    expect(states.some((state) => state.userId === primaryId)).toBe(false);

    await asPartner.mutation(api.mutations.messages.markRead, { messageId });
    const summary = await asPartner.query(api.queries.messages.unreadSummary, {});
    expect(summary.unreadCount).toBe(0);
  });

  test("delivery and read acknowledgements remain monotonic", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    const messageId = await asPrimary.mutation(api.mutations.messages.send, { body: "Status" });

    await asPartner.mutation(api.mutations.messages.markDelivered, { messageId });
    await asPartner.mutation(api.mutations.messages.markRead, { messageId });
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
    await expect(t.withIdentity({ subject: "outsider-clerk" }).mutation(api.mutations.messages.markRead, { messageId }))
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
});
