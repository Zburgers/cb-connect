import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";

export const generatePairingCode = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can generate pairing codes");
    }

    const existingCouple = await getCoupleForUser(ctx, user._id);
    let coupleId: Id<"couples">;

    if (existingCouple) {
      coupleId = existingCouple.membership.coupleId;

      // Invalidate existing active codes
      const existingCodes = await ctx.db
        .query("pairingCodes")
        .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      for (const code of existingCodes) {
        await ctx.db.patch(code._id, { status: "expired" });
      }
    } else {
      coupleId = await ctx.db.insert("couples", {
        createdAt: Date.now(),
        status: "pending",
      });

      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: user._id,
        role: "primary",
        sharingPain: false,
        sharingPhase: true,
        joinedAt: Date.now(),
      });
    }

    // Generate unique 6-digit code
    let code: string = "";
    let isUnique = false;

    while (!isUnique) {
      code = Math.floor(100000 + Math.random() * 900000).toString();

      const existing = await ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();

      if (!existing) {
        isUnique = true;
      }
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.db.insert("pairingCodes", {
      code,
      coupleId,
      createdBy: user._id,
      expiresAt,
      status: "active",
    });

    return { code, expiresAt };
  },
});

export const linkPartnerWithCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "partner") {
      throw new Error("Only partner users can use pairing codes");
    }

    const pairingCode = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!pairingCode) {
      throw new Error("Invalid or expired pairing code");
    }

    if (pairingCode.expiresAt < Date.now()) {
      await ctx.db.patch(pairingCode._id, { status: "expired" });
      throw new Error("Pairing code has expired");
    }

    // Check if partner already linked
    const existingMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership) {
      throw new Error("You are already linked to a couple");
    }

    // Create partner membership
    await ctx.db.insert("coupleMembers", {
      coupleId: pairingCode.coupleId,
      userId: user._id,
      role: "partner",
      sharingPain: false,
      sharingPhase: true,
      joinedAt: Date.now(),
    });

    // Mark code as used
    await ctx.db.patch(pairingCode._id, {
      status: "used",
      usedBy: user._id,
      usedAt: Date.now(),
    });

    // Update couple status
    await ctx.db.patch(pairingCode.coupleId, {
      status: "active",
      linkedAt: Date.now(),
    });

    return { success: true, coupleId: pairingCode.coupleId };
  },
});

export const revokePartnerAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can revoke partner access");
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData) {
      throw new Error("You are not part of a couple");
    }

    await ctx.db.patch(coupleData.membership.coupleId, {
      status: "revoked",
    });

    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q
          .eq("coupleId", coupleData.membership.coupleId)
          .eq("role", "partner")
      )
      .first();

    if (partnerMembership) {
      await ctx.db.delete(partnerMembership._id);
    }

    return { success: true };
  },
});

export const updateSharingSettings = mutation({
  args: {
    sharingPain: v.optional(v.boolean()),
    sharingPhase: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can update sharing settings");
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData) {
      throw new Error("You are not part of a couple");
    }

    await ctx.db.patch(coupleData.membership._id, {
      ...(args.sharingPain !== undefined && { sharingPain: args.sharingPain }),
      ...(args.sharingPhase !== undefined && {
        sharingPhase: args.sharingPhase,
      }),
    });

    return { success: true };
  },
});
