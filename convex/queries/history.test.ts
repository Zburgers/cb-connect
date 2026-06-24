import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

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
    expect(timeline[0]).toMatchObject({
      type: "period",
      period: {
        id: eventId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        createdByName: "Partner Person",
        updatedByName: "Partner Person",
        canCorrect: false,
      },
    });
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
