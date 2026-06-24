import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

describe("partner-assisted period logging", () => {
  test("partner cannot use primary-only self logging or cycle settings", async () => {
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    await expect(
      asPartner.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.logPeriodEnd, {
        endDate: "2026-06-24",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.updateCycleSettings, {
        cycleLength: 30,
      })
    ).rejects.toThrow("Only the primary user");
  });

  test("partner cannot assist-log without an active couple", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "partner-clerk",
      name: "Partner Person",
      role: "partner",
    });
    const asPartner = t.withIdentity({ subject: "partner-clerk" });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("active couple");
  });

  test.each([
    {
      sharingPhase: false,
      sharingPeriodWrite: false,
      error: "Period history is not shared",
    },
    {
      sharingPhase: true,
      sharingPeriodWrite: false,
      error: "Assisted period logging is not enabled",
    },
  ])(
    "partner cannot assist-log without required sharing permissions",
    async ({ sharingPhase, sharingPeriodWrite, error }) => {
      const t = convexTest(schema, modules);
      const { asPartner } = await seedActiveCouple(t, {
        sharingPhase,
        sharingPeriodWrite,
      });

      await expect(
        asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
          startDate: "2026-06-20",
        })
      ).rejects.toThrow(error);
    }
  );

  test("assisted start writes the primary cycle with partner attribution", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    const result = await asPartner.mutation(
      api.mutations.periods.assistLogPeriodStart,
      { startDate: "2026-06-20" }
    );

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });
    expect(event).toMatchObject({
      userId: primaryId,
      startDate: "2026-06-20",
      createdByUserId: partnerId,
      updatedByUserId: partnerId,
      source: "partner_assist",
      confirmationStatus: "confirmed",
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.query("notificationLog").first();
    });
    expect(notification).toMatchObject({
      userId: primaryId,
      type: "partner_assisted_period_start",
      payload: {
        startDate: "2026-06-20",
        partnerName: "Partner Person",
      },
      status: "sent",
    });
  });

  test("assisted start closes an existing primary period the day before", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const existingId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-01",
        createdByUserId: primaryId,
        updatedByUserId: primaryId,
        source: "self",
        confirmationStatus: "confirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
      startDate: "2026-06-20",
    });

    const existing = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", existingId);
    });
    expect(existing).toMatchObject({
      endDate: "2026-06-19",
      updatedByUserId: partnerId,
    });
  });

  test("assisted start rejects a date that would end the open period before it began", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: "2026-06-20",
      })
    ).rejects.toThrow("after the current period start");
  });

  test("assisted end updates the primary user's open period", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdByUserId: primaryId,
        updatedByUserId: primaryId,
        source: "self",
        confirmationStatus: "confirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
      endDate: "2026-06-24",
    });

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(event).toMatchObject({
      endDate: "2026-06-24",
      source: "self",
      updatedByUserId: partnerId,
    });
  });

  test("primary self logging keeps self attribution", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    const result = await asPrimary.mutation(api.mutations.periods.logPeriodStart, {
      startDate: "2026-06-20",
    });
    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });

    expect(event).toMatchObject({
      userId: primaryId,
      createdByUserId: primaryId,
      updatedByUserId: primaryId,
      source: "self",
      confirmationStatus: "confirmed",
    });
  });
});

describe("period corrections", () => {
  test("partner cannot update or delete the primary user's period event", async () => {
    const t = convexTest(schema, modules);
    const { asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-06-20",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPartner.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: eventId,
        startDate: "2026-06-19",
      })
    ).rejects.toThrow("Only the primary user");
    await expect(
      asPartner.mutation(api.mutations.periods.deletePeriodEvent, {
        periodEventId: eventId,
      })
    ).rejects.toThrow("Only the primary user");
  });

  test("primary can correct and delete an assisted event", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
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

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: eventId,
      startDate: "2026-06-19",
      endDate: "2026-06-23",
    });

    const corrected = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(corrected).toMatchObject({
      startDate: "2026-06-19",
      endDate: "2026-06-23",
      source: "partner_assist",
      updatedByUserId: primaryId,
      confirmationStatus: "confirmed",
    });

    await asPrimary.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: eventId,
    });
    expect(
      await t.run(async (ctx) => await ctx.db.get("periodEvents", eventId))
    ).toBeNull();
  });
});
