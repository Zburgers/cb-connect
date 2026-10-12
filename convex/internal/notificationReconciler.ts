import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  isValidProjectInAppArgs,
  nextNotificationWakeSequence,
  type ProjectInAppArgs,
  isValidNotificationDeliveryRecord,
  recoverExpiredDeliveryClaim,
  type NotificationDeliveryRecord,
} from "../_helpers/notificationDelivery";
import { IN_APP_LIMITS, nextTerminalClaimGeneration } from "./notificationDelivery";

const PAGE_SIZE = IN_APP_LIMITS.maxBatchSize;
const MAX_RUN_AT_DELAY_MS = 5 * 365 * 24 * 60 * 60 * 1_000;
const OUTBOX_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
const PROJECTION_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_PROJECTION_V1";
const DELIVERY_ENABLED_ENV = "CB_CONNECT_NOTIFICATION_DELIVERY_V1";

type ReconcileState = "pending" | "retry_wait" | "processing" | "unknown";

const reconcileArgsValidator = v.object({
  state: v.union(
    v.literal("pending"),
    v.literal("retry_wait"),
    v.literal("processing"),
    v.literal("unknown"),
  ),
  cursor: v.union(v.string(), v.null()),
  deadlineCursor: v.union(v.string(), v.null()),
});

const reconcileResultValidator = v.object({
  status: v.union(v.literal("disabled"), v.literal("reconciled")),
  state: v.union(
    v.literal("pending"),
    v.literal("retry_wait"),
    v.literal("processing"),
    v.literal("unknown"),
  ),
  inspected: v.number(),
  scheduled: v.number(),
  retried: v.number(),
  unknown: v.number(),
  expired: v.number(),
  exhausted: v.number(),
  skipped: v.number(),
  hasMore: v.boolean(),
  cursor: v.union(v.string(), v.null()),
  deadlineCursor: v.union(v.string(), v.null()),
});

const reconcileRef = makeFunctionReference<"mutation">(
  "internal/notificationReconciler:reconcile",
);
const projectInAppWakeRef = makeFunctionReference<"mutation">(
  "internal/notificationDelivery:projectInAppWake",
);

type ScheduledProjectInAppArgs = ProjectInAppArgs & { expectedWakeSequence: number };
type ScheduleWakeResult = "scheduled" | "reused" | "invalid" | "exhausted";

function sameScheduledWakeArgs(
  value: unknown,
  expected: ScheduledProjectInAppArgs,
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = value as Record<string, unknown>;
  const entries = Object.entries(expected);
  return (
    Object.keys(actual).length === entries.length &&
    entries.every(([key, expectedValue]) => actual[key] === expectedValue)
  );
}

async function projectArgsForWake(
  ctx: MutationCtx,
  delivery: Doc<"notificationDeliveries">,
  expectedGeneration: number,
): Promise<ProjectInAppArgs | null> {
  const event = await ctx.db.get(delivery.eventId);
  if (!event) return null;
  const typedSource =
    event.eventType === "period_window_approaching.v1" ||
    event.eventType === "late_status.v1";
  const args: ProjectInAppArgs = {
    eventId: delivery.eventId,
    expectedGeneration,
  };
  if (typedSource) {
    const identity = event.sourceIdentity;
    if (
      !identity ||
      identity.eventType !== event.eventType ||
      !("latestEligibleStartEventId" in identity) ||
      !("sourceAuthorityVersion" in identity) ||
      identity.sourceAuthorityVersion !== event.sourceAuthorityVersion ||
      !Number.isSafeInteger(identity.reminderWindowVersion) ||
      identity.reminderWindowVersion <= 0
    ) {
      return null;
    }
    args.expectedSourceAuthorityVersion = identity.sourceAuthorityVersion;
    args.expectedReminderWindowVersion = identity.reminderWindowVersion;
  }
  return isValidProjectInAppArgs(args, { requireScheduleFences: typedSource })
    ? args
    : null;
}

function isEnabled(name: string): boolean {
  return process.env[name] === "true";
}

