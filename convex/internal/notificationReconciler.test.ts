import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  makeDeliveryIdempotencyKey,
  makeEventIdempotencyKey,
  transitionDeliveryState,
  transitionDeliveryStateFenced,
  transitionProviderReceiptFactual,
  type DeliveryState,
  type FrozenRenderIdentity,
} from "../_helpers/notificationDelivery";
import { renderFrozen } from "../_helpers/notificationTemplates";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

type TestBackend = TestConvex<typeof schema>;
type ReconcileState = "pending" | "retry_wait" | "processing" | "unknown";
type SeedOptions = {
  state?: ReconcileState | "expired" | "failed_permanent";
  eligibility?: "eligible" | "expired";
  providerOutcome?: "none" | "unknown";
  claimGeneration?: number;
  attemptCount?: number;
  notBefore?: number;
  expiresAt?: number;
  nextAttemptAt?: number;
  leaseUntil?: number;
  dispatchStartedAt?: number;
};

const reconcileRef = makeFunctionReference<"mutation">(
  "internal/notificationReconciler:reconcile",
);
const projectInAppRef = makeFunctionReference<"mutation">(
  "internal/notificationDelivery:projectInApp",
);
let syntheticId = 0;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function enableDelivery() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
}

async function insertDelivery(
  ctx: MutationCtx,
  recipientUserId: Id<"users">,
  renderIdentity: FrozenRenderIdentity,
  options: SeedOptions = {},
) {
  const now = Date.now();
  const suffix = `n2e-${++syntheticId}`;
  const eventId = await ctx.db.insert("notificationEvents", {
    eventType: "partner_message.v1",
    eventVersion: 1,
    purpose: "partner_message",
    producerKind: "new_couple_message",
    sourceReference: `message:${suffix}`,
    sourceAuthorityVersion: "link-generation:1",
    ownerUserId: recipientUserId,
    recipientUserId,
    recipientScope: "other_active_member",
    privacyClass: "relationship_private_free_text_source",
    validityRule: "while_message_and_active_link_exist",
    idempotencyKey: makeEventIdempotencyKey("partner_message.v1", {
      messageId: suffix,
      recipientId: String(recipientUserId),
    }),
    allowedChannel: "in_app",
    createdAt: now,
  });
  const state = options.state ?? "pending";
  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    eventId,
    recipientUserId,
    channel: "in_app",
    stableDestinationId: String(recipientUserId),
    logicalKey: makeDeliveryIdempotencyKey(
      String(eventId),
      "in_app",
      String(recipientUserId),
    ),
    notBefore: options.notBefore ?? now,
    ...(options.expiresAt === undefined ? {} : { expiresAt: options.expiresAt }),
    state,
    eligibility: options.eligibility ?? (state === "expired" ? "expired" : "eligible"),
    providerOutcome: options.providerOutcome ?? (state === "unknown" ? "unknown" : "none"),
    attemptCount: options.attemptCount ?? 0,
    ...(options.nextAttemptAt === undefined
      ? {}
      : { nextAttemptAt: options.nextAttemptAt }),
    claimGeneration: options.claimGeneration ?? 0,
    ...(options.leaseUntil === undefined ? {} : { leaseUntil: options.leaseUntil }),
    ...(options.dispatchStartedAt === undefined
      ? {}
      : { dispatchStartedAt: options.dispatchStartedAt }),
    renderIdentity,
    createdAt: now,
    updatedAt: now,
  });
  return { eventId, deliveryId };
}

async function setup(t: TestBackend) {
  const { primaryId } = await seedActiveCouple(t);
  const rendered = await renderFrozen({
    eventType: "partner_message.v1",
    templateVersion: "g4-static-v1",
    locale: "en",
    variableSchemaVersion: "g4-no-variables-v1",
  });
  return { recipientUserId: primaryId, renderIdentity: rendered.identity };
}

