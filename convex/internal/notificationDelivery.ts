import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import {
  assertValidNotificationDeliveryAttemptNumbers,
  assertValidNotificationDeliveryRecord,
  claimInAppDelivery,
  isValidNotificationDeliveryRecord,
  makeDeliveryIdempotencyKey,
  projectInAppArgsValidator,
  sameFrozenRenderIdentity,
  type NotificationDeliveryRecord,
  type NotificationOperationalLimits,
} from "../_helpers/notificationDelivery";
import { authorizeNotificationProjection } from "../_helpers/notificationPolicy";
import { renderFrozen } from "../_helpers/notificationTemplates";
import { notificationEventDefinitions } from "../_helpers/notificationTypes";

const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const PROJECTION_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_PROJECTION_V1";
const DELIVERY_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_DELIVERY_V1";
const MAX_SOURCE_ROWS = 2;
type SourceTable = "periodEvents" | "coupleMessages" | "couples" | "nudges";

// The in-app adapter is a single atomic Convex transaction. The remaining
// finite settings share the N2c versioned limits contract and are measured at
// N8 before qualification.
const IN_APP_LIMITS: NotificationOperationalLimits = Object.freeze({
  version: "g4-limits-v1",
  maxBatchSize: 10,
  maxConcurrent: 2,
  maxAttempts: 4,
  leaseMs: 500,
  receiptDeadlineMs: 2_000,
  baseBackoffMs: 50,
  maxBackoffMs: 1_000,
  jitterRatio: 0.25,
});

const projectResultValidator = v.object({
  status: v.union(
    v.literal("projected"),
    v.literal("replayed"),
    v.literal("denied"),
    v.literal("stale"),
    v.literal("disabled"),
    v.literal("expired"),
  ),
  eventId: v.id("notificationEvents"),
  deliveryId: v.union(v.id("notificationDeliveries"), v.null()),
  inboxItemId: v.union(v.id("notificationInboxItems"), v.null()),
});

type SourceCheck =
  | { current: true; sourceAuthorityVersion: string }
  | {
      current: false;
      cancellationReason: "source_changed" | "authority_revoked";
    };

function isEnabled(name: string): boolean {
  return process.env[name] === "true";
}

function parseId<TableName extends SourceTable>(
  ctx: MutationCtx,
  tableName: TableName,
  value: string,
): Id<TableName> | null {
  if (!value || value.length > 1_024) return null;
  return ctx.db.normalizeId(tableName, value) as Id<TableName> | null;
}

function idFromReference<TableName extends SourceTable>(
  ctx: MutationCtx,
  tableName: TableName,
  reference: string,
  prefix: string,
): Id<TableName> | null {
  if (!reference.startsWith(prefix) || reference.length > 1_024) return null;
  return parseId(ctx, tableName, reference.slice(prefix.length));
}

async function getCurrentMembership(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user_and_revoked_at", (q) =>
      q.eq("userId", userId).eq("revokedAt", undefined),
    )
    .take(MAX_SOURCE_ROWS);
  return rows.length === 1 ? rows[0] : null;
}

async function getActiveRelationship(
  ctx: MutationCtx,
  ownerUserId: Id<"users">,
  recipientUserId: Id<"users">,
) {
  if (ownerUserId === recipientUserId) return null;
  const [ownerMembership, recipientMembership] = await Promise.all([
    getCurrentMembership(ctx, ownerUserId),
    getCurrentMembership(ctx, recipientUserId),
  ]);
  if (
    !ownerMembership ||
    !recipientMembership ||
    ownerMembership.coupleId !== recipientMembership.coupleId ||
    ownerMembership.role === recipientMembership.role
  ) {
    return null;
  }
  const couple = await ctx.db.get(ownerMembership.coupleId);
  if (!couple || couple.status !== "active") return null;
  return { couple, ownerMembership, recipientMembership };
}

