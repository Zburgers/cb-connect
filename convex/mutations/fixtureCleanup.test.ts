import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const fixtureArgs = {
  runId: "run-fixture-cleanup",
  primaryClerkId: "clerk-primary",
  partnerClerkId: "clerk-partner",
};

function enableFixtureCleanup() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CB_CONNECT_FIXTURE_CLEANUP_ENABLED", "true");
  vi.stubEnv(
    "CB_CONNECT_BACKEND_DEPLOYMENT",
    "dev:hallowed-hummingbird-284",
  );
}

async function seedFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const primaryId = await ctx.db.insert("users", {
      clerkId: fixtureArgs.primaryClerkId,
      email: "cb-connect-e2e+run-fixture-cleanup-primary@example.com",
      name: "Fixture Primary",
      role: "primary",
      fixtureRunId: fixtureArgs.runId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    const partnerId = await ctx.db.insert("users", {
      clerkId: fixtureArgs.partnerClerkId,
      email: "cb-connect-e2e+run-fixture-cleanup-partner@example.com",
      name: "Fixture Partner",
      role: "partner",
      fixtureRunId: fixtureArgs.runId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    const coupleId = await ctx.db.insert("couples", {
      createdAt: Date.now(),
      linkedAt: Date.now(),
      status: "active",
    });
    await ctx.db.insert("fixtureRuns", {
      runId: fixtureArgs.runId,
      primaryClerkId: fixtureArgs.primaryClerkId,
      partnerClerkId: fixtureArgs.partnerClerkId,
      coupleId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("coupleMembers", {
      coupleId,
      userId: primaryId,
      role: "primary",
      sharingPain: true,
      sharingPhase: true,
      sharingPeriodWrite: true,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("coupleMembers", {
      coupleId,
      userId: partnerId,
      role: "partner",
      sharingPain: false,
      sharingPhase: false,
      sharingPeriodWrite: false,
      joinedAt: Date.now(),
    });

    const nutritionTipId = await ctx.db.insert("nutritionTips", {
      phase: "follicular",
      foodItem: "Fixture food",
      reasoning: "Fixture reasoning",
      isActive: true,
      priority: 1,
    });
    const messageId = await ctx.db.insert("coupleMessages", {
      coupleId,
      senderId: primaryId,
      body: "Fixture message",
      createdAt: Date.now(),
    });
    await ctx.db.insert("pairingCodes", {
      code: "123456",
      coupleId,
      createdBy: primaryId,
      expiresAt: Date.now() + 60_000,
      status: "used",
      usedBy: partnerId,
      usedAt: Date.now(),
    });
    await ctx.db.insert("pairingCodeAttempts", {
      userId: partnerId,
      enteredCode: "123456",
      attemptedAt: Date.now(),
      success: true,
    });
    await ctx.db.insert("periodEvents", {
      userId: primaryId,
      startDate: "2026-08-04",
      createdByUserId: primaryId,
      updatedByUserId: partnerId,
      source: "partner_assist",
      confirmationStatus: "confirmed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("painLogs", {
      userId: primaryId,
      date: "2026-08-04",
      painScore: 1,
      tags: ["other"],
      note: "Fixture note",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("cycleSettings", {
      userId: primaryId,
      cycleLength: 28,
      periodLength: 5,
      lastUpdatedAt: Date.now(),
    });
    await ctx.db.insert("hiddenNutrition", {
      userId: primaryId,
      nutritionTipId,
      hiddenUntil: Date.now() + 60_000,
    });
    await ctx.db.insert("notificationLog", {
      userId: primaryId,
      type: "fixture",
      payload: { fixture: true },
      sentAt: Date.now(),
      status: "sent",
    });
    await ctx.db.insert("presence", {
      coupleId,
      userId: partnerId,
      lastSeen: Date.now(),
    });
    await ctx.db.insert("nudges", {
      coupleId,
      senderId: primaryId,
      receiverId: partnerId,
      emoji: "✨",
      message: "Fixture nudge",
      createdAt: Date.now(),
    });
    await ctx.db.insert("coupleMessageReactions", {
      coupleId,
      messageId,
      userId: partnerId,
      emoji: "💗",
      createdAt: Date.now(),
    });
    await ctx.db.insert("coupleChatStates", {
      coupleId,
      userId: primaryId,
      unreadCount: 1,
    });

    return { primaryId, partnerId, coupleId, nutritionTipId };
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bounded fixture cleanup", () => {
  test("registers an authenticated fixture and fills a missing identity email", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const primaryId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        clerkId: fixtureArgs.primaryClerkId,
        email: "",
        name: "Fixture Primary",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      }),
    );
    await t.run(async (ctx) => {
      const partnerId = await ctx.db.insert("users", {
        clerkId: fixtureArgs.partnerClerkId,
        // Clerk's Convex JWT does not always include an email claim, so the
        // dashboard can create the partner before fixture registration with
        // an empty stored email.
        email: "",
        name: "Fixture Partner",
        role: "partner",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
      const coupleId = await ctx.db.insert("couples", {
        createdAt: Date.now(),
        linkedAt: Date.now(),
        status: "active",
      });
      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: primaryId,
        role: "primary",
        sharingPain: false,
        sharingPhase: true,
        joinedAt: Date.now(),
      });
      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: partnerId,
        role: "partner",
        sharingPain: false,
        sharingPhase: true,
        joinedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("fixtureRuns", {
        runId: fixtureArgs.runId,
        primaryClerkId: fixtureArgs.primaryClerkId,
        partnerClerkId: fixtureArgs.partnerClerkId,
        createdAt: Date.now(),
      });
    });

    const result = await t.withIdentity({
      subject: fixtureArgs.primaryClerkId,
    }).mutation(api.mutations.fixtureCleanup.registerFixtureUser, {
      runId: fixtureArgs.runId,
      clerkId: fixtureArgs.primaryClerkId,
      email: "cb-connect-e2e+run-fixture-cleanup-primary@example.com",
      role: "primary",
      primaryClerkId: fixtureArgs.primaryClerkId,
      partnerClerkId: fixtureArgs.partnerClerkId,
    });

    expect(result).toEqual({ registered: true });
    expect(
      await t.run(async (ctx) => ctx.db.get("users", primaryId)),
    ).toEqual(expect.objectContaining({
      email: "cb-connect-e2e+run-fixture-cleanup-primary@example.com",
      fixtureRunId: fixtureArgs.runId,
    }));
  });

  test("records run ownership before dashboard writes and cleans a linking failure idempotently", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);

    await expect(
      t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
        api.mutations.fixtureCleanup.beginFixtureRun,
        fixtureArgs,
      ),
    ).resolves.toEqual({ begun: true });
    await expect(
      t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
        api.mutations.fixtureCleanup.beginFixtureRun,
        fixtureArgs,
      ),
    ).resolves.toEqual({ begun: false });

    await t.run(async (ctx) => {
      const primaryId = await ctx.db.insert("users", {
        clerkId: fixtureArgs.primaryClerkId,
        email: "",
        name: "Fixture Primary",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
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
        joinedAt: Date.now(),
      });
      await ctx.db.insert("users", {
        clerkId: fixtureArgs.partnerClerkId,
        email: "cb-connect-e2e+run-fixture-cleanup-partner@example.com",
        name: "Fixture Partner",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    });

    const cleaned = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(cleaned).toMatchObject({
      ok: true,
      remaining: false,
      deleted: { users: 2, couples: 1, coupleMembers: 1 },
    });
    await expect(
      t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
        api.mutations.fixtureCleanup.cleanupFixture,
        fixtureArgs,
      ),
    ).resolves.toMatchObject({ ok: true, remaining: false });
  });

  test("rejects production deployment identities before reading or mutating", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CB_CONNECT_FIXTURE_CLEANUP_ENABLED", "true");
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "prod:festive-malamute-715");
    const t = convexTest(schema, modules);

    await expect(
      t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
        api.mutations.fixtureCleanup.cleanupFixture,
        fixtureArgs,
      ),
    ).rejects.toThrow("fixture_cleanup_not_allowed");
  });

  test("cascades every associated fixture table and leaves shared tips alone", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);

    const result = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(false);
    expect(result.deleted.users).toBe(2);
    expect(result.deleted.couples).toBe(1);
    expect(result.deleted.coupleMessages).toBe(1);
    expect(result.deleted.coupleMessageReactions).toBe(1);

    const status = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).query(
      api.mutations.fixtureCleanup.getFixtureCleanupStatus,
      fixtureArgs,
    );
    expect(status).toEqual({
      remaining: false,
      counts: expect.objectContaining({ users: 0, couples: 0 }),
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("nutritionTips", seeded.nutritionTipId)),
    ).not.toBeNull();
  });

  test("cleans a partially deleted pair and is safe to repeat", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);
    await t.run(async (ctx) => ctx.db.delete("users", seeded.partnerId));

    const first = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(first.ok).toBe(true);
    expect(first.deleted.users).toBe(1);
    expect(first.remaining).toBe(false);

    const second = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(second).toEqual({ ok: true, deleted: expect.any(Object), remaining: false });
    expect(Object.values(second.deleted).every((count) => count === 0)).toBe(true);
  });

  test("rejects a run-identity mismatch without deleting the fixture", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    await seedFixture(t);

    await expect(
      t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(api.mutations.fixtureCleanup.cleanupFixture, {
        ...fixtureArgs,
        runId: "different-run",
      }),
    ).rejects.toThrow("fixture_cleanup_identity_mismatch");

    const status = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_fixture_run_id_and_clerk_id", (q) =>
          q.eq("fixtureRunId", fixtureArgs.runId).eq("clerkId", fixtureArgs.primaryClerkId),
        )
        .unique(),
    );
    expect(status).not.toBeNull();
  });

  test("uses the durable run marker when both fixture users have disappeared", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.delete("users", seeded.primaryId);
      await ctx.db.delete("users", seeded.partnerId);
    });

    const first = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(first).toMatchObject({ ok: true, remaining: false, deleted: { couples: 1 } });
    expect(first.deleted.coupleMembers).toBe(2);

    const second = await t.withIdentity({ subject: fixtureArgs.primaryClerkId }).mutation(
      api.mutations.fixtureCleanup.cleanupFixture,
      fixtureArgs,
    );
    expect(Object.values(second.deleted).every((count) => count === 0)).toBe(true);
  });

  test("rejects unauthenticated fixture cleanup and status calls", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    await seedFixture(t);

    await expect(
      t.mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
    await expect(
      t.query(api.mutations.fixtureCleanup.getFixtureCleanupStatus, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
    await expect(
      t.withIdentity({ subject: fixtureArgs.partnerClerkId }).mutation(
        api.mutations.fixtureCleanup.cleanupFixture,
        fixtureArgs,
      ),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
  });
});