describe("N2e durable delivery reconciliation", () => {
  test("stays inert while any required delivery flag is off", async () => {
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const row = await t.run((ctx) =>
      insertDelivery(ctx, recipientUserId, renderIdentity, { notBefore: now }),
    );

    const result = await t.mutation(reconcileRef, {
      state: "pending",
      cursor: null,
      deadlineCursor: null,
    } as never);

    expect(result).toMatchObject({ status: "disabled", scheduled: 0, hasMore: false });
    expect(
      await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10)),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(row.deliveryId))).toMatchObject({
      state: "pending",
      claimGeneration: 0,
    });
  });

  test("pages pending work past retained terminal history and independently expires deadlines", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const seeded = await t.run(async (ctx) => {
      const terminalIds: Id<"notificationDeliveries">[] = [];
      const pendingIds: Array<{
        eventId: Id<"notificationEvents">;
        deliveryId: Id<"notificationDeliveries">;
      }> = [];
      for (let index = 0; index < 80; index += 1) {
        const terminal = await insertDelivery(ctx, recipientUserId, renderIdentity, {
          state: "expired",
          eligibility: "expired",
          expiresAt: now - 1,
          nextAttemptAt: now,
        });
        terminalIds.push(terminal.deliveryId);
      }
      for (let index = 0; index < 12; index += 1) {
        pendingIds.push(
          await insertDelivery(ctx, recipientUserId, renderIdentity, {
            claimGeneration: index + 7,
            notBefore: now + (index === 0 ? 100 : 0),
          }),
        );
      }
      const expiredPending = await insertDelivery(ctx, recipientUserId, renderIdentity, {
        expiresAt: now - 1,
        notBefore: now,
      });
      return { terminalIds, pendingIds, expiredPending };
    });
    const first = await t.mutation(reconcileRef, {
      state: "pending",
      cursor: null,
      deadlineCursor: null,
    } as never);
    expect(first).toMatchObject({ scheduled: 10, expired: 1, hasMore: true });

    const scheduledFirst = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(100),
    );
    const firstWake = scheduledFirst.find(({ args }) => {
      const arg = args[0];
      return (
        typeof arg === "object" &&
        arg !== null &&
        "eventId" in arg &&
        arg.eventId === seeded.pendingIds[0].eventId
      );
    });
    expect(firstWake?.args[0]).toMatchObject({
      eventId: seeded.pendingIds[0].eventId,
      expectedGeneration: 7,
    });
    expect(firstWake?.scheduledTime).toBe(now + 100);
    const continuation = scheduledFirst.find(({ args }) => {
      const arg = args[0];
      return (
        typeof arg === "object" &&
        arg !== null &&
        "state" in arg &&
        arg.state === "pending" &&
        "cursor" in arg &&
        arg.cursor === first.cursor
      );
    });
    expect(continuation?.scheduledTime).toBeGreaterThan(now);
    expect(
      await t.run((ctx) => ctx.db.get(seeded.expiredPending.deliveryId)),
    ).toMatchObject({ state: "expired", eligibility: "expired", claimGeneration: 1 });

    const second = await t.mutation(reconcileRef, {
      state: "pending",
      cursor: first.cursor,
      deadlineCursor: first.deadlineCursor,
    } as never);
    expect(second).toMatchObject({ scheduled: 2, expired: 0, hasMore: false });
    const allScheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(100),
    );
    const pendingDeliveries = await t.run((ctx) =>
      Promise.all(seeded.pendingIds.map(({ deliveryId }) => ctx.db.get(deliveryId))),
    );
    for (const [index, { eventId }] of seeded.pendingIds.entries()) {
      const wake = allScheduled.find(({ args }) => {
        const arg = args[0];
        return (
          typeof arg === "object" &&
          arg !== null &&
          "eventId" in arg &&
          arg.eventId === eventId
        );
      });
      expect(wake?.args[0]).toMatchObject({
        eventId,
        expectedGeneration: pendingDeliveries[index]?.claimGeneration,
      });
    }
    expect(seeded.terminalIds).toHaveLength(80);
  });

  test("expires unknown rows in bounded cursor pages without changing their factual outcome", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const ids = await t.run(async (ctx) => {
      const values: Id<"notificationDeliveries">[] = [];
      for (let index = 0; index < 25; index += 1) {
        const row = await insertDelivery(ctx, recipientUserId, renderIdentity, {
          state: "unknown",
          providerOutcome: "unknown",
          eligibility: "eligible",
          expiresAt: now - 1,
        });
        values.push(row.deliveryId);
      }
      return values;
    });

    const first = await t.mutation(reconcileRef, {
      state: "unknown",
      cursor: null,
      deadlineCursor: null,
    } as never);
    expect(first).toMatchObject({ state: "unknown", inspected: 10, expired: 10, hasMore: true });
    expect(first.cursor).not.toBeNull();
    expect(first.deadlineCursor).toBeNull();

    const second = await t.mutation(reconcileRef, {
      state: "unknown",
      cursor: first.cursor,
      deadlineCursor: first.deadlineCursor,
    } as never);
    expect(second).toMatchObject({ inspected: 10, expired: 10, hasMore: true });
    expect(second.cursor).not.toBeNull();

    const third = await t.mutation(reconcileRef, {
      state: "unknown",
      cursor: second.cursor,
      deadlineCursor: second.deadlineCursor,
    } as never);
    expect(third).toMatchObject({ inspected: 5, expired: 5, hasMore: false });
    expect(third.cursor).toBeNull();

    const rows = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
    expect(rows).toHaveLength(25);
    for (const row of rows) {
      expect(row).toMatchObject({
        state: "expired",
        eligibility: "expired",
        providerOutcome: "unknown",
        errorCode: "expired",
      });
      expect(row?.nextAttemptAt).toBeUndefined();
      expect(row?.leaseUntil).toBeUndefined();
    }
  });

  test("terminalizes pending and retry_wait work when a saturated generation cannot schedule", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const rows = await t.run(async (ctx) => ({
      pending: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "pending",
        claimGeneration: Number.MAX_SAFE_INTEGER,
        notBefore: now,
      }),
      retryWait: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "retry_wait",
        claimGeneration: Number.MAX_SAFE_INTEGER,
        notBefore: now,
        nextAttemptAt: now,
      }),
    }));

    const pending = await t.mutation(reconcileRef, {
      state: "pending",
      cursor: null,
      deadlineCursor: null,
    } as never);
    const retryWait = await t.mutation(reconcileRef, {
      state: "retry_wait",
      cursor: null,
      deadlineCursor: null,
    } as never);

    expect(pending).toMatchObject({ scheduled: 0, exhausted: 1, skipped: 0 });
    expect(retryWait).toMatchObject({ scheduled: 0, exhausted: 1, skipped: 0 });
    for (const row of [rows.pending, rows.retryWait]) {
      expect(await t.run((ctx) => ctx.db.get(row.deliveryId))).toMatchObject({
        state: "failed_permanent",
        eligibility: "eligible",
        providerOutcome: "none",
        claimGeneration: Number.MAX_SAFE_INTEGER,
        errorCode: "attempts_exhausted",
      });
      const delivery = await t.run((ctx) => ctx.db.get(row.deliveryId));
      expect(delivery?.nextAttemptAt).toBeUndefined();
      expect(delivery?.leaseUntil).toBeUndefined();
    }
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
    for (const row of [rows.pending, rows.retryWait]) {
      expect(
        scheduled.some(({ args }) => {
          const arg = args[0];
          return (
            typeof arg === "object" &&
            arg !== null &&
            "eventId" in arg &&
            arg.eventId === row.eventId
          );
        }),
      ).toBe(false);
    }
  });

  test("retries only proven-undispatched leases and fences every terminal recovery", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const rows = await t.run(async (ctx) => ({
      retry: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: 4,
        leaseUntil: now - 1,
      }),
      marked: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: 5,
        leaseUntil: now - 1,
        dispatchStartedAt: now - 10,
      }),
      markedExpired: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: 7,
        leaseUntil: now - 1,
        expiresAt: now - 1,
        dispatchStartedAt: now - 10,
      }),
      exhausted: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 4,
        claimGeneration: 8,
        leaseUntil: now - 1,
      }),
      expired: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: 9,
        leaseUntil: now - 1,
        expiresAt: now - 1,
      }),
      maxGeneration: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: Number.MAX_SAFE_INTEGER,
        leaseUntil: now - 1,
      }),
      maxExpired: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: Number.MAX_SAFE_INTEGER,
        leaseUntil: now - 1,
        expiresAt: now - 1,
      }),
      maxMarked: await insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: Number.MAX_SAFE_INTEGER,
        leaseUntil: now - 1,
        dispatchStartedAt: now - 10,
      }),
    }));

    const result = await t.mutation(reconcileRef, {
      state: "processing",
      cursor: null,
      deadlineCursor: null,
    } as never);
    expect(result).toMatchObject({
      retried: 1,
      unknown: 2,
      expired: 3,
      exhausted: 2,
      skipped: 0,
    });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(rows.retry.deliveryId)).toMatchObject({
        state: "retry_wait",
        claimGeneration: 5,
        nextAttemptAt: now + 50,
      });
      expect(await ctx.db.get(rows.marked.deliveryId)).toMatchObject({
        state: "unknown",
        providerOutcome: "unknown",
        claimGeneration: 6,
        dispatchStartedAt: now - 10,
        reviewAt: expect.any(Number),
      });
      expect((await ctx.db.get(rows.marked.deliveryId))?.leaseUntil).toBeUndefined();
      expect((await ctx.db.get(rows.marked.deliveryId))?.nextAttemptAt).toBeUndefined();
      expect(await ctx.db.get(rows.markedExpired.deliveryId)).toMatchObject({
        state: "expired",
        eligibility: "expired",
        providerOutcome: "unknown",
        claimGeneration: 8,
      });
      expect((await ctx.db.get(rows.markedExpired.deliveryId))?.leaseUntil).toBeUndefined();
      expect(await ctx.db.get(rows.exhausted.deliveryId)).toMatchObject({
        state: "failed_permanent",
        claimGeneration: 9,
        errorCode: "attempts_exhausted",
      });
      expect(await ctx.db.get(rows.expired.deliveryId)).toMatchObject({
        state: "expired",
        eligibility: "expired",
        claimGeneration: 10,
      });
      expect(await ctx.db.get(rows.maxGeneration.deliveryId)).toMatchObject({
        state: "failed_permanent",
        claimGeneration: Number.MAX_SAFE_INTEGER,
        errorCode: "attempts_exhausted",
      });
      expect((await ctx.db.get(rows.maxGeneration.deliveryId))?.leaseUntil).toBeUndefined();
      expect(await ctx.db.get(rows.maxExpired.deliveryId)).toMatchObject({
        state: "expired",
        eligibility: "expired",
        claimGeneration: Number.MAX_SAFE_INTEGER,
      });
      expect((await ctx.db.get(rows.maxExpired.deliveryId))?.leaseUntil).toBeUndefined();
      expect(await ctx.db.get(rows.maxMarked.deliveryId)).toMatchObject({
        state: "unknown",
        providerOutcome: "unknown",
        claimGeneration: Number.MAX_SAFE_INTEGER,
        dispatchStartedAt: now - 10,
      });
      expect((await ctx.db.get(rows.maxMarked.deliveryId))?.leaseUntil).toBeUndefined();
    });
    await expect(
      t.mutation(projectInAppRef, {
        eventId: rows.retry.eventId,
        expectedGeneration: 4,
      } as never),
    ).resolves.toMatchObject({ status: "stale" });
    await expect(
      t.mutation(projectInAppRef, {
        eventId: rows.marked.eventId,
        expectedGeneration: 5,
      } as never),
    ).resolves.toMatchObject({ status: "stale" });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(20),
    );
    const retryWake = scheduled.find(({ args }) => {
      const arg = args[0];
      return (
        typeof arg === "object" &&
        arg !== null &&
        "eventId" in arg &&
        arg.eventId === rows.retry.eventId
      );
    });
    expect(retryWake?.scheduledTime).toBe(now + 50);
    expect(retryWake?.args[0]).toMatchObject({
      eventId: rows.retry.eventId,
      expectedGeneration: 5,
    });
    for (const row of [rows.marked, rows.markedExpired, rows.maxMarked]) {
      expect(
        scheduled.some(({ args }) => {
          const arg = args[0];
          return (
            typeof arg === "object" &&
            arg !== null &&
            "eventId" in arg &&
            arg.eventId === row.eventId
          );
        }),
      ).toBe(false);
    }
  });

  test("reserves the maximum generation for terminal recovery when no wake can be created", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const row = await t.run((ctx) =>
      insertDelivery(ctx, recipientUserId, renderIdentity, {
        state: "processing",
        attemptCount: 1,
        claimGeneration: Number.MAX_SAFE_INTEGER - 1,
        leaseUntil: now - 1,
      }),
    );

    const result = await t.mutation(reconcileRef, {
      state: "processing",
      cursor: null,
      deadlineCursor: null,
    } as never);

    expect(result).toMatchObject({ retried: 0, scheduled: 0, exhausted: 1, skipped: 0 });
    const recovered = await t.run((ctx) => ctx.db.get(row.deliveryId));
    expect(recovered).toMatchObject({
      state: "failed_permanent",
      claimGeneration: Number.MAX_SAFE_INTEGER,
      errorCode: "attempts_exhausted",
    });
    expect(recovered?.nextAttemptAt).toBeUndefined();
    expect(recovered?.leaseUntil).toBeUndefined();
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(20),
    );
    expect(
      scheduled.some(({ args }) => {
        const arg = args[0];
        return (
          typeof arg === "object" &&
          arg !== null &&
          "eventId" in arg &&
          arg.eventId === row.eventId
        );
      }),
    ).toBe(false);
  });

  test("limits recovery bursts to one bounded page and preserves the continuation cursor", async () => {
    enableDelivery();
    const now = Date.parse("2026-10-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { recipientUserId, renderIdentity } = await setup(t);
    const ids = await t.run(async (ctx) => {
      const values: Id<"notificationDeliveries">[] = [];
      for (let index = 0; index < 25; index += 1) {
        const row = await insertDelivery(ctx, recipientUserId, renderIdentity, {
          state: "processing",
          attemptCount: 1,
          claimGeneration: index,
          leaseUntil: now - 1,
        });
        values.push(row.deliveryId);
      }
      return values;
    });

    const first = await t.mutation(reconcileRef, {
      state: "processing",
      cursor: null,
      deadlineCursor: null,
    } as never);
    expect(first).toMatchObject({ retried: 10, hasMore: true });
    const firstPage = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    expect(firstPage.filter((row) => row?.state === "retry_wait")).toHaveLength(10);
    expect(firstPage.filter((row) => row?.state === "processing")).toHaveLength(15);

    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(100),
    );
    const continuation = scheduled.find(({ args }) => {
      const arg = args[0];
      return (
        typeof arg === "object" &&
        arg !== null &&
        "state" in arg &&
        arg.state === "processing" &&
        "cursor" in arg &&
        arg.cursor === first.cursor
      );
    });
    expect(continuation?.scheduledTime).toBe(now + 1_000);

    const second = await t.mutation(reconcileRef, {
      state: "processing",
      cursor: first.cursor,
      deadlineCursor: first.deadlineCursor,
    } as never);
    expect(second).toMatchObject({ retried: 10, hasMore: true });
    const secondPage = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    expect(secondPage.filter((row) => row?.state === "retry_wait")).toHaveLength(20);
    expect(secondPage.filter((row) => row?.state === "processing")).toHaveLength(5);
  });

  test("future provider results remain fenced while factual receipts stay monotonic", () => {
    const processing: DeliveryState = {
      channel: "push",
      status: "processing",
      eligibility: "eligible",
      providerOutcome: "none",
    };
    expect(
      transitionDeliveryStateFenced(processing, {
        expectedGeneration: 6,
        currentGeneration: 7,
        fact: { kind: "accepted", providerMessageId: "synthetic" },
      }).applied,
    ).toBe(false);
    expect(
      transitionDeliveryStateFenced(
        {
          channel: "in_app",
          status: "unknown",
          eligibility: "eligible",
          providerOutcome: "unknown",
        },
        {
          expectedGeneration: Number.MAX_SAFE_INTEGER,
          currentGeneration: Number.MAX_SAFE_INTEGER,
          fact: { kind: "accepted", providerMessageId: "stale" },
        },
      ).applied,
    ).toBe(false);
    const unknown = transitionDeliveryState(processing, {
      kind: "unknown",
      errorCode: "timeout",
    });
    expect(unknown.state).toMatchObject({ status: "unknown", providerOutcome: "unknown" });

    const cancelled = transitionDeliveryState(processing, { kind: "cancelled" }).state;
    const lateReceipt = transitionProviderReceiptFactual(cancelled, {
      kind: "provider_receipt",
      outcome: "delivered",
      providerMessageId: "synthetic-late-fact",
    });
    expect(lateReceipt.state).toMatchObject({
      status: "cancelled",
      eligibility: "cancelled",
      providerOutcome: "delivered",
      providerMessageId: "synthetic-late-fact",
    });
  });
});
