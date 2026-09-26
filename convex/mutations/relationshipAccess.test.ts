import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

describe("relationship access integrity", () => {
  test("duplicate partners cannot expose presence, write heartbeats, or receive nudges", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t);
    const duplicatePartnerId = await seedUser(t, {
      clerkId: "duplicate-presence-partner",
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
      await ctx.db.insert("presence", {
        coupleId,
        userId: duplicatePartnerId,
        lastSeen: Date.now(),
      });
    });

    await expect(
      asPrimary.query(api.queries.presence.getPartnerPresence, {}),
    ).resolves.toBeNull();
    await expect(
      asPrimary.mutation(api.mutations.presence.heartbeat, {}),
    ).resolves.toBeNull();
    await expect(
      asPrimary.mutation(api.mutations.nudges.send, { emoji: "💗" }),
    ).rejects.toThrow("You are not linked to a couple");

    const nudges = await t.run(async (ctx) => ctx.db.query("nudges").collect());
    expect(nudges).toEqual([]);
  });

  test("duplicate caller memberships cannot write presence to an arbitrary couple", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      const otherCoupleId = await ctx.db.insert("couples", {
        createdAt: Date.now(),
        status: "pending",
      });
      await ctx.db.insert("coupleMembers", {
        coupleId: otherCoupleId,
        userId: primaryId,
        role: "primary",
        sharingPain: false,
        sharingPhase: false,
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
    });

    await expect(
      asPrimary.mutation(api.mutations.presence.heartbeat, {}),
    ).resolves.toBeNull();
    const presence = await t.run(async (ctx) => ctx.db.query("presence").collect());
    expect(presence).toEqual([]);
  });

  test("a replacement relationship cannot read the previous partner's nudge", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.nudges.send, { emoji: "💗" });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    await seedUser(t, {
      clerkId: "replacement-nudge-partner",
      name: "Replacement Partner",
      role: "partner",
    });
    await t.withIdentity({ subject: "replacement-nudge-partner" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: pairing.code },
    );

    await expect(
      asPrimary.query(api.queries.nudges.latestReceived, {}),
    ).resolves.toBeNull();
  });
});
