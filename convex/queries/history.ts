import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "../_helpers/auth";

export const getPainHistory = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const logs = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).gte("date", args.startDate)
      )
      .filter((q) => q.lte(q.field("date"), args.endDate))
      .collect();

    return logs;
  },
});

export const getPeriodHistory = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const periods = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return periods;
  },
});

export const getCycleSettings = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const settings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return settings ?? { cycleLength: 28, periodLength: 5 };
  },
});
