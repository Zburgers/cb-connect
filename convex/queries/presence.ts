import { query, QueryCtx } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";

const PRESENCE_TIMEOUT_MS = 25 * 1000;

async function getPartnerPresenceState(ctx: QueryCtx) {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) {
    return null;
  }

  const coupleData = await getCoupleForUser(ctx, user._id);
  if (!coupleData || coupleData.couple.status !== "active") return null;
  const { membership } = coupleData;

  const partnerMemberships = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role", (q) =>
      q
        .eq("coupleId", membership.coupleId)
        .eq("role", membership.role === "primary" ? "partner" : "primary")
    )
    .take(2);

  if (partnerMemberships.length !== 1) return null;
  const partnerMembership = partnerMemberships[0];

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
