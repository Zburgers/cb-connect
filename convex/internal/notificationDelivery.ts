import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import {
  assertValidNotificationDeliveryAttemptNumbers,
  assertValidNotificationDeliveryRecord,
  claimInAppDelivery,
  isValidProjectInAppArgs,
  isValidNotificationDeliveryRecord,
  makeDeliveryIdempotencyKey,
  projectInAppArgsValidator,
  sameFrozenRenderIdentity,
  type NotificationDeliveryRecord,
  type NotificationOperationalLimits,
} from "../_helpers/notificationDelivery";
import { authorizeNotificationProjection } from "../_helpers/notificationPolicy";
import { isNotificationSourceCurrent } from "../_helpers/notificationSourceReader";
import { renderFrozen } from "../_helpers/notificationTemplates";
import { notificationEventDefinitions } from "../_helpers/notificationTypes";

const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const PROJECTION_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_PROJECTION_V1";
const DELIVERY_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_DELIVERY_V1";
const MAX_SOURCE_ROWS = 2;

// The in-app adapter is a single atomic Convex transaction. The remaining
// finite settings share the N2c versioned limits contract and are measured at
// N8 before qualification.
export const IN_APP_LIMITS: NotificationOperationalLimits = Object.freeze({
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

function isEnabled(name: string): boolean {
  return process.env[name] === "true";
}

export function nextTerminalClaimGeneration(generation: number): number | null {
  return Number.isSafeInteger(generation) &&
    generation >= 0 &&
    generation < Number.MAX_SAFE_INTEGER
    ? generation + 1
    : null;
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

function projectorScheduleFencesMatchEvent(
  event: Doc<"notificationEvents">,
  args: Parameters<typeof isValidProjectInAppArgs>[0] & {
    expectedSourceAuthorityVersion?: string;
    expectedReminderWindowVersion?: number;
  },
): boolean {
  if (
    event.eventType !== "period_window_approaching.v1" &&
    event.eventType !== "late_status.v1"
  ) {
    return true;
  }
  const identity = event.sourceIdentity;
  return (
    identity !== undefined &&
    identity.eventType === event.eventType &&
    "sourceAuthorityVersion" in identity &&
    args.expectedSourceAuthorityVersion === identity.sourceAuthorityVersion &&
    args.expectedReminderWindowVersion === identity.reminderWindowVersion &&
    event.sourceAuthorityVersion === identity.sourceAuthorityVersion
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
  const claimGeneration = nextTerminalClaimGeneration(delivery.claimGeneration);
  if (claimGeneration === null) return null;
  const ineligible = args.status;
  return {
    state: ineligible,
    eligibility: ineligible,
    claimGeneration,
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
    const requiresScheduleFences =
      event.eventType === "period_window_approaching.v1" ||
      event.eventType === "late_status.v1";
    if (
      !isValidProjectInAppArgs(args, { requireScheduleFences: requiresScheduleFences }) ||
      !projectorScheduleFencesMatchEvent(event, args)
    ) {
      return { status: "denied" as const, ...emptyResult };
    }
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
        const patch = deniedDeliveryPatch(delivery, { status: "suppressed", now });
        if (patch) await ctx.db.patch(delivery._id, patch);
      }
      return { status: "denied" as const, ...resultBase };
    }

    if (!eventMatchesCatalog(event)) {
      if (delivery.state === "delivered") {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
      } else {
        const patch = deniedDeliveryPatch(delivery, { status: "suppressed", now });
        if (patch) await ctx.db.patch(delivery._id, patch);
      }
      return { status: "denied" as const, ...resultBase };
    }

    if (delivery.state === "delivered") {
      if (delivery.expiresAt !== undefined && delivery.expiresAt <= now) {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
        await ctx.db.patch(delivery._id, {
          state: "expired",
          eligibility: "expired",
          claimGeneration: nextTerminalClaimGeneration(delivery.claimGeneration) ??
            delivery.claimGeneration,
          cancellationReason: "expired",
          errorCode: "expired",
          nextAttemptAt: undefined,
          leaseUntil: undefined,
          dispatchStartedAt: undefined,
          nextReceiptCheckAt: undefined,
          reviewAt: undefined,
          updatedAt: now,
        });
        return { status: "expired" as const, ...resultBase };
      }
      const sourceCurrent = await isNotificationSourceCurrent(ctx, event);
      if (!sourceCurrent) {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
        const patch = deniedDeliveryPatch(delivery, {
          status: "cancelled",
          reason: "source_changed",
          now,
        });
        if (patch) await ctx.db.patch(delivery._id, patch);
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
    const sourceCurrent = await isNotificationSourceCurrent(ctx, event);
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
      currentSourceAuthorityVersion: sourceCurrent
        ? event.sourceAuthorityVersion
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
        ? sourceCurrent
          ? "authority_revoked"
          : "source_changed"
        : undefined;
      if (isRevocation) {
        await hideCurrentInboxItem(ctx, event._id, event.recipientUserId);
      }
      const patch = deniedDeliveryPatch(delivery, {
        status: isRevocation ? "cancelled" : "suppressed",
        reason,
        now,
      });
      if (patch) await ctx.db.patch(delivery._id, patch);
      return { status: "denied" as const, ...resultBase };
    }

    if (
      inboxItem &&
      (inboxItem.templateVersion !== delivery.renderIdentity.templateVersion ||
        inboxItem.route === undefined)
    ) {
      const patch = deniedDeliveryPatch(delivery, { status: "suppressed", now });
      if (patch) await ctx.db.patch(delivery._id, patch);
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
        const patch = deniedDeliveryPatch(delivery, { status: "suppressed", now });
        if (patch) await ctx.db.patch(delivery._id, patch);
        return { status: "denied" as const, ...resultBase };
      }
      throw error;
    }
    if (
      !sameFrozenRenderIdentity(delivery.renderIdentity, rendered.identity) ||
      (inboxItem && inboxItem.route !== rendered.payload.route)
    ) {
      const patch = deniedDeliveryPatch(delivery, { status: "suppressed", now });
      if (patch) await ctx.db.patch(delivery._id, patch);
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
      const claimGeneration = nextTerminalClaimGeneration(delivery.claimGeneration);
      if (claimGeneration === null) {
        return { status: "stale" as const, ...resultBase };
      }
      const expired = assertValidNotificationDeliveryRecord(claim.record);
      await ctx.db.patch(delivery._id, {
        state: "expired",
        eligibility: "expired",
        claimGeneration,
        attemptCount: expired.attemptCount,
        leaseUntil: expired.leaseUntil,
        errorCode: expired.errorCode,
        nextAttemptAt: undefined,
        updatedAt: expired.updatedAt,
      });
      return { status: "expired" as const, ...resultBase };
    }
    if (claim.kind === "attempts_exhausted") {
      const claimGeneration = nextTerminalClaimGeneration(delivery.claimGeneration);
      if (claimGeneration === null) {
        return { status: "stale" as const, ...resultBase };
      }
      const exhausted = assertValidNotificationDeliveryRecord(claim.record);
      await ctx.db.patch(delivery._id, {
        state: "failed_permanent",
        eligibility: "eligible",
        claimGeneration,
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
