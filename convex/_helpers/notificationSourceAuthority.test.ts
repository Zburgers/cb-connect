import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  advanceNotificationSourceAuthority,
  initializeNotificationSourceAuthority,
  makeSourceAuthorityVersion,
} from "./notificationSourceAuthority";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

describe("G4-SOURCE-V1 canonical authority", () => {
  test("includes source revision and served method contracts, but ignores refresh metadata", () => {
    const first = makeSourceAuthorityVersion({
      sourceRevision: 5,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v3",
      calibrationMethodVersion: "calibrate-v2",
      snapshotId: "predictionSnapshots:old",
      generatedAt: 10,
      refreshedAt: 11,
      localDay: "2026-10-04",
      rawInputHash: "do-not-store",
      providerVersion: "future-provider",
      templateVersion: "future-template",
      cycleStateSchemaVersion: 1,
      snapshotContractVersion: 2,
    });
    const incidentalRefresh = makeSourceAuthorityVersion({
      sourceRevision: 5,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v3",
      calibrationMethodVersion: "calibrate-v2",
      snapshotId: "predictionSnapshots:new",
      generatedAt: 99,
      refreshedAt: 100,
      localDay: "2026-10-05",
      rawInputHash: "changed-secret",
      providerVersion: "another-provider",
      templateVersion: "another-template",
      cycleStateSchemaVersion: 4,
      snapshotContractVersion: 7,
    });

    expect(first).toBe("g4-source-v1:[5,\"cycle-read-model-v1\",\"prediction-serving-v2\",\"estimate-v3\",\"calibrate-v2\"]");
    expect(incidentalRefresh).toBe(first);
    expect(
      makeSourceAuthorityVersion({
        sourceRevision: 6,
        servedCycleContract: "cycle-read-model-v1",
        servedPredictionContract: "prediction-serving-v2",
        estimatorMethodVersion: "estimate-v3",
        calibrationMethodVersion: "calibrate-v2",
      }),
    ).not.toBe(first);
    expect(
      makeSourceAuthorityVersion({
        sourceRevision: 5,
        servedCycleContract: "cycle-read-model-v2",
        servedPredictionContract: "prediction-serving-v2",
        estimatorMethodVersion: "estimate-v3",
        calibrationMethodVersion: "calibrate-v2",
      }),
    ).not.toBe(first);
    expect(
      makeSourceAuthorityVersion({
        sourceRevision: 5,
        servedCycleContract: "cycle-read-model-v1",
        servedPredictionContract: "prediction-serving-v2",
        estimatorMethodVersion: "estimate-v4",
        calibrationMethodVersion: "calibrate-v2",
      }),
    ).not.toBe(first);
    expect(
      makeSourceAuthorityVersion({
        sourceRevision: 5,
        servedCycleContract: "cycle-read-model-v1",
        servedPredictionContract: "prediction-serving-v2",
        estimatorMethodVersion: "estimate-v3",
        calibrationMethodVersion: "calibrate-v3",
      }),
    ).not.toBe(first);
  });

  test("rejects malformed revisions and contract versions", () => {
    const explicitNoPrediction = {
      servedPredictionContract: null,
      estimatorMethodVersion: null,
      calibrationMethodVersion: null,
    } as const;
    expect(() => makeSourceAuthorityVersion({ sourceRevision: Number.NaN, servedCycleContract: "cycle-read-model-v1", ...explicitNoPrediction })).toThrow();
    expect(() => makeSourceAuthorityVersion({ sourceRevision: -1, servedCycleContract: "cycle-read-model-v1", ...explicitNoPrediction })).toThrow();
    expect(() => makeSourceAuthorityVersion({ sourceRevision: 0.5, servedCycleContract: "cycle-read-model-v1", ...explicitNoPrediction })).toThrow();
    expect(() => makeSourceAuthorityVersion({ sourceRevision: 0, servedCycleContract: "cycle-read-model-v1", servedPredictionContract: "2", estimatorMethodVersion: "estimate-v1", calibrationMethodVersion: null })).toThrow();
    expect(() => makeSourceAuthorityVersion({ sourceRevision: 0, servedCycleContract: "", ...explicitNoPrediction })).toThrow();
    expect(() => makeSourceAuthorityVersion({ sourceRevision: 0, servedCycleContract: "cycle-read-model-v1" } as never)).toThrow();
    expect(() => makeSourceAuthorityVersion({
      sourceRevision: 0,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: null,
      estimatorMethodVersion: "estimate-v1",
      calibrationMethodVersion: null,
    } as never)).toThrow();
    expect(() => makeSourceAuthorityVersion({
      sourceRevision: 0,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: null,
      calibrationMethodVersion: null,
    } as never)).toThrow();
  });
});

describe("transactional notification source revision", () => {
  test("flags-off fresh installs have no metadata; first opt-in initializes once without backfill", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "false");
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run((ctx) =>
      ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 1,
        updatedAt: 100,
      }),
    );

    expect(
      await t.run((ctx) => initializeNotificationSourceAuthority(ctx, primaryId, 100)),
    ).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationScheduleState").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
    });

    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    const initialized = await t.run((ctx) =>
      initializeNotificationSourceAuthority(ctx, primaryId, 200),
    );
    const replayed = await t.run((ctx) =>
      initializeNotificationSourceAuthority(ctx, primaryId, 300),
    );
    expect(initialized).toMatchObject({ sourceRevision: 0, createdAt: 200, updatedAt: 200 });
    expect(replayed?._id).toBe(initialized?._id);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationScheduleState").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
    });
  });

  test("equal wall-clock times and concurrent relevant transitions still advance uniquely", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run((ctx) =>
      ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 1,
        updatedAt: 500,
      }),
    );
    await t.run((ctx) => initializeNotificationSourceAuthority(ctx, primaryId, 500));

    const revisions = await Promise.all([
      t.run((ctx) => advanceNotificationSourceAuthority(ctx, primaryId, 900)),
      t.run((ctx) => advanceNotificationSourceAuthority(ctx, primaryId, 900)),
    ]);

    expect(revisions.map((row) => row?.sourceRevision).sort()).toEqual([1, 2]);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique();
      expect(row?.sourceRevision).toBe(2);
      expect(row?.updatedAt).toBe(900);
    });
  });

  test("failed domain transactions roll back the source revision and flags-off advances do not backfill", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    expect(
      await t.run((ctx) => advanceNotificationSourceAuthority(ctx, primaryId, 1)),
    ).toBeNull();
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    await t.run((ctx) =>
      ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 1,
        updatedAt: 1,
      }),
    );
    await t.run((ctx) => initializeNotificationSourceAuthority(ctx, primaryId, 1));

    await expect(
      t.run(async (ctx) => {
        await advanceNotificationSourceAuthority(ctx, primaryId, 2);
        throw new Error("abort source transaction");
      }),
    ).rejects.toThrow("abort source transaction");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique();
      expect(row?.sourceRevision).toBe(0);
      expect(row?.updatedAt).toBe(1);
    });
  });

  test("rejects partner-owned source metadata", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    const t = convexTest(schema, modules);
    const { partnerId } = await seedActiveCouple(t);

    await expect(
      t.run((ctx) => initializeNotificationSourceAuthority(ctx, partnerId, 1)),
    ).rejects.toThrow(/primary/i);
  });
});
