import { mutation } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";

/**
 * Record a heartbeat for the currently authenticated user.
 * Each heartbeat updates or inserts a presence record for the user's couple.
 * A heartbeat should be sent periodically from the client
 * to indicate the user is actively online.
 */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData || coupleData.couple.status !== "active") {
      // No couple membership – nothing to update.
      return;
    }
    const { membership } = coupleData;

    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_couple_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", user._id)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("presence", {
        coupleId: membership.coupleId,
        userId: user._id,
        lastSeen: now,
      });
    }
  },
});

export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return;
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData || coupleData.couple.status !== "active") return;
    const { membership } = coupleData;

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_couple_user", (q) =>
        q.eq("coupleId", membership.coupleId).eq("userId", user._id)
      )
      .unique();
    if (!existing) {
      return;
    }

    await ctx.db.patch(existing._id, { lastSeen: 0 });
  },
});
