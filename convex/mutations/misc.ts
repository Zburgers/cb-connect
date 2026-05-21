import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";

export const hideNutritionTip = mutation({
  args: {
    nutritionTipId: v.id("nutritionTips"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Check if already hidden
    const existing = await ctx.db
      .query("hiddenNutrition")
      .withIndex("by_user_and_tip", (q) =>
        q.eq("userId", user._id).eq("nutritionTipId", args.nutritionTipId)
      )
      .first();

    if (existing) {
      // Refresh the hide duration
      await ctx.db.patch(existing._id, {
        hiddenUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      return;
    }

    await ctx.db.insert("hiddenNutrition", {
      userId: user._id,
      nutritionTipId: args.nutritionTipId,
      hiddenUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
  },
});

export const logNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    payload: v.any(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLog", {
      userId: args.userId,
      type: args.type,
      payload: args.payload,
      sentAt: Date.now(),
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});
