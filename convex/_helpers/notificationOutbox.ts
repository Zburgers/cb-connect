import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { toCalendarDateInTimeZone } from "./calendarDates";
import { addCalendarDays } from "./cycleCalculations";
import { makeEventIdempotencyKey } from "./notificationDelivery";
import { readCurrentNotificationCycleState } from "./notificationCycleState";
import { notificationEventDefinitions } from "./notificationTypes";

const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const MAX_SOURCE_EVENTS = 256;
const MAX_DUE_WORK_PER_DELIVERY = 256;

export type AssistedPeriodEventType =
  | "assisted_period_start.v1"
  | "assisted_period_end.v1";

export type SourceCancellationReason =
  | "source_changed"
  | "authority_revoked"
  | "preference_off"
  | "expired";

type AssistedPeriodEventEnvelope = {
  eventType: AssistedPeriodEventType;
  eventVersion: 1;
  purpose: "assisted_period_start" | "assisted_period_end";
  producerKind: "accepted_period_start" | "accepted_period_end";
  sourceReference: string;
  sourceAuthorityVersion: string;
  ownerUserId: Id<"users">;
  recipientUserId: Id<"users">;
  recipientScope: "primary";
  privacyClass: "primary_private_health";
  validityRule: "while_authority_is_current_and_primary_has_access";
  idempotencyKey: string;
  allowedChannel: "in_app";
};

type LateStatusEventEnvelope = {
  eventType: "late_status.v1";
  eventVersion: 1;
  purpose: "late_status";
  producerKind: "approved_served_late_state";
  sourceReference: string;
  sourceAuthorityVersion: string;
  ownerUserId: Id<"users">;
  recipientUserId: Id<"users">;
  recipientScope: "primary";
  privacyClass: "primary_private_inferred_health";
  validityRule: "while_current_late_state_is_valid";
  idempotencyKey: string;
  allowedChannel: "in_app";
};

type EventEnvelope = AssistedPeriodEventEnvelope | LateStatusEventEnvelope;

function assertNow(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Outbox timestamp must be a non-negative safe integer");
  }
}

function isKnownCertainty(value: string | undefined): value is "exact" | "approximate" {
  return value === "exact" || value === "approximate";
}

function eventEnvelope(
  eventType: AssistedPeriodEventType,
  periodEventId: Id<"periodEvents">,
  primaryId: Id<"users">,
  authorityVersion: number,
): AssistedPeriodEventEnvelope {
  const definition = notificationEventDefinitions[eventType];
  return {
    eventType,
    eventVersion: 1,
    purpose: definition.purpose,
    producerKind: definition.producer,
    sourceReference: `period:${periodEventId}`,
    sourceAuthorityVersion: `period-authority:${authorityVersion}`,
    ownerUserId: primaryId,
    recipientUserId: primaryId,
    recipientScope: "primary",
    privacyClass: "primary_private_health",
    validityRule: "while_authority_is_current_and_primary_has_access",
    idempotencyKey: makeEventIdempotencyKey(eventType, {
      periodEventId: String(periodEventId),
      authorityVersion: String(authorityVersion),
      primaryId: String(primaryId),
    }),
    allowedChannel: "in_app",
  };
}

