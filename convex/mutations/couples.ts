import { v } from "convex/values";
import { mutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";
import { internal } from "../_generated/api";

const PAIRING_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PAIRING_CODE_ATTEMPTS = 10;

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

    // Rate limit: max 5 pairing codes per hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
      .filter((q) => q.gte(q.field("_creationTime"), oneHourAgo))
      .collect();

    if (recentCodes.length >= 5) {
      throw new Error("Too many pairing codes generated. Please wait before generating another.");
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

    const enteredCode = args.code.trim();
    const now = Date.now();
    const failedAttemptWindowStart = now - PAIRING_CODE_ATTEMPT_WINDOW_MS;

    const recentFailedByUser = await countRecentFailedPairingAttemptsByUser(
      ctx,
      user._id,
      failedAttemptWindowStart
    );
    if (recentFailedByUser >= MAX_FAILED_PAIRING_CODE_ATTEMPTS) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "throttled",
      });
      throw new Error("Too many failed pairing attempts. Please wait before trying again.");
    }

    const recentFailedByCode = await countRecentFailedPairingAttemptsByCode(
      ctx,
      enteredCode,
      failedAttemptWindowStart
    );
    if (recentFailedByCode >= MAX_FAILED_PAIRING_CODE_ATTEMPTS) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "throttled",
      });
      throw new Error("Too many failed pairing attempts. Please wait before trying again.");
    }

    if (!/^\d{6}$/.test(enteredCode)) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "invalid_format",
      });
      throw new Error("Invalid or expired pairing code");
    }

    const pairingCode = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", enteredCode))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!pairingCode) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "not_found",
      });
      throw new Error("Invalid or expired pairing code");
    }

    if (pairingCode.expiresAt < Date.now()) {
      await ctx.db.patch(pairingCode._id, { status: "expired" });
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "expired",
      });
      throw new Error("Pairing code has expired");
    }

    // Check if partner already linked
    const existingMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "already_linked",
      });
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

    await recordPairingCodeAttempt(ctx, {
      userId: user._id,
      enteredCode,
      attemptedAt: Date.now(),
      success: true,
    });

    // Find the primary user to notify them
    const primaryMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", pairingCode.coupleId).eq("role", "primary")
      )
      .first();

    if (primaryMembership) {
      const primaryUser = await ctx.db.get(primaryMembership.userId);
      if (primaryUser?.externalNotificationConsent) {
        await ctx.scheduler.runAfter(0, internal.actions.discord.sendDiscordNotification, {
          userId: primaryMembership.userId,
          type: "partner_linked",
          message: "Partner link completed.",
        });
      }
    }

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

    const chatReactions = await ctx.db
      .query("coupleMessageReactions")
      .withIndex("by_couple", (q) => q.eq("coupleId", coupleData.membership.coupleId))
      .collect();
    for (const reaction of chatReactions) {
      await ctx.db.delete(reaction._id);
    }

    const chatMessages = await ctx.db
      .query("coupleMessages")
      .withIndex("by_couple_created", (q) => q.eq("coupleId", coupleData.membership.coupleId))
      .collect();
    for (const message of chatMessages) {
      await ctx.db.delete(message._id);
    }

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

async function countRecentFailedPairingAttemptsByUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  since: number
) {
  const attempts = await ctx.db
    .query("pairingCodeAttempts")
    .withIndex("by_user_and_attempted_at", (q) =>
      q.eq("userId", userId).gte("attemptedAt", since)
    )
    .filter((q) => q.eq(q.field("success"), false))
    .take(MAX_FAILED_PAIRING_CODE_ATTEMPTS + 1);

  return attempts.length;
}

async function countRecentFailedPairingAttemptsByCode(
  ctx: MutationCtx,
  enteredCode: string,
  since: number
) {
  const attempts = await ctx.db
    .query("pairingCodeAttempts")
    .withIndex("by_entered_code_and_attempted_at", (q) =>
      q.eq("enteredCode", enteredCode).gte("attemptedAt", since)
    )
    .filter((q) => q.eq(q.field("success"), false))
    .take(MAX_FAILED_PAIRING_CODE_ATTEMPTS + 1);

  return attempts.length;
}

async function recordPairingCodeAttempt(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    enteredCode: string;
    attemptedAt: number;
    success: boolean;
    failureReason?: string;
  }
) {
  await ctx.db.insert("pairingCodeAttempts", args);
}

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

export const updateConnectedSinceDate = mutation({
  args: {
    connectedSinceDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData || coupleData.couple.status !== "active") {
      throw new Error("You are not part of an active couple");
    }

    const connectedSinceDate = args.connectedSinceDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(connectedSinceDate)) {
      throw new Error("Use a valid date");
    }

    const parsed = new Date(`${connectedSinceDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== connectedSinceDate) {
      throw new Error("Use a valid date");
    }

    await ctx.db.patch(coupleData.membership.coupleId, {
      connectedSinceDate,
      connectedSinceUpdatedAt: Date.now(),
      connectedSinceUpdatedBy: user._id,
    });

    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", coupleData.membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();

    if (partnerMembership) {
      await ctx.db.insert("notificationLog", {
        userId: partnerMembership.userId,
        type: "connected_since_updated",
        payload: {
          connectedSinceDate,
          updatedBy: user.preferredName || user.name,
        },
        sentAt: Date.now(),
        status: "sent",
      });
    }

    return { success: true };
  },
});

export const updatePartnerNickname = mutation({
  args: {
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData || coupleData.couple.status !== "active") {
      throw new Error("You are not part of an active couple");
    }

    const nickname = args.nickname.trim().replace(/\s+/g, " ");
    if (nickname.length > 40) {
      throw new Error("Nickname must be 40 characters or fewer");
    }

    await ctx.db.patch(coupleData.membership._id, {
      partnerNickname: nickname || undefined,
    });

    return { success: true };
  },
});
