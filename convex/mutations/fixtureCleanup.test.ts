import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { fixtureEmail } from "../../lib/fixtureEmail";
import schema from "../schema";
import { modules } from "../test.setup";

const fixtureArgs = {
  runId: "qa-35577171543-1-prediction-v2-off-desktop",
  primaryClerkId: "clerk-primary",
  partnerClerkId: "clerk-partner",
};

function enableFixtureCleanup() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CB_CONNECT_FIXTURE_CLEANUP_ENABLED", "true");
  vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "dev:hallowed-hummingbird-284");
}

async function seedFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const primaryId = await ctx.db.insert("users", {
      clerkId: fixtureArgs.primaryClerkId,
      email: fixtureEmail(fixtureArgs.runId, "primary"),
      name: "Fixture Primary",
      role: "primary",
      fixtureRunId: fixtureArgs.runId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    const partnerId = await ctx.db.insert("users", {
      clerkId: fixtureArgs.partnerClerkId,
      email: fixtureEmail(fixtureArgs.runId, "partner"),
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
    const periodEventId = await ctx.db.insert("periodEvents", {
      userId: primaryId,
      startDate: "2026-08-04",
      createdByUserId: primaryId,
      updatedByUserId: partnerId,
      source: "partner_assist",
      confirmationStatus: "confirmed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const segmentId = await ctx.db.insert("cyclePredictionSegments", {
      userId: primaryId,
      startDate: "2026-08-04",
      status: "active",
      createdAt: Date.now(),
    });
    const snapshotId = await ctx.db.insert("predictionSnapshots", {
      userId: primaryId,
      generatedAt: Date.now(),
      inputCutoffAt: Date.now(),
      inputCutoffDate: "2026-08-04",
      status: "limited_evidence",
      estimatorId: "cycle-interval",
      estimatorVersion: 2,
      intervalMethodVersion: "cycle_intervals_v1",
      calibrationVersion: "empirical-residual-quantiles-v1",
      pointDate: "2026-09-01",
      earliestDate: "2026-08-30",
      latestDate: "2026-09-03",
      probabilityLabel: null,
      quality: "limited_evidence",
      basisCount: 1,
      reasonCodes: ["LIMITED_HISTORY"],
      displayStatus: "shadow",
      predictionSegmentId: segmentId,
      featureVersion: "period_prediction_v2",
      contractVersion: 2,
    });
    await ctx.db.insert("predictionSnapshotAssessments", {
      snapshotId,
      type: "outcome",
      observedEligibleStartDate: "2026-08-04",
      signedErrorDays: 0,
      absoluteErrorDays: 0,
      insideWindow: true,
      sourcePeriodEventId: periodEventId,
      reason: "eligible_outcome",
      recordedAt: Date.now(),
    });
    await ctx.db.insert("predictionSnapshotOutcomeCandidates", {
      snapshotId,
      sourcePeriodEventId: periodEventId,
      observedEligibleStartDate: "2026-08-04",
      status: "eligible",
      recordedAt: Date.now(),
    });
    const painLogId = await ctx.db.insert("painLogs", {
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

    return { primaryId, partnerId, coupleId, nutritionTipId, painLogId };
  });
}

async function seedNotificationRows(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  painLogId: Id<"painLogs">,
  key: string,
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const requestId = await ctx.db.insert("painReminderRequests", {
      ownerUserId: userId,
      painLogId,
      selectedLocalDay: "2026-08-04",
      requestVersion: 1,
      state: "active",
      createdAt: now,
      updatedAt: now,
    });
    const eventId = await ctx.db.insert("notificationEvents", {
      eventType: "pain_check_in.v1",
      eventVersion: 1,
      purpose: "pain_check_in",
      producerKind: "explicit_primary_request",
      sourceReference: String(requestId),
      sourceAuthorityVersion: `${key}-authority-v1`,
      ownerUserId: userId,
      recipientUserId: userId,
      recipientScope: "primary",
      privacyClass: "primary_private_health",
      validityRule: "selected_local_day_while_request_is_active",
      idempotencyKey: `${key}-event-v1`,
      allowedChannel: "in_app",
      createdAt: now,
    });
    const inboxItemId = await ctx.db.insert("notificationInboxItems", {
      eventId,
      recipientUserId: userId,
      idempotencyKey: `${key}-event-v1`,
      templateVersion: "g4-template-v1",
      route: "pain",
      state: "current",
      createdAt: now,
    });
    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      eventId,
      recipientUserId: userId,
      channel: "in_app",
      stableDestinationId: "fixture-in-app",
      logicalKey: `${key}-delivery-v1`,
      notBefore: now,
      state: "pending",
      eligibility: "eligible",
      providerOutcome: "none",
      attemptCount: 0,
      claimGeneration: 0,
      renderIdentity: {
        templateVersion: "g4-template-v1",
        locale: "en",
        variableSchemaVersion: "v1",
        payloadHash: "a".repeat(64),
      },
      createdAt: now,
      updatedAt: now,
    });
    const attemptId = await ctx.db.insert("notificationDeliveryAttempts", {
      deliveryId,
      attemptOrdinal: 1,
      claimGeneration: 1,
      startedAt: now,
      completedAt: now,
      result: { kind: "in_app_persisted" },
    });
    const dueWorkId = await ctx.db.insert("notificationDueWork", {
      ownerUserId: userId,
      kind: "pain_reminder",
      state: "pending",
      dueAt: now,
      generation: 1,
      eventId,
      deliveryId,
      painReminderRequestId: requestId,
      createdAt: now,
      updatedAt: now,
    });
    const preferenceId = await ctx.db.insert("notificationPreferences", {
      userId,
      purpose: "pain_check_in",
      inAppEnabled: true,
      reminderWindowVersion: 1,
      updatedAt: now,
    });
    const scheduleStateId = await ctx.db.insert("notificationScheduleState", {
      userId,
      sourceRevision: 1,
      createdAt: now,
      updatedAt: now,
    });

    return {
      requestId,
      eventId,
      inboxItemId,
      deliveryId,
      attemptId,
      dueWorkId,
      preferenceId,
      scheduleStateId,
    };
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

    const result = await t
      .withIdentity({
        subject: fixtureArgs.primaryClerkId,
      })
      .mutation(api.mutations.fixtureCleanup.registerFixtureUser, {
        runId: fixtureArgs.runId,
        clerkId: fixtureArgs.primaryClerkId,
        email: fixtureEmail(fixtureArgs.runId, "primary"),
        role: "primary",
        primaryClerkId: fixtureArgs.primaryClerkId,
        partnerClerkId: fixtureArgs.partnerClerkId,
      });

    expect(result).toEqual({ registered: true });
    expect(await t.run(async (ctx) => ctx.db.get("users", primaryId))).toEqual(
      expect.objectContaining({
        email: fixtureEmail(fixtureArgs.runId, "primary"),
        fixtureRunId: fixtureArgs.runId,
      }),
    );
  });

  test("records run ownership before dashboard writes and cleans a linking failure idempotently", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);

    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.beginFixtureRun, fixtureArgs),
    ).resolves.toEqual({ begun: true });
    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.beginFixtureRun, fixtureArgs),
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
        email: fixtureEmail(fixtureArgs.runId, "partner"),
        name: "Fixture Partner",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    });

    const cleaned = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(cleaned).toMatchObject({
      ok: true,
      remaining: false,
      deleted: { users: 2, couples: 1, coupleMembers: 1 },
    });
    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).resolves.toMatchObject({ ok: true, remaining: false });
  });

  test("rejects production deployment identities before reading or mutating", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CB_CONNECT_FIXTURE_CLEANUP_ENABLED", "true");
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "prod:festive-malamute-715");
    const t = convexTest(schema, modules);

    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_not_allowed");
  });

  test("cascades every associated fixture table and leaves shared tips alone", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);

    const result = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(false);
    expect(result.deleted.users).toBe(2);
    expect(result.deleted.couples).toBe(1);
    expect(result.deleted.coupleMessages).toBe(1);
    expect(result.deleted.coupleMessageReactions).toBe(1);
    expect(result.deleted.cyclePredictionSegments).toBe(1);
    expect(result.deleted.predictionSnapshots).toBe(1);
    expect(result.deleted.predictionSnapshotAssessments).toBe(1);
    expect(result.deleted.predictionSnapshotOutcomeCandidates).toBe(1);

    const status = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .query(api.mutations.fixtureCleanup.getFixtureCleanupStatus, fixtureArgs);
    expect(status).toEqual({
      remaining: false,
      counts: expect.objectContaining({ users: 0, couples: 0 }),
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db.get("nutritionTips", seeded.nutritionTipId),
      ),
    ).not.toBeNull();
  });

  test("cleans Gate 4 notification rows only for the attested fixture users", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const fixtureNotifications = await seedNotificationRows(
      t,
      fixture.primaryId,
      fixture.painLogId,
      "fixture-notifications",
    );
    const unrelated = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "unrelated-clerk",
        email: "unrelated@example.test",
        name: "Unrelated User",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
      const painLogId = await ctx.db.insert("painLogs", {
        userId,
        date: "2026-08-04",
        painScore: 1,
        tags: ["other"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const controlId = await ctx.db.insert("notificationControls", {
        scope: "global",
        key: "fixture-test-control",
        version: 1,
        operatorReference: "synthetic-fixture-cleanup-test",
        updatedAt: Date.now(),
      });
      return { userId, painLogId, controlId };
    });
    const unrelatedNotifications = await seedNotificationRows(
      t,
      unrelated.userId,
      unrelated.painLogId,
      "unrelated-notifications",
    );

    const result = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);

    expect(result.deleted).toEqual(
      expect.objectContaining({
        notificationEvents: 1,
        notificationInboxItems: 1,
        notificationDeliveries: 1,
        notificationDeliveryAttempts: 1,
        notificationDueWork: 1,
        notificationPreferences: 1,
        notificationScheduleState: 1,
        painReminderRequests: 1,
      }),
    );
    const fixtureRows = await t.run(async (ctx) => ({
      event: await ctx.db.get("notificationEvents", fixtureNotifications.eventId),
      inboxItem: await ctx.db.get(
        "notificationInboxItems",
        fixtureNotifications.inboxItemId,
      ),
      delivery: await ctx.db.get(
        "notificationDeliveries",
        fixtureNotifications.deliveryId,
      ),
      attempt: await ctx.db.get(
        "notificationDeliveryAttempts",
        fixtureNotifications.attemptId,
      ),
      dueWork: await ctx.db.get("notificationDueWork", fixtureNotifications.dueWorkId),
      preference: await ctx.db.get(
        "notificationPreferences",
        fixtureNotifications.preferenceId,
      ),
      scheduleState: await ctx.db.get(
        "notificationScheduleState",
        fixtureNotifications.scheduleStateId,
      ),
      request: await ctx.db.get(
        "painReminderRequests",
        fixtureNotifications.requestId,
      ),
    }));
    expect(fixtureRows).toEqual({
      event: null,
      inboxItem: null,
      delivery: null,
      attempt: null,
      dueWork: null,
      preference: null,
      scheduleState: null,
      request: null,
    });

    const unrelatedRows = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", unrelated.userId),
      painLog: await ctx.db.get("painLogs", unrelated.painLogId),
      event: await ctx.db.get("notificationEvents", unrelatedNotifications.eventId),
      inboxItem: await ctx.db.get(
        "notificationInboxItems",
        unrelatedNotifications.inboxItemId,
      ),
      delivery: await ctx.db.get(
        "notificationDeliveries",
        unrelatedNotifications.deliveryId,
      ),
      attempt: await ctx.db.get(
        "notificationDeliveryAttempts",
        unrelatedNotifications.attemptId,
      ),
      dueWork: await ctx.db.get(
        "notificationDueWork",
        unrelatedNotifications.dueWorkId,
      ),
      preference: await ctx.db.get(
        "notificationPreferences",
        unrelatedNotifications.preferenceId,
      ),
      scheduleState: await ctx.db.get(
        "notificationScheduleState",
        unrelatedNotifications.scheduleStateId,
      ),
      request: await ctx.db.get(
        "painReminderRequests",
        unrelatedNotifications.requestId,
      ),
      control: await ctx.db.get("notificationControls", unrelated.controlId),
    }));
    expect(Object.values(unrelatedRows).every((row) => row !== null)).toBe(true);
  });

  test("cleans revoked partner membership history after a relink", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);
    await t.run(async (ctx) => {
      const partnerMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", seeded.coupleId)
            .eq("role", "partner")
            .eq("revokedAt", undefined),
        )
        .unique();
      if (!partnerMembership) throw new Error("fixture_partner_membership_missing");
      await ctx.db.patch(partnerMembership._id, { revokedAt: Date.now() - 1 });
      await ctx.db.insert("coupleMembers", {
        coupleId: seeded.coupleId,
        userId: seeded.partnerId,
        role: "partner",
        sharingPain: false,
        sharingPhase: true,
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
    });

    const result = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);

    expect(result).toMatchObject({ ok: true, remaining: false });
    expect(result.deleted.coupleMembers).toBe(3);
  });

  test("preserves a third-party membership when cleaning a fixture couple", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);
    await t.run(async (ctx) => {
      const unrelatedUserId = await ctx.db.insert("users", {
        clerkId: "unrelated-member",
        email: "",
        name: "Unrelated member",
        role: "partner",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
      await ctx.db.insert("coupleMembers", {
        coupleId: seeded.coupleId,
        userId: unrelatedUserId,
        role: "partner",
        sharingPain: false,
        sharingPhase: false,
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
    });

    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_identity_mismatch");
    const remainingUsers = await t.run(async (ctx) =>
      ctx.db.query("users").collect(),
    );
    expect(remainingUsers).toHaveLength(3);
  });

  test("cleans a partially deleted pair and is safe to repeat", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    const seeded = await seedFixture(t);
    await t.run(async (ctx) => ctx.db.delete("users", seeded.partnerId));

    const first = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(first.ok).toBe(true);
    expect(first.deleted.users).toBe(1);
    expect(first.remaining).toBe(false);

    const second = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(second).toEqual({
      ok: true,
      deleted: expect.any(Object),
      remaining: false,
    });
    expect(Object.values(second.deleted).every((count) => count === 0)).toBe(
      true,
    );
  });

  test("rejects a run-identity mismatch without deleting the fixture", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    await seedFixture(t);

    await expect(
      t
        .withIdentity({ subject: fixtureArgs.primaryClerkId })
        .mutation(api.mutations.fixtureCleanup.cleanupFixture, {
          ...fixtureArgs,
          runId: "different-run",
        }),
    ).rejects.toThrow("fixture_cleanup_identity_mismatch");

    const status = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_fixture_run_id_and_clerk_id", (q) =>
          q
            .eq("fixtureRunId", fixtureArgs.runId)
            .eq("clerkId", fixtureArgs.primaryClerkId),
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

    const first = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(first).toMatchObject({
      ok: true,
      remaining: false,
      deleted: { couples: 1 },
    });
    expect(first.deleted.coupleMembers).toBe(2);

    const second = await t
      .withIdentity({ subject: fixtureArgs.primaryClerkId })
      .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs);
    expect(Object.values(second.deleted).every((count) => count === 0)).toBe(
      true,
    );
  });

  test("rejects unauthenticated fixture cleanup and status calls", async () => {
    enableFixtureCleanup();
    const t = convexTest(schema, modules);
    await seedFixture(t);

    await expect(
      t.mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
    await expect(
      t.query(
        api.mutations.fixtureCleanup.getFixtureCleanupStatus,
        fixtureArgs,
      ),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
    await expect(
      t
        .withIdentity({ subject: fixtureArgs.partnerClerkId })
        .mutation(api.mutations.fixtureCleanup.cleanupFixture, fixtureArgs),
    ).rejects.toThrow("fixture_cleanup_unauthenticated");
  });
});
