import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

describe("mobile couple chat pagination", () => {
  test("returns bounded newest-first pages without gaps or duplicates", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const relationshipMembershipId = await t.run(async (ctx) => {
      const partner = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined)
        )
        .unique();
      return partner!._id;
    });
    const createdAt = Date.now() + 1;
    await t.run(async (ctx) => {
      for (let index = 1; index <= 5; index += 1) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          relationshipMembershipId,
          senderId: index % 2 ? primaryId : partnerId,
          body: `message-${index}`,
          createdAt: createdAt + index,
          recipientSequence: index,
        });
      }
    });

    const first = await asPrimary.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 2, cursor: null },
      relationshipGeneration: (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    const second = await asPrimary.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
      relationshipGeneration: (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });

    expect(first.page.map(({ body }) => body)).toEqual(["message-5", "message-4"]);
    expect(first.isDone).toBe(false);
    expect(second.page.map(({ body }) => body)).toEqual(["message-3", "message-2"]);
    expect(new Set([...first.page, ...second.page].map(({ _id }) => _id)).size).toBe(4);
  });

  test("caps client page requests at forty messages", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId, primaryId } = await seedActiveCouple(t);
    const relationshipMembershipId = await t.run(async (ctx) =>
      (await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined)
        )
        .unique())!._id,
    );
    const createdAt = Date.now() + 1;
    await t.run(async (ctx) => {
      for (let index = 0; index < 45; index += 1) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          relationshipMembershipId,
          senderId: primaryId,
          body: `bounded-${index}`,
          createdAt: createdAt + index,
          recipientSequence: index + 1,
        });
      }
    });

    const page = await asPrimary.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 100, cursor: null },
      relationshipGeneration: (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    expect(page.page).toHaveLength(40);
    expect(page.isDone).toBe(false);
  });

  test("keeps filtered, cleared, and legacy rows inside a bounded split page", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const memberships = await t.run(async (ctx) =>
      ctx.db.query("coupleMembers")
        .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
        .take(2),
    );
    const currentRelationshipId = memberships.find(({ role }) => role === "partner")!._id;
    const previousRelationshipId = memberships.find(({ role }) => role === "primary")!._id;
    const createdAt = Date.now() + 1;
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const time = createdAt + 100 + index;
        const rowKind = index % 3;
        await ctx.db.insert("coupleMessages", {
          coupleId,
          ...(rowKind === 0
            ? { relationshipMembershipId: previousRelationshipId }
            : rowKind === 1
              ? { relationshipMembershipId: currentRelationshipId, clearedAt: time }
              : { clearedAt: time }),
          senderId: primaryId,
          body: `filtered-${index}`,
          createdAt: time,
        });
      }
      await ctx.db.insert("coupleMessages", {
        coupleId,
        relationshipMembershipId: currentRelationshipId,
        senderId: primaryId,
        body: "current-relationship",
        createdAt: createdAt + 2,
      });
      await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: partnerId,
        body: "legacy-current-relationship",
        createdAt: createdAt + 1,
      });
    });

    const page = await asPrimary.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 40, cursor: null },
      relationshipGeneration: (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    expect(page.page.map(({ body }) => body)).not.toContain("filtered-0");
    expect(page.page.map(({ body }) => body)).not.toContain("filtered-99");
    expect(page.page.every(({ body }) => body === "current-relationship" || body === "legacy-current-relationship")).toBe(true);
    expect(page.pageStatus).toBe("SplitRequired");
    expect(page.splitCursor).toBeTruthy();

    const remainder = await asPrimary.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 40, cursor: page.continueCursor },
      relationshipGeneration: (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    expect(remainder.page.map(({ body }) => body)).toEqual([
      "current-relationship",
      "legacy-current-relationship",
    ]);
  });

  test("revocation fences the paginated chat query immediately", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const relationshipMembershipId = await t.run(async (ctx) =>
      (await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined)
        )
        .unique())!._id,
    );
    await t.run(async (ctx) => {
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("coupleMessages", {
          coupleId,
          relationshipMembershipId,
          senderId: primaryId,
          body: `private-${index}`,
          createdAt: Date.now() + index + 1,
          recipientSequence: index + 1,
        });
      }
    });
    const first = await asPartner.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 1, cursor: null },
      relationshipGeneration: (await asPartner.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    expect(first.page).toHaveLength(1);
    expect(first.isDone).toBe(false);

    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await expect(asPartner.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 10, cursor: first.continueCursor },
      relationshipGeneration: (await asPartner.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    })).rejects.toThrow();
  });

  test("replacement partners cannot page the previous relationship chat", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t);
    const previousGeneration = (await asPrimary.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!;
    await asPrimary.mutation(api.mutations.messages.send, { body: "previous relationship message" });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(api.mutations.couples.generatePairingCode, {});
    await seedUser(t, { clerkId: "next-partner", name: "Next Partner", role: "partner" });
    const nextPartner = t.withIdentity({ subject: "next-partner" });
    const linkResult = await nextPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
      code: pairing.code,
    });
    expect(linkResult.success).toBe(true);
    await nextPartner.mutation(api.mutations.messages.send, { body: "current relationship message" });

    const page = await nextPartner.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 40, cursor: null },
      relationshipGeneration: (await nextPartner.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!,
    });
    expect(page.page.map(({ body }) => body)).toEqual(["current relationship message"]);
    const nextGeneration = (await nextPartner.query(api.queries.couples.getCoupleStatus, {})).relationshipGeneration!;
    expect(nextGeneration).not.toBe(previousGeneration);
    await expect(nextPartner.query(api.queries.messages.listPageForMobile, {
      paginationOpts: { numItems: 40, cursor: null },
      relationshipGeneration: previousGeneration,
    })).rejects.toThrow("Relationship changed");
    const retainedMessages = await t.run((ctx) =>
      ctx.db.query("coupleMessages")
        .withIndex("by_couple_created", (q) => q.eq("coupleId", coupleId))
        .take(10),
    );
    expect(retainedMessages.some(({ body }) => body === "previous relationship message")).toBe(true);
  });
});
