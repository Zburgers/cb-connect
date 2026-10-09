import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { getCurrentUser } from "../_helpers/auth";
import { cancelSource } from "../_helpers/notificationOutbox";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import {
  requireValidCalendarDate,
  resolveCalendarTimeZone,
  toCalendarDateInTimeZone,
} from "../_helpers/calendarDates";
import {
  assertValidNotificationEventWrite,
  notificationEventDefinitions,
  type NotificationSourceIdentity,
} from "../_helpers/notificationTypes";

const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const MAX_REQUEST_VERSION = Number.MAX_SAFE_INTEGER;

const setMyPainReminderArgs = {
  painLogId: v.id("painLogs"),
  selectedLocalDay: v.string(),
};

const painLogIdArgs = { painLogId: v.id("painLogs") };

type PainReminderRequestReference = Pick<
  Doc<"painReminderRequests">,
  "_id" | "ownerUserId" | "painLogId" | "selectedLocalDay" | "requestVersion" | "state"
>;

function requestSourceReference(requestId: Id<"painReminderRequests">): string {
  return String(requestId);
}

function sameSourceIdentity(
  existing: NotificationSourceIdentity | undefined,
  expected: NotificationSourceIdentity,
): boolean {
  if (!existing || existing.eventType !== expected.eventType) return false;
  const existingFields = existing as unknown as Record<string, unknown>;
  const expectedFields = expected as unknown as Record<string, unknown>;
  const expectedKeys = Object.keys(expectedFields);
  return (
    Object.keys(existingFields).length === expectedKeys.length &&
    expectedKeys.every((key) => existingFields[key] === expectedFields[key])
  );
}

function assertRequestVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Pain reminder request version is invalid or exhausted");
  }
}

async function requirePrimary(ctx: MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (user.role !== "primary") {
    throw new Error("Only primary users can request pain reminders");
  }
  return user;
}

async function ensurePainReminderEvent(
  ctx: MutationCtx,
  request: PainReminderRequestReference,
): Promise<Id<"notificationEvents"> | null> {
  if (
    process.env[OUTBOX_ENABLED_ENV] !== "true" ||
    request.state !== "active"
  ) {
    return null;
  }

  assertRequestVersion(request.requestVersion);
  const painLog = await ctx.db.get(request.painLogId);
  if (!painLog || painLog.userId !== request.ownerUserId) return null;
  const definition = notificationEventDefinitions["pain_check_in.v1"];
  const sourceReference = requestSourceReference(request._id);
  const requestVersion = String(request.requestVersion);
  const envelope = {
    eventType: "pain_check_in.v1" as const,
    eventVersion: 1 as const,
    purpose: definition.purpose,
    producerKind: definition.producer,
    sourceReference,
    sourceAuthorityVersion: `pain-reminder-request:v${requestVersion}`,
    ownerUserId: request.ownerUserId,
    recipientUserId: request.ownerUserId,
    recipientScope: "primary" as const,
    privacyClass: definition.privacyClass,
    validityRule: definition.validity,
    idempotencyKey: makeEventIdempotencyKey("pain_check_in.v1", {
      requestId: String(request._id),
      requestVersion,
      primaryId: String(request.ownerUserId),
    }),
    allowedChannel: "in_app" as const,
    sourceIdentity: {
      eventType: "pain_check_in.v1" as const,
      requestId: request._id,
      painLogId: request.painLogId,
      requestVersion: request.requestVersion,
      primaryId: request.ownerUserId,
      selectedLocalDay: request.selectedLocalDay,
    } satisfies Extract<
      NotificationSourceIdentity,
      { eventType: "pain_check_in.v1" }
    >,
  };
  assertValidNotificationEventWrite(ctx, envelope);

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
      existing.allowedChannel !== envelope.allowedChannel ||
      !sameSourceIdentity(existing.sourceIdentity, envelope.sourceIdentity)
    ) {
      throw new Error("Pain reminder event key conflicts with its source authority");
    }
    return existing._id;
  }

  return await ctx.db.insert("notificationEvents", {
    ...envelope,
    createdAt: Date.now(),
  });
}

