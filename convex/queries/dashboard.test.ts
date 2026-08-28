import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dashboard cycle state read model", () => {
  test("flag off preserves the existing cycleInfo contract and omits v1 state", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-02-01",
    });

    expect(result.cycleInfo).toMatchObject({
      cycleDay: 4,
      phase: "menstruation",
    });
    expect(result.cycleStateV1).toBeNull();
    expect(result.cycleStateV1Exposed).toBe(false);
  });

  test("flag on records exact coverage and ignores approximate and tombstoned rows", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        startCertainty: "exact",
        endCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-10",
        startCertainty: "approximate",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-11",
        startCertainty: "exact",
        authorityVersion: 1,
        tombstoneByUserId: primaryId,
        tombstoneAt: 123,
        tombstoneAuthorityVersion: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-03",
    });

    expect(result.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
      cycleDay: 3,
    });
  });

  test("does not record an approximate end after the exact start", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        endDate: "2026-01-05",
        startCertainty: "exact",
        endCertainty: "approximate",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-03",
    });

    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
    });
    expect(result.cycleStateV1).not.toHaveProperty("coveringEventId");
  });

  test("flag on keeps an open event estimated instead of inferring its end", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-06",
    });

    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 6,
    });
  });

  test("flag on records an exact open start only on its observed date", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const startDay = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-01",
    });
    expect(startDay.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
      cycleDay: 1,
    });

    const laterDay = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-06",
    });
    expect(laterDay.cycleStateV1).toMatchObject({
      status: "estimated",
      evidence: "CALENDAR_ESTIMATE",
      cycleDay: 6,
    });
  });

  test("flag on suppresses phase guidance after the local Late boundary", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-02-02",
    });

    expect(result.cycleStateV1).toMatchObject({ status: "late_or_uncertain" });
    expect(result.cycleInfo).toBeNull();
    expect(result.painTip).toBeNull();
    expect(result.nutritionTips).toEqual([]);
  });

  test("does not expose cycle state to a partner when phase sharing is off", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: false,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-06",
    });

    expect(result.cycleStateV1).toBeNull();
    expect(result.cycleStateV1Exposed).toBe(true);
    expect(result.cycleInfo).toBeNull();
  });

  test("projects partner cycle state at the query boundary", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        startCertainty: "exact",
        endCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-03",
    });

    expect(result.cycleStateV1).toMatchObject({
      status: "recorded_period",
      evidence: "RECORDED_EXACT",
    });
    expect(result.cycleStateV1Exposed).toBe(true);
    expect(result.cycleInfo).toBeNull();
    expect(result.painTip).toBeNull();
    expect(result.nutritionTips).toEqual([]);
    expect(result.cycleStateV1).not.toHaveProperty("coveringEventId");
    expect(JSON.stringify(result.cycleStateV1)).not.toMatch(
      /coveringEventId|periodEvent|startDate|endDate|tombstone|userId/
    );
  });

  test("flag-off compatibility reads ignore a newer Gate 1 tombstone", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "false");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-20",
        startCertainty: "exact",
        authorityVersion: 2,
        tombstoneByUserId: primaryId,
        tombstoneAt: 123,
        tombstoneAuthorityVersion: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-21",
    });

    expect(result.cycleStateV1).toBeNull();
    expect(result.cycleInfo).toMatchObject({
      cycleDay: 21,
      phase: "luteal",
    });
  });

  test("Gate 2 remains fail-closed when Gate 1 capability is off", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        startCertainty: "exact",
        endCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-03",
    });

    expect(result.cycleStateV1).toBeNull();
    expect(result.cycleInfo).toMatchObject({ cycleDay: 3 });
  });

  test("ordinary users receive no Gate 2 state while D-011 exposure is closed", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t, {
      fixtureRunId: null,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        startCertainty: "exact",
        endCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-03",
    });

    expect(result.cycleStateV1).toBeNull();
    expect(result.cycleStateV1Exposed).toBe(false);
  });

  test("keeps revoked fixture partners without cycle payload", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, coupleId, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { status: "revoked" });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-01-01",
    });

    expect(result.cycleStateV1Exposed).toBe(false);
    expect(result.cycleStateV1).toBeNull();
    expect(result.hasData).toBe(false);
  });
});
