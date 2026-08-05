import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

describe("assisted period sharing settings", () => {
  test("turning off phase visibility also disables assisted logging", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    await asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
      sharingPhase: false,
    });

    const primaryMembership = await t.run(async (ctx) => {
      return await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary")
        )
        .unique();
    });

    expect(primaryMembership).toMatchObject({
      sharingPhase: false,
      sharingPeriodWrite: false,
    });
  });

  test("assisted logging cannot be enabled while phase visibility is off", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t, {
      sharingPhase: false,
    });

    await expect(
      asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
        sharingPeriodWrite: true,
      })
    ).rejects.toThrow("Turn on period visibility first");
  });

  test("partner sees the primary member's assisted logging permission", async () => {
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    const status = await asPartner.query(api.queries.couples.getCoupleStatus, {});

    expect(status.sharingSettings).toEqual({
      pain: false,
      phase: true,
      periodWrite: true,
    });
  });
});

describe("revoke and relink lifecycle", () => {
  test("reopens the revoked primary couple instead of creating a hidden duplicate", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.mutation(
      api.mutations.couples.generatePairingCode,
      {},
    );

    const pendingStatus = await asPrimary.query(
      api.queries.couples.getCoupleStatus,
      {},
    );
    expect(pendingStatus).toMatchObject({
      isLinked: false,
      status: "pending",
    });

    await asPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
      code: pairing.code,
    });

    const [primaryStatus, partnerStatus, memberships] = await Promise.all([
      asPrimary.query(api.queries.couples.getCoupleStatus, {}),
      asPartner.query(api.queries.couples.getCoupleStatus, {}),
      t.run(async (ctx) =>
        ctx.db
          .query("coupleMembers")
          .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
          .collect(),
      ),
    ]);

    expect(primaryStatus.isLinked).toBe(true);
    expect(partnerStatus.isLinked).toBe(true);
    expect(memberships).toHaveLength(2);
  });

  test("rejects multiple historical revoked memberships instead of reopening an arbitrary couple", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    await t.run(async (ctx) => {
      const revokedCoupleId = await ctx.db.insert("couples", {
        createdAt: Date.now() - 1,
        status: "revoked",
      });
      await ctx.db.insert("coupleMembers", {
        coupleId: revokedCoupleId,
        userId: primaryId,
        role: "primary",
        sharingPain: false,
        sharingPhase: true,
        joinedAt: Date.now() - 1,
      });
    });

    await expect(
      asPrimary.mutation(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("Pairing state is ambiguous. Please contact support.");
  });

  test("prefers the sole active membership over a historical revoked membership", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      const revokedCoupleId = await ctx.db.insert("couples", {
        createdAt: Date.now() - 1,
        status: "revoked",
      });
      await ctx.db.insert("coupleMembers", {
        coupleId: revokedCoupleId,
        userId: primaryId,
        role: "primary",
        sharingPain: false,
        sharingPhase: true,
        joinedAt: Date.now() - 1,
      });
    });

    const pairing = await asPrimary.mutation(
      api.mutations.couples.generatePairingCode,
      {},
    );
    const pairingCode = await t.run(async (ctx) =>
      ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", pairing.code))
        .unique(),
    );
    expect(pairingCode?.coupleId).toBe(coupleId);
  });

  test("reopens the sole revoked membership when historical data is otherwise unambiguous", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await asPrimary.mutation(api.mutations.couples.generatePairingCode, {});

    const couple = await t.run(async (ctx) => ctx.db.get("couples", coupleId));
    expect(couple?.status).toBe("pending");
  });
});
