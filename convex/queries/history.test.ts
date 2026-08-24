import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
});

describe("period history attribution", () => {
  test("legacy events render with safe defaults and owner correction", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const history = await asPrimary.query(api.queries.history.getPeriodHistory, {});

    expect(history[0]).toMatchObject({
      source: "self",
      confirmationStatus: "confirmed",
      createdByUserId: primaryId,
      updatedByUserId: primaryId,
      createdByName: "Primary Person",
      updatedByName: "Primary Person",
      canCorrect: true,
    });
  });

  test("partner visibility and timeline metadata use primary sharing settings", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const history = await asPartner.query(api.queries.history.getPeriodHistory, {});
    const timeline = await asPartner.query(api.queries.history.getTimelineHistory, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(history[0]).toMatchObject({
      _id: eventId,
      source: "partner_assist",
      createdByName: "Partner Person",
      canCorrect: false,
    });
    expect(history[0]).not.toHaveProperty("userId");
    expect(history[0]).not.toHaveProperty("createdByUserId");
    expect(history[0]).not.toHaveProperty("updatedByUserId");
    expect(history[0]).not.toHaveProperty("_creationTime");
    expect(history[0]).not.toHaveProperty("createdAt");
    expect(history[0]).not.toHaveProperty("updatedAt");
    expect(history[0]).not.toHaveProperty("tombstoneByUserId");
    expect(history[0]).toHaveProperty("authorityVersion");
    expect(timeline[0]).toMatchObject({
      type: "period",
      period: {
        id: eventId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        createdByName: "Partner Person",
        updatedByName: "Partner Person",
        createdByViewer: true,
        updatedByViewer: true,
        canCorrect: false,
      },
    });
    expect(timeline[0].period).not.toHaveProperty("userId");
    expect(timeline[0].period).not.toHaveProperty("createdByUserId");
    expect(timeline[0].period).not.toHaveProperty("updatedByUserId");
    expect(timeline[0].period).not.toHaveProperty("_creationTime");
    expect(timeline[0].period).not.toHaveProperty("createdAt");
    expect(timeline[0].period).not.toHaveProperty("updatedAt");
  });

  test("partner receives no period history when phase sharing is disabled", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: false,
      sharingPeriodWrite: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    expect(
      await asPartner.query(api.queries.history.getPeriodHistory, {})
    ).toEqual([]);
  });
});

describe("fact-aware history and prediction reads", () => {
  test("flag-off prediction keeps the newest legacy row without certainty", async () => {
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-07-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-01",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const prediction = await t.query(
      internal.queries.history.getPredictionInputsForUser,
      { userId: primaryId }
    );

    expect(prediction).toMatchObject({ recentPeriodStart: "2026-08-01" });
  });

  test("keeps uncertain history visible but excludes it from prediction", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-07-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-08-01",
        startCertainty: "approximate",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-09-01",
        startCertainty: "exact",
        authorityVersion: 1,
        tombstoneByUserId: primaryId,
        tombstoneAt: 2,
        tombstoneAuthorityVersion: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const history = await asPrimary.query(api.queries.history.getPeriodHistory, {});
    const prediction = await t.query(
      internal.queries.history.getPredictionInputsForUser,
      { userId: primaryId }
    );

    expect(history.map((period) => period.startDate)).toEqual([
      "2026-08-01",
      "2026-07-01",
    ]);
    expect(history[0]).toMatchObject({ certainty: "approximate" });
    expect(prediction).toMatchObject({ recentPeriodStart: "2026-07-01" });
  });

  test("keeps partner phase-sharing boundaries server-side", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: false,
      sharingPeriodWrite: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-07-01",
        startCertainty: "approximate",
        authorityVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    expect(
      await asPartner.query(api.queries.history.getPeriodHistory, {})
    ).toEqual([]);
  });
});
