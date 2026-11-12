import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCoupleForUser, getCurrentUserOrNull } from "../_helpers/auth";

const role = v.union(v.literal("primary"), v.literal("partner"));

export const getGuardState = query({
  args: {},
  returns: v.object({
    user: v.union(v.object({ role: v.union(role, v.null()) }), v.null()),
    couple: v.union(
      v.object({ isLinked: v.boolean(), role: v.union(role, v.null()) }),
      v.null(),
    ),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return { user: null, couple: null };

    const relationship = await getCoupleForUser(ctx, user._id);
    return {
      user: { role: user.role ?? null },
      // Pending invitations are not active couple links. Keep this aligned
      // with getCoupleStatus.isLinked and the web's private-primary journey.
      couple: relationship?.couple.status === "active"
        ? { isLinked: true, role: relationship.membership.role }
        : { isLinked: false, role: null },
    };
  },
});
