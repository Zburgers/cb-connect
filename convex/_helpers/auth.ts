import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

const LEGACY_CLERK_ISSUER = "https://clerk.cb.builtbynaki.tech";
const SYNTHETIC_CLERK_ISSUER = "https://holy-clam-29.clerk.accounts.dev";
const CONVEX_TEST_ISSUER = "https://convex.test";
const APPROVED_TEST_DEPLOYMENT = "dev:hallowed-hummingbird-284";

function isConfiguredIssuer(issuer: string): boolean {
  return process.env.CLERK_FRONTEND_API_URL
    ?.split(",")
    .some((domain) => domain.trim() === issuer) ?? false;
}

export function getLegacyClerkSubject(
  identity: Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>,
): string | null {
  if (!identity) return null;
  if (identity.issuer === LEGACY_CLERK_ISSUER && isConfiguredIssuer(identity.issuer)) {
    return identity.subject;
  }

  // Synthetic Clerk identities are trusted only on the fixture-cleanup deployment.
  if (
    identity.issuer === SYNTHETIC_CLERK_ISSUER &&
    isConfiguredIssuer(identity.issuer) &&
    process.env.CB_CONNECT_BACKEND_DEPLOYMENT === APPROVED_TEST_DEPLOYMENT &&
    process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED === "true"
  ) {
    return identity.subject;
  }

  // convex-test supplies its own issuer for existing app-level auth tests.
  if (process.env.NODE_ENV === "test" && identity.issuer === CONVEX_TEST_ISSUER) {
    return identity.subject;
  }
  return null;
}

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  const clerkSubject = getLegacyClerkSubject(identity);
  if (!clerkSubject) {
    throw new Error("User not found in database");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkSubject))
    .unique();

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
}

export async function getCurrentUserOrNull(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const clerkSubject = getLegacyClerkSubject(identity);
  if (!clerkSubject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkSubject))
    .unique();
}

export async function getCoupleForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  const memberships = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user_and_revoked_at", (q) =>
      q.eq("userId", userId).eq("revokedAt", undefined)
    )
    .take(2);

  if (memberships.length !== 1) return null;
  const [membership] = memberships;

  const couple = await ctx.db.get(membership.coupleId);
  if (!couple || couple.status === "revoked") return null;
  const user = await ctx.db.get(userId);

  const [primaries, partners] = await Promise.all([
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", couple._id).eq("role", "primary").eq("revokedAt", undefined)
      )
      .take(2),
    ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", couple._id).eq("role", "partner").eq("revokedAt", undefined)
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
    .withIndex("by_couple_and_role_and_revoked_at", (q) =>
      q.eq("coupleId", viewerCouple.membership.coupleId).eq("role", "primary").eq("revokedAt", undefined)
    )
    .first();

  if (!targetMembership || targetMembership.userId !== targetUserId) return false;

  // Check if primary's membership has pain sharing on
  const primaryMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role_and_revoked_at", (q) =>
      q.eq("coupleId", viewerCouple.membership.coupleId).eq("role", "primary").eq("revokedAt", undefined)
    )
    .first();

  return primaryMembership?.sharingPain ?? false;
}
