import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

test("updating connected-since date does not write sensitive legacy notification data", async () => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example.test/webhook");
  const t = convexTest(schema, modules);
  const { asPrimary } = await seedActiveCouple(t);

  await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
    connectedSinceDate: "2020-02-14",
  });

  await expect(
    t.run(async (ctx) => ctx.db.query("notificationLog").collect()),
  ).resolves.toEqual([]);
});

test("partner linking cannot POST with a stale webhook secret", async () => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example.test/webhook");
  const fetchStub = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchStub);

  const t = convexTest(schema, modules);
  const primaryId = await seedUser(t, {
    clerkId: "legacy-discord-link-primary",
    name: "Primary",
    role: "primary",
  });
  await seedUser(t, {
    clerkId: "legacy-discord-link-partner",
    name: "Partner",
    role: "partner",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(primaryId, { externalNotificationConsent: true });
    const coupleId = await ctx.db.insert("couples", {
      createdAt: Date.now(),
      status: "pending",
    });
    await ctx.db.insert("coupleMembers", {
      coupleId,
      userId: primaryId,
      role: "primary",
      sharingPain: false,
      sharingPhase: true,
      sharingPeriodWrite: false,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("pairingCodes", {
      code: "482731",
      coupleId,
      createdBy: primaryId,
      expiresAt: Date.now() + 60 * 60 * 1000,
      status: "active",
    });
  });

  vi.useFakeTimers();
  try {
    await t.withIdentity({ subject: "legacy-discord-link-partner" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: "482731" },
    );
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    vi.useRealTimers();
  }

  expect(fetchStub).not.toHaveBeenCalled();
  await expect(
    t.run(async (ctx) => ctx.db.query("notificationLog").collect()),
  ).resolves.toEqual([]);
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

describe("couple notification outbox", () => {
  async function seedConnectedSinceProjection(
    t: ReturnType<typeof convexTest>,
    args: {
      coupleId: Id<"couples">;
      primaryId: Id<"users">;
      partnerId: Id<"users">;
      sourceReference: string;
      sourceAuthorityVersion: string;
      idempotencySettingVersion: string;
    },
  ) {
    return await t.run(async (ctx) => {
      const now = Date.now();
      const eventId = await ctx.db.insert("notificationEvents", {
        eventType: "connected_since_updated.v1",
        eventVersion: 1,
        purpose: "connected_since_updated",
        producerKind: "explicit_connected_since_update",
        sourceReference: args.sourceReference,
        sourceAuthorityVersion: args.sourceAuthorityVersion,
        ownerUserId: args.primaryId,
        recipientUserId: args.partnerId,
        recipientScope: "other_active_member",
        privacyClass: "account_relationship_sensitive",
        validityRule: "until_setting_version_changes_or_link_revocation",
        idempotencyKey: makeEventIdempotencyKey("connected_since_updated.v1", {
          coupleId: String(args.coupleId),
          settingVersion: args.idempotencySettingVersion,
          recipientId: String(args.partnerId),
        }),
        allowedChannel: "in_app",
        createdAt: now,
      });
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        eventId,
        recipientUserId: args.partnerId,
        channel: "in_app",
        stableDestinationId: args.partnerId,
        logicalKey: `connected-since-test:${eventId}`,
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
          payloadHash: "static-connected-since-v1",
        },
        createdAt: now,
        updatedAt: now,
      });
      const inboxItemId = await ctx.db.insert("notificationInboxItems", {
        eventId,
        recipientUserId: args.partnerId,
        idempotencyKey: `connected-since-inbox:${eventId}`,
        templateVersion: "g4-static-v1",
        route: "settings",
        state: "current",
        createdAt: now,
      });
      return { eventId, deliveryId, inboxItemId };
    });
  }

  async function seedPendingPairing(t: ReturnType<typeof convexTest>) {
    const primaryId = await seedUser(t, {
      clerkId: "n3d-primary",
      name: "Primary Private Name",
      role: "primary",
    });
    const partnerId = await seedUser(t, {
      clerkId: "n3d-partner",
      name: "Partner Private Name",
      role: "partner",
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
      await ctx.db.insert("pairingCodes", {
        code: "482731",
        coupleId: id,
        createdBy: primaryId,
        expiresAt: Date.now() + 60 * 60 * 1000,
        status: "active",
      });
      return id;
    });
    return { primaryId, partnerId, coupleId };
  }

  test("emits one content-free link event per member and dedupes pairing-code replay", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId, coupleId } = await seedPendingPairing(t);
    const asPartner = t.withIdentity({ subject: "n3d-partner" });

    await expect(
      asPartner.mutation(api.mutations.couples.linkPartnerWithCode, { code: "482731" }),
    ).resolves.toMatchObject({ success: true, coupleId });
    await expect(
      asPartner.mutation(api.mutations.couples.linkPartnerWithCode, { code: "482731" }),
    ).resolves.toMatchObject({ success: false });

    const { partnerMembership, events } = await t.run(async (ctx) => ({
      partnerMembership: await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique(),
      events: await ctx.db.query("notificationEvents").collect(),
    }));
    expect(partnerMembership).not.toBeNull();
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.recipientUserId).sort()).toEqual(
      [primaryId, partnerId].sort(),
    );
    for (const event of events) {
      const linkGeneration = String(partnerMembership!._id);
      expect(event).toMatchObject({
        eventType: "partner_linked.v1",
        eventVersion: 1,
        purpose: "partner_linked",
        producerKind: "active_link_transition",
        sourceReference: `couple:${coupleId}:link:${linkGeneration}`,
        sourceAuthorityVersion: `relationship-membership:${linkGeneration}`,
        ownerUserId: partnerId,
        recipientScope: "each_link_member_separately",
        privacyClass: "account_relationship_sensitive",
        validityRule: "while_link_generation_is_active",
        idempotencyKey: makeEventIdempotencyKey("partner_linked.v1", {
          coupleId: String(coupleId),
          linkGeneration,
          recipientId: String(event.recipientUserId),
        }),
        allowedChannel: "in_app",
      });
      expect(event).not.toHaveProperty("connectedSinceDate");
      expect(event).not.toHaveProperty("primaryName");
      expect(event).not.toHaveProperty("partnerName");
      expect(event).not.toHaveProperty("payload");
    }
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationLog").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("revocation cancels current relationship projections without deleting event history", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId, coupleId } = await seedPendingPairing(t);
    const asPrimary = t.withIdentity({ subject: "n3d-primary" });
    const asPartner = t.withIdentity({ subject: "n3d-partner" });
    await asPartner.mutation(api.mutations.couples.linkPartnerWithCode, { code: "482731" });
    await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
      connectedSinceDate: "2000-02-14",
    });
    const projectionIds = await t.run(async (ctx) => {
      const events = await ctx.db.query("notificationEvents").collect();
      const now = 1_800_000_000_000;
      return await Promise.all(events.map(async (event) => {
        const deliveryId = await ctx.db.insert("notificationDeliveries", {
          eventId: event._id,
          recipientUserId: event.recipientUserId,
          channel: "in_app",
          stableDestinationId: String(event.recipientUserId),
          logicalKey: `link-test:${event._id}`,
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
            payloadHash: "static-link-v1",
          },
          createdAt: now,
          updatedAt: now,
        });
        const inboxItemId = await ctx.db.insert("notificationInboxItems", {
          eventId: event._id,
          recipientUserId: event.recipientUserId,
          idempotencyKey: `link-inbox:${event._id}`,
          templateVersion: "g4-static-v1",
          route: "settings",
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
        return { eventId: event._id, deliveryId, inboxItemId, dueWorkId };
      }));
    });

    await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(3);
      for (const ids of projectionIds) {
        expect(await ctx.db.get(ids.eventId)).not.toBeNull();
        expect(await ctx.db.get(ids.deliveryId)).toMatchObject({
          state: "cancelled",
          eligibility: "cancelled",
          cancellationReason: "authority_revoked",
        });
        expect(await ctx.db.get(ids.inboxItemId)).toMatchObject({ state: "hidden" });
        expect(await ctx.db.get(ids.dueWorkId)).toMatchObject({ state: "cancelled", generation: 2 });
      }
      const couple = await ctx.db.get(coupleId);
      expect(couple?.status).toBe("revoked");
      expect((await ctx.db.get(partnerId))?.role).toBe("partner");
    });
  });

  test("same-date connected-since retry is a no-op and a changed date supersedes the prior event", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
    try {
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId, partnerId, coupleId } = await seedActiveCouple(t);
      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-14",
      });
      const firstSettingVersion = await t.run(async (ctx) => {
        return (await ctx.db.get(coupleId))?.connectedSinceUpdatedAt;
      });
      expect(firstSettingVersion).toBeDefined();
      const firstProjection = await t.run(async (ctx) => {
        const event = await ctx.db.query("notificationEvents").unique();
        if (!event) throw new Error("Expected the first setting-version event");
        const now = Date.now();
        const deliveryId = await ctx.db.insert("notificationDeliveries", {
          eventId: event._id,
          recipientUserId: partnerId,
          channel: "in_app",
          stableDestinationId: String(partnerId),
          logicalKey: `setting-test:${event._id}`,
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
            payloadHash: "static-connected-since-v1",
          },
          createdAt: now,
          updatedAt: now,
        });
        const inboxItemId = await ctx.db.insert("notificationInboxItems", {
          eventId: event._id,
          recipientUserId: partnerId,
          idempotencyKey: `setting-inbox:${event._id}`,
          templateVersion: "g4-static-v1",
          route: "settings",
          state: "current",
          createdAt: now,
        });
        return { deliveryId, inboxItemId };
      });
      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-14",
      });

      const replayState = await t.run(async (ctx) => ({
        couple: await ctx.db.get(coupleId),
        events: await ctx.db.query("notificationEvents").collect(),
        delivery: await ctx.db.get(firstProjection.deliveryId),
        inboxItem: await ctx.db.get(firstProjection.inboxItemId),
      }));
      expect(replayState.couple?.connectedSinceDate).toBe("2000-02-14");
      expect(replayState.couple?.connectedSinceUpdatedAt).toBe(firstSettingVersion);
      expect(replayState.events).toHaveLength(1);
      expect(replayState.delivery).toMatchObject({ state: "pending", eligibility: "eligible" });
      expect(replayState.inboxItem).toMatchObject({ state: "current" });

      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-15",
      });

      const { couple, events } = await t.run(async (ctx) => ({
        couple: await ctx.db.get(coupleId),
        events: await ctx.db.query("notificationEvents").collect(),
      }));
      expect(events).toHaveLength(2);
      expect(new Set(events.map((event) => event.sourceAuthorityVersion)).size).toBe(2);
      expect(events.map((event) => event.recipientUserId)).toEqual([partnerId, partnerId]);
      for (const event of events) {
        const settingVersion = event.sourceAuthorityVersion.replace("connected-since-setting:", "");
        expect(event).toMatchObject({
          eventType: "connected_since_updated.v1",
          eventVersion: 1,
          purpose: "connected_since_updated",
          producerKind: "explicit_connected_since_update",
          sourceReference: `couple:${coupleId}:connected-since:${settingVersion}`,
          ownerUserId: primaryId,
          recipientUserId: partnerId,
          recipientScope: "other_active_member",
          privacyClass: "account_relationship_sensitive",
          validityRule: "until_setting_version_changes_or_link_revocation",
          idempotencyKey: makeEventIdempotencyKey("connected_since_updated.v1", {
            coupleId: String(coupleId),
            settingVersion,
            recipientId: String(partnerId),
          }),
          allowedChannel: "in_app",
        });
        expect(event).not.toHaveProperty("connectedSinceDate");
        expect(event).not.toHaveProperty("name");
        expect(event).not.toHaveProperty("payload");
      }
      expect(couple?.connectedSinceDate).toBe("2000-02-15");
      expect(couple?.connectedSinceUpdatedAt).toBe(firstSettingVersion! + 1);
      await t.run(async (ctx) => {
        expect(await ctx.db.get(firstProjection.deliveryId)).toMatchObject({
          state: "cancelled",
          eligibility: "cancelled",
          cancellationReason: "source_changed",
        });
        expect(await ctx.db.get(firstProjection.inboxItemId)).toMatchObject({ state: "hidden" });
        expect(await ctx.db.query("notificationLog").collect()).toHaveLength(0);
        expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(1);
        expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(1);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a connected-since correction cancels legacy numeric source work without touching another link generation", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
    try {
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId, partnerId, coupleId } = await seedActiveCouple(t);
      const settingVersion = Date.now() - 1_000;
      const { partnerMembershipId, otherGenerationId } = await t.run(async (ctx) => {
        const memberships = await ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role_and_revoked_at", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
          )
          .unique();
        if (!memberships) throw new Error("Expected the active partner membership");
        await ctx.db.patch(coupleId, {
          connectedSinceDate: "2000-02-14",
          connectedSinceUpdatedAt: settingVersion,
          connectedSinceUpdatedBy: primaryId,
        });
        const otherId = await ctx.db.insert("coupleMembers", {
          coupleId,
          userId: partnerId,
          role: "partner",
          sharingPain: false,
          sharingPhase: false,
          sharingPeriodWrite: false,
          joinedAt: Date.now() + 1,
          revokedAt: Date.now() + 2,
        });
        return { partnerMembershipId: memberships._id, otherGenerationId: otherId };
      });
      const legacy = await seedConnectedSinceProjection(t, {
        coupleId,
        primaryId,
        partnerId,
        sourceReference: `couple:${coupleId}:connected-since:${settingVersion}`,
        sourceAuthorityVersion: `connected-since-setting:${settingVersion}`,
        idempotencySettingVersion: String(settingVersion),
      });
      const currentGeneration = await seedConnectedSinceProjection(t, {
        coupleId,
        primaryId,
        partnerId,
        sourceReference: `couple:${coupleId}:connected-since:${partnerMembershipId}:${settingVersion}`,
        sourceAuthorityVersion: `connected-since-setting:${partnerMembershipId}:${settingVersion}`,
        idempotencySettingVersion: `${partnerMembershipId}:${settingVersion}`,
      });
      const otherGeneration = await seedConnectedSinceProjection(t, {
        coupleId,
        primaryId,
        partnerId,
        sourceReference: `couple:${coupleId}:connected-since:${otherGenerationId}:${settingVersion}`,
        sourceAuthorityVersion: `connected-since-setting:${otherGenerationId}:${settingVersion}`,
        idempotencySettingVersion: `${otherGenerationId}:${settingVersion}`,
      });

      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-15",
      });

      await t.run(async (ctx) => {
        for (const projection of [legacy, currentGeneration]) {
          expect(await ctx.db.get(projection.deliveryId)).toMatchObject({
            state: "cancelled",
            eligibility: "cancelled",
            cancellationReason: "source_changed",
          });
          expect(await ctx.db.get(projection.inboxItemId)).toMatchObject({ state: "hidden" });
        }
        expect(await ctx.db.get(otherGeneration.deliveryId)).toMatchObject({
          state: "pending",
          eligibility: "eligible",
        });
        expect(await ctx.db.get(otherGeneration.inboxItemId)).toMatchObject({ state: "current" });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("relationship revocation cancels legacy numeric connected-since source work", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
    try {
      const t = convexTest(schema, modules);
      const { asPrimary, primaryId, partnerId, coupleId } = await seedActiveCouple(t);
      const settingVersion = Date.now() - 1_000;
      await t.run(async (ctx) => {
        await ctx.db.patch(coupleId, {
          connectedSinceDate: "2000-02-14",
          connectedSinceUpdatedAt: settingVersion,
          connectedSinceUpdatedBy: primaryId,
        });
      });
      const legacy = await seedConnectedSinceProjection(t, {
        coupleId,
        primaryId,
        partnerId,
        sourceReference: `couple:${coupleId}:connected-since:${settingVersion}`,
        sourceAuthorityVersion: `connected-since-setting:${settingVersion}`,
        idempotencySettingVersion: String(settingVersion),
      });

      await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

      await t.run(async (ctx) => {
        expect(await ctx.db.get(legacy.deliveryId)).toMatchObject({
          state: "cancelled",
          eligibility: "cancelled",
          cancellationReason: "authority_revoked",
        });
        expect(await ctx.db.get(legacy.inboxItemId)).toMatchObject({ state: "hidden" });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("relinking the same partner under a fixed clock creates a new connected-since event generation", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
    try {
      const t = convexTest(schema, modules);
      const { asPrimary, asPartner, coupleId, partnerId } = await seedActiveCouple(t);

      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-14",
      });
      const first = await t.run(async (ctx) => {
        const event = (await ctx.db.query("notificationEvents").collect()).find(
          (candidate) => candidate.eventType === "connected_since_updated.v1",
        );
        if (!event) throw new Error("Expected the first connected-since event");
        const partnerMembership = await ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role_and_revoked_at", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
          )
          .unique();
        if (!partnerMembership) throw new Error("Expected the active partner membership");
        const now = Date.now();
        const deliveryId = await ctx.db.insert("notificationDeliveries", {
          eventId: event._id,
          recipientUserId: partnerId,
          channel: "in_app",
          stableDestinationId: String(partnerId),
          logicalKey: `relink-test:${event._id}`,
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
            payloadHash: "static-connected-since-v1",
          },
          createdAt: now,
          updatedAt: now,
        });
        const inboxItemId = await ctx.db.insert("notificationInboxItems", {
          eventId: event._id,
          recipientUserId: partnerId,
          idempotencyKey: `relink-inbox:${event._id}`,
          templateVersion: "g4-static-v1",
          route: "settings",
          state: "current",
          createdAt: now,
        });
        return { event, partnerMembershipId: partnerMembership._id, deliveryId, inboxItemId };
      });

      await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});
      const revoked = await t.run(async (ctx) => ({
        couple: await ctx.db.get(coupleId),
        delivery: await ctx.db.get(first.deliveryId),
        inboxItem: await ctx.db.get(first.inboxItemId),
      }));
      expect(revoked.couple?.connectedSinceDate).toBeUndefined();
      expect(revoked.couple?.connectedSinceUpdatedAt).toBeUndefined();
      expect(revoked.delivery).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
        cancellationReason: "authority_revoked",
      });
      expect(revoked.inboxItem).toMatchObject({ state: "hidden" });

      const pairing = await asPrimary.action(api.mutations.couples.generatePairingCode, {});
      await asPartner.mutation(api.mutations.couples.linkPartnerWithCode, { code: pairing.code });
      const secondPartnerMembershipId = await t.run(async (ctx) => {
        const membership = await ctx.db
          .query("coupleMembers")
          .withIndex("by_couple_and_role_and_revoked_at", (q) =>
            q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
          )
          .unique();
        return membership?._id;
      });
      expect(secondPartnerMembershipId).toBeDefined();
      expect(secondPartnerMembershipId).not.toBe(first.partnerMembershipId);

      await asPrimary.mutation(api.mutations.couples.updateConnectedSinceDate, {
        connectedSinceDate: "2000-02-14",
      });

      const connectedSinceEvents = await t.run(async (ctx) =>
        (await ctx.db.query("notificationEvents").collect()).filter(
          (event) => event.eventType === "connected_since_updated.v1",
        ),
      );
      expect(connectedSinceEvents).toHaveLength(2);
      const [firstEvent, secondEvent] = connectedSinceEvents;
      expect(secondEvent._id).not.toBe(firstEvent._id);
      expect(secondEvent.sourceReference).not.toBe(firstEvent.sourceReference);
      expect(secondEvent.idempotencyKey).not.toBe(firstEvent.idempotencyKey);
      expect(secondEvent.sourceAuthorityVersion).not.toBe(firstEvent.sourceAuthorityVersion);
      for (const event of connectedSinceEvents) {
        const settingVersion = event.sourceAuthorityVersion.replace(
          "connected-since-setting:",
          "",
        );
        expect(event.idempotencyKey).toBe(
          makeEventIdempotencyKey("connected_since_updated.v1", {
            coupleId: String(coupleId),
            settingVersion,
            recipientId: String(partnerId),
          }),
        );
        expect(event).not.toHaveProperty("connectedSinceDate");
        expect(event).not.toHaveProperty("name");
      }
      const couple = await t.run(async (ctx) => ctx.db.get(coupleId));
      expect(couple?.connectedSinceDate).toBe("2000-02-14");
      expect(couple?.connectedSinceUpdatedAt).toBe(Date.now());
      const oldProjection = await t.run(async (ctx) => ({
        delivery: await ctx.db.get(first.deliveryId),
        inboxItem: await ctx.db.get(first.inboxItemId),
      }));
      expect(oldProjection.delivery).toMatchObject({ state: "cancelled", eligibility: "cancelled" });
      expect(oldProjection.inboxItem).toMatchObject({ state: "hidden" });
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps link events dark unless the exact outbox flag is true", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "false");
    const t = convexTest(schema, modules);
    await seedPendingPairing(t);
    await t.withIdentity({ subject: "n3d-partner" }).mutation(
      api.mutations.couples.linkPartnerWithCode,
      { code: "482731" },
    );
    await expect(
      t.run(async (ctx) => ctx.db.query("notificationEvents").collect()),
    ).resolves.toEqual([]);
  });
});
