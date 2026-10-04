import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const SCHEDULER_FLAG = "CB_CONNECT_NOTIFICATION_SCHEDULER_V1";
const SOURCE_VERSION_PREFIX = "g4-source-v1:";
const MAX_METHOD_VERSION_LENGTH = 128;

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
  return `${SOURCE_VERSION_PREFIX}${JSON.stringify(tuple)}`;
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
