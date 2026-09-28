import { v } from "convex/values";
import { action, internalMutation, mutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";
import { internal } from "../_generated/api";

const PAIRING_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PAIRING_CODE_ATTEMPTS = 10;
const MAX_MEMBERSHIPS_PER_USER = 3;
const PAIRING_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_CODE_LENGTH = 12;
const PAIRING_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;

export const generatePairingCode = action({
  args: {},
  returns: v.object({ code: v.string(), expiresAt: v.number() }),
  handler: async (ctx) => {
    const candidates = Array.from({ length: 4 }, () => {
      const randomBytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH));
      return Array.from(
        randomBytes,
        (byte) => PAIRING_CODE_ALPHABET[byte & 31],
      ).join("");
    });
    const result: { code: string; expiresAt: number } = await ctx.runMutation(
      internal.mutations.couples.generatePairingCodeInternal,
      { codes: candidates },
    );
    return result;
  },
});

export const generatePairingCodeInternal = internalMutation({
  args: { codes: v.array(v.string()) },
  returns: v.object({ code: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can generate pairing codes");
    }

    const memberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_MEMBERSHIPS_PER_USER);
    if (memberships.length === MAX_MEMBERSHIPS_PER_USER) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    if (memberships.length > 1) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    const membershipCouples = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        couple: await ctx.db.get("couples", membership.coupleId),
      })),
    );
    if (membershipCouples.some(({ membership }) => membership.role !== "primary")) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    if (membershipCouples.some(({ couple }) => couple === null)) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    const usableMemberships = membershipCouples.filter(
      (entry): entry is { membership: typeof memberships[number]; couple: NonNullable<typeof entry.couple> } =>
        entry.couple !== null,
    );
    const active = usableMemberships.filter(
      ({ couple }) => couple.status === "active",
    );
    const pending = usableMemberships.filter(
      ({ couple }) => couple.status === "pending",
    );
    const revoked = usableMemberships.filter(
      ({ couple }) => couple.status === "revoked",
    );
    if (active.length > 1 || pending.length > 1 || (active.length === 0 && pending.length === 0 && revoked.length > 1)) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    if (active.length > 0) {
      throw new Error("You are already linked to a partner");
    }
    const selected = pending[0] ?? revoked[0] ?? null;
    let coupleId: Id<"couples">;

    if (selected?.couple.status === "pending") {
      const existingPartners = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", selected.couple._id).eq("role", "partner")
        )
        .take(1);
      if (existingPartners.length > 0) {
        throw new Error("Pairing state is ambiguous. Please contact support.");
      }
    }

    if (selected?.couple.status === "revoked") {
      // Revocation removes the partner membership but intentionally keeps the
      // primary membership. Reopen that couple for a fresh invite so the
      // primary does not accumulate duplicate memberships that hide the new
      // active link behind the revoked one.
      coupleId = selected.membership.coupleId;
      const remainingPartners = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner")
        )
        .take(1);
      if (remainingPartners.length > 0) {
        throw new Error("Pairing state is ambiguous. Please contact support.");
      }
      await ctx.db.patch(selected.membership._id, {
        sharingPain: false,
        sharingPeriodWrite: false,
      });
      await ctx.db.patch(coupleId, {
        status: "pending",
        linkedAt: undefined,
      });
    } else if (selected) {
      coupleId = selected.couple._id;
      await ctx.db.patch(selected.membership._id, {
        sharingPain: false,
        sharingPeriodWrite: false,
      });
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
        sharingPeriodWrite: false,
        joinedAt: Date.now(),
      });
    }

    if (selected) {
      // Invalidate existing active codes
      const existingCodes = await ctx.db
        .query("pairingCodes")
        .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      for (const code of existingCodes) {
        await ctx.db.patch(code._id, { status: "expired" });
      }
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

    let code: string | undefined;
    for (const candidate of args.codes) {
      if (!PAIRING_CODE_PATTERN.test(candidate)) {
        throw new Error("Invalid pairing code candidate");
      }
      const existing = await ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .first();

      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not generate a unique pairing code");

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
  returns: v.union(
    v.object({ success: v.literal(true), coupleId: v.id("couples") }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "partner") {
      throw new Error("Only partner users can use pairing codes");
    }

    const submittedCode = args.code.length <= 64 ? args.code.trim().toUpperCase() : "";
    const hasValidFormat = PAIRING_CODE_PATTERN.test(submittedCode);
    const enteredCode = hasValidFormat ? submittedCode : "";
    const now = Date.now();
    const failedAttemptWindowStart = now - PAIRING_CODE_ATTEMPT_WINDOW_MS;

    const recentFailedByUser = await countRecentFailedPairingAttemptsByUser(
      ctx,
      user._id,
      failedAttemptWindowStart
    );
    if (recentFailedByUser >= MAX_FAILED_PAIRING_CODE_ATTEMPTS) {
      return {
        success: false as const,
        error: "Too many failed pairing attempts. Please wait before trying again.",
      };
    }

    if (!hasValidFormat) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "invalid_format",
      });
      return { success: false as const, error: "Invalid or expired pairing code" };
    }

    const recentFailedByCode = await countRecentFailedPairingAttemptsByCode(
      ctx,
      enteredCode,
      failedAttemptWindowStart,
    );
    if (recentFailedByCode >= MAX_FAILED_PAIRING_CODE_ATTEMPTS) {
      return {
        success: false as const,
        error: "Too many failed pairing attempts. Please wait before trying again.",
      };
    }

    const matchingCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", enteredCode))
      .take(2);
    const pairingCode =
      matchingCodes.length === 1 && matchingCodes[0].status === "active"
        ? matchingCodes[0]
        : null;

    if (!pairingCode) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "not_found",
      });
      return { success: false as const, error: "Invalid or expired pairing code" };
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
      return { success: false as const, error: "Pairing code has expired" };
    }

    const couple = await ctx.db.get(pairingCode.coupleId);
    const primaryMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", pairingCode.coupleId).eq("role", "primary")
      )
      .take(2);
    const partnerMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", pairingCode.coupleId).eq("role", "partner")
      )
      .take(1);

    if (
      !couple ||
      couple.status !== "pending" ||
      primaryMemberships.length !== 1 ||
      partnerMemberships.length !== 0
    ) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "stale_or_ambiguous_relationship",
      });
      return { success: false as const, error: "Invalid or expired pairing code" };
    }

    // Check if partner already linked
    const existingMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(1);

    if (existingMembership.length > 0) {
      await recordPairingCodeAttempt(ctx, {
        userId: user._id,
        enteredCode,
        attemptedAt: now,
        success: false,
        failureReason: "already_linked",
      });
      return { success: false as const, error: "You are already linked to a couple" };
    }

    // Create partner membership
    await ctx.db.insert("coupleMembers", {
      coupleId: pairingCode.coupleId,
      userId: user._id,
      role: "partner",
      sharingPain: false,
      sharingPhase: true,
      sharingPeriodWrite: false,
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

    return { success: true as const, coupleId: pairingCode.coupleId };
  },
});

