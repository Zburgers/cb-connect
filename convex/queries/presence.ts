import { query, QueryCtx } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

const PRESENCE_TIMEOUT_MS = 25 * 1000;

async function getPartnerPresenceState(ctx: QueryCtx) {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    return null;
  }

  // Find the caller's membership and couple.
  const membership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (!membership) {
    return null;
  }

  // Find partner membership (the other member in the same couple).
  const partnerMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
    .filter((q) => q.neq(q.field("userId"), user._id))
    .first();

  if (!partnerMembership) {
    return null;
  }

  // Lookup partner's presence record.
  const presence = await ctx.db
    .query("presence")
    .withIndex("by_couple_user", (q) =>
      q.eq("coupleId", membership.coupleId).eq("userId", partnerMembership.userId)
    )
    .unique();
  if (!presence) {
    return null;
  }

  const now = Date.now();
  const expiresAt = presence.lastSeen + PRESENCE_TIMEOUT_MS;
  return {
    isPresent: now < expiresAt,
    lastSeen: presence.lastSeen,
    expiresAt,
  };
}

/**
 * Returns true if the caller's partner is currently present (recently sent a heartbeat).
 * We consider a partner "present" if their last heartbeat is within the active timeout.
 */
export const isPartnerPresent = query({
  handler: async (ctx) => {
    const presence = await getPartnerPresenceState(ctx);
    return presence?.isPresent ?? false;
  },
});

export const getPartnerPresence = query({
  args: {},
  handler: async (ctx) => {
    return await getPartnerPresenceState(ctx);
  },
});
