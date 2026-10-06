import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

type TestBackend = TestConvex<typeof schema>;

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function seedScheduledUser(t: TestBackend, userId: Id<"users">) {
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { timeZone: "UTC" });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-03-01",
      startCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.UTC(2026, 2, 1),
      updatedAt: Date.UTC(2026, 2, 1),
    });
    await ctx.db.insert("cyclePredictionSegments", {
      userId,
      startDate: "2026-03-01",
      status: "active",
      createdAt: Date.UTC(2026, 2, 1),
    });
    await ctx.db.insert("notificationScheduleState", {
      userId,
      sourceRevision: 4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    for (const purpose of ["period_window_approaching", "late_status"] as const) {
      await ctx.db.insert("notificationPreferences", {
        userId,
        purpose,
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 1,
        updatedAt: Date.now(),
      });
    }
  });
  const snapshotId = await t.mutation(
    internal.internal.predictionSnapshots.ensureCurrentForUser,
    { userId },
  );
  if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
  return snapshotId;
}

async function pendingScheduleRows(t: TestBackend, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("notificationDueWork")
      .withIndex("by_owner_and_state_and_due_at", (q) =>
        q.eq("ownerUserId", userId).eq("state", "pending"),
      )
      .take(10),
  );
}

async function allScheduleRows(t: TestBackend, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("notificationDueWork")
      .withIndex("by_owner_and_state_and_due_at", (q) =>
        q.eq("ownerUserId", userId),
      )
      .take(10),
  );
}

describe("user role onboarding", () => {
  test("allows the first role selection for an unlinked user", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, {
      clerkId: "first-role-user",
      name: "First Role User",
      role: "primary",
    });
    await t.run(async (ctx) => ctx.db.patch(userId, { role: undefined }));

    await expect(
      t.withIdentity({ subject: "first-role-user" }).mutation(
        api.mutations.users.updateUserRole,
        { role: "partner" },
      ),
    ).resolves.toBe(userId);
  });

  test("rejects changing a role after onboarding", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "onboarded-user",
      name: "Onboarded User",
      role: "primary",
    });

    await expect(
      t.withIdentity({ subject: "onboarded-user" }).mutation(
        api.mutations.users.updateUserRole,
        { role: "partner" },
      ),
    ).rejects.toThrow("Role can only be selected during onboarding");
  });

  test("does not permit a role change for a member missing legacy role state", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => ctx.db.patch(primaryId, { role: undefined }));

    await expect(
      asPrimary.mutation(api.mutations.users.updateUserRole, {
        role: "partner",
      }),
    ).rejects.toThrow("Role cannot be changed after joining a couple");
  });
});

describe("authenticated user mutation issuer scoping", () => {
  test.each([
    {
      label: "updateUserRole",
      update: (asUser: ReturnType<TestBackend["withIdentity"]>) =>
        asUser.mutation(api.mutations.users.updateUserRole, { role: "partner" }),
    },
    {
      label: "updateUserPreferences",
      update: (asUser: ReturnType<TestBackend["withIdentity"]>) =>
        asUser.mutation(api.mutations.users.updateUserPreferences, {
          preferredName: "Wrong Issuer",
          timeZone: "Asia/Kolkata",
        }),
    },
    {
      label: "updateUserTimeZone",
      update: (asUser: ReturnType<TestBackend["withIdentity"]>) =>
        asUser.mutation(api.mutations.users.updateUserTimeZone, {
          timeZone: "Asia/Kolkata",
        }),
    },
  ])("$label rejects a foreign issuer reusing a legacy subject", async ({ update }) => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, {
      clerkId: "shared-legacy-subject",
      name: "Original User",
      role: "primary",
    });
    await t.run((ctx) =>
      ctx.db.patch(userId, { preferredName: "Original", timeZone: "UTC" }),
    );
    const foreignIssuer = t.withIdentity({
      subject: "shared-legacy-subject",
      issuer: "https://other.clerk.example",
    });

    await expect(update(foreignIssuer)).rejects.toThrow("User not found in database");
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.toMatchObject({
      role: "primary",
      preferredName: "Original",
      timeZone: "UTC",
    });
  });
});

