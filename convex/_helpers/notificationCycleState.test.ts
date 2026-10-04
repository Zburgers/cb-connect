import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import { addCalendarDays } from "./cycleCalculations";
import { readCurrentNotificationCycleState } from "./notificationCycleState";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("current notification cycle state", () => {
  test("enters Late when only the local clock advances beyond the served V2 bound", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t, { fixtureRunId: "n3e-late" });
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: "America/Los_Angeles" });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-03-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.parse("2026-03-01T08:00:00.000Z"),
        updatedAt: Date.parse("2026-03-01T08:00:00.000Z"),
      });
      await ctx.db.insert("cyclePredictionSegments", {
        userId: primaryId,
        startDate: "2026-03-01",
        status: "active",
        createdAt: Date.parse("2026-03-01T08:00:00.000Z"),
      });
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a served V2 snapshot");
    const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    if (!snapshot) throw new Error("Expected a served V2 snapshot");

    const before = await t.run((ctx) =>
      readCurrentNotificationCycleState(
        ctx,
        primaryId,
        Date.parse("2026-03-07T20:00:00.000Z"),
      ),
    );
    expect(before?.state).toMatchObject({
      status: "estimated",
      reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
    });

    const lateInstant = Date.parse(
      `${addCalendarDays(snapshot.latestDate, 1)}T20:00:00.000Z`,
    );
    vi.setSystemTime(lateInstant);
    const after = await t.run((ctx) =>
      readCurrentNotificationCycleState(ctx, primaryId, lateInstant),
    );

    expect(after).toMatchObject({
      localDay: addCalendarDays(snapshot.latestDate, 1),
      sourceRevision: 7,
      state: {
        status: "late_or_uncertain",
        reason: "AFTER_LATEST_BOUND",
      },
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get(snapshotId)).toEqual(snapshot);
      expect(await ctx.db.query("predictionSnapshots").take(5)).toHaveLength(1);
      expect(await ctx.db.query("notificationEvents").take(5)).toEqual([]);
      expect(await ctx.db.query("periodEvents").take(5)).toHaveLength(1);
      expect(
        await ctx.db
          .query("notificationScheduleState")
          .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
          .unique(),
      ).toMatchObject({ sourceRevision: 7 });
    });
  });
});
