import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import { addCalendarDays } from "../_helpers/cycleCalculations";
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

  test("Gate 3 prediction flags off preserves the Gate 2 V1 dashboard output", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "false");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "false");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    const periodId = await t.run(async (ctx) => {
      return ctx.db.insert("periodEvents", {
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

    expect(result.cycleStateV1).toEqual({
      version: 1,
      status: "recorded_period",
      phase: "menstruation",
      evidence: "RECORDED_EXACT",
      cycleDay: 3,
      coveringEventId: periodId,
      reason: "CONFIRMED_EVENT_COVERS_TODAY",
    });
    expect(result.cycleInfo).toEqual({
      phase: "menstruation",
      cycleDay: 3,
      daysUntilNextPeriod: 26,
      predictedNextPeriodStart: "2026-01-29",
      predictedNextPeriodEnd: "2026-02-02",
      phaseDescription: "Recorded period",
    });
  });

  test("serves primary V2 prediction through Gate 2 without leaking the legacy exact date", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      for (const [index, startDate] of [
        "2026-06-01",
        "2026-06-29",
        "2026-07-27",
        "2026-08-24",
      ].entries()) {
        await ctx.db.insert("periodEvents", {
          userId: primaryId,
          startDate,
          startCertainty: "exact",
          source: "self",
          confirmationStatus: "confirmed",
          authorityVersion: 1,
          createdAt: Date.now() - 1_000 + index,
          updatedAt: Date.now() - 1_000 + index,
        });
      }
      await ctx.db.insert("painTips", {
        phase: "menstruation",
        painSeverity: "none",
        title: "Gentle movement",
        suggestions: ["Try a short walk"],
        safetyNote: "Choose what feels comfortable.",
        isActive: true,
        priority: 1,
      });
      await ctx.db.insert("nutritionTips", {
        phase: "menstruation",
        foodItem: "Lentils",
        reasoning: "A varied meal can support everyday nutrition.",
        isActive: true,
        priority: 1,
      });
    });

    await asPrimary.mutation(api.mutations.predictionSnapshots.ensureForViewer, {});

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.cycleInfo).toBeNull();
    expect(result.painTip).toMatchObject({ title: "Gentle movement" });
    expect(result.nutritionTips).toContainEqual(
      expect.objectContaining({ foodItem: "Lentils" }),
    );
    expect(result.periodPredictionV2).toMatchObject({
      status: "limited_evidence",
      pointDate: "2026-09-21",
      earliestDate: "2026-09-21",
      latestDate: "2026-09-24",
      probabilityLabel: null,
      estimatorId: "configured_v1",
      basisCount: 3,
    });
    const snapshot = await t.run(async (ctx) =>
      ctx.db
        .query("predictionSnapshots")
        .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
        .order("desc")
        .first(),
    );
    expect(snapshot?.predictionSegmentId).toBe("default_all_history_v1");
    expect(result.periodPredictionV2).toMatchObject({ snapshotId: snapshot?._id });
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 2, pointDate: "2026-09-21" },
    });
  });

  test("keeps V2 and Gate 2 on the same anchor beyond the bounded legacy window", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      let startDate = "2026-05-01";
      for (let index = 0; index < 105; index += 1) {
        await ctx.db.insert("periodEvents", {
          userId: primaryId,
          startDate,
          startCertainty: "approximate",
          source: "self",
          confirmationStatus: "confirmed",
          authorityVersion: 1,
          createdAt: index + 2,
          updatedAt: index + 2,
        });
        startDate = addCalendarDays(startDate, 1);
      }
    });

    await asPrimary.mutation(api.mutations.predictionSnapshots.ensureForViewer, {});

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-02-01",
    });

    expect(result.periodPredictionV2).toMatchObject({
      status: "configured",
      pointDate: "2026-01-29",
      basisCount: 0,
    });
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 2, pointDate: result.periodPredictionV2?.pointDate },
    });
  });

  test("keeps a V2 prediction visible when the bounded history contains only tombstones", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-01-01",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      let startDate = "2026-05-01";
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("periodEvents", {
          userId: primaryId,
          startDate,
          startCertainty: "exact",
          source: "self",
          confirmationStatus: "confirmed",
          authorityVersion: 1,
          tombstoneByUserId: primaryId,
          tombstoneAt: index + 2,
          tombstoneAuthorityVersion: 2,
          createdAt: index + 2,
          updatedAt: index + 2,
        });
        startDate = addCalendarDays(startDate, 1);
      }
    });

    await asPrimary.mutation(api.mutations.predictionSnapshots.ensureForViewer, {});

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-02-01",
    });

    expect(result.hasData).toBe(true);
    expect(result.periodPredictionV2).toMatchObject({
      status: "configured",
      pointDate: "2026-01-29",
    });
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 2, pointDate: "2026-01-29" },
    });
  });

  test("does not expose primary V2 prediction details to partner dashboard reads", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-24",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: Date.now() - 1_000,
        updatedAt: Date.now() - 1_000,
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result).not.toHaveProperty("periodPredictionV2");
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 1 },
    });
  });

  test("returns only the partner V2 allowlist when both flags and sharing allow it", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "false");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
    });
    const starts = [
      "2026-06-01",
      "2026-06-29",
      "2026-07-27",
      "2026-08-24",
    ];

    await t.run(async (ctx) => {
      for (const [index, startDate] of starts.entries()) {
        await ctx.db.insert("periodEvents", {
          userId: primaryId,
          startDate,
          ...(startDate === "2026-08-24"
            ? { endDate: "2026-08-26", endCertainty: "exact" as const }
            : {}),
          startCertainty: "exact",
          source: "self",
          confirmationStatus: "confirmed",
          authorityVersion: 1,
          createdAt: Date.now() - starts.length + index,
          updatedAt: Date.now() - starts.length + index,
        });
      }
    });

    expect(
      await asPartner.mutation(
        api.mutations.predictionSnapshots.ensureForViewer,
        {},
      ),
    ).toBeNull();

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.partnerPredictionV2Exposed).toBe(true);
    expect(result.partnerPredictionV2).toMatchObject({
      version: 2,
      status: "estimated",
      timingStatus: "recorded_period",
      pointDate: "2026-09-21",
      earliestDate: "2026-09-21",
      latestDate: "2026-09-24",
      quality: "limited_evidence",
      basisBand: "broader",
    });
    expect(Object.keys(result.partnerPredictionV2 ?? {}).sort()).toEqual(
      [
        "version",
        "status",
        "timingStatus",
        "pointDate",
        "earliestDate",
        "latestDate",
        "quality",
        "basisBand",
      ].sort(),
    );
    expect(result).not.toHaveProperty("periodPredictionV2");
    expect(result.cycleStateV1).toBeNull();
    expect(JSON.stringify(result.partnerPredictionV2)).not.toMatch(
      /snapshotId|estimator|calibration|reasonCodes|basisCount|periodEvents|userId|privateContext/,
    );
  });

  test("keeps the partner V2 projection hidden when the partner flag is off", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "false");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-24",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.partnerPredictionV2Exposed).toBe(false);
    expect(result).not.toHaveProperty("partnerPredictionV2");
    expect(result).not.toHaveProperty("periodPredictionV2");
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 1 },
    });
  });

  test("requires the global prediction flag as well as the partner flag", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "false");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-24",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.partnerPredictionV2Exposed).toBe(false);
    expect(result).not.toHaveProperty("partnerPredictionV2");
    expect(result).not.toHaveProperty("periodPredictionV2");
    expect(result.cycleStateV1).toMatchObject({
      status: "estimated",
      bounds: { version: 1 },
    });
  });

  test("returns a reduced unavailable partner projection without suggesting they log", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, { sharingPhase: true });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {});

    expect(result.hasData).toBe(false);
    expect(result.message).toBe(
      "A shared timing estimate is not available yet.",
    );
    expect(result.partnerPredictionV2Exposed).toBe(true);
    expect(result.partnerPredictionV2).toMatchObject({
      status: "unavailable",
      timingStatus: "insufficient_data",
      pointDate: null,
      earliestDate: null,
      latestDate: null,
      basisBand: "limited",
    });
    expect(result).not.toHaveProperty("periodPredictionV2");
  });

  test("hides partner V2 prediction when phase sharing is disabled", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_PARTNER_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: false,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-24",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.partnerPredictionV2Exposed).toBe(false);
    expect(result.hasData).toBe(false);
    expect(result).not.toHaveProperty("partnerPredictionV2");
    expect(result).not.toHaveProperty("periodPredictionV2");
    expect(result.cycleInfo).toBeNull();
    expect(result.cycleStateV1).toBeNull();
    expect(result.message).toBe("Cycle timing is not shared right now.");
  });

  test("keeps independently shared pain visible while cycle timing stays private", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, coupleId } = await seedActiveCouple(t, {
      sharingPhase: false,
    });

    await t.run(async (ctx) => {
      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary")
        )
        .first();
      expect(primaryMembership).not.toBeNull();
      await ctx.db.patch(primaryMembership!._id, { sharingPain: true });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-24",
        startCertainty: "exact",
        source: "self",
        confirmationStatus: "confirmed",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("painLogs", {
        userId: primaryId,
        date: "2026-08-25",
        painScore: 4,
        tags: ["cramps"],
        note: "private note",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asPartner.query(api.queries.dashboard.getDashboardData, {
      todayDate: "2026-08-25",
    });

    expect(result.hasData).toBe(true);
    expect(result.painData).toMatchObject({ score: 4 });
    expect(result.painData).not.toHaveProperty("tags");
    expect(result.painData).not.toHaveProperty("note");
    expect(result.cycleInfo).toBeNull();
    expect(result.cycleStateV1).toBeNull();
    expect(result.partnerPredictionV2Exposed).toBe(false);
    expect(result).not.toHaveProperty("partnerPredictionV2");
    expect(result).not.toHaveProperty("periodPredictionV2");
  });

  test("returns an unavailable V2 contract when the primary has no eligible start", async () => {
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    const result = await asPrimary.query(api.queries.dashboard.getDashboardData, {});

    expect(result.hasData).toBe(false);
    expect(result.periodPredictionV2).toMatchObject({
      status: "unavailable",
      pointDate: null,
      probabilityLabel: null,
    });
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