describe("user timezone notification reconciliation", () => {
  test.each([
    {
      label: "updateUserPreferences",
      update: (asPrimary: ReturnType<TestBackend["withIdentity"]>) =>
        asPrimary.mutation(api.mutations.users.updateUserPreferences, {
          timeZone: "Asia/Kolkata",
        }),
    },
    {
      label: "updateUserTimeZone",
      update: (asPrimary: ReturnType<TestBackend["withIdentity"]>) =>
        asPrimary.mutation(api.mutations.users.updateUserTimeZone, {
          timeZone: "Asia/Kolkata",
        }),
    },
  ])("$label advances source authority and reconciles without refreshing the snapshot", async ({ update }) => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const snapshotId = await seedScheduledUser(t, primaryId);
    const beforeSnapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    const beforeWork = await pendingScheduleRows(t, primaryId);
    expect(beforeWork).toHaveLength(2);
    const predictionWork = beforeWork.find((row) => row.kind === "prediction_window");
    if (!predictionWork) throw new Error("Expected prediction-window work");
    const claimedWorkId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: predictionWork.dueAt,
        generation: predictionWork.generation,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await update(asPrimary);

    const after = await t.run(async (ctx) => ({
      user: await ctx.db.get(primaryId),
      source: await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
      snapshots: await ctx.db
        .query("predictionSnapshots")
        .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
        .take(10),
    }));
    const allWork = await allScheduleRows(t, primaryId);
    const newPending = allWork.filter((row) => row.state === "pending");
    const cancelled = allWork.filter((row) => row.state === "cancelled");

    expect(after.user?.timeZone).toBe("Asia/Kolkata");
    expect(after.source?.sourceRevision).toBe(5);
    expect(after.snapshots).toHaveLength(1);
    expect(after.snapshots[0]?._id).toBe(snapshotId);
    expect(after.snapshots[0]?.generatedAt).toBe(beforeSnapshot?.generatedAt);
    expect(cancelled).toHaveLength(3);
    expect(cancelled.find((row) => row._id === claimedWorkId)).toBeDefined();
    expect(newPending).toHaveLength(2);
    expect(newPending.map((row) => row.generation)).toEqual([5, 5]);
    expect(newPending.map((row) => row.dueAt)).not.toEqual(
      beforeWork.map((row) => row.dueAt),
    );
  });

  test("unchanged timezone and legacy external consent do not advance source authority", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await seedScheduledUser(t, primaryId);
    const beforeWork = await pendingScheduleRows(t, primaryId);

    await asPrimary.mutation(api.mutations.users.updateUserPreferences, {
      timeZone: "UTC",
      externalNotificationConsent: true,
    });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
      work: await ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId),
        )
        .take(10),
    }));
    expect(state.source?.sourceRevision).toBe(4);
    expect(state.work.map(({ _id, state: rowState }) => ({ _id, state: rowState }))).toEqual(
      beforeWork.map(({ _id, state: rowState }) => ({ _id, state: rowState })),
    );
  });

  test("scheduler-off timezone change invalidates old work without replacement wakeups", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await seedScheduledUser(t, primaryId);
    const beforeWork = await pendingScheduleRows(t, primaryId);
    const predictionWork = beforeWork.find((row) => row.kind === "prediction_window");
    if (!predictionWork) throw new Error("Expected prediction-window work");
    const claimedWorkId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: predictionWork.dueAt,
        generation: predictionWork.generation,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const scheduledBefore = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10),
    );
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "false");

    await asPrimary.mutation(api.mutations.users.updateUserTimeZone, {
      timeZone: "Asia/Kolkata",
    });

    const allWork = await allScheduleRows(t, primaryId);
    const source = await t.run((ctx) =>
      ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
    );
    const scheduledAfter = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10),
    );
    expect(source?.sourceRevision).toBe(5);
    expect(allWork.every((row) => row.state === "cancelled")).toBe(true);
    expect(allWork.find((row) => row._id === claimedWorkId)?.state).toBe("cancelled");
    expect(scheduledAfter.map(({ _id }) => _id)).toEqual(
      scheduledBefore.map(({ _id }) => _id),
    );
  });

  test("timezone update rolls back when source revision cannot advance", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await seedScheduledUser(t, primaryId);
    await t.run(async (ctx) => {
      const state = await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique();
      if (!state) throw new Error("Expected notification source state");
      await ctx.db.patch(state._id, { sourceRevision: Number.MAX_SAFE_INTEGER });
    });
    const beforeWork = await allScheduleRows(t, primaryId);

    await expect(
      asPrimary.mutation(api.mutations.users.updateUserTimeZone, {
        timeZone: "Asia/Kolkata",
      }),
    ).rejects.toThrow(/cannot be advanced safely/i);

    const after = await t.run(async (ctx) => ({
      user: await ctx.db.get(primaryId),
      source: await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
    }));
    expect(after.user?.timeZone).toBe("UTC");
    expect(after.source?.sourceRevision).toBe(Number.MAX_SAFE_INTEGER);
    expect(await allScheduleRows(t, primaryId)).toEqual(beforeWork);
  });
});
