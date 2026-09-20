import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
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
