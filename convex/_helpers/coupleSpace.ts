import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "./auth";

export async function getActiveCoupleSpace(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  const coupleData = await getCoupleForUser(ctx, user._id);
  if (!coupleData) {
    throw new Error("You are not linked to a couple");
  }
  const { membership, couple } = coupleData;
  if (couple.status !== "active") {
    throw new Error("Your couple link is not active");
  }

  const partnerMemberships = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role_and_revoked_at", (q) =>
      q
        .eq("coupleId", membership.coupleId)
        .eq("role", membership.role === "primary" ? "partner" : "primary").eq("revokedAt", undefined)
    )
    .take(2);

  if (partnerMemberships.length !== 1) {
    throw new Error("No linked partner found");
  }

  return {
    user,
    couple,
    membership,
    partnerMembership: partnerMemberships[0],
    relationshipStartedAt:
      couple.linkedAt ?? Math.max(membership.joinedAt, partnerMemberships[0].joinedAt),
    relationshipMembershipId:
      membership.role === "partner" ? membership._id : partnerMemberships[0]._id,
  };
}

export async function assertCoupleMember(
  ctx: QueryCtx | MutationCtx,
  coupleId: Id<"couples">,
  userId: Id<"users">
) {
  const coupleData = await getCoupleForUser(ctx, userId);
  if (!coupleData || coupleData.membership.coupleId !== coupleId) {
    throw new Error("Not authorized for this couple");
  }

  if (coupleData.couple.status !== "active") {
    throw new Error("Your couple link is not active");
  }

  return coupleData.membership;
}
