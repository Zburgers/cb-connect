import { query } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

export const latestReceived = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }

    const nudge = await ctx.db
      .query("nudges")
      .withIndex("by_receiver_created", (q) => q.eq("receiverId", user._id))
      .order("desc")
      .first();

    if (!nudge || nudge.seenAt) {
      return null;
    }

    const sender = await ctx.db.get(nudge.senderId);
    return {
      _id: nudge._id,
      emoji: nudge.emoji,
      message: nudge.message,
      createdAt: nudge.createdAt,
      senderName: sender?.name ?? "Your partner",
    };
  },
});
