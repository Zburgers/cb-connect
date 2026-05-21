import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { calculateCycleInfo } from "../_helpers/cycleCalculations";

export const getPainHistory = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    let targetUserId = user._id;
    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return [];
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership?.sharingPain) {
        return [];
      }

      targetUserId = primaryMembership.userId;
    }

    const logs = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).gte("date", args.startDate)
      )
      .filter((q) => q.lte(q.field("date"), args.endDate))
      .collect();

    return logs;
  },
});

export const getPeriodHistory = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    let targetUserId = user._id;
    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return [];
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership?.sharingPhase) {
        return [];
      }

      targetUserId = primaryMembership.userId;
    }

    const periods = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .collect();

    return periods;
  },
});

export const getCycleSettings = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return { cycleLength: 28, periodLength: 5 };
    }

    const settings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return settings ?? { cycleLength: 28, periodLength: 5 };
  },
});

export const getPredictionInputsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const recentPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    if (!recentPeriod) {
      return null;
    }

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    return {
      cycleLength,
      periodLength,
      recentPeriodStart: recentPeriod.startDate,
      cycleInfo: calculateCycleInfo(
        recentPeriod.startDate,
        cycleLength,
        periodLength
      ),
    };
  },
});