export async function lateStatusSourceReference(
  primaryId: Id<"users">,
  sourceRevision: number,
  localDay: string,
  reminderWindowVersion: number,
): Promise<string> {
  if (
    !Number.isSafeInteger(sourceRevision) ||
    sourceRevision < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(localDay) ||
    !Number.isSafeInteger(reminderWindowVersion) ||
    reminderWindowVersion < 0
  ) {
    throw new Error("Late-status source generation is invalid");
  }
  const source = new TextEncoder().encode(
    `cb-connect:late-source-reference:v1:${JSON.stringify([
      String(primaryId),
      sourceRevision,
      localDay,
      reminderWindowVersion,
    ])}`,
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `late:v1:${hex}`;
}

async function lateStatusEventEnvelope(
  primaryId: Id<"users">,
  sourceAuthorityVersion: string,
  sourceRevision: number,
  localDay: string,
  reminderWindowVersion: number,
): Promise<LateStatusEventEnvelope> {
  const eventType = "late_status.v1" as const;
  return {
    eventType,
    eventVersion: 1,
    purpose: "late_status",
    producerKind: "approved_served_late_state",
    sourceReference: await lateStatusSourceReference(
      primaryId,
      sourceRevision,
      localDay,
      reminderWindowVersion,
    ),
    sourceAuthorityVersion,
    ownerUserId: primaryId,
    recipientUserId: primaryId,
    recipientScope: "primary",
    privacyClass: "primary_private_inferred_health",
    validityRule: "while_current_late_state_is_valid",
    idempotencyKey: makeEventIdempotencyKey(eventType, {
      primaryId: String(primaryId),
      sourceAuthorityVersion,
      localDay,
      reminderWindowVersion: String(reminderWindowVersion),
    }),
    allowedChannel: "in_app",
  };
}

async function cancelLateStatusGeneration(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  sourceRevision: number,
  localDay: string,
  reminderWindowVersion: number,
  reason: SourceCancellationReason,
  now: number,
): Promise<void> {
  await cancelSource(
    ctx,
    await lateStatusSourceReference(
      primaryId,
      sourceRevision,
      localDay,
      reminderWindowVersion,
    ),
    reason,
    now,
  );
}

/**
 * Cancels only the current and immediately previous Late intent generations.
 * Their opaque references include the local day and reminder-window revision,
 * so retained older events do not enlarge these bounded source prefixes.
 */
export async function cancelCurrentLateStatusSource(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  reason: SourceCancellationReason,
  now: number = Date.now(),
): Promise<void> {
  assertNow(now);
  const [user, scheduleState, preference] = await Promise.all([
    ctx.db.get(primaryId),
    ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
      .unique(),
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", primaryId).eq("purpose", "late_status"),
      )
      .unique(),
  ]);
  if (!user || user.role !== "primary" || !scheduleState) return;
  if (!Number.isSafeInteger(scheduleState.sourceRevision) || scheduleState.sourceRevision < 0) {
    throw new Error("Stored notification source revision is invalid");
  }
  const reminderWindowVersion = preference?.reminderWindowVersion ?? 0;
  if (!Number.isSafeInteger(reminderWindowVersion) || reminderWindowVersion < 0) {
    throw new Error("Late-status reminder window version is invalid");
  }
  const localDay = toCalendarDateInTimeZone(
    new Date(now),
    user.timeZone ?? "UTC",
  );
  const localDaysToCancel = [localDay, addCalendarDays(localDay, -1)];
  const versionsToCancel =
    reminderWindowVersion === 0
      ? [reminderWindowVersion]
      : [reminderWindowVersion, reminderWindowVersion - 1];
  for (const day of localDaysToCancel) {
    for (const version of versionsToCancel) {
      await cancelLateStatusGeneration(
        ctx,
        primaryId,
        scheduleState.sourceRevision,
        day,
        version,
        reason,
        now,
      );
    }
  }
}

function sameEnvelope(
  existing: {
    eventType: string;
    eventVersion: number;
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
    allowedChannel: string;
  },
  expected: EventEnvelope,
): boolean {
  return (
    existing.eventType === expected.eventType &&
    existing.eventVersion === expected.eventVersion &&
    existing.purpose === expected.purpose &&
    existing.producerKind === expected.producerKind &&
    existing.sourceReference === expected.sourceReference &&
    existing.sourceAuthorityVersion === expected.sourceAuthorityVersion &&
    existing.ownerUserId === expected.ownerUserId &&
    existing.recipientUserId === expected.recipientUserId &&
    existing.recipientScope === expected.recipientScope &&
    existing.privacyClass === expected.privacyClass &&
    existing.validityRule === expected.validityRule &&
    existing.idempotencyKey === expected.idempotencyKey &&
    existing.allowedChannel === expected.allowedChannel
  );
}

/**
 * Writes only the immutable domain event, in the caller's transaction. Copy,
 * delivery creation, projection and external transport belong to later lanes.
 */
export async function ensureAssistedPeriodEvent(
  ctx: MutationCtx,
  eventType: AssistedPeriodEventType,
  periodEventId: Id<"periodEvents">,
  now: number = Date.now(),
): Promise<Id<"notificationEvents"> | null> {
  assertNow(now);
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return null;

  const period = await ctx.db.get(periodEventId);
  if (
    !period ||
    period.source !== "partner_assist" ||
    period.tombstoneAt !== undefined ||
    period.confirmationStatus !== "confirmed" ||
    !isKnownCertainty(period.startCertainty)
  ) {
    return null;
  }
  if (
    eventType === "assisted_period_end.v1" &&
    (period.endDate === undefined || !isKnownCertainty(period.endCertainty))
  ) {
    return null;
  }

  const authorityVersion = period.authorityVersion;
  if (!Number.isSafeInteger(authorityVersion) || authorityVersion === undefined || authorityVersion < 1) {
    return null;
  }
  const envelope = eventEnvelope(eventType, period._id, period.userId, authorityVersion);
  const existing = await ctx.db
    .query("notificationEvents")
    .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", envelope.idempotencyKey))
    .unique();
  if (existing) {
    if (!sameEnvelope(existing, envelope)) {
      throw new Error("Notification event key conflicts with its source authority");
    }
    return existing._id;
  }

  return await ctx.db.insert("notificationEvents", {
    ...envelope,
    createdAt: now,
  });
}

/**
 * Re-reads current served cycle authority at a due boundary and records one
 * content-free Late event. The caller owns due-work scheduling; this helper
 * never refreshes a snapshot, computes prediction bounds, or projects copy.
 */
