import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { getActiveCoupleSpace } from "../_helpers/coupleSpace";
import { cancelSource } from "../_helpers/notificationOutbox";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import {
  assertValidNotificationEventWrite,
  notificationEventDefinitions,
  type NotificationEventWrite,
  type NotificationSourceIdentity,
} from "../_helpers/notificationTypes";

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

function sameSourceIdentity(
  existing: NotificationSourceIdentity | undefined,
  expected: NotificationSourceIdentity,
): boolean {
  if (!existing) return false;
  const actualFields = existing as unknown as Record<string, unknown>;
  const expectedFields = expected as unknown as Record<string, unknown>;
  return (
    Object.keys(actualFields).length === Object.keys(expectedFields).length &&
    Object.entries(expectedFields).every(([field, value]) => actualFields[field] === value)
  );
}

export async function ensureNudgeEvent(
  ctx: MutationCtx,
  nudgeId: Id<"nudges">,
): Promise<void> {
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return;

  const nudge = await ctx.db.get(nudgeId);
  if (!nudge?.relationshipMembershipId) {
    throw new Error("Nudge notification source has no relationship generation");
  }
  const definition = notificationEventDefinitions[NUDGE_EVENT_TYPE];
  const envelope: NotificationEventWrite = {
    eventType: NUDGE_EVENT_TYPE,
    eventVersion: definition.version,
    purpose: definition.purpose,
    producerKind: definition.producer,
    sourceReference: `nudge:${nudgeId}`,
    sourceAuthorityVersion: `relationship-membership:${nudge.relationshipMembershipId}`,
    ownerUserId: nudge.senderId,
    recipientUserId: nudge.receiverId,
    recipientScope: "nudge_receiver" as const,
    privacyClass: definition.privacyClass,
    validityRule: definition.validity,
    idempotencyKey: makeEventIdempotencyKey(NUDGE_EVENT_TYPE, {
      nudgeId: String(nudgeId),
      receiverId: String(nudge.receiverId),
    }),
    allowedChannel: "in_app" as const,
    sourceIdentity: {
      eventType: NUDGE_EVENT_TYPE,
      sourceId: nudge._id,
      coupleId: nudge.coupleId,
      relationshipMembershipId: nudge.relationshipMembershipId,
      ownerUserId: nudge.senderId,
      recipientUserId: nudge.receiverId,
    },
  };
  assertValidNotificationEventWrite(ctx, envelope);

  const existing = await ctx.db
    .query("notificationEvents")
    .withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", envelope.idempotencyKey),
    )
    .unique();
  if (existing) {
    const matchesEnvelope = Object.entries(envelope).every(
      ([field, value]) =>
        field === "sourceIdentity"
          ? sameSourceIdentity(existing.sourceIdentity, value as NotificationSourceIdentity)
          : existing[field as keyof typeof envelope] === value,
    );
    if (!matchesEnvelope) {
      throw new Error("Nudge notification event key conflicts with its source");
    }
    return;
  }

  await ctx.db.insert("notificationEvents", { ...envelope, createdAt: nudge.createdAt });
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
    await ensureNudgeEvent(ctx, nudgeId);
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