async function checkEventSource(
  ctx: MutationCtx,
  event: Doc<"notificationEvents">,
): Promise<SourceCheck> {
  switch (event.eventType) {
    case "assisted_period_start.v1":
    case "assisted_period_end.v1": {
      const periodId = idFromReference(ctx, "periodEvents", event.sourceReference, "period:");
      const expectedVersion = /^period-authority:([1-9][0-9]*)$/.exec(
        event.sourceAuthorityVersion,
      );
      if (!periodId || !expectedVersion) {
        return { current: false, cancellationReason: "source_changed" };
      }
      const period = await ctx.db.get(periodId);
      const recipient = await ctx.db.get(event.recipientUserId);
      const authorityVersion = Number(expectedVersion[1]);
      if (
        !period ||
        !recipient ||
        recipient.role !== "primary" ||
        event.ownerUserId !== event.recipientUserId ||
        period.userId !== event.recipientUserId ||
        period.source !== "partner_assist" ||
        period.confirmationStatus !== "confirmed" ||
        period.tombstoneAt !== undefined ||
        period.authorityVersion !== authorityVersion ||
        (period.startCertainty !== "exact" && period.startCertainty !== "approximate") ||
        (event.eventType === "assisted_period_end.v1" &&
          (period.endDate === undefined ||
            (period.endCertainty !== "exact" && period.endCertainty !== "approximate")))
      ) {
        return { current: false, cancellationReason: "source_changed" };
      }
      return { current: true, sourceAuthorityVersion: event.sourceAuthorityVersion };
    }
    case "partner_message.v1": {
      const messageId = idFromReference(ctx, "coupleMessages", event.sourceReference, "message:");
      if (!messageId) {
        return { current: false, cancellationReason: "source_changed" };
      }
      const message = await ctx.db.get(messageId);
      if (!message || message.senderId !== event.ownerUserId) {
        return { current: false, cancellationReason: "source_changed" };
      }
      const relationship = await getActiveRelationship(
        ctx,
        event.ownerUserId,
        event.recipientUserId,
      );
      if (
        !relationship ||
        relationship.couple._id !== message.coupleId ||
        message.relationshipMembershipId !== relationship.recipientMembership._id ||
        message.clearedAt !== undefined ||
        (relationship.couple.chatClearedAt !== undefined &&
          message.createdAt <= relationship.couple.chatClearedAt)
      ) {
        return {
          current: false,
          cancellationReason: relationship ? "source_changed" : "authority_revoked",
        };
      }
      return { current: true, sourceAuthorityVersion: event.sourceAuthorityVersion };
    }
    case "partner_chat_cleared.v1": {
      const coupleId = idFromReference(ctx, "couples", event.sourceReference, "couple-chat:");
      const clearVersion = /^chat-clear:([1-9][0-9]*)$/.exec(
        event.sourceAuthorityVersion,
      );
      if (!coupleId || !clearVersion) {
        return { current: false, cancellationReason: "source_changed" };
      }
      const relationship = await getActiveRelationship(
        ctx,
        event.ownerUserId,
        event.recipientUserId,
      );
      const clearedAt = Number(clearVersion[1]);
      if (
        !relationship ||
        relationship.couple._id !== coupleId ||
        relationship.couple.chatClearedAt !== clearedAt ||
        (relationship.couple.linkedAt !== undefined &&
          relationship.couple.linkedAt > event.createdAt)
      ) {
        return {
          current: false,
          cancellationReason: relationship ? "source_changed" : "authority_revoked",
        };
      }
      return { current: true, sourceAuthorityVersion: event.sourceAuthorityVersion };
    }
    case "partner_nudge.v1": {
      const nudgeId = idFromReference(ctx, "nudges", event.sourceReference, "nudge:");
      if (!nudgeId) return { current: false, cancellationReason: "source_changed" };
      const nudge = await ctx.db.get(nudgeId);
      if (
        !nudge ||
        nudge.seenAt !== undefined ||
        nudge.senderId !== event.ownerUserId ||
        nudge.receiverId !== event.recipientUserId
      ) {
        return { current: false, cancellationReason: "source_changed" };
      }
      const relationship = await getActiveRelationship(
        ctx,
        event.ownerUserId,
        event.recipientUserId,
      );
      if (
        !relationship ||
        relationship.couple._id !== nudge.coupleId ||
        nudge.relationshipMembershipId !== relationship.recipientMembership._id
      ) {
        return {
          current: false,
          cancellationReason: relationship ? "source_changed" : "authority_revoked",
        };
      }
      return { current: true, sourceAuthorityVersion: event.sourceAuthorityVersion };
    }
    default:
      // Event kinds without an integrated source reader fail closed until their
      // owner hands the current source contract to the N8 integration lane.
      return { current: false, cancellationReason: "source_changed" };
  }
}

