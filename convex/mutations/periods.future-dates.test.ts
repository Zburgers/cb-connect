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
      { startDate: today, timeZone: "UTC" }
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
    await t.run(async (ctx) => {
      const primary = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "primary-clerk"))
        .unique();
      if (!primary) {
        throw new Error("Primary fixture user was not found");
      }
      await ctx.db.patch(primary._id, { timeZone: "UTC" });
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
        timeZone: "UTC",
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
        timeZone: "UTC",
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
        timeZone: "UTC",
      })
    ).rejects.toThrow("Start date cannot be in the future");

    await expect(
      asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: eventId,
        startDate: pastStart,
        endDate: tomorrow,
        timeZone: "UTC",
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
        timeZone: "UTC",
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
      timeZone: "UTC",
    });

    const corrected = await t.run(async (ctx) => {
      return await ctx.db.get("periodEvents", eventId);
    });
    expect(corrected).toMatchObject({
      startDate: correctedStart,
      endDate: correctedEnd,
    });
  });

  test("rejects an identified primary write without a timezone", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: undefined });
    });
    const today = toCalendarDateInTimeZone(new Date(), "UTC");

    await expect(
      asPrimary.mutation(api.mutations.periods.logPeriodStart, {
        startDate: today,
      })
    ).rejects.toThrow("Time zone is required for an identified user");
  });

  test("preserves date-only values when the stored timezone changes", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const startDate = "2026-08-05";

    const result = await asPrimary.mutation(
      api.mutations.periods.logPeriodStart,
      { startDate, timeZone: "Asia/Kolkata" }
    );
    await asPrimary.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: result.eventId,
      startDate,
      timeZone: "America/Los_Angeles",
    });

    const [event, user] = await t.run(async (ctx) => {
      return await Promise.all([
        ctx.db.get("periodEvents", result.eventId),
        ctx.db.get("users", primaryId),
      ]);
    });
    expect(event?.startDate).toBe(startDate);
    expect(user?.timeZone).toBe("America/Los_Angeles");
  });
});
