import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";

export const logPeriodStart = mutation({
  args: {
    startDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Check for ongoing periods - close them first
    const ongoingPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("endDate"), undefined))
      .first();

    if (ongoingPeriod) {
      // Auto-end the ongoing period the day before new one starts
      const endDate = new Date(args.startDate + "T00:00:00");
      endDate.setDate(endDate.getDate() - 1);
      await ctx.db.patch(ongoingPeriod._id, {
        endDate: endDate.toISOString().split("T")[0],
        updatedAt: Date.now(),
      });
    }

    const eventId = await ctx.db.insert("periodEvents", {
      userId: user._id,
      startDate: args.startDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { eventId };
  },
});

export const logPeriodEnd = mutation({
  args: {
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const ongoingPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("endDate"), undefined))
      .first();

    if (!ongoingPeriod) {
      throw new Error("No ongoing period to end");
    }

    if (args.endDate < ongoingPeriod.startDate) {
      throw new Error("End date cannot be before start date");
    }

    await ctx.db.patch(ongoingPeriod._id, {
      endDate: args.endDate,
      updatedAt: Date.now(),
    });

    return { eventId: ongoingPeriod._id };
  },
});

export const autoEndPeriods = internalMutation({
  handler: async (ctx) => {
    // Find all ongoing (open) periods
    const openPeriods = await ctx.db
      .query("periodEvents")
      .filter((q) => q.eq(q.field("endDate"), undefined))
      .collect();

    let endedCount = 0;

    for (const period of openPeriods) {
      // Get the user's cycle settings
      const settings = await ctx.db
        .query("cycleSettings")
        .withIndex("by_user", (q) => q.eq("userId", period.userId))
        .unique();

      const periodLength = settings?.periodLength ?? 5;

      // Calculate expected end date
      const startDate = new Date(period.startDate + "T00:00:00");
      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + periodLength - 1);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // If past the expected end date, auto-close it
      if (expectedEndDate < today) {
        const endDateStr = expectedEndDate.toISOString().split("T")[0];
        await ctx.db.patch(period._id, {
          endDate: endDateStr,
          updatedAt: Date.now(),
        });
        endedCount++;
      }
    }

    console.log(`autoEndPeriods: closed ${endedCount} open period(s)`);
    return { endedCount };
  },
});

export const updateCycleSettings = mutation({
  args: {
    cycleLength: v.optional(v.number()),
    periodLength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (args.cycleLength !== undefined) {
      if (args.cycleLength < 21 || args.cycleLength > 40) {
        throw new Error("Cycle length must be between 21 and 40 days");
      }
    }

    if (args.periodLength !== undefined) {
      if (args.periodLength < 2 || args.periodLength > 8) {
        throw new Error("Period length must be between 2 and 8 days");
      }
    }

    const existing = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.cycleLength !== undefined && {
          cycleLength: args.cycleLength,
        }),
        ...(args.periodLength !== undefined && {
          periodLength: args.periodLength,
        }),
        lastUpdatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("cycleSettings", {
        userId: user._id,
        cycleLength: args.cycleLength ?? 28,
        periodLength: args.periodLength ?? 5,
        lastUpdatedAt: Date.now(),
      });
    }
  },
});