function eventMatchesCatalog(event: Doc<"notificationEvents">): boolean {
  const definition = notificationEventDefinitions[event.eventType];
  const catalogRecipientScope: Record<string, string> = {
    primary: "primary",
    each_link_member_separately: "each_link_member_separately",
    other_active_member: "other_active_member",
    nudge_receiver: "nudge_receiver",
  };
  return (
    event.eventVersion === definition.version &&
    event.purpose === definition.purpose &&
    event.producerKind === definition.producer &&
    event.recipientScope === catalogRecipientScope[definition.recipient] &&
    event.privacyClass === definition.privacyClass &&
    event.validityRule === definition.validity &&
    definition.allowedChannels.some((channel) => channel === event.allowedChannel) &&
    (event.recipientScope !== "primary" || event.ownerUserId === event.recipientUserId)
  );
}

async function hasControl(
  ctx: MutationCtx,
  scope: "global" | "channel" | "purpose",
  key: string,
): Promise<boolean> {
  const control = await ctx.db
    .query("notificationControls")
    .withIndex("by_scope_and_key", (q) => q.eq("scope", scope).eq("key", key))
    .unique();
  return control !== null;
}

function inboxIdempotencyKey(eventId: Id<"notificationEvents">, recipientUserId: Id<"users">) {
  return `inbox:v1:${JSON.stringify([String(eventId), String(recipientUserId)])}`;
}

async function findInboxItem(
  ctx: MutationCtx,
  eventId: Id<"notificationEvents">,
  recipientUserId: Id<"users">,
) {
  return await ctx.db
    .query("notificationInboxItems")
    .withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", inboxIdempotencyKey(eventId, recipientUserId)),
    )
    .unique();
}

async function findInboxItemsForEvent(
  ctx: MutationCtx,
  eventId: Id<"notificationEvents">,
) {
  return await ctx.db
    .query("notificationInboxItems")
    .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
    .take(MAX_SOURCE_ROWS + 1);
}

async function findInboxItemsForIdempotencyKey(
  ctx: MutationCtx,
  idempotencyKey: string,
) {
  return await ctx.db
    .query("notificationInboxItems")
    .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
    .take(2);
}

function checkedDeliveryRecord(delivery: Doc<"notificationDeliveries">) {
  const record = delivery as NotificationDeliveryRecord;
  if (!isValidNotificationDeliveryRecord(record)) {
    throw new Error("Stored in-app notification delivery is invalid");
  }
  return record;
}

function deniedDeliveryPatch(
  delivery: Doc<"notificationDeliveries">,
  args: {
    status: "suppressed" | "cancelled";
    reason?: "source_changed" | "authority_revoked";
    now: number;
  },
) {
  const ineligible = args.status;
  return {
    state: ineligible,
    eligibility: ineligible,
    ...(args.reason ? { cancellationReason: args.reason } : {}),
    errorCode: args.status === "cancelled" ? "authorization_revoked" as const : undefined,
    nextAttemptAt: undefined,
    leaseUntil: undefined,
    updatedAt: args.now,
  };
}

async function hideCurrentInboxItem(
  ctx: MutationCtx,
  eventId: Id<"notificationEvents">,
  recipientUserId: Id<"users">,
) {
  const item = await findInboxItem(ctx, eventId, recipientUserId);
  if (item?.state === "current") {
    await ctx.db.patch(item._id, { state: "hidden" });
  }
}

