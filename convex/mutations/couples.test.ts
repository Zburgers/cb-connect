import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

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

  test("re-pairing resets pain and assisted-write sharing before the new partner joins", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, coupleId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
      sharingPain: true,
      sharingPeriodWrite: true,
    });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    const newPartnerId = await seedUser(t, {
      clerkId: "replacement-partner",
      name: "Replacement Partner",
      role: "partner",
    });

    await t.withIdentity({ subject: "replacement-partner" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: pairing.code },
    );

    const primaryMembership = await t.run(async (ctx) =>
      ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary"),
        )
        .unique(),
    );
    expect(primaryMembership).toMatchObject({
      userId: primaryId,
      sharingPain: false,
      sharingPeriodWrite: false,
      sharingPhase: true,
    });
    expect(
      await t.withIdentity({ subject: "replacement-partner" }).query(
        api.queries.couples.getCoupleStatus,
        {},
      ),
    ).toMatchObject({
      isLinked: true,
      sharingSettings: { pain: false, phase: true, periodWrite: false },
    });
    expect(newPartnerId).toBeDefined();
  });
});

describe("revoke and relink lifecycle", () => {
  test("does not mint another code for an active couple", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    await expect(
      asPrimary.action(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("You are already linked to a partner");
  });

  test("generates a 12-character Crockford base32 invite with the existing 24-hour lifetime", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    const before = Date.now();
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    const after = Date.now();

    expect(pairing.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(pairing.expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(pairing.expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
  });

  test("per-user and per-code throttles do not extend their own windows", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "per-user-throttle",
      name: "First Partner",
      role: "partner",
    });
    await seedUser(t, {
      clerkId: "per-code-throttle",
      name: "Second Partner",
      role: "partner",
    });
    const firstPartner = t.withIdentity({ subject: "per-user-throttle" });
    const secondPartner = t.withIdentity({ subject: "per-code-throttle" });
    const invalidCode = "000000000000";

    for (let i = 0; i < 10; i += 1) {
      await firstPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: invalidCode,
      });
    }
    await expect(
      firstPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: invalidCode,
      }),
    ).resolves.toMatchObject({ success: false, error: expect.stringContaining("Too many") });
    await expect(
      secondPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: invalidCode,
      }),
    ).resolves.toMatchObject({ success: false, error: expect.stringContaining("Too many") });

    const attempts = await t.run(async (ctx) =>
      ctx.db
        .query("pairingCodeAttempts")
        .withIndex("by_entered_code_and_attempted_at", (q) =>
          q.eq("enteredCode", invalidCode),
        )
        .collect(),
    );
    expect(attempts).toHaveLength(10);
  });

  test("does not retain oversized malformed pairing input in attempt records", async () => {
    const t = convexTest(schema, modules);
    const partnerId = await seedUser(t, {
      clerkId: "oversized-pairing-input",
      name: "Partner",
      role: "partner",
    });

    const result = await t.withIdentity({ subject: "oversized-pairing-input" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: "A".repeat(100_000) },
    );
    const attempts = await t.run(async (ctx) =>
      ctx.db
        .query("pairingCodeAttempts")
        .withIndex("by_user", (q) => q.eq("userId", partnerId))
        .collect(),
    );

    expect(result).toMatchObject({ success: false, error: "Invalid or expired pairing code" });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].enteredCode).toBe("");
  });

  test("two partners racing to redeem one code produce one membership", async () => {
    const t = convexTest(schema, modules);
    const primaryId = await seedUser(t, {
      clerkId: "race-primary",
      name: "Primary",
      role: "primary",
    });
    const asPrimary = t.withIdentity({ subject: "race-primary" });
    const firstPartnerId = await seedUser(t, {
      clerkId: "race-partner-a",
      name: "Partner A",
      role: "partner",
    });
    const secondPartnerId = await seedUser(t, {
      clerkId: "race-partner-b",
      name: "Partner B",
      role: "partner",
    });
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );

    const results = await Promise.allSettled([
      t.withIdentity({ subject: "race-partner-a" }).mutation(
        api.mutations.couples.linkPartnerWithCode,
        { code: pairing.code },
      ),
      t.withIdentity({ subject: "race-partner-b" }).mutation(
        api.mutations.couples.linkPartnerWithCode,
        { code: pairing.code },
      ),
    ]);

    const memberships = await t.run(async (ctx) =>
      ctx.db.query("coupleMembers").collect(),
    );
    expect(
      results.filter((result) => result.status === "fulfilled" && result.value.success),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "fulfilled" && !result.value.success),
    ).toHaveLength(1);
    expect(memberships.filter((membership) => membership.role === "partner")).toHaveLength(1);
    expect(memberships.some((membership) => membership.userId === primaryId)).toBe(true);
    expect(
      [firstPartnerId, secondPartnerId].filter((id) =>
        memberships.some((membership) => membership.userId === id),
      ),
    ).toHaveLength(1);
  });

  test("revocation expires old codes and removes corrupt duplicate partner rows", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId, coupleId } = await seedActiveCouple(t);
    const oldCode = await t.run(async (ctx) => {
      return await ctx.db.insert("pairingCodes", {
        code: "OLD-CODE",
        coupleId,
        createdBy: primaryId,
        expiresAt: Date.now() + 60_000,
        status: "active",
      });
    });
    const duplicatePartnerId = await seedUser(t, {
      clerkId: "duplicate-partner",
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
      asPartner.query(api.queries.couples.getCoupleStatus, {}),
    ).resolves.toMatchObject({ isLinked: false });
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    const [remainingPartners, code] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner"),
          )
          .collect(),
        ctx.db.get(oldCode),
      ]),
    );
    expect(remainingPartners).toHaveLength(0);
    expect(code?.status).toBe("expired");
  });

  test("a stale code cannot be reused after revocation and reopening", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const oldPairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const newPairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );

    await expect(
      asPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: oldPairing.code,
      }),
    ).resolves.toMatchObject({ success: false, error: "Invalid or expired pairing code" });
    await expect(
      asPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: newPairing.code,
      }),
    ).resolves.toMatchObject({ success: true });
  });

  test("a pairing code duplicated by corrupt legacy rows fails closed", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId, primaryId } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(
      api.mutations.couples.generatePairingCode,
      {},
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("pairingCodes", {
        code: pairing.code,
        coupleId,
        createdBy: primaryId,
        expiresAt: pairing.expiresAt,
        status: "expired",
      });
    });

    await expect(
      asPartner.mutation(api.mutations.couples.linkPartnerWithCode, {
        code: pairing.code,
      }),
    ).resolves.toMatchObject({ success: false, error: "Invalid or expired pairing code" });
    const partners = await t.run(async (ctx) =>
      ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner"),
        )
        .collect(),
    );
    expect(partners).toHaveLength(0);
  });

  test("reopens the revoked primary couple instead of creating a hidden duplicate", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, coupleId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pairing = await asPrimary.action(
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
      asPrimary.action(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("Pairing state is ambiguous. Please contact support.");
  });

  test("rejects invite creation when any active membership exists alongside revoked history", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
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
      asPrimary.action(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("Pairing state is ambiguous. Please contact support.");
  });

  test("fails closed for mixed pending and revoked primary memberships", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, coupleId: revokedCoupleId } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
    const pendingCoupleId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("couples", {
        createdAt: Date.now(),
        status: "pending",
      });
      await ctx.db.insert("coupleMembers", {
        coupleId: id,
        userId: primaryId,
        role: "primary",
        sharingPain: false,
        sharingPhase: true,
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
      return id;
    });

    await expect(
      asPrimary.action(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("Pairing state is ambiguous. Please contact support.");
    const [pendingCouple, revokedCouple, codes] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(pendingCoupleId),
        ctx.db.get(revokedCoupleId),
        ctx.db.query("pairingCodes").collect(),
      ]),
    );
    expect(pendingCouple?.status).toBe("pending");
    expect(revokedCouple?.status).toBe("revoked");
    expect(codes).toEqual([]);
  });

  test("reopens the sole revoked membership when historical data is otherwise unambiguous", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await asPrimary.action(api.mutations.couples.generatePairingCode, {});

    const couple = await t.run(async (ctx) => ctx.db.get("couples", coupleId));
    expect(couple?.status).toBe("pending");
  });
});
