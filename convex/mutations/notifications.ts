import { v } from "convex/values";

import { internalMutation, mutation } from "../_generated/server";
import {
  notificationEventDefinitions,
  notificationEventEnvelopeValidator,
} from "../_helpers/notificationTypes";
import {
  frozenRenderIdentityValidator,
  isEventChannelAllowed,
  isValidFrozenRenderIdentity,
  makeDeliveryIdempotencyKey,
  notificationInboxRouteValidator,
  type FrozenRenderIdentity,
  type NotificationInboxRoute,
} from "../_helpers/notificationDelivery";
import { getCurrentUser } from "../_helpers/auth";
import {
  notificationPurposeValidator,
  notificationPurposeValues,
} from "../schema";

const MAX_KEY_LENGTH = 1_024;
const INBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_INBOX_V1";
const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const PROJECTION_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_PROJECTION_V1";

type NotificationFlagName =
  | typeof INBOX_ENABLED_ENV
  | typeof OUTBOX_ENABLED_ENV
  | typeof PROJECTION_ENABLED_ENV;

const ensureInAppRecordsArgsValidator = v.object({
  envelope: notificationEventEnvelopeValidator,
  route: notificationInboxRouteValidator,
  templateVersion: v.string(),
  renderIdentity: frozenRenderIdentityValidator,
  createdAt: v.number(),
  notBefore: v.number(),
  expiresAt: v.optional(v.number()),
});

const ensureInAppRecordsResultValidator = v.object({
  status: v.union(
    v.literal("disabled"),
    v.literal("event_only"),
    v.literal("projected"),
  ),
  eventId: v.union(v.id("notificationEvents"), v.null()),
  deliveryId: v.union(v.id("notificationDeliveries"), v.null()),
  inboxItemId: v.union(v.id("notificationInboxItems"), v.null()),
});

const preferenceResultValidator = v.object({
  purpose: notificationPurposeValidator,
  inAppEnabled: v.boolean(),
  localReminderTime: v.optional(v.string()),
});

function isEnabled(name: NotificationFlagName): boolean {
  switch (name) {
    case INBOX_ENABLED_ENV:
      return process.env.CB_CONNECT_NOTIFICATION_INBOX_V1 === "true";
    case OUTBOX_ENABLED_ENV:
      return process.env.CB_CONNECT_NOTIFICATION_OUTBOX_V1 === "true";
    case PROJECTION_ENABLED_ENV:
      return process.env.CB_CONNECT_NOTIFICATION_PROJECTION_V1 === "true";
  }
}

