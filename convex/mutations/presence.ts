import { mutation } from "../_generated/server";
import { getCurrentUserOrNull } from "../_helpers/auth";

/**
 * Record a heartbeat for the currently authenticated user.
 * Each heartbeat updates or inserts a presence record for the user's couple.
 * A heartbeat should be sent periodically from the client (e.g. every 30 seconds)
 * to indicate the user is actively online.
 */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    // Look up the caller's couple membership.
    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!membership) {
      // No couple membership – nothing to update.
      return;
    }

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
