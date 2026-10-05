import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
});

describe("prediction segment mutation", () => {
  test("creates a private active segment from an eligible exact self start", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-01",
        startCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { segmentId } = await asPrimary.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: "2026-08-01" },
    );
    const active = await t.run(async (ctx) =>
      ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", primaryId).eq("status", "active"),
        )
        .unique(),
    );

    expect(active).toMatchObject({
      _id: segmentId,
      userId: primaryId,
      startDate: "2026-08-01",
      status: "active",
    });
    expect(active?.supersedesSegmentId).toBeUndefined();
  });

  test("accepts an eligible exact partner-assisted start", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-01",
        startCertainty: "exact",
        source: "partner_assist",
        confirmationStatus: "confirmed",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPrimary.mutation(api.mutations.cycleContext.createPredictionSegment, {
        startDate: "2026-08-01",
      }),
    ).resolves.toMatchObject({ segmentId: expect.any(String) });
  });

  test("rejects approximate, legacy, tombstoned, and foreign starts", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-04-01",
        startCertainty: "approximate",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-05-01",
        startCertainty: "exact",
        legacyReason: "duplicate",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        startCertainty: "exact",
        tombstoneByUserId: primaryId,
        tombstoneAt: now,
        tombstoneAuthorityVersion: 2,
        authorityVersion: 2,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-07-01",
        startCertainty: "exact",
        confirmationStatus: "unreviewed",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("periodEvents", {
        userId: partnerId,
        startDate: "2026-08-01",
        startCertainty: "exact",
        createdAt: now,
        updatedAt: now,
      });
    });

    for (const startDate of [
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]) {
      await expect(
        asPrimary.mutation(api.mutations.cycleContext.createPredictionSegment, {
          startDate,
        }),
      ).rejects.toThrow("PREDICTION_SEGMENT_START_NOT_ELIGIBLE");
    }
  });

  test("supersedes the active segment and restores earlier eligible history", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      for (const startDate of ["2026-05-01", "2026-07-01"]) {
        await ctx.db.insert("periodEvents", {
          userId: primaryId,
          startDate,
          startCertainty: "exact",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    const first = await asPrimary.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: "2026-07-01" },
    );
    const firstActive = await t.run(async (ctx) =>
      ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", primaryId).eq("status", "active"),
        )
        .unique(),
    );
    expect(firstActive?._id).toBe(first.segmentId);

    const restored = await asPrimary.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: "2026-05-01" },
    );
    const { active, superseded } = await t.run(async (ctx) => ({
      active: await ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", primaryId).eq("status", "active"),
        )
        .unique(),
      superseded: await ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", primaryId).eq("status", "superseded"),
        )
        .take(10),
    }));

    expect(active).toMatchObject({
      _id: restored.segmentId,
      startDate: "2026-05-01",
      status: "active",
      supersedesSegmentId: first.segmentId,
    });
    expect(superseded).toHaveLength(1);
    expect(superseded[0]).toMatchObject({
      _id: first.segmentId,
      startDate: "2026-07-01",
      status: "superseded",
    });
    expect(superseded[0].supersededAt).toEqual(expect.any(Number));
  });

  test("repeating the active start date leaves the segment and scheduled work unchanged", async () => {
    const now = Date.parse("2026-09-24T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: "UTC" });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-09-20",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.parse("2026-09-20T12:00:00.000Z"),
        updatedAt: Date.parse("2026-09-20T12:00:00.000Z"),
      });
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        createdAt: now,
        updatedAt: now,
      });
      for (const purpose of ["period_window_approaching", "late_status"] as const) {
        await ctx.db.insert("notificationPreferences", {
          userId: primaryId,
          purpose,
          inAppEnabled: true,
          localReminderTime: "09:00",
          reminderWindowVersion: 3,
          updatedAt: now,
        });
      }
    });

    const first = await asPrimary.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: "2026-09-20" },
    );
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    expect(snapshotId).not.toBeNull();

    const before = await t.run(async (ctx) => ({
      segments: await ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) => q.eq("userId", primaryId))
        .take(10),
      scheduleState: await ctx.db
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
    expect(before.segments).toHaveLength(1);
    expect(before.segments[0]).toMatchObject({
      _id: first.segmentId,
      startDate: "2026-09-20",
      status: "active",
    });
    expect(before.scheduleState?.sourceRevision).toBe(8);
    expect(before.work).toHaveLength(2);
    expect(before.work.every(({ state }) => state === "pending")).toBe(true);

    const repeated = await asPrimary.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: "2026-09-20" },
    );
    const after = await t.run(async (ctx) => ({
      segments: await ctx.db
        .query("cyclePredictionSegments")
        .withIndex("by_user_and_status", (q) => q.eq("userId", primaryId))
        .take(10),
      scheduleState: await ctx.db
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

    expect(repeated.segmentId).toBe(first.segmentId);
    expect(after.segments).toEqual(before.segments);
    expect(after.scheduleState).toEqual(before.scheduleState);
    expect(after.work).toEqual(before.work);
  });

  test("defers replacement schedule work until a current V2 snapshot is refreshed", async () => {
    const now = Date.parse("2026-09-24T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: "UTC" });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-09-20",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.parse("2026-09-20T12:00:00.000Z"),
        updatedAt: Date.parse("2026-09-20T12:00:00.000Z"),
      });
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        createdAt: now,
        updatedAt: now,
      });
      for (const purpose of ["period_window_approaching", "late_status"] as const) {
        await ctx.db.insert("notificationPreferences", {
          userId: primaryId,
          purpose,
          inAppEnabled: true,
          localReminderTime: "09:00",
          reminderWindowVersion: 3,
          updatedAt: now,
        });
      }
      for (const kind of ["prediction_window", "late_boundary"] as const) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind,
          state: "pending",
          dueAt: now + 60_000,
          generation: 7,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    await asPrimary.mutation(api.mutations.cycleContext.createPredictionSegment, {
      startDate: "2026-09-20",
    });

    const afterSegment = await t.run(async (ctx) => ({
      scheduleState: await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
      work: await ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId),
        )
        .take(10),
      snapshots: await ctx.db
        .query("predictionSnapshots")
        .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
        .take(10),
    }));
    expect(afterSegment.scheduleState?.sourceRevision).toBe(8);
    expect(afterSegment.work.map(({ state }) => state)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(afterSegment.snapshots).toEqual([]);

    const pendingBeforeRefresh = await t.run(async (ctx) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId).eq("state", "pending"),
        )
        .take(10),
    );
    expect(pendingBeforeRefresh).toEqual([]);

    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    expect(snapshotId).not.toBeNull();
    const pendingAfterRefresh = await t.run(async (ctx) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId).eq("state", "pending"),
        )
        .take(10),
    );
    expect(pendingAfterRefresh).toHaveLength(2);
    expect(pendingAfterRefresh.map(({ generation }) => generation)).toEqual([
      8,
      8,
    ]);
    expect(pendingAfterRefresh.map(({ kind }) => kind).sort()).toEqual([
      "late_boundary",
      "prediction_window",
    ]);
  });

  test("partners cannot mutate prediction segments", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t);

    await expect(
      asPartner.mutation(api.mutations.cycleContext.createPredictionSegment, {
        startDate: "2026-08-01",
      }),
    ).rejects.toThrow("Only the primary user can update cycle data");
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("cyclePredictionSegments")
          .withIndex("by_user_and_status", (q) =>
            q.eq("userId", primaryId).eq("status", "active"),
          )
          .take(10),
      ),
    ).toEqual([]);
  });

  test("keeps the segment mutation disabled by default", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-01",
        startCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPrimary.mutation(api.mutations.cycleContext.createPredictionSegment, {
        startDate: "2026-08-01",
      }),
    ).rejects.toThrow("PERIOD_PREDICTION_V2_DISABLED");
  });
});
