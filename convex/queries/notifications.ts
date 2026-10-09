import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";
import {
  isCurrentNotificationScheduleFence,
  isValidNotificationDueWorkRecord,
  type NotificationDueWorkKind,
} from "../_helpers/notificationSourceAuthority";
import {
  notificationInboxRouteValidator,
} from "../_helpers/notificationDelivery";
import { isNotificationSourceCurrent } from "../_helpers/notificationSourceReader";
import { notificationEventTypeValidator } from "../_helpers/notificationTypes";
import {
  notificationControlValidator,
  notificationDueWorkValidator,
  notificationPurposeValues,
} from "../schema";

const MAX_INBOX_PAGE_SIZE = 50;
const MAX_DUE_WORK_ITEMS = 100;
const MAX_CURSOR_LENGTH = 2_048;

const notificationDueWorkKindValidator = v.union(
  v.literal("delivery"),
  v.literal("prediction_window"),
  v.literal("late_boundary"),
  v.literal("source_reconcile"),
  v.literal("pain_reminder"),
);

const inboxPaginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
});

const preferenceResultValidator = v.object({
  purpose: v.union(
    v.literal("assisted_period_start"),
    v.literal("assisted_period_end"),
    v.literal("period_window_approaching"),
    v.literal("late_status"),
    v.literal("pain_check_in"),
    v.literal("partner_linked"),
    v.literal("partner_message"),
    v.literal("partner_nudge"),
    v.literal("partner_chat_cleared"),
    v.literal("connected_since_updated"),
  ),
  inAppEnabled: v.boolean(),
  localReminderTime: v.optional(v.string()),
});

const inboxItemResultValidator = v.object({
  itemId: v.id("notificationInboxItems"),
  eventType: notificationEventTypeValidator,
  templateVersion: v.string(),
  route: v.optional(notificationInboxRouteValidator),
  state: v.literal("current"),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
});

const dueWorkResultValidator = v.object({
  ...notificationDueWorkValidator.fields,
  _id: v.id("notificationDueWork"),
  _creationTime: v.number(),
});

const controlResultValidator = v.union(
  v.object({ blocked: v.literal(false) }),
  v.object({ blocked: v.literal(true), control: notificationControlValidator }),
);

function assertEnabledInbox(): void {
  if (process.env.CB_CONNECT_NOTIFICATION_INBOX_V1 !== "true") {
    throw new Error("Notification inbox is disabled");
  }
}

async function isCurrentDueWork(ctx: QueryCtx, row: Doc<"notificationDueWork">): Promise<boolean> {
  if (!isValidNotificationDueWorkRecord(row)) return false;
  if (row.kind === "prediction_window" || row.kind === "late_boundary") {
    const purpose = row.kind === "prediction_window"
      ? "period_window_approaching"
      : "late_status";
    const [currentState, currentPreference] = await Promise.all([
      ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", row.ownerUserId))
        .unique(),
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", row.ownerUserId).eq("purpose", purpose),
        )
        .unique(),
    ]);
    return isCurrentNotificationScheduleFence(row, currentState, currentPreference);
  }
  if (row.kind === "delivery") {
    if (!row.deliveryId) return false;
    const delivery = await ctx.db.get(row.deliveryId);
    return delivery !== null && delivery.recipientUserId === row.ownerUserId;
  }
  if (row.kind === "pain_reminder") {
    if (!row.painReminderRequestId) return false;
    const request = await ctx.db.get(row.painReminderRequestId);
    return (
      request !== null &&
      request.ownerUserId === row.ownerUserId &&
      request.state === "active"
    );
  }
  return true;
}

function assertDueWorkBounds(now: number, limit: number): void {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Due-work time must be a finite non-negative integer timestamp");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_DUE_WORK_ITEMS) {
    throw new Error(`Due-work limit must be between 1 and ${MAX_DUE_WORK_ITEMS}`);
  }
}

export const getMyPreferences = query({
  args: {},
  returns: v.array(preferenceResultValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const stored = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(notificationPurposeValues.length + 1);
    if (
      stored.length > notificationPurposeValues.length ||
      new Set(stored.map((preference) => preference.purpose)).size !== stored.length
    ) {
      throw new Error("Notification preferences exceeded their bounded purpose set");
    }

    const byPurpose = new Map(stored.map((preference) => [preference.purpose, preference]));
    return notificationPurposeValues.map((purpose) => {
      const preference = byPurpose.get(purpose);
      return {
        purpose,
        inAppEnabled: preference?.inAppEnabled ?? false,
        ...(preference?.localReminderTime === undefined
          ? {}
          : { localReminderTime: preference.localReminderTime }),
      };
    });
  },
});