function validateSelectedLocalDay(selectedLocalDay: string, timeZone: string): void {
  requireValidCalendarDate(selectedLocalDay, "Selected local day");
  const today = toCalendarDateInTimeZone(new Date(), timeZone);
  if (selectedLocalDay < today) {
    throw new Error("Selected local day cannot be in the past");
  }
}

function advanceRequestVersion(previousVersion: number | undefined): number {
  if (previousVersion === undefined) return 1;
  if (!Number.isSafeInteger(previousVersion) || previousVersion < 1) {
    throw new Error("Stored pain reminder request version is invalid");
  }
  const nextVersion = previousVersion + 1;
  if (!Number.isSafeInteger(nextVersion) || nextVersion > MAX_REQUEST_VERSION) {
    throw new Error("Pain reminder request version is exhausted");
  }
  return nextVersion;
}

export const setMyPainReminder = mutation({
  args: setMyPainReminderArgs,
  returns: v.literal("saved"),
  handler: async (ctx, args) => {
    const user = await requirePrimary(ctx);
    const timeZone = resolveCalendarTimeZone(user.timeZone);
    validateSelectedLocalDay(args.selectedLocalDay, timeZone);

    const painLog = await ctx.db.get(args.painLogId);
    if (!painLog || painLog.userId !== user._id) {
      throw new Error("Pain log not found");
    }

    const latestRequest = await ctx.db
      .query("painReminderRequests")
      .withIndex("by_pain_log_and_version", (q) =>
        q.eq("painLogId", painLog._id),
      )
      .order("desc")
      .first();
    if (latestRequest && latestRequest.ownerUserId !== user._id) {
      throw new Error("Pain reminder request not found");
    }

    if (latestRequest?.state === "active") {
      assertRequestVersion(latestRequest.requestVersion);
      if (latestRequest.selectedLocalDay === args.selectedLocalDay) {
        await ensurePainReminderEvent(ctx, latestRequest);
        return "saved" as const;
      }

      const requestVersion = advanceRequestVersion(latestRequest.requestVersion);
      const now = Date.now();
      await cancelSource(
        ctx,
        requestSourceReference(latestRequest._id),
        "source_changed",
        now,
      );
      await ctx.db.patch(latestRequest._id, {
        selectedLocalDay: args.selectedLocalDay,
        requestVersion,
        updatedAt: now,
      });

      await ensurePainReminderEvent(ctx, {
        ...latestRequest,
        selectedLocalDay: args.selectedLocalDay,
        requestVersion,
        state: "active",
      });
      return "saved" as const;
    }

    const requestVersion = advanceRequestVersion(latestRequest?.requestVersion);
    const now = Date.now();
    const requestId = await ctx.db.insert("painReminderRequests", {
      ownerUserId: user._id,
      painLogId: painLog._id,
      selectedLocalDay: args.selectedLocalDay,
      requestVersion,
      state: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ensurePainReminderEvent(ctx, {
      _id: requestId,
      ownerUserId: user._id,
      painLogId: painLog._id,
      selectedLocalDay: args.selectedLocalDay,
      requestVersion,
      state: "active",
    });

    return "saved" as const;
  },
});

async function deactivateMyPainReminder(
  ctx: MutationCtx,
  painLogId: Id<"painLogs">,
  reason: "source_changed" | "authority_revoked",
): Promise<null> {
  const user = await requirePrimary(ctx);
  const painLog = await ctx.db.get(painLogId);
  if (!painLog || painLog.userId !== user._id) {
    throw new Error("Pain reminder request not found");
  }
  const request = await ctx.db
    .query("painReminderRequests")
    .withIndex("by_pain_log_and_version", (q) => q.eq("painLogId", painLogId))
    .order("desc")
    .first();
  if (!request || request.ownerUserId !== user._id) {
    throw new Error("Pain reminder request not found");
  }
  if (request.state === "cancelled") return null;

  const now = Date.now();
  await cancelSource(ctx, requestSourceReference(request._id), reason, now);
  await ctx.db.patch(request._id, { state: "cancelled", updatedAt: now });
  return null;
}

export const cancelMyPainReminder = mutation({
  args: painLogIdArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await deactivateMyPainReminder(ctx, args.painLogId, "source_changed"),
});

export const revokeMyPainReminder = mutation({
  args: painLogIdArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await deactivateMyPainReminder(ctx, args.painLogId, "authority_revoked"),
});
