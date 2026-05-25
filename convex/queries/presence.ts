import { query } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

/**
 * Returns true if the caller's partner is currently present (recently sent a heartbeat).
 * We consider a partner "present" if their last heartbeat was within the last minute.
 */
export const isPartnerPresent = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return false;
    }

    // Find the caller's membership and couple.
    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!membership) {
      return false;
    }

    // Find partner membership (the other member in the same couple).
    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();

    if (!partnerMembership) {
      return false;
    }

    // Lookup partner's presence record.
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_couple_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", partnerMembership.userId)
      )
      .unique();
    if (!presence) {
      return false;
    }

    const now = Date.now();
    // Consider partner present if last heartbeat within past 60 seconds.
    return presence.lastSeen > now - 60 * 1000;
  },
});
