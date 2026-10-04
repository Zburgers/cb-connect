import { v } from "convex/values";
import { action, internalMutation, mutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";
import { internal } from "../_generated/api";
import { cancelSource } from "../_helpers/notificationOutbox";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import { notificationEventDefinitions } from "../_helpers/notificationTypes";

const PAIRING_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_PAIRING_CODE_ATTEMPTS = 10;
const MAX_MEMBERSHIPS_PER_USER = 3;
const PAIRING_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_CODE_LENGTH = 12;
const PAIRING_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;
const LEGACY_PAIRING_CODE_PATTERN = /^\d{6}$/;
const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";

function linkSourceReference(coupleId: Id<"couples">, linkGeneration: string) {
  return `couple:${coupleId}:link:${linkGeneration}`;
}

function connectedSinceSourceReference(
  coupleId: Id<"couples">,
  settingVersion: number,
) {
  return `couple:${coupleId}:connected-since:${settingVersion}`;
}

async function insertRelationshipEvent(
  ctx: MutationCtx,
  envelope: {
    eventType: "partner_linked.v1" | "connected_since_updated.v1";
    eventVersion: 1;
    purpose: "partner_linked" | "connected_since_updated";
    producerKind: "active_link_transition" | "explicit_connected_since_update";
    sourceReference: string;
    sourceAuthorityVersion: string;
    ownerUserId: Id<"users">;
    recipientUserId: Id<"users">;
    recipientScope: "each_link_member_separately" | "other_active_member";
    privacyClass: "account_relationship_sensitive";
    validityRule: "while_link_generation_is_active" | "until_setting_version_changes_or_link_revocation";
    idempotencyKey: string;
    allowedChannel: "in_app";
  },
  createdAt: number,
): Promise<void> {
  const existing = await ctx.db
    .query("notificationEvents")
    .withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", envelope.idempotencyKey),
    )
    .unique();
  if (existing) {
    if (
      existing.eventType !== envelope.eventType ||
      existing.eventVersion !== envelope.eventVersion ||
      existing.purpose !== envelope.purpose ||
      existing.producerKind !== envelope.producerKind ||
      existing.sourceReference !== envelope.sourceReference ||
      existing.sourceAuthorityVersion !== envelope.sourceAuthorityVersion ||
      existing.ownerUserId !== envelope.ownerUserId ||
      existing.recipientUserId !== envelope.recipientUserId ||
      existing.recipientScope !== envelope.recipientScope ||
      existing.privacyClass !== envelope.privacyClass ||
      existing.validityRule !== envelope.validityRule ||
      existing.idempotencyKey !== envelope.idempotencyKey ||
      existing.allowedChannel !== envelope.allowedChannel
    ) {
      throw new Error("Relationship notification key conflicts with its source");
    }
    return;
  }

  await ctx.db.insert("notificationEvents", { ...envelope, createdAt });
}

async function ensurePartnerLinkedEvent(
  ctx: MutationCtx,
  args: {
    coupleId: Id<"couples">;
    linkGeneration: string;
    ownerUserId: Id<"users">;
    recipientUserId: Id<"users">;
    createdAt: number;
  },
): Promise<void> {
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return;

  const definition = notificationEventDefinitions["partner_linked.v1"];
  await insertRelationshipEvent(
    ctx,
    {
      eventType: "partner_linked.v1",
      eventVersion: definition.version,
      purpose: definition.purpose,
      producerKind: definition.producer,
      sourceReference: linkSourceReference(args.coupleId, args.linkGeneration),
      sourceAuthorityVersion: `relationship-membership:${args.linkGeneration}`,
      ownerUserId: args.ownerUserId,
      recipientUserId: args.recipientUserId,
      recipientScope: "each_link_member_separately",
      privacyClass: definition.privacyClass,
      validityRule: definition.validity,
      idempotencyKey: makeEventIdempotencyKey("partner_linked.v1", {
        coupleId: String(args.coupleId),
        linkGeneration: args.linkGeneration,
        recipientId: String(args.recipientUserId),
      }),
      allowedChannel: "in_app",
    },
    args.createdAt,
  );
}

