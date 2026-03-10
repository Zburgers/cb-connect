import { query } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";

export const getCoupleStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) {
      return { isLinked: false };
    }

    const couple = await ctx.db.get(membership.coupleId);
    if (!couple || couple.status === "revoked") {
      return { isLinked: false };
    }

    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();

    let partnerInfo = null;
    if (partnerMembership) {
      const partnerUser = await ctx.db.get(partnerMembership.userId);
      partnerInfo = {
        name: partnerUser?.name,
        email: partnerUser?.email,
      };
    }

    // Get active pairing code if pending
    let activePairingCode = null;
    if (couple.status === "pending") {
      const code = await ctx.db
        .query("pairingCodes")
        .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();
      if (code && code.expiresAt > Date.now()) {
        activePairingCode = { code: code.code, expiresAt: code.expiresAt };
      }
    }

    return {
      isLinked: couple.status === "active",
      status: couple.status,
      role: membership.role,
      sharingSettings: {
        pain: membership.sharingPain,
        phase: membership.sharingPhase,
      },
      partner: partnerInfo,
      activePairingCode,
    };
  },
});