function deliveryIsEnabled(): boolean {
  return (
    isEnabled(OUTBOX_ENABLED_ENV) &&
    isEnabled(PROJECTION_ENABLED_ENV) &&
    isEnabled(DELIVERY_ENABLED_ENV)
  );
}

function isValidDelivery(delivery: Doc<"notificationDeliveries">): boolean {
  return isValidNotificationDeliveryRecord(delivery as NotificationDeliveryRecord);
}

async function scheduleWake(
  ctx: MutationCtx,
  delivery: Doc<"notificationDeliveries">,
  dueAt: number,
  now: number,
  expectedGeneration = delivery.claimGeneration,
): Promise<ScheduleWakeResult> {
  const wakeMetadata = delivery as NotificationDeliveryRecord;
  if (
    expectedGeneration >= Number.MAX_SAFE_INTEGER ||
    !Number.isSafeInteger(dueAt) ||
    dueAt < 0 ||
    dueAt > now + MAX_RUN_AT_DELAY_MS
  ) {
    return expectedGeneration >= Number.MAX_SAFE_INTEGER ? "exhausted" : "invalid";
  }
  const projectArgs = await projectArgsForWake(ctx, delivery, expectedGeneration);
  if (!projectArgs) return "invalid";

  if (
    wakeMetadata.wakeScheduledFunctionId !== undefined &&
    wakeMetadata.wakeSequence !== undefined
  ) {
    const currentWake = await ctx.db.system.get(
      "_scheduled_functions",
      wakeMetadata.wakeScheduledFunctionId,
    );
    const currentWakeArgs: ScheduledProjectInAppArgs = {
      ...projectArgs,
      expectedWakeSequence: wakeMetadata.wakeSequence,
    };
    if (
      currentWake?.state.kind === "pending" &&
      currentWake.name === "internal/notificationDelivery:projectInAppWake" &&
      currentWake.args.length === 1 &&
      sameScheduledWakeArgs(currentWake.args[0], currentWakeArgs)
    ) {
      return "reused";
    }
  }

  const expectedWakeSequence = nextNotificationWakeSequence(wakeMetadata);
  if (expectedWakeSequence === null) return "exhausted";
  const wakeArgs: ScheduledProjectInAppArgs = {
    ...projectArgs,
    expectedWakeSequence,
  };
  const wakeScheduledFunctionId = await ctx.scheduler.runAt(
    Math.max(now, dueAt),
    projectInAppWakeRef,
    wakeArgs,
  );
  await ctx.db.patch(delivery._id, {
    wakeScheduledFunctionId,
    wakeSequence: expectedWakeSequence,
  });
  return "scheduled";
}

async function expireDelivery(
  ctx: MutationCtx,
  delivery: Doc<"notificationDeliveries">,
  now: number,
): Promise<void> {
  const claimGeneration =
    nextTerminalClaimGeneration(delivery.claimGeneration) ?? delivery.claimGeneration;
  await ctx.db.patch(delivery._id, {
    state: "expired",
    eligibility: "expired",
    claimGeneration,
    providerOutcome:
      delivery.dispatchStartedAt !== undefined ? "unknown" : delivery.providerOutcome,
    errorCode: "expired",
    nextAttemptAt: undefined,
    leaseUntil: undefined,
    updatedAt: now,
  });
}

type LeaseResult =
  | { kind: "retried"; scheduled: number }
  | { kind: "unknown" | "expired" | "exhausted" | "skipped"; scheduled: 0 };