export async function ensureCurrentLateStatusEvent(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  now: number = Date.now(),
): Promise<Id<"notificationEvents"> | null> {
  assertNow(now);

  const current = await readCurrentNotificationCycleState(ctx, primaryId, now);
  if (
    !current ||
    current.state.status !== "late_or_uncertain" ||
    current.state.reason !== "AFTER_LATEST_BOUND"
  ) {
    await cancelCurrentLateStatusSource(ctx, primaryId, "source_changed", now);
    return null;
  }

  const preference = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user_and_purpose", (q) =>
      q.eq("userId", primaryId).eq("purpose", "late_status"),
    )
    .unique();
  if (!preference?.inAppEnabled) {
    await cancelCurrentLateStatusSource(ctx, primaryId, "preference_off", now);
    return null;
  }
  if (
    !Number.isSafeInteger(preference.reminderWindowVersion) ||
    preference.reminderWindowVersion < 0
  ) {
    throw new Error("Late-status reminder window version is invalid");
  }
  if (process.env[OUTBOX_ENABLED_ENV] !== "true") return null;

  const envelope = await lateStatusEventEnvelope(
    primaryId,
    current.sourceAuthorityVersion,
    current.sourceRevision,
    current.localDay,
    preference.reminderWindowVersion,
  );
  const existing = await ctx.db
    .query("notificationEvents")
    .withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", envelope.idempotencyKey),
    )
    .unique();
  if (existing) {
    if (!sameEnvelope(existing, envelope)) {
      throw new Error("Late-status event key conflicts with its source authority");
    }
    return existing._id;
  }

  const daysToSupersede = [current.localDay, addCalendarDays(current.localDay, -1)];
  const versionsToSupersede =
    preference.reminderWindowVersion === 0
      ? [preference.reminderWindowVersion]
      : [preference.reminderWindowVersion, preference.reminderWindowVersion - 1];
  for (const day of daysToSupersede) {
    for (const version of versionsToSupersede) {
      if (
        day === current.localDay &&
        version === preference.reminderWindowVersion
      ) {
        await cancelSource(ctx, envelope.sourceReference, "source_changed", now);
      } else {
        await cancelLateStatusGeneration(
          ctx,
          primaryId,
          current.sourceRevision,
          day,
          version,
          "source_changed",
          now,
        );
      }
    }
  }
  return await ctx.db.insert("notificationEvents", {
    ...envelope,
    createdAt: now,
  });
}

/**
 * Non-destructively invalidates every bounded event generation for one source.
 * Delivered outcomes remain factual; inbox rows become hidden and old wakeups
 * are fenced by incrementing their generation.
 */
export async function cancelSource(
  ctx: MutationCtx,
  sourceRef: string,
  reason: SourceCancellationReason,
  now: number = Date.now(),
): Promise<void> {
  assertNow(now);
  if (sourceRef.length === 0 || sourceRef.length > 1_024) {
    throw new Error("Notification source reference is outside its fixed bound");
  }

  const events = await ctx.db
    .query("notificationEvents")
    .withIndex("by_source_reference_and_authority", (q) =>
      q.eq("sourceReference", sourceRef),
    )
    .take(MAX_SOURCE_EVENTS + 1);
  if (events.length > MAX_SOURCE_EVENTS) {
    throw new Error("Notification source has too many event generations to cancel atomically");
  }

  for (const event of events) {
    const deliveries = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_event_id", (q) => q.eq("eventId", event._id))
      .take(2);
    if (deliveries.length > 1) {
      throw new Error("Notification event has more than one in-app destination");
    }

    for (const delivery of deliveries) {
      const dueWork = await ctx.db
        .query("notificationDueWork")
        .withIndex("by_delivery_id", (q) => q.eq("deliveryId", delivery._id))
        .take(MAX_DUE_WORK_PER_DELIVERY + 1);
      if (dueWork.length > MAX_DUE_WORK_PER_DELIVERY) {
        throw new Error("Notification delivery has too many wakeups to cancel atomically");
      }
      for (const work of dueWork) {
        if (work.state !== "pending" && work.state !== "claimed") continue;
        if (!Number.isSafeInteger(work.generation) || work.generation < 1 || work.generation >= Number.MAX_SAFE_INTEGER) {
          throw new Error("Notification wakeup generation cannot be advanced safely");
        }
        await ctx.db.patch(work._id, {
          state: "cancelled",
          generation: work.generation + 1,
          updatedAt: now,
        });
      }

      const active =
        delivery.state === "pending" ||
        delivery.state === "processing" ||
        delivery.state === "retry_wait";
      const terminalState = reason === "expired" ? "expired" : "cancelled";
      await ctx.db.patch(delivery._id, {
        state: active ? terminalState : delivery.state,
        eligibility: reason === "expired" ? "expired" : "cancelled",
        cancellationReason: reason,
        updatedAt: now,
      });
    }

    const inboxItems = await ctx.db
      .query("notificationInboxItems")
      .withIndex("by_event_id", (q) => q.eq("eventId", event._id))
      .take(2);
    if (inboxItems.length > 1) {
      throw new Error("Notification event has more than one primary inbox item");
    }
    for (const item of inboxItems) {
      if (item.state === "current") {
        await ctx.db.patch(item._id, { state: "hidden" });
      }
    }
  }
}