export const projectInApp = internalMutation({
  args: projectInAppArgsValidator.fields,
  returns: projectResultValidator,
  handler: async (ctx, args) => {
    const eventId = args.eventId;
    const emptyResult = {
      eventId,
      deliveryId: null,
      inboxItemId: null,
    };
    if (
      !Number.isSafeInteger(args.expectedGeneration) ||
      args.expectedGeneration < 0
    ) {
      return { status: "stale" as const, ...emptyResult };
    }
    if (
      !isEnabled(OUTBOX_ENABLED_ENV) ||
      !isEnabled(PROJECTION_ENABLED_ENV) ||
      !isEnabled(DELIVERY_ENABLED_ENV)
    ) {
      return { status: "disabled" as const, ...emptyResult };
    }

    const event = await ctx.db.get(eventId);
    if (!event) return { status: "denied" as const, ...emptyResult };

    const deliveryRows = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .take(MAX_SOURCE_ROWS);
    if (deliveryRows.length !== 1) {
      return { status: "denied" as const, ...emptyResult };
    }
    const delivery = deliveryRows[0];
    const deliveryId = delivery._id;
    const resultBase = { eventId, deliveryId, inboxItemId: null };
    const now = Date.now();
    const currentRecord = checkedDeliveryRecord(delivery);
    if (
      delivery.eventId !== event._id ||
      delivery.recipientUserId !== event.recipientUserId ||
      delivery.channel !== "in_app" ||
      delivery.stableDestinationId !== String(event.recipientUserId) ||
      delivery.logicalKey !==
        makeDeliveryIdempotencyKey(String(event._id), "in_app", String(event.recipientUserId))
    ) {
      throw new Error("Stored delivery does not match the event recipient authority");
    }
    if (args.expectedGeneration !== delivery.claimGeneration) {
      return { status: "stale" as const, ...resultBase };
    }

    const expectedInboxKey = inboxIdempotencyKey(event._id, event.recipientUserId);
    const eventInboxItems = await findInboxItemsForEvent(ctx, event._id);
    const keyedInboxItems = await findInboxItemsForIdempotencyKey(ctx, expectedInboxKey);
    const maxRecipients = event.recipientScope === "each_link_member_separately" ? 2 : 1;
    const recipientInboxItems = eventInboxItems.filter(
      (item) => item.recipientUserId === event.recipientUserId,
    );
    const inboxItem = recipientInboxItems[0] ?? null;
    const inboxConflict =
      eventInboxItems.length > maxRecipients ||
      recipientInboxItems.length > 1 ||
      (inboxItem !== null && inboxItem.idempotencyKey !== expectedInboxKey) ||
      keyedInboxItems.length > 1 ||
      keyedInboxItems.some(
        (item) => item.eventId !== event._id || item.recipientUserId !== event.recipientUserId,
      );
    if (inboxConflict) {
      if (delivery.state !== "delivered") {
        await ctx.db.patch(
          delivery._id,
          deniedDeliveryPatch(delivery, { status: "suppressed", now }),
        );
      }
      return { status: "denied" as const, ...resultBase };
    }

    if (!eventMatchesCatalog(event)) {
      if (delivery.state === "delivered") {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
      } else {
        await ctx.db.patch(
          delivery._id,
          deniedDeliveryPatch(delivery, { status: "suppressed", now }),
        );
      }
      return { status: "denied" as const, ...resultBase };
    }

    if (delivery.state === "delivered") {
      const source = await checkEventSource(ctx, event);
      if (!source.current) {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
        await ctx.db.patch(
          delivery._id,
          deniedDeliveryPatch(delivery, {
            status: "cancelled",
            reason: source.cancellationReason,
            now,
          }),
        );
        return { status: "denied" as const, ...resultBase };
      }
      return {
        status: "replayed" as const,
        eventId,
        deliveryId,
        inboxItemId: inboxItem?._id ?? null,
      };
    }

    const recipient = await ctx.db.get(event.recipientUserId);
    const source = await checkEventSource(ctx, event);
    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", event.recipientUserId).eq("purpose", event.purpose),
      )
      .unique();
    const [globalDenied, channelDenied, purposeDenied] = await Promise.all([
      hasControl(ctx, "global", "delivery"),
      hasControl(ctx, "channel", "in_app"),
      hasControl(ctx, "purpose", event.purpose),
    ]);
    const authorization = authorizeNotificationProjection({
      eventType: event.eventType,
      purpose: event.purpose,
      channel: delivery.channel,
      recipientUserId: String(event.recipientUserId),
      currentRecipientUserId:
        recipient && recipient.role !== undefined ? String(recipient._id) : null,
      sourceAuthorityVersion: event.sourceAuthorityVersion,
      currentSourceAuthorityVersion: source.current
        ? source.sourceAuthorityVersion
        : null,
      expectedGeneration: args.expectedGeneration,
      currentGeneration: delivery.claimGeneration,
      purposeEnabled: preference?.inAppEnabled === true,
      // No Gate 4 content approval exists for the Late template.
      lateContentApproved: false,
      flags: { projectionEnabled: true, deliveryEnabled: true },
      controls: { globalDenied, channelDenied, purposeDenied },
    });
    if (!authorization.allowed) {
      const isRevocation =
        authorization.reason === "stale_source" ||
        authorization.reason === "recipient_mismatch";
      const reason = isRevocation
        ? source.current
          ? "authority_revoked"
          : source.cancellationReason
        : undefined;
      if (isRevocation) {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
      }
      await ctx.db.patch(
        delivery._id,
        deniedDeliveryPatch(delivery, {
          status: isRevocation ? "cancelled" : "suppressed",
          reason,
          now,
        }),
      );
      return { status: "denied" as const, ...resultBase };
    }

    if (
      inboxItem &&
      (inboxItem.templateVersion !== delivery.renderIdentity.templateVersion ||
        inboxItem.route === undefined)
    ) {
      await ctx.db.patch(
        delivery._id,
        deniedDeliveryPatch(delivery, { status: "suppressed", now }),
      );
      return { status: "denied" as const, ...resultBase };
    }

    let rendered;
    try {
      rendered = await renderFrozen({
        eventType: event.eventType,
        templateVersion: delivery.renderIdentity.templateVersion,
        locale: delivery.renderIdentity.locale,
        variableSchemaVersion: delivery.renderIdentity.variableSchemaVersion,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Notification template is gated pending D-011 approval"
      ) {
        await ctx.db.patch(
          delivery._id,
          deniedDeliveryPatch(delivery, { status: "suppressed", now }),
        );
        return { status: "denied" as const, ...resultBase };
      }
      throw error;
    }
    if (
      !sameFrozenRenderIdentity(delivery.renderIdentity, rendered.identity) ||
      (inboxItem && inboxItem.route !== rendered.payload.route)
    ) {
      await ctx.db.patch(
        delivery._id,
        deniedDeliveryPatch(delivery, { status: "suppressed", now }),
      );
      return { status: "denied" as const, ...resultBase };
    }

    const claim = claimInAppDelivery(currentRecord, {
      expectedGeneration: args.expectedGeneration,
      now,
      limits: IN_APP_LIMITS,
    });
    if (claim.kind === "stale_generation") {
      return { status: "stale" as const, ...resultBase };
    }
    if (claim.kind === "expired") {
      const expired = assertValidNotificationDeliveryRecord(claim.record);
      await ctx.db.patch(delivery._id, {
        state: "expired",
        eligibility: "expired",
        attemptCount: expired.attemptCount,
        claimGeneration: expired.claimGeneration,
        leaseUntil: expired.leaseUntil,
        errorCode: expired.errorCode,
        nextAttemptAt: undefined,
        updatedAt: expired.updatedAt,
      });
      return { status: "expired" as const, ...resultBase };
    }
    if (claim.kind === "attempts_exhausted") {
      const exhausted = assertValidNotificationDeliveryRecord(claim.record);
      await ctx.db.patch(delivery._id, {
        state: "failed_permanent",
        eligibility: "eligible",
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        leaseUntil: exhausted.leaseUntil,
        updatedAt: exhausted.updatedAt,
      });
      return { status: "denied" as const, ...resultBase };
    }
    if (claim.kind !== "claimed") {
      return { status: "denied" as const, ...resultBase };
    }

    const claimed = assertValidNotificationDeliveryRecord(claim.record);
    const attempt = {
      deliveryId: delivery._id,
      attemptOrdinal: claimed.attemptCount,
      claimGeneration: claimed.claimGeneration,
      startedAt: now,
      completedAt: now,
      result: { kind: "in_app_persisted" as const },
    };
    // This numeric guard runs before the first write in this transaction.
    assertValidNotificationDeliveryAttemptNumbers(attempt);
    const existingAttempt = await ctx.db
      .query("notificationDeliveryAttempts")
      .withIndex("by_delivery_and_ordinal", (q) =>
        q.eq("deliveryId", delivery._id).eq("attemptOrdinal", attempt.attemptOrdinal),
      )
      .unique();
    if (existingAttempt) {
      throw new Error("In-app delivery attempt ordinal already exists");
    }

    await ctx.db.patch(delivery._id, {
      state: "delivered",
      eligibility: "eligible",
      providerOutcome: "none",
      attemptCount: claimed.attemptCount,
      claimGeneration: claimed.claimGeneration,
      renderIdentity: claimed.renderIdentity,
      nextAttemptAt: undefined,
      leaseUntil: undefined,
      dispatchStartedAt: undefined,
      nextReceiptCheckAt: undefined,
      reviewAt: undefined,
      errorCode: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("notificationDeliveryAttempts", attempt);
    const inboxItemId = inboxItem
      ? inboxItem._id
      : await ctx.db.insert("notificationInboxItems", {
          eventId: event._id,
          recipientUserId: event.recipientUserId,
          idempotencyKey: inboxIdempotencyKey(event._id, event.recipientUserId),
          templateVersion: rendered.identity.templateVersion,
          route: rendered.payload.route,
          state: "current",
          createdAt: now,
        });
    return { status: "projected" as const, eventId, deliveryId, inboxItemId };
  },
});
