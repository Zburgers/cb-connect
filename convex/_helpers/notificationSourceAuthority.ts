import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const SCHEDULER_FLAG = "CB_CONNECT_NOTIFICATION_SCHEDULER_V1";
const SOURCE_VERSION_PREFIX = "g4-source-v1:";
const MAX_METHOD_VERSION_LENGTH = 128;
const MAX_SOURCE_AUTHORITY_VERSION_LENGTH = 1_024;

type SourceAuthorityVersionBase = {
  sourceRevision: number;
  servedCycleContract: string;
  [ignoredMetadata: string]: unknown;
};

export type SourceAuthorityVersionInput =
  | (SourceAuthorityVersionBase & {
      servedPredictionContract: null;
      estimatorMethodVersion: null;
      calibrationMethodVersion: null;
    })
  | (SourceAuthorityVersionBase & {
      servedPredictionContract: string;
      estimatorMethodVersion: string;
      calibrationMethodVersion: string | null;
    });

function isValidContractVersion(value: string | null | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_METHOD_VERSION_LENGTH &&
      value.trim() === value &&
      !/^\d+(?:\.\d+)*$/.test(value) &&
      !/[\u0000-\u001f\u007f]/.test(value))
  );
}

/**
 * Produces the canonical G4-SOURCE-V1 tuple from semantic served implementation
 * contracts, never schema fields such as CycleState.version or snapshot.contractVersion.
 * Snapshot, refresh, date, raw-input, provider, and template metadata are excluded.
 */
export function makeSourceAuthorityVersion(input: SourceAuthorityVersionInput): string {
  if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new Error("Source revision must be a non-negative safe integer");
  }
  if (
    !isValidContractVersion(input.servedCycleContract) ||
    input.servedCycleContract === undefined ||
    input.servedCycleContract === null ||
    input.servedPredictionContract === undefined ||
    input.estimatorMethodVersion === undefined ||
    input.calibrationMethodVersion === undefined ||
    !isValidContractVersion(input.servedPredictionContract) ||
    !isValidContractVersion(input.estimatorMethodVersion) ||
    !isValidContractVersion(input.calibrationMethodVersion) ||
    (input.servedPredictionContract === null &&
      (input.estimatorMethodVersion !== null || input.calibrationMethodVersion !== null)) ||
    (input.servedPredictionContract !== null && input.estimatorMethodVersion === null)
  ) {
    throw new Error("Source contract versions must be bounded non-empty version strings");
  }
  const tuple = [
    input.sourceRevision,
    input.servedCycleContract,
    input.servedPredictionContract,
    input.estimatorMethodVersion,
    input.calibrationMethodVersion,
  ];
  const version = `${SOURCE_VERSION_PREFIX}${JSON.stringify(tuple)}`;
  if (version.length > MAX_SOURCE_AUTHORITY_VERSION_LENGTH) {
    throw new Error("Source authority tuple exceeds its bounded version length");
  }
  return version;
}

