import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";
import {
  DEFAULT_TIME_ZONE,
  resolveCalendarTimeZone,
} from "../_helpers/calendarDates";
import { advanceNotificationSourceAuthority } from "../_helpers/notificationSourceAuthority";
import { reconcileUserSchedule } from "../internal/notificationScheduler";

export const updateUserRole = mutation({
  args: {
    role: v.union(v.literal("primary"), v.literal("partner")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== undefined && user.role !== args.role) {
      throw new Error("Role can only be selected during onboarding");
    }

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user_and_revoked_at", (q) =>
        q.eq("userId", user._id).eq("revokedAt", undefined)
      )
      .take(1);
    if (membership.length > 0 && user.role !== args.role) {
      throw new Error("Role cannot be changed after joining a couple");
    }

    await ctx.db.patch(user._id, { role: args.role });
    return user._id;
  },
});

export const updateUserPreferences = mutation({
  args: {
    preferredName: v.optional(v.string()),
    gender: v.optional(
      v.union(
        v.literal("male"),
        v.literal("female"),
        v.literal("other"),
        v.literal("prefer_not_to_say")
      )
    ),
    partnerType: v.optional(
      v.union(
        v.literal("boyfriend"),
        v.literal("girlfriend"),
        v.literal("spouse"),
        v.literal("partner"),
        v.literal("other")
      )
    ),
    externalNotificationConsent: v.optional(v.boolean()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const timeZone =
      args.timeZone === undefined
        ? undefined
        : resolveCalendarTimeZone(args.timeZone);
    const timeZoneChanged =
      user.role === "primary" &&
      timeZone !== undefined &&
      isTimeZoneChange(user.timeZone, timeZone);

    await ctx.db.patch(user._id, {
      ...(args.preferredName !== undefined && {
        preferredName: sanitizePreferredName(args.preferredName),
      }),
      ...(args.gender !== undefined && { gender: args.gender }),
      ...(args.partnerType !== undefined && { partnerType: args.partnerType }),
      ...(args.externalNotificationConsent !== undefined && {
        externalNotificationConsent: args.externalNotificationConsent,
      }),
      ...(timeZone !== undefined && { timeZone }),
    });

    if (timeZoneChanged) {
      await advanceNotificationSourceAuthority(ctx, user._id);
      await reconcileUserSchedule(ctx, user._id);
    }

    return user._id;
  },
});

export const updateUserTimeZone = mutation({
  args: { timeZone: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const timeZone = resolveCalendarTimeZone(args.timeZone);
    const timeZoneChanged =
      user.role === "primary" &&
      isTimeZoneChange(user.timeZone, timeZone);
    if (user.timeZone !== timeZone) {
      await ctx.db.patch(user._id, { timeZone });
    }

    if (timeZoneChanged) {
      await advanceNotificationSourceAuthority(ctx, user._id);
      await reconcileUserSchedule(ctx, user._id);
    }

    return user._id;
  },
});

function sanitizePreferredName(preferredName: string) {
  const normalized = preferredName.trim().replace(/\s+/g, " ");
  if (normalized.length > 40) {
    throw new Error("Preferred name must be 40 characters or fewer");
  }
  return normalized || undefined;
}

function isTimeZoneChange(currentTimeZone: string | undefined, nextTimeZone: string) {
  if (currentTimeZone === undefined) return nextTimeZone !== DEFAULT_TIME_ZONE;
  try {
    return resolveCalendarTimeZone(currentTimeZone) !== nextTimeZone;
  } catch {
    return true;
  }
}

export const syncUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        ...(args.imageUrl !== undefined && { imageUrl: args.imageUrl }),
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      ...(args.imageUrl !== undefined && { imageUrl: args.imageUrl }),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Ensures the currently authenticated Clerk user exists in Convex.
 * Called client-side on first load. Does not set role — that's done in onboarding.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(identity.pictureUrl !== undefined && { imageUrl: identity.pictureUrl }),
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    const name =
      [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
      identity.name ||
      "User";

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name,
      ...(identity.pictureUrl !== undefined && { imageUrl: identity.pictureUrl }),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});