export const getMyInbox = query({
  args: { paginationOpts: inboxPaginationOptsValidator },
  returns: paginationResultValidator(inboxItemResultValidator),
  handler: async (ctx, args) => {
    assertEnabledInbox();
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_INBOX_PAGE_SIZE
    ) {
      throw new Error(
        `Notification inbox page size is outside the supported bound 1..${MAX_INBOX_PAGE_SIZE}`,
      );
    }
    if (
      args.paginationOpts.cursor !== null &&
      args.paginationOpts.cursor.length > MAX_CURSOR_LENGTH
    ) {
      throw new Error("Notification inbox cursor exceeds its fixed bound");
    }
    const user = await getCurrentUser(ctx);
    const page = await ctx.db
      .query("notificationInboxItems")
      .withIndex("by_recipient_state_and_created_at", (q) =>
        q.eq("recipientUserId", user._id).eq("state", "current"),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const joinedPage = await Promise.all(
      page.page.map(async (item) => {
        const event = await ctx.db.get(item.eventId);
        if (!event || !(await isNotificationSourceCurrent(ctx, event))) return null;
        return {
          itemId: item._id,
          eventType: event.eventType,
          templateVersion: item.templateVersion,
          ...(item.route === undefined ? {} : { route: item.route }),
          state: "current" as const,
          createdAt: item.createdAt,
          ...(item.readAt === undefined ? {} : { readAt: item.readAt }),
        };
      }),
    );
    return { ...page, page: joinedPage.filter((item) => item !== null) };
  },
});

export const getDueWork = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(dueWorkResultValidator),
  handler: async (ctx, args) => {
    assertDueWorkBounds(args.now, args.limit);
    const rows = await ctx.db
      .query("notificationDueWork")
      .withIndex("by_state_and_due_at", (q) =>
        q.eq("state", "pending").lte("dueAt", args.now),
      )
      .take(args.limit);
    const current = await Promise.all(rows.map((row) => isCurrentDueWork(ctx, row)));
    return rows.filter((_, index) => current[index]);
  },
});

/**
 * Kind-scoped bounded page for scheduler lanes. The cursor advances across
 * legacy/stale rows that are safely suppressed, so callers must continue until
 * isDone rather than treating an empty filtered page as exhaustion.
 */
export const getDueWorkByKind = internalQuery({
  args: {
    kind: notificationDueWorkKindValidator,
    now: v.number(),
    limit: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: paginationResultValidator(dueWorkResultValidator),
  handler: async (ctx, args) => {
    assertDueWorkBounds(args.now, args.limit);
    if (args.cursor !== null && args.cursor.length > MAX_CURSOR_LENGTH) {
      throw new Error("Due-work cursor exceeds its fixed bound");
    }
    const page = await ctx.db
      .query("notificationDueWork")
      .withIndex("by_kind_and_state_and_due_at", (q) =>
        q.eq("kind", args.kind).eq("state", "pending").lte("dueAt", args.now),
      )
      .order("asc")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    const current = await Promise.all(page.page.map((row) => isCurrentDueWork(ctx, row)));
    return {
      ...page,
      page: page.page.filter((_, index) => current[index]),
    };
  },
});

export const getControl = internalQuery({
  args: {
    scope: v.union(v.literal("global"), v.literal("channel"), v.literal("purpose")),
    key: v.string(),
  },
  returns: controlResultValidator,
  handler: async (ctx, args) => {
    if (args.key.length === 0 || args.key.length > 128) {
      throw new Error("Notification control key must be a bounded non-empty string");
    }
    const control = await ctx.db
      .query("notificationControls")
      .withIndex("by_scope_and_key", (q) =>
        q.eq("scope", args.scope).eq("key", args.key),
      )
      .unique();
    return control
      ? {
          blocked: true as const,
          control: {
            scope: control.scope,
            key: control.key,
            version: control.version,
            operatorReference: control.operatorReference,
            updatedAt: control.updatedAt,
          },
        }
      : { blocked: false as const };
  },
});