async function recoverLease(
  ctx: MutationCtx,
  delivery: Doc<"notificationDeliveries">,
  now: number,
): Promise<LeaseResult> {
  if (!isValidDelivery(delivery)) return { kind: "skipped", scheduled: 0 };
  const recovered = recoverExpiredDeliveryClaim(
    delivery as NotificationDeliveryRecord,
    {
      expectedGeneration: delivery.claimGeneration,
      now,
      jitterFactor: 0.5,
      limits: IN_APP_LIMITS,
    },
  );
  if (
    recovered.kind !== "retry" &&
    recovered.kind !== "unknown" &&
    recovered.kind !== "expired" &&
    recovered.kind !== "exhausted"
  ) {
    return { kind: "skipped", scheduled: 0 };
  }
  const claimGeneration =
    nextTerminalClaimGeneration(delivery.claimGeneration) ?? delivery.claimGeneration;
  if (recovered.kind === "retry") {
    const dueAt = recovered.record.nextAttemptAt!;
    const wakeResult = await scheduleWake(ctx, delivery, dueAt, now, claimGeneration);
    if (wakeResult !== "scheduled" && wakeResult !== "reused") {
      await ctx.db.patch(delivery._id, {
        state: "failed_permanent",
        eligibility: "eligible",
        claimGeneration,
        providerOutcome: delivery.providerOutcome,
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        leaseUntil: undefined,
        updatedAt: now,
      });
      return { kind: "exhausted", scheduled: 0 };
    }
    await ctx.db.patch(delivery._id, {
      state: "retry_wait",
      eligibility: "eligible",
      claimGeneration,
      providerOutcome: delivery.providerOutcome,
      errorCode: recovered.record.errorCode,
      nextAttemptAt: dueAt,
      leaseUntil: undefined,
      dispatchStartedAt: undefined,
      updatedAt: now,
    });
    return { kind: "retried", scheduled: wakeResult === "scheduled" ? 1 : 0 };
  }
  if (recovered.kind === "unknown") {
    await ctx.db.patch(delivery._id, {
      state: "unknown",
      eligibility: recovered.record.eligibility,
      claimGeneration,
      providerOutcome: "unknown",
      errorCode: recovered.record.errorCode,
      nextAttemptAt: undefined,
      leaseUntil: undefined,
      reviewAt: recovered.record.reviewAt,
      updatedAt: now,
    });
    return { kind: "unknown", scheduled: 0 };
  }
  if (recovered.kind === "expired") {
    await ctx.db.patch(delivery._id, {
      state: "expired",
      eligibility: "expired",
      claimGeneration,
      providerOutcome:
        delivery.dispatchStartedAt !== undefined ? "unknown" : delivery.providerOutcome,
      errorCode: recovered.record.errorCode,
      nextAttemptAt: undefined,
      leaseUntil: undefined,
      updatedAt: now,
    });
    return { kind: "expired", scheduled: 0 };
  }
  await ctx.db.patch(delivery._id, {
    state: "failed_permanent",
    eligibility: "eligible",
    claimGeneration,
    providerOutcome: delivery.providerOutcome,
    errorCode: "attempts_exhausted",
    nextAttemptAt: undefined,
    leaseUntil: undefined,
    updatedAt: now,
  });
  return { kind: "exhausted", scheduled: 0 };
}