/** Parse and validate the one canonical G4-SOURCE-V1 tuple used by all lanes. */
export function parseSourceAuthorityVersion(
  value: unknown,
): SourceAuthorityVersionInput | null {
  if (
    typeof value !== "string" ||
    value.length > MAX_SOURCE_AUTHORITY_VERSION_LENGTH ||
    !value.startsWith(SOURCE_VERSION_PREFIX)
  ) {
    return null;
  }
  try {
    const tuple: unknown = JSON.parse(value.slice(SOURCE_VERSION_PREFIX.length));
    if (!Array.isArray(tuple) || tuple.length !== 5) return null;
    const [sourceRevision, servedCycleContract, servedPredictionContract, estimatorMethodVersion, calibrationMethodVersion] = tuple;
    if (typeof sourceRevision !== "number" || typeof servedCycleContract !== "string") {
      return null;
    }
    let parsed: SourceAuthorityVersionInput;
    if (
      servedPredictionContract === null &&
      estimatorMethodVersion === null &&
      calibrationMethodVersion === null
    ) {
      parsed = {
        sourceRevision,
        servedCycleContract,
        servedPredictionContract: null,
        estimatorMethodVersion: null,
        calibrationMethodVersion: null,
      };
    } else if (
      typeof servedPredictionContract === "string" &&
      typeof estimatorMethodVersion === "string" &&
      (typeof calibrationMethodVersion === "string" || calibrationMethodVersion === null)
    ) {
      parsed = {
        sourceRevision,
        servedCycleContract,
        servedPredictionContract,
        estimatorMethodVersion,
        calibrationMethodVersion,
      };
    } else {
      return null;
    }
    return makeSourceAuthorityVersion(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}

function sourceRevisionFromVersion(value: unknown): number | null {
  return parseSourceAuthorityVersion(value)?.sourceRevision ?? null;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isFiniteNonNegativeIntegerTimestamp(value: unknown): value is number {
  return isNonNegativeSafeInteger(value);
}

export type CurrentNotificationScheduleState = {
  sourceRevision: number;
  sourceAuthorityVersion?: string;
} | null | undefined;

export type CurrentNotificationSchedulePreference = {
  inAppEnabled: boolean;
  localReminderTime?: string;
  reminderWindowVersion: number;
} | null | undefined;

/** Compares a captured wakeup fence with fresh persisted source and purpose authority. */
export function isCurrentNotificationScheduleFence(
  captured: {
    sourceAuthorityVersion?: string;
    reminderWindowVersion?: number;
  } | null | undefined,
  currentState: CurrentNotificationScheduleState,
  currentPreference: CurrentNotificationSchedulePreference,
): boolean {
  if (
    !captured ||
    !currentState ||
    !currentPreference ||
    !currentPreference.inAppEnabled ||
    !isValidReminderTime(currentPreference.localReminderTime) ||
    !isPositiveSafeInteger(captured.reminderWindowVersion) ||
    !isPositiveSafeInteger(currentPreference.reminderWindowVersion) ||
    captured.reminderWindowVersion !== currentPreference.reminderWindowVersion ||
    !isNonNegativeSafeInteger(currentState.sourceRevision)
  ) {
    return false;
  }
  const capturedRevision = sourceRevisionFromVersion(captured.sourceAuthorityVersion);
  const currentRevision = sourceRevisionFromVersion(currentState.sourceAuthorityVersion);
  return (
    capturedRevision !== null &&
    currentRevision !== null &&
    capturedRevision === currentState.sourceRevision &&
    currentRevision === currentState.sourceRevision &&
    captured.sourceAuthorityVersion === currentState.sourceAuthorityVersion
  );
}

function isValidReminderTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export type NotificationDueWorkKind =
  | "delivery"
  | "prediction_window"
  | "late_boundary"
  | "source_reconcile"
  | "pain_reminder";

type NotificationDueWorkBase = {
  ownerUserId: Id<"users">;
  state: "pending" | "claimed" | "completed" | "cancelled";
  dueAt: number;
  generation: number;
  eventId?: Id<"notificationEvents">;
  createdAt: number;
  updatedAt: number;
};

export type NotificationDueWorkRecord =
  | (NotificationDueWorkBase & {
      kind: "delivery";
      deliveryId: Id<"notificationDeliveries">;
      painReminderRequestId?: never;
      sourceAuthorityVersion?: never;
      reminderWindowVersion?: never;
    })
  | (NotificationDueWorkBase & {
      kind: "prediction_window" | "late_boundary";
      sourceAuthorityVersion: string;
      reminderWindowVersion: number;
      deliveryId?: never;
      painReminderRequestId?: never;
    })
  | (NotificationDueWorkBase & {
      kind: "pain_reminder";
      painReminderRequestId: Id<"painReminderRequests">;
      deliveryId?: never;
      sourceAuthorityVersion?: never;
      reminderWindowVersion?: never;
    })
  | (NotificationDueWorkBase & {
      kind: "source_reconcile";
      deliveryId?: never;
      painReminderRequestId?: never;
      sourceAuthorityVersion?: never;
      reminderWindowVersion?: never;
    });

export function isValidNotificationDueWorkRecord(
  value: unknown,
): value is NotificationDueWorkRecord & { state: "pending" } {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  if (
    row.state !== "pending" ||
    !isFiniteNonNegativeIntegerTimestamp(row.dueAt) ||
    !isPositiveSafeInteger(row.generation) ||
    !isFiniteNonNegativeIntegerTimestamp(row.createdAt) ||
    !isFiniteNonNegativeIntegerTimestamp(row.updatedAt) ||
    typeof row.ownerUserId !== "string" ||
    row.ownerUserId.length === 0 ||
    (row.eventId !== undefined && (typeof row.eventId !== "string" || row.eventId.length === 0)) ||
    (row.deliveryId !== undefined && (typeof row.deliveryId !== "string" || row.deliveryId.length === 0)) ||
    (row.painReminderRequestId !== undefined && (typeof row.painReminderRequestId !== "string" || row.painReminderRequestId.length === 0))
  ) {
    return false;
  }
  switch (row.kind) {
    case "delivery":
      return (
        typeof row.deliveryId === "string" &&
        row.painReminderRequestId === undefined &&
        row.sourceAuthorityVersion === undefined &&
        row.reminderWindowVersion === undefined
      );
    case "prediction_window":
    case "late_boundary":
      return (
        sourceRevisionFromVersion(row.sourceAuthorityVersion) !== null &&
        isPositiveSafeInteger(row.reminderWindowVersion) &&
        row.deliveryId === undefined &&
        row.painReminderRequestId === undefined
      );
    case "pain_reminder":
      return (
        typeof row.painReminderRequestId === "string" &&
        row.deliveryId === undefined &&
        row.sourceAuthorityVersion === undefined &&
        row.reminderWindowVersion === undefined
      );
    case "source_reconcile":
      return (
        row.deliveryId === undefined &&
        row.painReminderRequestId === undefined &&
        row.sourceAuthorityVersion === undefined &&
        row.reminderWindowVersion === undefined
      );
    default:
      return false;
  }
}

export function assertValidNotificationDueWorkWrite(
  value: unknown,
): asserts value is NotificationDueWorkRecord & { state: "pending" } {
  if (typeof value === "object" && value !== null) {
    const row = value as Record<string, unknown>;
    if (!isPositiveSafeInteger(row.generation)) {
      throw new Error("Due-work generation must be a positive safe integer");
    }
    for (const field of ["dueAt", "createdAt", "updatedAt"] as const) {
      if (!isFiniteNonNegativeIntegerTimestamp(row[field])) {
        throw new Error(`Due-work ${field} must be a finite non-negative integer timestamp`);
      }
    }
    if (row.kind === "delivery" && typeof row.deliveryId !== "string") {
      throw new Error("Delivery due work requires a deliveryId");
    }
    if (row.kind === "pain_reminder" && typeof row.painReminderRequestId !== "string") {
      throw new Error("Pain reminder due work requires a painReminderRequestId");
    }
    if (
      (row.kind === "prediction_window" || row.kind === "late_boundary") &&
      (typeof row.sourceAuthorityVersion !== "string" ||
        !isPositiveSafeInteger(row.reminderWindowVersion))
    ) {
      throw new Error("Scheduled due work requires source and reminder-window fences");
    }
  }
  if (!isValidNotificationDueWorkRecord(value)) {
    throw new Error("Notification due work has invalid semantic fields or kind references");
  }
}

function isSchedulerEnabled(): boolean {
  return process.env[SCHEDULER_FLAG] === "true";
}

async function assertPrimaryUser(ctx: MutationCtx, primaryId: Id<"users">): Promise<void> {
  const user = await ctx.db.get(primaryId);
  if (!user || user.role !== "primary") {
    throw new Error("Notification source authority requires a primary user");
  }
}

/**
 * Creates metadata only for an explicit first scheduler opt-in. Callers must invoke
 * this in the same transaction as that opt-in; it never scans or backfills events.
 */
export async function initializeNotificationSourceAuthority(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  now: number = Date.now(),
) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Source authority timestamp must be a finite non-negative integer");
  }
  await assertPrimaryUser(ctx, primaryId);
  const existing = await ctx.db
    .query("notificationScheduleState")
    .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
    .unique();
  if (existing) return existing;
  if (!isSchedulerEnabled()) return null;
  const [predictionWindowPreference, lateStatusPreference] = await Promise.all([
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", primaryId).eq("purpose", "period_window_approaching"),
      )
      .unique(),
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", primaryId).eq("purpose", "late_status"),
      )
      .unique(),
  ]);
  if (!predictionWindowPreference?.inAppEnabled && !lateStatusPreference?.inAppEnabled) {
    return null;
  }
  const id = await ctx.db.insert("notificationScheduleState", {
    userId: primaryId,
    sourceRevision: 0,
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(id);
}

/**
 * Advances source authority once for a relevant accepted domain transition.
 * Existing opted-in rows keep advancing even while execution flags are paused.
 */
export async function advanceNotificationSourceAuthority(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  now: number = Date.now(),
) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Source authority timestamp must be a finite non-negative integer");
  }
  await assertPrimaryUser(ctx, primaryId);
  const existing = await ctx.db
    .query("notificationScheduleState")
    .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
    .unique();
  if (!existing) return null;
  if (!Number.isSafeInteger(existing.sourceRevision) || existing.sourceRevision < 0) {
    throw new Error("Stored source revision is invalid");
  }
  if (existing.sourceRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Stored source revision cannot be advanced safely");
  }
  const sourceRevision = existing.sourceRevision + 1;
  await ctx.db.patch(existing._id, { sourceRevision, updatedAt: now });
  return { ...existing, sourceRevision, updatedAt: now };
}

