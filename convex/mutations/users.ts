import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";

export const updateUserRole = mutation({
  args: {
    role: v.union(v.literal("primary"), v.literal("partner")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { role: args.role });
    return user._id;
  },
});

export const updateUserPreferences = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      ...(args.gender !== undefined && { gender: args.gender }),
      ...(args.partnerType !== undefined && { partnerType: args.partnerType }),
      ...(args.externalNotificationConsent !== undefined && {
        externalNotificationConsent: args.externalNotificationConsent,
      }),
    });

    return user._id;
  },
});

export const syncUserFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !process.env.CLERK_WEBHOOK_SECRET ||
      args.webhookSecret !== process.env.CLERK_WEBHOOK_SECRET
    ) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

export const syncUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
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
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
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
      await ctx.db.patch(existing._id, { lastActiveAt: Date.now() });
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
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});