function assertFiniteTimestamp(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative timestamp`);
  }
}

function assertEventEnvelope(envelope: {
  eventType: keyof typeof notificationEventDefinitions;
  eventVersion: 1;
  purpose: string;
  producerKind: string;
  sourceReference: string;
  sourceAuthorityVersion: string;
  ownerUserId: string;
  recipientUserId: string;
  recipientScope: string;
  privacyClass: string;
  validityRule: string;
  idempotencyKey: string;
  allowedChannel: "in_app";
}): void {
  const definition = notificationEventDefinitions[envelope.eventType];
  const recipientScopeByCatalogValue: Record<string, string> = {
    primary: "primary",
    each_link_member_separately: "each_link_member_separately",
    other_active_member: "other_active_member",
    nudge_receiver: "nudge_receiver",
  };

  if (
    envelope.eventVersion !== definition.version ||
    envelope.purpose !== definition.purpose ||
    envelope.producerKind !== definition.producer ||
    envelope.recipientScope !== recipientScopeByCatalogValue[definition.recipient] ||
    envelope.privacyClass !== definition.privacyClass ||
    envelope.validityRule !== definition.validity ||
    !isEventChannelAllowed(envelope.eventType, envelope.allowedChannel)
  ) {
    throw new Error("Notification event does not match the frozen event catalog");
  }
  if (
    envelope.sourceReference.length === 0 ||
    envelope.sourceReference.length > MAX_KEY_LENGTH ||
    envelope.sourceAuthorityVersion.length === 0 ||
    envelope.sourceAuthorityVersion.length > MAX_KEY_LENGTH ||
    envelope.idempotencyKey.length === 0 ||
    envelope.idempotencyKey.length > MAX_KEY_LENGTH ||
    !envelope.idempotencyKey.startsWith("event:v1:")
  ) {
    throw new Error("Notification event references and keys must be bounded opaque values");
  }
  if (envelope.recipientScope === "primary" && envelope.ownerUserId !== envelope.recipientUserId) {
    throw new Error("Primary-scoped notification recipient must be the event owner");
  }
}

function expectedRoute(eventType: keyof typeof notificationEventDefinitions): NotificationInboxRoute {
  if (eventType === "pain_check_in.v1") return "pain";
  if (
    eventType === "partner_linked.v1" ||
    eventType === "connected_since_updated.v1"
  ) {
    return "settings";
  }
  if (
    eventType === "partner_message.v1" ||
    eventType === "partner_nudge.v1" ||
    eventType === "partner_chat_cleared.v1"
  ) {
    return "messages";
  }
  return "periods";
}

function assertRenderInputs(
  route: NotificationInboxRoute,
  templateVersion: string,
  renderIdentity: FrozenRenderIdentity,
): void {
  if (
    route.length === 0 ||
    templateVersion.length === 0 ||
    templateVersion.length > 64 ||
    !/^g4-static-v[1-9][0-9]*$/.test(templateVersion) ||
    renderIdentity.templateVersion !== templateVersion ||
    !isValidFrozenRenderIdentity(renderIdentity)
  ) {
    throw new Error("Notification rendering identity is invalid");
  }
}

function assertPurposeAndLocalTime(
  purpose: string,
  localReminderTime: string | null | undefined,
): void {
  if (!notificationPurposeValues.includes(purpose as (typeof notificationPurposeValues)[number])) {
    throw new Error("Unknown notification purpose");
  }
  if (
    localReminderTime !== undefined &&
    localReminderTime !== null &&
    !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(localReminderTime)
  ) {
    throw new Error("Local reminder time must use 24-hour HH:mm format");
  }
}

/**
 * Internal transactional storage primitive for the later producer/projector lanes.
 * It cannot accept a channel, and the table validator independently restricts all
 * persisted delivery rows and attempts to in-app-only shapes.
 */
export const ensureInAppRecords = internalMutation({
  args: ensureInAppRecordsArgsValidator.fields,
  returns: ensureInAppRecordsResultValidator,
  handler: async (ctx, args) => {
    if (!isEnabled(OUTBOX_ENABLED_ENV)) {
      return { status: "disabled" as const, eventId: null, deliveryId: null, inboxItemId: null };
    }

    assertEventEnvelope(args.envelope);
    assertFiniteTimestamp(args.createdAt, "createdAt");
    assertFiniteTimestamp(args.notBefore, "notBefore");
    if (args.expiresAt !== undefined) {
      assertFiniteTimestamp(args.expiresAt, "expiresAt");
      if (args.expiresAt <= args.notBefore) {
        throw new Error("Notification expiry must follow its not-before time");
      }
    }
    assertRenderInputs(args.route, args.templateVersion, args.renderIdentity);
    if (args.route !== expectedRoute(args.envelope.eventType)) {
      throw new Error("Notification route does not match the static event route");
    }

    const existingEvent = await ctx.db
      .query("notificationEvents")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.envelope.idempotencyKey),
      )
      .unique();
    const envelopeFields = [
      "eventType",
      "eventVersion",
      "purpose",
      "producerKind",
      "sourceReference",
      "sourceAuthorityVersion",
      "ownerUserId",
      "recipientUserId",
      "recipientScope",
      "privacyClass",
      "validityRule",
      "idempotencyKey",
      "allowedChannel",
    ] as const;
    if (
      existingEvent &&
      envelopeFields.some((field) => existingEvent[field] !== args.envelope[field])
    ) {
      throw new Error("Notification event idempotency key conflicts with stored authority");
    }
    const eventId = existingEvent
      ? existingEvent._id
      : await ctx.db.insert("notificationEvents", {
          ...args.envelope,
          createdAt: args.createdAt,
        });

    if (!isEnabled(PROJECTION_ENABLED_ENV)) {
      return { status: "event_only" as const, eventId, deliveryId: null, inboxItemId: null };
    }

    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", args.envelope.recipientUserId).eq("purpose", args.envelope.purpose),
      )
      .unique();
    if (!preference?.inAppEnabled) {
      return { status: "event_only" as const, eventId, deliveryId: null, inboxItemId: null };
    }

    const stableDestinationId = String(args.envelope.recipientUserId);
    const logicalKey = makeDeliveryIdempotencyKey(String(eventId), "in_app", stableDestinationId);
    const existingDelivery = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_logical_key", (q) => q.eq("logicalKey", logicalKey))
      .unique();
    if (
      existingDelivery &&
      (existingDelivery.eventId !== eventId ||
        existingDelivery.recipientUserId !== args.envelope.recipientUserId ||
        existingDelivery.channel !== "in_app")
    ) {
      throw new Error("Notification delivery key conflicts with stored recipient authority");
    }
    const deliveryId = existingDelivery
      ? existingDelivery._id
      : await ctx.db.insert("notificationDeliveries", {
          eventId,
          recipientUserId: args.envelope.recipientUserId,
          channel: "in_app",
          stableDestinationId,
          logicalKey,
          notBefore: args.notBefore,
          ...(args.expiresAt === undefined ? {} : { expiresAt: args.expiresAt }),
          state: "pending",
          eligibility: "eligible",
          providerOutcome: "none",
          attemptCount: 0,
          claimGeneration: 0,
          renderIdentity: args.renderIdentity,
          createdAt: args.createdAt,
          updatedAt: args.createdAt,
        });

    const inboxIdempotencyKey = `inbox:v1:${JSON.stringify([
      String(eventId),
      String(args.envelope.recipientUserId),
    ])}`;
    const existingItem = await ctx.db
      .query("notificationInboxItems")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", inboxIdempotencyKey),
      )
      .unique();
    if (
      existingItem &&
      (existingItem.eventId !== eventId ||
        existingItem.recipientUserId !== args.envelope.recipientUserId)
    ) {
      throw new Error("Inbox idempotency key conflicts with stored recipient authority");
    }
    const inboxItemId = existingItem
      ? existingItem._id
      : await ctx.db.insert("notificationInboxItems", {
          eventId,
          recipientUserId: args.envelope.recipientUserId,
          idempotencyKey: inboxIdempotencyKey,
          templateVersion: args.templateVersion,
          route: args.route,
          state: "current",
          createdAt: args.createdAt,
        });

    return { status: "projected" as const, eventId, deliveryId, inboxItemId };
  },
});

export const setMyPreference = mutation({
  args: {
    purpose: notificationPurposeValidator,
    inAppEnabled: v.boolean(),
    localReminderTime: v.optional(v.union(v.string(), v.null())),
  },
  returns: preferenceResultValidator,
  handler: async (ctx, args) => {
    assertPurposeAndLocalTime(args.purpose, args.localReminderTime);
    const user = await getCurrentUser(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", user._id).eq("purpose", args.purpose),
      )
      .unique();
    const localReminderTime = args.localReminderTime === undefined
      ? existing?.localReminderTime
      : args.localReminderTime ?? undefined;
    const changed =
      existing === null ||
      existing === undefined
        ? args.inAppEnabled || localReminderTime !== undefined
        : existing.inAppEnabled !== args.inAppEnabled ||
          existing.localReminderTime !== localReminderTime;
    const currentVersion = existing?.reminderWindowVersion ?? 0;
    if (!Number.isSafeInteger(currentVersion) || currentVersion < 0) {
      throw new Error("Stored reminder schedule version is invalid");
    }
    const reminderWindowVersion = changed ? currentVersion + 1 : currentVersion;
    if (!Number.isSafeInteger(reminderWindowVersion)) {
      throw new Error("Reminder schedule version exhausted its safe integer range");
    }
    const updatedAt = Date.now();
    const baseValues = {
      userId: user._id,
      purpose: args.purpose,
      inAppEnabled: args.inAppEnabled,
      reminderWindowVersion,
      updatedAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...baseValues,
        ...(args.localReminderTime === null
          ? { localReminderTime: undefined }
          : localReminderTime === undefined
            ? {}
            : { localReminderTime }),
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        ...baseValues,
        ...(localReminderTime === undefined ? {} : { localReminderTime }),
      });
    }

    return {
      purpose: args.purpose,
      inAppEnabled: args.inAppEnabled,
      ...(localReminderTime === undefined ? {} : { localReminderTime }),
    };
  },
});

export const markMyInboxItemRead = mutation({
  args: { itemId: v.id("notificationInboxItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isEnabled(INBOX_ENABLED_ENV)) {
      throw new Error("Notification inbox is disabled");
    }
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.recipientUserId !== user._id || item.state !== "current") {
      throw new Error("Notification item not found");
    }
    if (item.readAt === undefined) {
      await ctx.db.patch(item._id, { readAt: Date.now() });
    }
    return null;
  },
});

export const dismissMyInboxItem = mutation({
  args: { itemId: v.id("notificationInboxItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isEnabled(INBOX_ENABLED_ENV)) {
      throw new Error("Notification inbox is disabled");
    }
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.recipientUserId !== user._id) {
      throw new Error("Notification item not found");
    }
    if (item.state === "dismissed") return null;
    if (item.state !== "current") throw new Error("Notification item not found");
    await ctx.db.patch(item._id, {
      state: "dismissed",
      dismissedAt: Date.now(),
    });
    return null;
  },
});
