import { query } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";

export const latestReceived = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData || coupleData.couple.status !== "active") return null;
    const partnerMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q
          .eq("coupleId", coupleData.membership.coupleId)
          .eq("role", coupleData.membership.role === "primary" ? "partner" : "primary").eq("revokedAt", undefined)
      )
      .take(2);
    if (partnerMemberships.length !== 1) return null;
    const relationshipStartedAt =
      coupleData.couple.linkedAt ??
      Math.max(coupleData.membership.joinedAt, partnerMemberships[0].joinedAt);
    const relationshipMembershipId =
      coupleData.membership.role === "partner"
        ? coupleData.membership._id
        : partnerMemberships[0]._id;

    const [epochNudge, legacyNudge] = await Promise.all([
      ctx.db
        .query("nudges")
        .withIndex("by_relationship_receiver_created", (q) =>
          q
            .eq("coupleId", coupleData.membership.coupleId)
            .eq("relationshipMembershipId", relationshipMembershipId)
            .eq("receiverId", user._id)
        )
        .order("desc")
        .first(),
      ctx.db
        .query("nudges")
        .withIndex("by_couple_receiver_created", (q) =>
          q
            .eq("coupleId", coupleData.membership.coupleId)
            .eq("receiverId", user._id)
            .gt("createdAt", relationshipStartedAt)
        )
        .filter((q) => q.eq(q.field("relationshipMembershipId"), undefined))
        .order("desc")
        .first(),
    ]);
    const nudge =
      !legacyNudge || (epochNudge && epochNudge.createdAt >= legacyNudge.createdAt)
        ? epochNudge
        : legacyNudge;

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
