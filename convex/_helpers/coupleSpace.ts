import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser } from "./auth";

export async function getActiveCoupleSpace(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  const membership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  if (!membership) {
    throw new Error("You are not linked to a couple");
  }

  const couple = await ctx.db.get(membership.coupleId);
  if (!couple || couple.status !== "active") {
    throw new Error("Your couple link is not active");
  }

  const partnerMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
    .filter((q) => q.neq(q.field("userId"), user._id))
    .first();

  if (!partnerMembership) {
    throw new Error("No linked partner found");
  }

  return {
    user,
    couple,
    membership,
    partnerMembership,
  };
}

export async function assertCoupleMember(
  ctx: QueryCtx | MutationCtx,
  coupleId: Id<"couples">,
  userId: Id<"users">
) {
  const membership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!membership || membership.coupleId !== coupleId) {
    throw new Error("Not authorized for this couple");
  }

  const couple = await ctx.db.get(coupleId);
  if (!couple || couple.status !== "active") {
    throw new Error("Your couple link is not active");
  }

  return membership;
}
