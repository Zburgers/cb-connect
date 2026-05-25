import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

const NUDGE_MESSAGES: Record<string, string> = {
  "💗": "Thinking of you",
  "🤗": "Sending a soft hug",
  "☕": "A small comfort check-in",
  "🌙": "Let us keep tonight gentle",
  "✨": "You have my attention",
  "🫶": "I am here with you",
};

export const send = mutation({
  args: {
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    const message = NUDGE_MESSAGES[args.emoji];
    if (!message) {
      throw new Error("Unsupported nudge emoji");
    }

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!membership) {
      throw new Error("You are not linked to a couple");
    }

    const couple = await ctx.db.get(membership.coupleId);
    if (!couple || couple.status !== "active") {
      throw new Error("Your couple link is not active");
    }

    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();
    if (!partnerMembership) {
      throw new Error("No linked partner found");
    }

    const now = Date.now();
    return await ctx.db.insert("nudges", {
      coupleId: membership.coupleId,
      senderId: user._id,
      receiverId: partnerMembership.userId,
      emoji: args.emoji,
      message,
      createdAt: now,
    });
  },
});

export const markSeen = mutation({
  args: {
    nudgeId: v.id("nudges"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    const nudge = await ctx.db.get(args.nudgeId);
    if (!nudge || nudge.receiverId !== user._id) {
      return;
    }

    await ctx.db.patch(args.nudgeId, { seenAt: Date.now() });
  },
});