/** Store a version read from the current served authority when it matches the live revision. */
export async function persistNotificationSourceAuthorityVersion(
  ctx: MutationCtx,
  primaryId: Id<"users">,
  sourceAuthorityVersion: string,
  now: number = Date.now(),
) {
  if (!isFiniteNonNegativeIntegerTimestamp(now)) {
    throw new Error("Source authority timestamp must be a finite non-negative integer");
  }
  const versionRevision = sourceRevisionFromVersion(sourceAuthorityVersion);
  if (versionRevision === null) {
    throw new Error("Source authority version is not a canonical G4-SOURCE-V1 tuple");
  }
  await assertPrimaryUser(ctx, primaryId);
  const existing = await ctx.db
    .query("notificationScheduleState")
    .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
    .unique();
  if (!existing) return null;
  if (
    !isNonNegativeSafeInteger(existing.sourceRevision) ||
    existing.sourceRevision !== versionRevision
  ) {
    throw new Error("Source authority tuple must match the current notification source revision");
  }
  await ctx.db.patch(existing._id, { sourceAuthorityVersion, updatedAt: now });
  return { ...existing, sourceAuthorityVersion, updatedAt: now };
}

/** Transactional write boundary for new due work; old unfenced rows remain suppressible. */
export async function createNotificationDueWork(
  ctx: MutationCtx,
  record: NotificationDueWorkRecord & { state: "pending" },
): Promise<Id<"notificationDueWork">> {
  assertValidNotificationDueWorkWrite(record);
  if (record.kind === "prediction_window" || record.kind === "late_boundary") {
    const purpose = record.kind === "prediction_window"
      ? "period_window_approaching"
      : "late_status";
    const [currentState, currentPreference] = await Promise.all([
      ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", record.ownerUserId))
        .unique(),
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", record.ownerUserId).eq("purpose", purpose),
        )
        .unique(),
    ]);
    if (!isCurrentNotificationScheduleFence(record, currentState, currentPreference)) {
      throw new Error("Scheduled due work must match current source authority and preference fences");
    }
  } else if (record.kind === "delivery") {
    if (!record.deliveryId) throw new Error("Delivery due work requires a deliveryId");
    const delivery = await ctx.db.get(record.deliveryId);
    if (!delivery || delivery.recipientUserId !== record.ownerUserId) {
      throw new Error("Delivery due work must reference the owner's delivery");
    }
  } else if (record.kind === "pain_reminder") {
    if (!record.painReminderRequestId) {
      throw new Error("Pain reminder due work requires a painReminderRequestId");
    }
    const request = await ctx.db.get(record.painReminderRequestId);
    if (!request || request.ownerUserId !== record.ownerUserId || request.state !== "active") {
      throw new Error("Pain reminder due work must reference the owner's active request");
    }
  }
  return await ctx.db.insert("notificationDueWork", record);
}