export const reconcile = internalMutation({
  args: reconcileArgsValidator.fields,
  returns: reconcileResultValidator,
  handler: async (ctx, args) => {
    const emptyResult = {
      state: args.state,
      inspected: 0,
      scheduled: 0,
      retried: 0,
      unknown: 0,
      expired: 0,
      exhausted: 0,
      skipped: 0,
      hasMore: false,
      cursor: null,
      deadlineCursor: null,
    };
    if (!deliveryIsEnabled()) return { status: "disabled" as const, ...emptyResult };

    const now = Date.now();
    const deadlinePage = args.state === "unknown"
      ? { page: [], isDone: true, continueCursor: null }
      : await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_state_and_expires_at", (q) =>
          q.eq("state", args.state).gte("expiresAt", 0).lte("expiresAt", now),
        )
        .paginate({ numItems: PAGE_SIZE, cursor: args.deadlineCursor });
    const workPage =
      args.state === "unknown"
        ? await ctx.db
          .query("notificationDeliveries")
          .withIndex("by_state_and_expires_at", (q) =>
            q.eq("state", "unknown").gte("expiresAt", 0).lte("expiresAt", now),
          )
          .paginate({ numItems: PAGE_SIZE, cursor: args.cursor })
        : args.state === "processing"
        ? await ctx.db
          .query("notificationDeliveries")
          .withIndex("by_state_and_lease_until", (q) =>
            q.eq("state", "processing").gte("leaseUntil", 0).lte("leaseUntil", now),
          )
          .paginate({ numItems: PAGE_SIZE, cursor: args.cursor })
        : await ctx.db
          .query("notificationDeliveries")
          .withIndex("by_state_and_next_attempt_at", (q) =>
            q.eq("state", args.state),
          )
          .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    let scheduled = 0;
    let retried = 0;
    let unknown = 0;
    let expired = 0;
    let exhausted = 0;
    let skipped = 0;
    const deadlineIds = new Set<string>();

    for (const delivery of deadlinePage.page) {
      deadlineIds.add(String(delivery._id));
      if (!isValidDelivery(delivery) || delivery.expiresAt === undefined) {
        skipped += 1;
      } else {
        await expireDelivery(ctx, delivery, now);
        expired += 1;
      }
    }

    for (const delivery of workPage.page) {
      if (deadlineIds.has(String(delivery._id))) continue;
      if (!isValidDelivery(delivery)) {
        skipped += 1;
        continue;
      }
      if (delivery.expiresAt !== undefined && delivery.expiresAt <= now) {
        await expireDelivery(ctx, delivery, now);
        expired += 1;
        continue;
      }
      if (args.state === "unknown") continue;
      if (args.state === "processing") {
        const result = await recoverLease(ctx, delivery, now);
        if (result.kind === "retried") {
          retried += 1;
          scheduled += result.scheduled;
        } else if (result.kind === "unknown") unknown += 1;
        else if (result.kind === "expired") expired += 1;
        else if (result.kind === "exhausted") exhausted += 1;
        else skipped += 1;
        continue;
      }
      const dueAt = Math.max(
        delivery.notBefore,
        delivery.nextAttemptAt ?? delivery.notBefore,
      );
      const wakeAt = delivery.expiresAt === undefined
        ? dueAt
        : Math.min(dueAt, delivery.expiresAt);
      const wakeResult = await scheduleWake(ctx, delivery, wakeAt, now);
      if (wakeResult === "scheduled") {
        scheduled += 1;
      } else if (wakeResult === "exhausted") {
        await ctx.db.patch(delivery._id, {
          state: "failed_permanent",
          eligibility: "eligible",
          errorCode: "attempts_exhausted",
          nextAttemptAt: undefined,
          leaseUntil: undefined,
          updatedAt: now,
        });
        exhausted += 1;
      } else if (wakeResult === "reused") {
        // A matching pending wake is already durable for this exact row generation.
      } else {
        skipped += 1;
      }
    }

    const hasMore = !workPage.isDone || !deadlinePage.isDone;
    const cursor = workPage.isDone ? null : workPage.continueCursor;
    const deadlineCursor = deadlinePage.isDone ? null : deadlinePage.continueCursor;
    let continuation: {
      state: ReconcileState;
      cursor: string | null;
      deadlineCursor: string | null;
    } | null = null;
    if (hasMore) {
      continuation = { state: args.state, cursor, deadlineCursor };
    } else if (args.state === "pending") {
      continuation = { state: "retry_wait", cursor: null, deadlineCursor: null };
    } else if (args.state === "retry_wait") {
      continuation = { state: "processing", cursor: null, deadlineCursor: null };
    } else if (args.state === "processing") {
      continuation = { state: "unknown", cursor: null, deadlineCursor: null };
    }
    if (continuation) {
      // ponytail: one bounded page per maxBackoffMs; tune from N8 load evidence.
      await ctx.scheduler.runAfter(IN_APP_LIMITS.maxBackoffMs, reconcileRef, continuation);
    }

    return {
      status: "reconciled" as const,
      state: args.state,
      inspected: workPage.page.length + deadlinePage.page.length,
      scheduled,
      retried,
      unknown,
      expired,
      exhausted,
      skipped,
      hasMore,
      cursor,
      deadlineCursor,
    };
  },
});
