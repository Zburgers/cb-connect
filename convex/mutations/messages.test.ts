import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

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
