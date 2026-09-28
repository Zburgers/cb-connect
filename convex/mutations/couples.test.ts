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

  test("re-pairing clears prior partner metadata and resets approved sharing defaults", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId, coupleId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: primaryId,
        unreadCount: 4,
        lastMessageSequence: 7,
        lastReadSequence: 3,
        legacySequenceBase: 4,
        legacyUnreadCount: 2,
        legacyReadThroughAt: 10,
      });
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: partnerId,
        unreadCount: 3,
      });
    });
    await asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
      sharingPain: true,
      sharingPeriodWrite: true,
    });
    await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
      connectedSinceDate: "2000-01-01",
    });
    await asPrimary.mutation(api.mutations.couples.updatePartnerNickname, {
      nickname: "Previous Partner",
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
    await t.run(async (ctx) => {
      await ctx.db.insert("coupleChatStates", {
        coupleId,
        userId: newPartnerId,
        unreadCount: 9,
        lastMessageSequence: 12,
        lastReadSequence: 5,
        legacySequenceBase: 6,
        legacyUnreadCount: 3,
        legacyReadThroughAt: 20,
      });
    });

    const replacement = t.withIdentity({ subject: "replacement-partner" });
    await replacement.mutation(
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
    expect(primaryMembership?.partnerNickname).toBeUndefined();
    const couple = await t.run(async (ctx) => ctx.db.get(coupleId));
    expect(couple?.status).toBe("active");
    expect(couple?.connectedSinceDate).toBeUndefined();
    expect(couple?.connectedSinceUpdatedAt).toBeUndefined();
    expect(couple?.connectedSinceUpdatedBy).toBeUndefined();
    const primaryStatus = await asPrimary.query(api.queries.couples.getCoupleStatus, {});
    expect(primaryStatus).toMatchObject({
      connectedSinceDate: null,
      anniversary: null,
      partner: {
        name: "Replacement Partner",
        displayName: "Replacement Partner",
        nickname: null,
      },
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
    const existingChatStates = await t.run(async (ctx) =>
      ctx.db
        .query("coupleChatStates")
        .withIndex("by_couple_and_user", (q) => q.eq("coupleId", coupleId))
        .collect(),
    );
    expect(existingChatStates.map((state) => state.unreadCount)).toEqual([0, 0, 0]);
    const currentRelationshipStates = await t.run(async (ctx) =>
      Promise.all([primaryId, newPartnerId].map(async (userId) =>
        ctx.db
          .query("coupleChatStates")
          .withIndex("by_couple_and_user", (q) =>
            q.eq("coupleId", coupleId).eq("userId", userId)
          )
          .unique(),
      )),
    );
    expect(currentRelationshipStates).toEqual([
      expect.objectContaining({
        unreadCount: 0,
        lastMessageSequence: 0,
        lastReadSequence: 0,
        legacySequenceBase: 0,
        legacyUnreadCount: 0,
      }),
      expect.objectContaining({
        unreadCount: 0,
        lastMessageSequence: 0,
        lastReadSequence: 0,
        legacySequenceBase: 0,
        legacyUnreadCount: 0,
      }),
    ]);

    await asPrimary.mutation(api.mutations.messages.send, { body: "New relationship primary" });
    await replacement.mutation(api.mutations.messages.send, { body: "New relationship partner" });
    await expect(
      asPrimary.query(api.queries.messages.unreadSummary, {}),
    ).resolves.toMatchObject({ unreadCount: 1 });
    await expect(
      replacement.query(api.queries.messages.unreadSummary, {}),
    ).resolves.toMatchObject({ unreadCount: 1 });
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

  test("keeps the five-invites-per-hour generation limit", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);
    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    for (let i = 0; i < 5; i += 1) {
      await asPrimary.action(api.mutations.couples.generatePairingCode, {});
    }

    await expect(
      asPrimary.action(api.mutations.couples.generatePairingCode, {}),
    ).rejects.toThrow("Too many pairing codes generated");
  });

  test("redeems an already-issued active unexpired legacy six-digit invite", async () => {
    const t = convexTest(schema, modules);
    const primaryId = await seedUser(t, {
      clerkId: "legacy-code-primary",
      name: "Primary",
      role: "primary",
    });
    const coupleId = await t.run(async (ctx) => {
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
    const legacyExpiresAt = Date.now() + 30 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("pairingCodes", {
        code: "482731",
        coupleId,
        createdBy: primaryId,
        expiresAt: legacyExpiresAt,
        status: "active",
      });
    });
    await seedUser(t, {
      clerkId: "legacy-code-partner",
      name: "Legacy Code Partner",
      role: "partner",
    });

    const result = await t.withIdentity({ subject: "legacy-code-partner" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: "482731" },
    );

    expect(result).toMatchObject({ success: true, coupleId });
    const redeemedCode = await t.run(async (ctx) =>
      ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", "482731"))
        .unique(),
    );
    expect(redeemedCode).toMatchObject({ status: "used", usedBy: expect.any(String) });
    expect(redeemedCode?.expiresAt).toBe(legacyExpiresAt);
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

    const [remainingPartners, retainedPartner, code] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role_and_revoked_at", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
          )
          .collect(),
        ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner"),
          )
          .first(),
        ctx.db.get(oldCode),
      ]),
    );
    expect(remainingPartners).toHaveLength(0);
    expect(retainedPartner?.revokedAt).toBeDefined();
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
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
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
    expect(memberships).toHaveLength(3);
    expect(memberships.filter((membership) => membership.revokedAt === undefined)).toHaveLength(2);
    expect(memberships.find((membership) => membership.revokedAt !== undefined)).toBeDefined();
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
