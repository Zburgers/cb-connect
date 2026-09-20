import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { getCoupleForUser, getCurrentUserOrNull } from "../_helpers/auth";
import {
  isPartnerPredictionV2Enabled,
  isPeriodPredictionV2Enabled,
} from "../_helpers/periodPredictionFlag";
import { ensureCurrentSnapshot } from "../internal/predictionSnapshots";

export const ensureForViewer = mutation({
  args: {},
  returns: v.union(v.id("predictionSnapshots"), v.null()),
  handler: async (ctx) => {
    if (!isPeriodPredictionV2Enabled()) return null;
    const viewer = await getCurrentUserOrNull(ctx);
    if (!viewer) return null;

    let targetUserId = viewer._id;
    if (viewer.role === "partner") {
      if (!isPartnerPredictionV2Enabled()) return null;
      const coupleData = await getCoupleForUser(ctx, viewer._id);
      if (!coupleData || coupleData.couple.status !== "active") return null;
      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary"),
        )
        .first();
      if (!primaryMembership?.sharingPhase) return null;
      targetUserId = primaryMembership.userId;
    }

    return await ensureCurrentSnapshot(ctx, targetUserId);
  },
});