async function ensureConnectedSinceEvent(
  ctx: MutationCtx,
  args: {
    coupleId: Id<"couples">;
    settingVersion: number;
    ownerUserId: Id<"users">;
    recipientUserId: Id<"users">;
    createdAt: number;
  },
): Promise<void> {
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return;

  const definition = notificationEventDefinitions["connected_since_updated.v1"];
  const settingVersion = String(args.settingVersion);
  await insertRelationshipEvent(
    ctx,
    {
      eventType: "connected_since_updated.v1",
      eventVersion: definition.version,
      purpose: definition.purpose,
      producerKind: definition.producer,
      sourceReference: connectedSinceSourceReference(args.coupleId, args.settingVersion),
      sourceAuthorityVersion: `connected-since-setting:${settingVersion}`,
      ownerUserId: args.ownerUserId,
      recipientUserId: args.recipientUserId,
      recipientScope: "other_active_member",
      privacyClass: definition.privacyClass,
      validityRule: definition.validity,
      idempotencyKey: makeEventIdempotencyKey("connected_since_updated.v1", {
        coupleId: String(args.coupleId),
        settingVersion,
        recipientId: String(args.recipientUserId),
      }),
      allowedChannel: "in_app",
    },
    args.createdAt,
  );
}

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
      .withIndex("by_user_and_revoked_at", (q) =>
        q.eq("userId", user._id).eq("revokedAt", undefined)
      )
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
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", selected.couple._id).eq("role", "partner").eq("revokedAt", undefined)
        )
        .take(1);
      if (existingPartners.length > 0) {
        throw new Error("Pairing state is ambiguous. Please contact support.");
      }
    }

    if (selected?.couple.status === "revoked") {
      // The revoked member row remains as relationship history; active lookups
      // use the revokedAt index so a re-link is a fresh membership epoch.
      coupleId = selected.membership.coupleId;
      const remainingPartners = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined)
        )
        .take(1);
      if (remainingPartners.length > 0) {
        throw new Error("Pairing state is ambiguous. Please contact support.");
      }
      await ctx.db.patch(selected.membership._id, {
        sharingPain: false,
        sharingPeriodWrite: false,
        partnerNickname: undefined,
      });
      await ctx.db.patch(coupleId, {
        status: "pending",
        linkedAt: undefined,
        connectedSinceDate: undefined,
        connectedSinceUpdatedAt: undefined,
        connectedSinceUpdatedBy: undefined,
      });
    } else if (selected) {
      coupleId = selected.couple._id;
      await ctx.db.patch(selected.membership._id, {
        sharingPain: false,
        sharingPeriodWrite: false,
        partnerNickname: undefined,
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
        .withIndex("by_couple_and_status", (q) =>
          q.eq("coupleId", coupleId).eq("status", "active")
        )
        .take(2);
      if (existingCodes.length > 1) {
        throw new Error("Pairing state is ambiguous. Please contact support.");
      }

      for (const code of existingCodes) {
        await ctx.db.patch(code._id, { status: "expired" });
      }
    }

    // Rate limit: max 5 pairing codes per hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_couple", (q) =>
        q.eq("coupleId", coupleId).gte("_creationTime", oneHourAgo)
      )
      .take(5);

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
    const hasValidFormat =
      PAIRING_CODE_PATTERN.test(submittedCode) ||
      LEGACY_PAIRING_CODE_PATTERN.test(submittedCode);
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
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", pairingCode.coupleId).eq("role", "primary").eq("revokedAt", undefined)
      )
      .take(2);
    const partnerMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", pairingCode.coupleId).eq("role", "partner").eq("revokedAt", undefined)
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
      .withIndex("by_user_and_revoked_at", (q) =>
        q.eq("userId", user._id).eq("revokedAt", undefined)
      )
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

    // The new membership row is the stable generation for this link. Re-linking
    // creates a new row, so old link events cannot become current again.
    const linkedAt = Date.now();
    const partnerMembershipId = await ctx.db.insert("coupleMembers", {
      coupleId: pairingCode.coupleId,
      userId: user._id,
      role: "partner",
      sharingPain: false,
      sharingPhase: true,
      sharingPeriodWrite: false,
      joinedAt: linkedAt,
    });

    for (const userId of [primaryMemberships[0].userId, user._id]) {
      const state = await ctx.db
        .query("coupleChatStates")
        .withIndex("by_couple_and_user", (q) =>
          q.eq("coupleId", pairingCode.coupleId).eq("userId", userId)
        )
        .first();
      if (state) {
        await ctx.db.patch(state._id, {
          unreadCount: 0,
          lastReadAt: undefined,
          lastDeliveredAt: undefined,
          lastMessageSequence: 0,
          lastReadSequence: 0,
          legacySequenceBase: 0,
          legacyUnreadCount: 0,
          legacyReadThroughAt: undefined,
        });
      }
    }

    // Mark code as used
    await ctx.db.patch(pairingCode._id, {
      status: "used",
      usedBy: user._id,
      usedAt: linkedAt,
    });

    // Update couple status
    await ctx.db.patch(pairingCode.coupleId, {
      status: "active",
      linkedAt,
    });

    const linkGeneration = String(partnerMembershipId);
    for (const recipientUserId of [primaryMemberships[0].userId, user._id]) {
      await ensurePartnerLinkedEvent(ctx, {
        coupleId: pairingCode.coupleId,
        linkGeneration,
        ownerUserId: user._id,
        recipientUserId,
        createdAt: linkedAt,
      });
    }

    await recordPairingCodeAttempt(ctx, {
      userId: user._id,
      enteredCode,
      attemptedAt: linkedAt,
      success: true,
    });

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
      .withIndex("by_user_and_revoked_at", (q) =>
        q.eq("userId", user._id).eq("revokedAt", undefined)
      )
      .take(2);
    if (memberships.length !== 1 || memberships[0].role !== "primary") {
      throw new Error("You are not part of a couple");
    }
    const couple = await ctx.db.get(memberships[0].coupleId);
    if (!couple || couple.status === "revoked") {
      throw new Error("You are not part of a couple");
    }
    const activePartners = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", couple._id).eq("role", "partner").eq("revokedAt", undefined)
      )
      .take(3);
    if (
      activePartners.length > 2 ||
      (couple.status === "active" && activePartners.length === 0)
    ) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }

    const revokedAt = Date.now();
    for (const partnerMembership of activePartners) {
      await cancelSource(
        ctx,
        linkSourceReference(couple._id, String(partnerMembership._id)),
        "authority_revoked",
        revokedAt,
      );
    }
    if (couple.connectedSinceUpdatedAt !== undefined) {
      await cancelSource(
        ctx,
        connectedSinceSourceReference(couple._id, couple.connectedSinceUpdatedAt),
        "authority_revoked",
        revokedAt,
      );
    }

    await ctx.db.patch(memberships[0].coupleId, {
      status: "revoked",
      connectedSinceDate: undefined,
      connectedSinceUpdatedAt: undefined,
      connectedSinceUpdatedBy: undefined,
    });
    await ctx.db.patch(memberships[0]._id, {
      sharingPain: false,
      sharingPeriodWrite: false,
      partnerNickname: undefined,
    });

    const activeCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_couple_and_status", (q) =>
        q.eq("coupleId", memberships[0].coupleId).eq("status", "active")
      )
      .take(6);
    if (activeCodes.length === 6) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }
    for (const code of activeCodes) {
      await ctx.db.patch(code._id, { status: "expired" });
    }

    for (const userId of [memberships[0].userId, ...activePartners.map(({ userId }) => userId)]) {
      const state = await ctx.db
        .query("coupleChatStates")
        .withIndex("by_couple_and_user", (q) =>
          q.eq("coupleId", memberships[0].coupleId).eq("userId", userId)
        )
        .first();
      if (state) {
        await ctx.db.patch(state._id, {
          unreadCount: 0,
          lastReadAt: Date.now(),
        });
      }
    }

    for (const partnerMembership of activePartners) {
      await ctx.db.patch(partnerMembership._id, {
        revokedAt,
        sharingPain: false,
        sharingPeriodWrite: false,
      });
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
    .withIndex("by_user_and_success_and_attempted_at", (q) =>
      q.eq("userId", userId).eq("success", false).gte("attemptedAt", since)
    )
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
    .withIndex("by_entered_code_and_success_and_attempted_at", (q) =>
      q.eq("enteredCode", enteredCode).eq("success", false).gte("attemptedAt", since)
    )
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

    const otherRole = coupleData.membership.role === "primary" ? "partner" : "primary";
    const otherMemberships = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q
          .eq("coupleId", coupleData.couple._id)
          .eq("role", otherRole)
          .eq("revokedAt", undefined),
      )
      .take(2);
    if (otherMemberships.length !== 1) {
      throw new Error("Pairing state is ambiguous. Please contact support.");
    }

    const now = Date.now();
    const previousSettingVersion = coupleData.couple.connectedSinceUpdatedAt;
    const settingVersion = Math.max(now, (previousSettingVersion ?? 0) + 1);
    if (!Number.isSafeInteger(settingVersion)) {
      throw new Error("Connected-since setting version cannot be advanced safely");
    }
    if (previousSettingVersion !== undefined) {
      await cancelSource(
        ctx,
        connectedSinceSourceReference(coupleData.couple._id, previousSettingVersion),
        "source_changed",
        now,
      );
    }

    await ctx.db.patch(coupleData.membership.coupleId, {
      connectedSinceDate,
      connectedSinceUpdatedAt: settingVersion,
      connectedSinceUpdatedBy: user._id,
    });
    await ensureConnectedSinceEvent(ctx, {
      coupleId: coupleData.couple._id,
      settingVersion,
      ownerUserId: user._id,
      recipientUserId: otherMemberships[0].userId,
      createdAt: now,
    });

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
