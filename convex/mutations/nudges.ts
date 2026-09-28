import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";

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

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData) throw new Error("You are not linked to a couple");
    const { membership, couple } = coupleData;
    if (couple.status !== "active") {
      throw new Error("Your couple link is not active");
    }

    const partnerMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q
          .eq("coupleId", membership.coupleId)
          .eq("role", membership.role === "primary" ? "partner" : "primary")
      )
      .take(2);
    if (partnerMemberships.length !== 1) {
      throw new Error("No linked partner found");
    }
    const partnerMembership = partnerMemberships[0];
    const relationshipMembershipId =
      membership.role === "partner" ? membership._id : partnerMembership._id;

    const now = Date.now();
    return await ctx.db.insert("nudges", {
      coupleId: membership.coupleId,
      relationshipMembershipId,
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
    const { user, membership, relationshipStartedAt, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    const nudge = await ctx.db.get(args.nudgeId);
    if (
      !nudge ||
      nudge.receiverId !== user._id ||
      nudge.coupleId !== membership.coupleId ||
      (nudge.relationshipMembershipId !== relationshipMembershipId &&
        !(
          nudge.relationshipMembershipId === undefined &&
          nudge.createdAt > relationshipStartedAt
        ))
    ) {
      return;
    }

    await ctx.db.patch(args.nudgeId, { seenAt: Date.now() });
  },
});
