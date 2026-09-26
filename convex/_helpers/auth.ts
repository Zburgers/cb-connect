import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
}

export async function getCurrentUserOrNull(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function getCoupleForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  const memberships = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(2);

  if (memberships.length !== 1) return null;
  const [membership] = memberships;

  const couple = await ctx.db.get(membership.coupleId);
  if (!couple || couple.status === "revoked") return null;
  const user = await ctx.db.get(userId);

  const [primaries, partners] = await Promise.all([
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", couple._id).eq("role", "primary")
      )
      .take(2),
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", couple._id).eq("role", "partner")
      )
      .take(2),
  ]);

  if (
    primaries.length !== 1 ||
    (couple.status === "active" && partners.length !== 1) ||
    (couple.status === "pending" && partners.length !== 0) ||
    (membership.role !== "primary" && membership.role !== "partner") ||
    user?.role !== membership.role
  ) {
    return null;
  }

  return { membership, couple };
}

export async function canViewPainData(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  targetUserId: Id<"users">
): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const viewerCouple = await getCoupleForUser(ctx, viewerId);
  if (!viewerCouple) return false;

  const targetMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role", (q) =>
      q.eq("coupleId", viewerCouple.membership.coupleId).eq("role", "primary")
    )
    .first();

  if (!targetMembership || targetMembership.userId !== targetUserId) return false;

  // Check if primary's membership has pain sharing on
  const primaryMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role", (q) =>
      q.eq("coupleId", viewerCouple.membership.coupleId).eq("role", "primary")
    )
    .first();

  return primaryMembership?.sharingPain ?? false;
}