export const revokePartnerAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can revoke partner access");
    }

    const memberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(2);
    if (memberships.length !== 1 || memberships[0].role !== "primary") {
      throw new Error("You are not part of a couple");
    }
    const couple = await ctx.db.get(memberships[0].coupleId);
    if (!couple || couple.status === "revoked") {
      throw new Error("You are not part of a couple");
    }

    await ctx.db.patch(memberships[0].coupleId, {
      status: "revoked",
    });
    await ctx.db.patch(memberships[0]._id, {
      sharingPain: false,
      sharingPeriodWrite: false,
    });

    const activeCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_couple", (q) => q.eq("coupleId", memberships[0].coupleId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    for (const code of activeCodes) {
      await ctx.db.patch(code._id, { status: "expired" });
    }

    for await (const state of ctx.db
      .query("coupleChatStates")
      .withIndex("by_couple_and_user", (q) => q.eq("coupleId", memberships[0].coupleId))) {
      await ctx.db.patch(state._id, {
        unreadCount: 0,
        lastReadAt: Date.now(),
      });
    }

    for await (const partnerMembership of ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", memberships[0].coupleId).eq("role", "partner")
      )) {
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
    sharingPeriodWrite: v.optional(v.boolean()),
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

    const effectiveSharingPhase =
      args.sharingPhase ?? coupleData.membership.sharingPhase;
    if (args.sharingPeriodWrite === true && !effectiveSharingPhase) {
      throw new Error("Turn on period visibility first");
    }

    const sharingPeriodWrite =
      args.sharingPhase === false
        ? false
        : args.sharingPeriodWrite;

    await ctx.db.patch(coupleData.membership._id, {
      ...(args.sharingPain !== undefined && { sharingPain: args.sharingPain }),
      ...(args.sharingPhase !== undefined && {
        sharingPhase: args.sharingPhase,
      }),
      ...(sharingPeriodWrite !== undefined && {
        sharingPeriodWrite,
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
