import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import {
  addCalendarDays,
} from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

describe("period date boundaries", () => {
  test("accepts today's date for direct self logging", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const today = toCalendarDateInTimeZone(new Date(), "UTC");

    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      { startDate: today }
    );

    const event = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", result.eventId);
    });
    expect(event).toMatchObject({
      userId: primaryId,
      startDate: today,
    });
  });

  test("rejects tomorrow across every public period write path", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });
    const today = toCalendarDateInTimeZone(new Date(), "UTC");
    const tomorrow = addCalendarDays(today, 1);
    const pastStart = addCalendarDays(today, -5);

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: pastStart,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: tomorrow,
      })
    ).rejects.toThrow("Start date cannot be in the future");

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodStart, {
        startDate: tomorrow,
      })
    ).rejects.toThrow("Start date cannot be in the future");

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodEnd, {
        endDate: tomorrow,
      })
    ).rejects.toThrow("End date cannot be in the future");

    await expect(
      asPartner.mutation(api.mutations.periods.assistLogPeriodEnd, {
        endDate: tomorrow,
      })
    ).rejects.toThrow("End date cannot be in the future");

    await expect(
      asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: eventId,
        startDate: tomorrow,
      })
    ).rejects.toThrow("Start date cannot be in the future");

    await expect(
      asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: eventId,
        startDate: pastStart,
        endDate: tomorrow,
      })
    ).rejects.toThrow("End date cannot be in the future");
  });

  test("rejects a distant future date and still accepts valid past corrections", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const today = toCalendarDateInTimeZone(new Date(), "UTC");
    const originalStart = addCalendarDays(today, -10);
    const correctedStart = addCalendarDays(today, -8);
    const correctedEnd = addCalendarDays(today, -4);

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: "2099-01-01",
      })
    ).rejects.toThrow("Start date cannot be in the future");

    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: originalStart,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: eventId,
      startDate: correctedStart,
      endDate: correctedEnd,
    });

    const corrected = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(corrected).toMatchObject({
      startDate: correctedStart,
      endDate: correctedEnd,
    });
  });
});
