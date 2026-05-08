import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";
import { api } from "../_generated/api";

export const createOrUpdatePainLog = mutation({
  args: {
    date: v.string(),
    painScore: v.number(),
    tags: v.array(
      v.union(
        v.literal("cramps"),
        v.literal("headache"),
        v.literal("back"),
        v.literal("fatigue"),
        v.literal("other")
      )
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (args.painScore < 0 || args.painScore > 10) {
      throw new Error("Pain score must be between 0 and 10");
    }

    if (args.note && args.note.length > 140) {
      throw new Error("Note must be 140 characters or less");
    }

    const existing = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        painScore: args.painScore,
        tags: args.tags,
        note: args.note,
        updatedAt: Date.now(),
      });

      // Notify for high pain scores (>= 7)
      if (args.painScore >= 7) {
        await ctx.scheduler.runAfter(0, api.actions.discord.sendDiscordNotification, {
          userId: user._id,
          type: "high_pain_logged",
          message: `High pain level (${args.painScore}/10) logged for ${user.name ?? "a user"} on ${args.date}. Tags: ${args.tags.join(", ") || "none"}.`,
        });
      }

      return { logId: existing._id, created: false };
    }

    const logId = await ctx.db.insert("painLogs", {
      userId: user._id,
      date: args.date,
      painScore: args.painScore,
      tags: args.tags,
      note: args.note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Notify for high pain scores (>= 7) on new entries
    if (args.painScore >= 7) {
      await ctx.scheduler.runAfter(0, api.actions.discord.sendDiscordNotification, {
        userId: user._id,
        type: "high_pain_logged",
        message: `High pain level (${args.painScore}/10) logged for ${user.name ?? "a user"} on ${args.date}. Tags: ${args.tags.join(", ") || "none"}.`,
      });
    }

    return { logId, created: true };
  },
});
