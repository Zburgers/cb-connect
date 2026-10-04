import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";
import { cancelSource } from "../_helpers/notificationOutbox";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import { notificationEventDefinitions } from "../_helpers/notificationTypes";

const NUDGE_EVENT_TYPE = "partner_nudge.v1" as const;
const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";

const NUDGE_MESSAGES: Record<string, string> = {
  "💗": "Thinking of you",
  "🤗": "Sending a soft hug",
  "☕": "A small comfort check-in",
  "🌙": "Let us keep tonight gentle",
  "✨": "You have my attention",
  "🫶": "I am here with you",
};

async function ensureNudgeEvent(
  ctx: MutationCtx,
  nudgeId: Id<"nudges">,
  senderId: Id<"users">,
  receiverId: Id<"users">,
  relationshipMembershipId: Id<"coupleMembers">,
  createdAt: number,
): Promise<void> {
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return;

  const definition = notificationEventDefinitions[NUDGE_EVENT_TYPE];
  const envelope = {
    eventType: NUDGE_EVENT_TYPE,
    eventVersion: definition.version,
    purpose: definition.purpose,
    producerKind: definition.producer,
    sourceReference: `nudge:${nudgeId}`,
    sourceAuthorityVersion: `relationship-membership:${relationshipMembershipId}`,
    ownerUserId: senderId,
    recipientUserId: receiverId,
    recipientScope: "nudge_receiver" as const,
    privacyClass: definition.privacyClass,
    validityRule: definition.validity,
    idempotencyKey: makeEventIdempotencyKey(NUDGE_EVENT_TYPE, {
      nudgeId: String(nudgeId),
      receiverId: String(receiverId),
    }),
    allowedChannel: "in_app" as const,
  };

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
      throw new Error("Nudge notification event key conflicts with its source");
    }
    return;
  }

  await ctx.db.insert("notificationEvents", { ...envelope, createdAt });
}

export const send = mutation({
  args: {
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      throw new Error("Unauthenticated");
    }

    const message = NUDGE_MESSAGES[args.emoji];
    if (!message) {
      throw new Error("Unsupported nudge emoji");
    }

    const coupleData = await getCoupleForUser(ctx, user._id);
    if (!coupleData) throw new Error("You are not linked to a couple");
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
    const partnerMembership = partnerMemberships[0];
    const relationshipMembershipId =
      membership.role === "partner" ? membership._id : partnerMembership._id;

    const now = Date.now();
    const nudgeId = await ctx.db.insert("nudges", {
      coupleId: membership.coupleId,
      relationshipMembershipId,
      senderId: user._id,
      receiverId: partnerMembership.userId,
      emoji: args.emoji,
      message,
      createdAt: now,
    });
    await ensureNudgeEvent(
      ctx,
      nudgeId,
      user._id,
      partnerMembership.userId,
      relationshipMembershipId,
      now,
    );
    return nudgeId;
  },
});

export const markSeen = mutation({
  args: {
    nudgeId: v.id("nudges"),
  },
  handler: async (ctx, args) => {
    const { user, membership, relationshipStartedAt, relationshipMembershipId } =
      await getActiveCoupleSpace(ctx);
    const nudge = await ctx.db.get(args.nudgeId);
    if (
      !nudge ||
      nudge.receiverId !== user._id ||
      nudge.coupleId !== membership.coupleId ||
      (nudge.relationshipMembershipId !== relationshipMembershipId &&
        !(
          nudge.relationshipMembershipId === undefined &&
          nudge.createdAt > relationshipStartedAt
        ))
    ) {
      return;
    }

    if (nudge.seenAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(args.nudgeId, { seenAt: now });
      await cancelSource(ctx, `nudge:${nudge._id}`, "source_changed", now);
    }
  },
});
