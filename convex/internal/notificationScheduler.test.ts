import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { addCalendarDays } from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import {
  advanceNotificationSourceAuthority,
  makeSourceAuthorityVersion,
} from "../_helpers/notificationSourceAuthority";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";
import {
  reconcileUserSchedule,
  resolveLocalReminderInstant,
} from "./notificationScheduler";

const reconcileDueWorkRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:reconcileDueWork",
);
const wakeDueWorkRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:wakeDueWork",
);
const continueClaimedScheduleCancellationRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:continueIndeterminateClaimCancellation",
);
const continueScheduleReconciliationRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:continueScheduleReconciliation",
);
const continueUnavailableScheduleCancellationRef =
  makeFunctionReference<"mutation">(
    "internal/notificationScheduler:continueUnavailableScheduleCancellation",
  );

type TestBackend = TestConvex<typeof schema>;

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function seedScheduleInputs(
  t: TestBackend,
  userId: Id<"users">,
  options: {
    timeZone: string;
    localReminderTime: string;
    sourceRevision?: number;
    includePredictionWindow?: boolean;
    includeLateStatus?: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.patch(userId, { timeZone: options.timeZone });
    const periodEventId = await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-03-01",
      startCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.UTC(2026, 2, 1),
      updatedAt: Date.UTC(2026, 2, 1),
    });
    const predictionSegmentId = await ctx.db.insert(
      "cyclePredictionSegments",
      {
        userId,
        startDate: "2026-03-01",
        status: "active",
        createdAt: Date.UTC(2026, 2, 1),
      },
    );
    await ctx.db.insert("notificationScheduleState", {
      userId,
      sourceRevision: options.sourceRevision ?? 7,
      createdAt: now,
      updatedAt: now,
    });

    const purposes = [
      ...(options.includePredictionWindow === false
        ? []
        : ["period_window_approaching" as const]),
      ...(options.includeLateStatus === false ? [] : ["late_status" as const]),
    ];
    for (const purpose of purposes) {
      await ctx.db.insert("notificationPreferences", {
        userId,
        purpose,
        inAppEnabled: true,
        localReminderTime: options.localReminderTime,
        reminderWindowVersion: 3,
        updatedAt: now,
      });
    }

    return { periodEventId, predictionSegmentId };
  });
}

function predictionWindowEventArgs(args: {
  userId: Id<"users">;
  anchorId: Id<"periodEvents">;
  sourceAuthorityVersion: string;
  reminderWindowVersion: number;
  dueLocalDay: string;
  createdAt: number;
  notBefore: number;
  expiresAt: number;
}) {
  const sourceIdentity = {
    eventType: "period_window_approaching.v1" as const,
    primaryId: args.userId,
    latestEligibleStartEventId: args.anchorId,
    sourceAuthorityVersion: args.sourceAuthorityVersion,
    reminderWindowVersion: args.reminderWindowVersion,
    dueLocalDay: args.dueLocalDay,
  };
  return {
    envelope: {
      eventType: "period_window_approaching.v1" as const,
      eventVersion: 1 as const,
      purpose: "period_window_approaching" as const,
      producerKind: "current_served_v2_snapshot" as const,
      sourceReference: `period:${String(args.anchorId)}`,
      sourceAuthorityVersion: args.sourceAuthorityVersion,
      ownerUserId: args.userId,
      recipientUserId: args.userId,
      recipientScope: "primary" as const,
      privacyClass: "primary_private_inferred_health" as const,
      validityRule: "designated_due_local_day_while_snapshot_is_current" as const,
      idempotencyKey: makeEventIdempotencyKey(
        "period_window_approaching.v1",
        {
          primaryId: String(args.userId),
          latestEligibleStartEventId: String(args.anchorId),
          sourceAuthorityVersion: args.sourceAuthorityVersion,
          dueLocalDay: args.dueLocalDay,
          reminderWindowVersion: String(args.reminderWindowVersion),
        },
      ),
      allowedChannel: "in_app" as const,
      sourceIdentity,
    },
    route: "periods" as const,
    templateVersion: "g4-static-v1",
    renderIdentity: {
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v1",
      payloadHash: "d011-blocked",
    },
    createdAt: args.createdAt,
    notBefore: args.notBefore,
    expiresAt: args.expiresAt,
  };
}

function snapshotRefreshArgs(
  snapshot: Doc<"predictionSnapshots">,
  generatedAt: number,
) {
  return {
    userId: snapshot.userId,
    generatedAt,
    inputCutoffAt: snapshot.inputCutoffAt,
    inputCutoffDate: snapshot.inputCutoffDate,
    status: snapshot.status,
    estimatorId: snapshot.estimatorId,
    estimatorVersion: snapshot.estimatorVersion,
    intervalMethodVersion: snapshot.intervalMethodVersion,
    calibrationVersion: snapshot.calibrationVersion,
    pointDate: snapshot.pointDate,
    earliestDate: snapshot.earliestDate,
    latestDate: snapshot.latestDate,
    probabilityLabel: snapshot.probabilityLabel,
    quality: snapshot.quality,
    qualityScoreV1: snapshot.qualityScoreV1 ?? null,
    basisCount: snapshot.basisCount,
    reasonCodes: snapshot.reasonCodes,
    displayStatus: snapshot.displayStatus,
    predictionSegmentId: snapshot.predictionSegmentId,
    featureVersion: snapshot.featureVersion,
    contractVersion: snapshot.contractVersion,
  };
}

async function pendingScheduleRows(t: TestBackend, userId: Id<"users">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("notificationDueWork")
      .withIndex("by_owner_and_state_and_due_at", (q) =>
        q.eq("ownerUserId", userId).eq("state", "pending"),
      )
      .take(100),
  );
}

async function allScheduleRows(t: TestBackend, userId: Id<"users">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("notificationDueWork")
      .withIndex("by_owner_and_state_and_due_at", (q) =>
        q.eq("ownerUserId", userId),
      )
      .take(1_000),
  );
}

describe("notification schedule reconciliation", () => {
  test.each([
    {
      label: "DST spring gap",
      localDay: "2026-03-08",
      localReminderTime: "02:30",
      timeZone: "America/New_York",
      expected: "2026-03-08T07:00:00.000Z",
    },
    {
      label: "DST fall fold",
      localDay: "2026-11-01",
      localReminderTime: "01:30",
      timeZone: "America/New_York",
      expected: "2026-11-01T05:30:00.000Z",
    },
    {
      label: "Asia/Kolkata half-hour offset",
      localDay: "2026-10-04",
      localReminderTime: "09:00",
      timeZone: "Asia/Kolkata",
      expected: "2026-10-04T03:30:00.000Z",
    },
    {
      label: "negative UTC offset",
      localDay: "2026-10-05",
      localReminderTime: "09:00",
      timeZone: "Etc/GMT+8",
      expected: "2026-10-05T17:00:00.000Z",
    },
  ])("resolves the local reminder clock across $label", (fixture) => {
    expect(
      resolveLocalReminderInstant(
        fixture.localDay,
        fixture.localReminderTime,
        fixture.timeZone,
      ),
    ).toBe(Date.parse(fixture.expected));
  });

  test("current served snapshot schedules local prediction and late boundaries with guarded wakeups", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });

    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    expect(snapshotId).not.toBeNull();
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    expect(snapshot?.displayStatus).toBe("visible");
    if (!snapshot) throw new Error("Expected the served V2 snapshot");

    const pending = await pendingScheduleRows(t, primaryId);
    const scheduleState = await t.run(async (ctx) =>
      ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
    );
    expect(scheduleState?.sourceAuthorityVersion).toMatch(/^g4-source-v1:/);
    expect(
      pending.map(({ sourceAuthorityVersion, reminderWindowVersion }) => ({
        sourceAuthorityVersion,
        reminderWindowVersion,
      })),
    ).toEqual(
      pending.map(() => ({
        sourceAuthorityVersion: scheduleState?.sourceAuthorityVersion,
        reminderWindowVersion: 3,
      })),
    );
    const timeZone = "America/Los_Angeles";
    const expected = [
      {
        kind: "prediction_window",
        dueAt: resolveLocalReminderInstant(
          addCalendarDays(snapshot.pointDate, -3),
          "09:00",
          timeZone,
        ),
      },
      {
        kind: "late_boundary",
        dueAt: resolveLocalReminderInstant(
          addCalendarDays(snapshot.latestDate, 1),
          "09:00",
          timeZone,
        ),
      },
    ];
    expect(
      pending.map(({ kind, dueAt, generation }) => ({ kind, dueAt, generation })),
    ).toEqual(
      expected.map(({ kind, dueAt }) => ({ kind, dueAt, generation: 7 })),
    );

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10),
    );
    expect(scheduled).toHaveLength(2);
    expect(scheduled.map(({ scheduledTime }) => scheduledTime)).toEqual(
      expect.arrayContaining(expected.map(({ dueAt }) => dueAt)),
    );
    expect(
      scheduled.every(
        ({ args }) =>
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "workId" in args[0] &&
          "generation" in args[0],
      ),
    ).toBe(true);

    const projected = await t.run(async (ctx) => ({
      events: await ctx.db.query("notificationEvents").take(10),
      deliveries: await ctx.db.query("notificationDeliveries").take(10),
      inboxItems: await ctx.db.query("notificationInboxItems").take(10),
    }));
    expect(projected).toEqual({ events: [], deliveries: [], inboxItems: [] });
  });

  test("scheduled prediction creation uses the selected anchor and idempotent source-window key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const { periodEventId } = await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const predictionWork = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    const scheduleState = await t.run((ctx) =>
      ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique(),
    );
    if (!predictionWork || !scheduleState?.sourceAuthorityVersion) {
      throw new Error("Expected current prediction work and source authority");
    }
    const dueLocalDay = toCalendarDateInTimeZone(
      new Date(predictionWork.dueAt),
      "America/Los_Angeles",
    );
    vi.setSystemTime(predictionWork.dueAt);
    const eventArgs = predictionWindowEventArgs({
      userId: primaryId,
      anchorId: periodEventId,
      sourceAuthorityVersion: scheduleState.sourceAuthorityVersion,
      reminderWindowVersion: 3,
      dueLocalDay,
      createdAt: predictionWork.dueAt,
      notBefore: predictionWork.dueAt,
      expiresAt: resolveLocalReminderInstant(
        addCalendarDays(dueLocalDay, 1),
        "00:00",
        "America/Los_Angeles",
      ),
    });

    const created = await t.mutation(
      internal.mutations.notifications.ensureInAppRecords,
      eventArgs,
    );
    expect(created.status).toBe("event_only");
    if (!created.eventId) throw new Error("Expected the gated event record");
    const replayed = await t.mutation(
      internal.mutations.notifications.ensureInAppRecords,
      eventArgs,
    );
    expect(replayed.eventId).toBe(created.eventId);
    expect(
      await t.run((ctx) => ctx.db.query("notificationEvents").take(10)),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("notificationDeliveries").take(10)),
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("notificationInboxItems").take(10)),
    ).toEqual([]);
  });

  test.each([
    "source advanced",
    "preference disabled",
    "wrong anchor",
    "snapshot stale",
  ] as const)(
    "scheduled prediction creation denies a stale fence when %s",
    async (change) => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
      vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

      const t = convexTest(schema, modules);
      const { primaryId, partnerId } = await seedActiveCouple(t);
      const { periodEventId } = await seedScheduleInputs(t, primaryId, {
        timeZone: "America/Los_Angeles",
        localReminderTime: "09:00",
        includeLateStatus: false,
      });
      const snapshotId = await t.mutation(
        internal.internal.predictionSnapshots.ensureCurrentForUser,
        { userId: primaryId },
      );
      if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
      const work = (await pendingScheduleRows(t, primaryId)).find(
        (row) => row.kind === "prediction_window",
      );
      const scheduleState = await t.run((ctx) =>
        ctx.db
          .query("notificationScheduleState")
          .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
          .unique(),
      );
      if (!work || !scheduleState?.sourceAuthorityVersion) {
        throw new Error("Expected current prediction work and source authority");
      }
      const dueLocalDay = toCalendarDateInTimeZone(
        new Date(work.dueAt),
        "America/Los_Angeles",
      );
      vi.setSystemTime(work.dueAt);
      const anchorId =
        change === "wrong anchor"
          ? await t.run((ctx) =>
              ctx.db.insert("periodEvents", {
                userId: partnerId,
                startDate: "2026-02-01",
                startCertainty: "exact",
                authorityVersion: 1,
                createdAt: Date.UTC(2026, 1, 1),
                updatedAt: Date.UTC(2026, 1, 1),
              }),
            )
          : periodEventId;
      const eventArgs = predictionWindowEventArgs({
        userId: primaryId,
        anchorId,
        sourceAuthorityVersion: scheduleState.sourceAuthorityVersion,
        reminderWindowVersion: 3,
        dueLocalDay,
        createdAt: work.dueAt,
        notBefore: work.dueAt,
        expiresAt: resolveLocalReminderInstant(
          addCalendarDays(dueLocalDay, 1),
          "00:00",
          "America/Los_Angeles",
        ),
      });

      await t.run(async (ctx) => {
        if (change === "source advanced") {
          await ctx.db.patch(periodEventId, {
            startDate: "2026-03-02",
            authorityVersion: 2,
            updatedAt: Date.now(),
          });
          await advanceNotificationSourceAuthority(ctx, primaryId);
        } else if (change === "preference disabled") {
          const preference = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_user_and_purpose", (q) =>
              q.eq("userId", primaryId).eq("purpose", "period_window_approaching"),
            )
            .unique();
          if (!preference) throw new Error("Expected prediction preference");
          await ctx.db.patch(preference._id, { inAppEnabled: false });
        } else if (change === "snapshot stale") {
          const snapshot = await ctx.db.get(snapshotId);
          if (!snapshot) throw new Error("Expected the served V2 snapshot");
          await ctx.db.patch(snapshotId, {
            pointDate: addCalendarDays(snapshot.pointDate, 1),
          });
        }
      });

      await expect(
        t.mutation(
          internal.mutations.notifications.ensureInAppRecords,
          eventArgs,
        ),
      ).resolves.toMatchObject({ status: "stale", eventId: null });
      expect(
        await t.run((ctx) => ctx.db.query("notificationEvents").take(10)),
      ).toEqual([]);
    },
  );

  test("due prediction wake creates a typed in-app event from the selected served anchor", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const { periodEventId } = await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    await t.mutation(internal.internal.predictionSnapshots.ensureCurrentForUser, {
      userId: primaryId,
    });
    const work = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!work) throw new Error("Expected prediction-window work");
    vi.setSystemTime(work.dueAt);

    await expect(
      t.mutation(wakeDueWorkRef, { workId: work._id, generation: work.generation }),
    ).resolves.toEqual({ status: "ready" });

    const events = await t.run((ctx) => ctx.db.query("notificationEvents").take(10));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "period_window_approaching.v1",
      ownerUserId: primaryId,
      recipientUserId: primaryId,
      sourceReference: `period:${String(periodEventId)}`,
      sourceIdentity: {
        eventType: "period_window_approaching.v1",
        primaryId,
        latestEligibleStartEventId: periodEventId,
        dueLocalDay: toCalendarDateInTimeZone(
          new Date(work.dueAt),
          "America/Los_Angeles",
        ),
      },
    });
    expect(events[0].ownerUserId).not.toBe(partnerId);
    expect(await t.run((ctx) => ctx.db.query("notificationDeliveries").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(work._id))).toMatchObject({ state: "claimed" });
  });

  test("missing eligible start anchor suppresses prediction-window scheduling", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: "America/Los_Angeles" });
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 3,
        updatedAt: now,
      });
    });

    expect(
      await t.mutation(internal.internal.predictionSnapshots.ensureCurrentForUser, {
        userId: primaryId,
      }),
    ).toBeNull();
    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));

    expect(
      (await allScheduleRows(t, primaryId)).filter(
        (row) =>
          row.kind === "prediction_window" &&
          (row.state === "pending" || row.state === "claimed"),
      ),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("notificationEvents").take(10))).toEqual([]);
  });

  test("outbox-off prediction wake leaves no event or claimed work", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "false");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    await t.mutation(internal.internal.predictionSnapshots.ensureCurrentForUser, {
      userId: primaryId,
    });
    const work = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!work) throw new Error("Expected prediction-window work");
    vi.setSystemTime(work.dueAt);

    const findWakeId = async () =>
      await t.run(async (ctx) => {
        const wake = (await ctx.db.system.query("_scheduled_functions").take(100)).find(
          (scheduled) => {
            const arg = scheduled.args[0];
            return (
              scheduled.name === "internal/notificationScheduler:wakeDueWork" &&
              scheduled.state.kind === "pending" &&
              typeof arg === "object" &&
              arg !== null &&
              "workId" in arg &&
              arg.workId === work._id
            );
          },
        );
        return wake?._id ?? null;
      });
    const originalWakeId = await findWakeId();
    if (!originalWakeId) throw new Error("Expected the due-work wake id");
    await t.run((ctx) => ctx.scheduler.cancel(originalWakeId));
    expect(await t.mutation(reconcileDueWorkRef, { kind: work.kind })).toEqual({
      scheduled: 0,
    });

    await expect(
      t.mutation(wakeDueWorkRef, { workId: work._id, generation: work.generation }),
    ).resolves.toEqual({ status: "blocked", reason: "outbox_disabled" });
    expect(await t.run((ctx) => ctx.db.query("notificationEvents").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(work._id))).toMatchObject({ state: "pending" });
    expect(await t.mutation(reconcileDueWorkRef, { kind: work.kind })).toEqual({
      scheduled: 0,
    });

    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    expect(await t.mutation(reconcileDueWorkRef, { kind: work.kind })).toEqual({
      scheduled: 1,
    });
  });

  test("does not catch up prediction-window or Late work after its local validity day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-04-15T12:00:00.000Z"));

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });

    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    if (!snapshot) throw new Error("Expected the served V2 snapshot");

    const today = toCalendarDateInTimeZone(
      new Date(Date.now()),
      "America/Los_Angeles",
    );
    expect(addCalendarDays(snapshot.pointDate, -3) < today).toBe(true);
    expect(addCalendarDays(snapshot.latestDate, 1) < today).toBe(true);
    expect(await pendingScheduleRows(t, primaryId)).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10)),
    ).toEqual([]);
  });

  test("delayed prediction wake is valid through its local day, then expires; Late remains denied", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const pending = await pendingScheduleRows(t, primaryId);
    const predictionWork = pending.find((row) => row.kind === "prediction_window");
    const lateWork = pending.find((row) => row.kind === "late_boundary");
    if (!predictionWork || !lateWork) throw new Error("Expected both due-work kinds");

    const predictionDay = toCalendarDateInTimeZone(
      new Date(predictionWork.dueAt),
      "America/Los_Angeles",
    );
    const expiredPredictionWorkId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "pending",
        dueAt: predictionWork.dueAt,
        generation: predictionWork.generation,
        createdAt: now,
        updatedAt: now,
      }),
    );
    vi.setSystemTime(
      resolveLocalReminderInstant(predictionDay, "22:00", "America/Los_Angeles"),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: predictionWork._id,
        generation: predictionWork.generation,
      }),
    ).resolves.toEqual({ status: "ready" });

    vi.setSystemTime(
      resolveLocalReminderInstant(
        addCalendarDays(predictionDay, 1),
        "12:00",
        "America/Los_Angeles",
      ),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: expiredPredictionWorkId,
        generation: predictionWork.generation,
      }),
    ).resolves.toEqual({ status: "stale" });

    const lateDay = toCalendarDateInTimeZone(
      new Date(lateWork.dueAt),
      "America/Los_Angeles",
    );
    vi.setSystemTime(
      resolveLocalReminderInstant(lateDay, "12:00", "America/Los_Angeles"),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: lateWork._id,
        generation: lateWork.generation,
      }),
    ).resolves.toEqual({ status: "blocked", reason: "content_not_approved" });

    vi.setSystemTime(
      resolveLocalReminderInstant(
        addCalendarDays(lateDay, 1),
        "12:00",
        "America/Los_Angeles",
      ),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: lateWork._id,
        generation: lateWork.generation,
      }),
    ).resolves.toEqual({ status: "stale" });

    const finalRows = await allScheduleRows(t, primaryId);
    expect(finalRows.find(({ _id }) => _id === predictionWork._id)?.state).toBe(
      "claimed",
    );
    expect(finalRows.find(({ _id }) => _id === lateWork._id)?.state).toBe(
      "cancelled",
    );
    expect(
      finalRows.find(({ _id }) => _id === expiredPredictionWorkId)?.state,
    ).toBe("cancelled");
    expect(
      await t.run((ctx) => ctx.db.query("notificationEvents").take(10)),
    ).toHaveLength(1);
  });

  test.each([
    {
      label: "spring DST gap",
      timeZone: "America/Los_Angeles",
      localDay: "2026-03-08",
      localReminderTime: "02:30",
      expectedDueAt: "2026-03-08T10:00:00.000Z",
    },
    {
      label: "fall DST repeated time",
      timeZone: "America/Los_Angeles",
      localDay: "2026-11-01",
      localReminderTime: "01:30",
      expectedDueAt: "2026-11-01T08:30:00.000Z",
    },
    {
      label: "Asia/Kolkata half-hour offset",
      timeZone: "Asia/Kolkata",
      localDay: "2026-10-04",
      localReminderTime: "09:00",
      expectedDueAt: "2026-10-04T03:30:00.000Z",
    },
    {
      label: "negative UTC offset",
      timeZone: "Etc/GMT+8",
      localDay: "2026-10-05",
      localReminderTime: "09:00",
      expectedDueAt: "2026-10-05T17:00:00.000Z",
    },
  ])("resolves the local reminder clock across $label", (testCase) => {
    expect(
      resolveLocalReminderInstant(
        testCase.localDay,
        testCase.localReminderTime,
        testCase.timeZone,
      ),
    ).toBe(Date.parse(testCase.expectedDueAt));
  });

  test("clock-only late-boundary wakeup rechecks policy without projecting Late", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includePredictionWindow: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");

    const [snapshot] = await t.run(async (ctx) => [await ctx.db.get(snapshotId)]);
    if (!snapshot) throw new Error("Expected the served V2 snapshot");
    const [lateWork] = await pendingScheduleRows(t, primaryId);
    expect(lateWork?.kind).toBe("late_boundary");
    if (!lateWork) throw new Error("Expected late-boundary due work");
    const expectedDueAt = resolveLocalReminderInstant(
      addCalendarDays(snapshot.latestDate, 1),
      "09:00",
      "America/Los_Angeles",
    );
    expect(lateWork.dueAt).toBe(expectedDueAt);

    vi.setSystemTime(expectedDueAt);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const afterWake = await t.run(async (ctx) => ({
      work: await ctx.db.get("notificationDueWork", lateWork._id),
      events: await ctx.db.query("notificationEvents").take(10),
      snapshots: await ctx.db
        .query("predictionSnapshots")
        .withIndex("by_user_and_generated_at", (q) => q.eq("userId", primaryId))
        .take(10),
    }));
    expect(afterWake.work?.state).toBe("cancelled");
    expect(afterWake.events).toEqual([]);
    expect(afterWake.snapshots).toHaveLength(1);
  });

  test.each([
    "served snapshot version changed",
    "newer stale served snapshot identity",
    "period correction",
    "period tombstone",
    "new period start",
    "prediction pause",
    "preference revoked",
  ])("wake cancels old work when %s before projection", async (change) => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const { periodEventId } = await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const [work] = await pendingScheduleRows(t, primaryId);
    if (!work) throw new Error("Expected prediction-window due work");

    await t.run(async (ctx) => {
      switch (change) {
        case "served snapshot version changed":
          await ctx.db.patch(snapshotId, { contractVersion: 3 });
          break;
        case "newer stale served snapshot identity": {
          const snapshot = await ctx.db.get(snapshotId);
          if (!snapshot) throw new Error("Expected the served V2 snapshot");
          const { _id, _creationTime, ...snapshotFields } = snapshot;
          await ctx.db.insert("predictionSnapshots", {
            ...snapshotFields,
            generatedAt: snapshot.generatedAt + 1_000,
            contractVersion: 3,
          });
          break;
        }
        case "period correction":
          await ctx.db.patch("periodEvents", periodEventId, {
            startDate: "2026-03-02",
            authorityVersion: 2,
            updatedAt: now,
          });
          await advanceNotificationSourceAuthority(ctx, primaryId, now);
          break;
        case "period tombstone":
          await ctx.db.patch("periodEvents", periodEventId, {
            tombstoneAt: now,
            tombstoneAuthorityVersion: 2,
            updatedAt: now,
          });
          await advanceNotificationSourceAuthority(ctx, primaryId, now);
          break;
        case "new period start":
          await ctx.db.insert("periodEvents", {
            userId: primaryId,
            startDate: "2026-03-15",
            startCertainty: "exact",
            authorityVersion: 1,
            createdAt: now,
            updatedAt: now,
          });
          await advanceNotificationSourceAuthority(ctx, primaryId, now);
          break;
        case "prediction pause":
          await ctx.db.insert("cycleSettings", {
            userId: primaryId,
            cycleLength: 28,
            periodLength: 5,
            predictionPaused: true,
            predictionPausedAt: now,
            lastUpdatedAt: now,
          });
          await advanceNotificationSourceAuthority(ctx, primaryId, now);
          break;
        case "preference revoked": {
          const preference = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_user_and_purpose", (q) =>
              q.eq("userId", primaryId).eq("purpose", "period_window_approaching"),
            )
            .unique();
          if (!preference) throw new Error("Expected prediction preference");
          await ctx.db.patch(preference._id, { inAppEnabled: false, updatedAt: now });
          break;
        }
      }
    });

    const claimedWorkId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: work.dueAt,
        generation: work.generation,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: work._id,
        generation: work.generation,
      }),
    ).resolves.toEqual({ status: "stale" });
    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));

    const afterWake = await t.run(async (ctx) => ({
      work: await ctx.db.get("notificationDueWork", work._id),
      claimedWork: await ctx.db.get("notificationDueWork", claimedWorkId),
      events: await ctx.db.query("notificationEvents").take(10),
      deliveries: await ctx.db.query("notificationDeliveries").take(10),
      inboxItems: await ctx.db.query("notificationInboxItems").take(10),
    }));
    expect(afterWake.work?.state).toBe("cancelled");
    expect(afterWake.claimedWork?.state).toBe("cancelled");
    expect(afterWake.events).toEqual([]);
    expect(afterWake.deliveries).toEqual([]);
    expect(afterWake.inboxItems).toEqual([]);
  });

  test("incidental refresh keeps work while an authoritative correction supersedes it", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const { periodEventId } = await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const originalSnapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    if (!originalSnapshot) throw new Error("Expected the served V2 snapshot");
    const originalPending = await pendingScheduleRows(t, primaryId);
    const originalFences = originalPending.map(
      ({ kind, sourceAuthorityVersion, reminderWindowVersion }) => ({
        kind,
        sourceAuthorityVersion,
        reminderWindowVersion,
      }),
    );

    await t.mutation(internal.internal.predictionSnapshots.createSnapshot, {
      ...snapshotRefreshArgs(originalSnapshot, originalSnapshot.generatedAt + 1_000),
    });
    const afterRefresh = await pendingScheduleRows(t, primaryId);
    expect(
      afterRefresh.map(({ _id, generation, kind }) => ({ _id, generation, kind })),
    ).toEqual(
      originalPending.map(({ _id, generation, kind }) => ({ _id, generation, kind })),
    );
    expect(
      afterRefresh.map(({ kind, sourceAuthorityVersion, reminderWindowVersion }) => ({
        kind,
        sourceAuthorityVersion,
        reminderWindowVersion,
      })),
    ).toEqual(originalFences);

    vi.setSystemTime(now + 5_000);
    await t.run(async (ctx) => {
      await ctx.db.patch("periodEvents", periodEventId, {
        startDate: "2026-03-02",
        authorityVersion: 2,
        updatedAt: now + 4_000,
      });
      await advanceNotificationSourceAuthority(ctx, primaryId, now + 4_000);
    });
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );

    const allWork = await t.run(async (ctx) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId),
        )
        .take(10),
    );
    expect(allWork.filter((row) => row.state === "cancelled")).toHaveLength(2);
    expect(allWork.filter((row) => row.state === "pending")).toHaveLength(2);
    expect(allWork.filter((row) => row.state === "pending").map(({ generation }) => generation)).toEqual([8, 8]);
    expect(
      allWork
        .filter((row) => row.state === "pending")
        .every((row) => row.sourceAuthorityVersion !== originalFences[0]?.sourceAuthorityVersion),
    ).toBe(true);
    expect(
      allWork
        .filter((row) => row.state === "pending")
        .map(({ reminderWindowVersion }) => reminderWindowVersion),
    ).toEqual([3, 3]);
  });

  test("newest shadow history cancels work instead of falling back to an older visible snapshot", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) throw new Error("Expected a current V2 snapshot");
    const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
    if (!servedSnapshot) throw new Error("Expected the served V2 snapshot");
    const originalWork = await pendingScheduleRows(t, primaryId);

    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const { qualityScoreV1, ...shadow } = snapshotRefreshArgs(
          servedSnapshot,
          servedSnapshot.generatedAt + 1_000 + index,
        );
        await ctx.db.insert("predictionSnapshots", {
          ...shadow,
          displayStatus: "shadow",
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
      }
    });
    await t.mutation(internal.internal.predictionSnapshots.createSnapshot, {
      ...snapshotRefreshArgs(servedSnapshot, servedSnapshot.generatedAt + 2_000),
      displayStatus: "shadow",
    });

    const afterShadowPage = await allScheduleRows(t, primaryId);
    expect(afterShadowPage.map(({ _id, state, kind, dueAt, generation }) => ({
      _id,
      state,
      kind,
      dueAt,
      generation,
    }))).toEqual(originalWork.map(({ _id, kind, dueAt, generation }) => ({
      _id,
      state: "cancelled",
      kind,
      dueAt,
      generation,
    })));
  });

  test.each(["shadow", "non-v2"] as const)(
    "does not fall back to an older visible snapshot when the newest is %s",
    async (newestKind) => {
      const now = Date.parse("2026-03-07T20:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const t = convexTest(schema, modules);
      const { primaryId } = await seedActiveCouple(t);
      await seedScheduleInputs(t, primaryId, {
        timeZone: "America/Los_Angeles",
        localReminderTime: "09:00",
      });
      const servedSnapshotId = await t.mutation(
        internal.internal.predictionSnapshots.ensureCurrentForUser,
        { userId: primaryId },
      );
      if (servedSnapshotId === null) throw new Error("Expected a current V2 snapshot");
      const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
      if (!servedSnapshot) throw new Error("Expected the served V2 snapshot");
      const originalWork = await pendingScheduleRows(t, primaryId);
      const newestArgs = snapshotRefreshArgs(
        servedSnapshot,
        servedSnapshot.generatedAt + 2_000,
      );
      await t.mutation(internal.internal.predictionSnapshots.createSnapshot, {
        ...newestArgs,
        ...(newestKind === "shadow"
          ? { displayStatus: "shadow" as const }
          : { featureVersion: "period_prediction_v1" }),
      });

      await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));

      const allWork = await allScheduleRows(t, primaryId);
      expect(allWork.filter((row) => row.state === "pending")).toEqual([]);
      expect(
        allWork
          .filter((row) => originalWork.some((original) => original._id === row._id))
          .every((row) => row.state === "cancelled"),
      ).toBe(true);
    },
  );

  test("unavailable newest shadow snapshot cancels due work without scheduling a retry", async () => {
    const start = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) throw new Error("Expected a current V2 snapshot");
    const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
    if (!servedSnapshot) throw new Error("Expected the served V2 snapshot");
    const work = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!work) throw new Error("Expected prediction-window due work");

    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const { qualityScoreV1, ...shadow } = snapshotRefreshArgs(
          servedSnapshot,
          servedSnapshot.generatedAt + 1_000 + index,
        );
        await ctx.db.insert("predictionSnapshots", {
          ...shadow,
          displayStatus: "shadow",
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
      }
    });

    const firstAttemptAt = work.dueAt + 1;
    vi.setSystemTime(firstAttemptAt);
    await expect(
      t.mutation(wakeDueWorkRef, { workId: work._id, generation: work.generation }),
    ).resolves.toEqual({ status: "stale" });
    expect(await t.run((ctx) => ctx.db.get(work._id))).toMatchObject({
      state: "cancelled",
    });
    expect(await t.run((ctx) => ctx.db.query("notificationEvents").take(10))).toEqual([]);
    const retryAt = firstAttemptAt + 5 * 60 * 1_000;
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").take(100)).some(
          (scheduled) =>
            scheduled.name === "internal/notificationScheduler:wakeDueWork" &&
            scheduled.scheduledTime === retryAt &&
            typeof scheduled.args[0] === "object" &&
            scheduled.args[0] !== null &&
            "workId" in scheduled.args[0] &&
            scheduled.args[0].workId === work._id,
        ),
      ),
    ).toBe(false);
  });

  test("kind-scoped cron recovery reaches pending work past terminal and other-kind history", async () => {
    const now = Date.parse("2026-10-04T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const sourceAuthorityVersion = makeSourceAuthorityVersion({
      sourceRevision: 7,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v1",
      calibrationMethodVersion: "calibrate-v1",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        sourceAuthorityVersion,
        createdAt: now,
        updatedAt: now,
      });
      for (const purpose of ["period_window_approaching", "late_status"] as const) {
        await ctx.db.insert("notificationPreferences", {
          userId: primaryId,
          purpose,
          inAppEnabled: true,
          localReminderTime: "09:00",
          reminderWindowVersion: 3,
          updatedAt: now,
        });
      }
    });
    const workIds = await t.run(async (ctx) => {
      for (let index = 0; index < 80; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "late_boundary",
          state: index % 2 === 0 ? "cancelled" : "completed",
          dueAt: now - 1_000 - index,
          generation: 1,
          createdAt: now - 10_000 - index,
          updatedAt: now - 10_000 - index,
        });
      }
      for (let index = 0; index < 60; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "delivery",
          state: "pending",
          dueAt: now - 1_000 + index,
          generation: 1,
          createdAt: now - 5_000 + index,
          updatedAt: now - 5_000 + index,
        });
      }
      const pendingIds: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 55; index += 1) {
        pendingIds.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: index % 2 === 0 ? "prediction_window" : "late_boundary",
            state: "pending",
            dueAt: now - 55 + index,
            generation: 2,
            sourceAuthorityVersion,
            reminderWindowVersion: 3,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return pendingIds;
    });

    const result = await t.mutation(
      reconcileDueWorkRef,
      {},
    );
    expect(result.scheduled).toBe(55);
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").take(60),
    );
    expect(scheduled).toHaveLength(55);
    const scheduledWorkIds = scheduled.map(({ args }) => {
        const arg = args[0];
        if (typeof arg !== "object" || arg === null || !("workId" in arg)) {
          throw new Error("Expected a scheduled due-work ID");
        }
        return arg.workId;
      });
    expect(scheduledWorkIds.sort()).toEqual([...workIds].sort());
  });

  test("owner schedule reconciliation skips other due-work kinds without prefix paging", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    await t.mutation(internal.internal.predictionSnapshots.ensureCurrentForUser, {
      userId: primaryId,
    });
    const prediction = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!prediction) throw new Error("Expected prediction-window work");

    const unrelatedIds = await t.run(async (ctx) => {
      const ids: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "pain_reminder",
            state: "claimed",
            dueAt: prediction.dueAt - 1_000 + index,
            generation: index + 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return ids;
    });
    const staleClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: prediction.dueAt,
        generation: prediction.generation,
        sourceAuthorityVersion: prediction.sourceAuthorityVersion,
        reminderWindowVersion: (prediction.reminderWindowVersion ?? 0) - 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const after = await t.run(async (ctx) => ({
      stale: (await ctx.db.get(staleClaimId))?.state,
      unrelated: await Promise.all(
        unrelatedIds.map(async (id) => (await ctx.db.get(id))?.state),
      ),
      continuations: (await ctx.db.system.query("_scheduled_functions").take(100))
        .filter(({ args }) =>
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "phase" in args[0],
        ),
    }));
    expect(after.stale).toBe("cancelled");
    expect(after.unrelated).toEqual(Array.from({ length: 100 }, () => "claimed"));
    expect(after.continuations).toEqual([]);
  });

  test("cron continues after a filtered-empty kind page and avoids other-kind starvation", async () => {
    const start = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    const work = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!work) throw new Error("Expected prediction-window due work");
    const now = work.dueAt + 60 * 60 * 1_000;
    vi.setSystemTime(now);

    await t.run(async (ctx) => {
      const wakeups = await ctx.db.system.query("_scheduled_functions").take(10);
      for (const wakeup of wakeups) {
        const arg = wakeup.args[0];
        if (
          wakeup.name === "internal/notificationScheduler:wakeDueWork" &&
          typeof arg === "object" &&
          arg !== null &&
          "workId" in arg &&
          arg.workId === work._id
        ) {
          await ctx.scheduler.cancel(wakeup._id);
        }
      }
      for (let index = 0; index < 501; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "delivery",
          state: "pending",
          dueAt: work.dueAt - 120_000 + index,
          generation: 1,
          createdAt: start,
          updatedAt: start,
        });
      }
      for (let index = 0; index < 50; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "prediction_window",
          state: "pending",
          dueAt: work.dueAt - 60_000 + index,
          generation: work.generation,
          createdAt: start,
          updatedAt: start,
        });
      }
    });

    const staleFirstPage = await t.query(
      internal.queries.notifications.getDueWorkByKind,
      { kind: "prediction_window", now, limit: 50, cursor: null },
    );
    expect(staleFirstPage.page).toEqual([]);
    expect(staleFirstPage.isDone).toBe(false);
    expect(staleFirstPage.continueCursor).not.toBeNull();

    expect(await t.mutation(reconcileDueWorkRef, {})).toEqual({ scheduled: 0 });
    const continuation = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(100)).find(
        (scheduled) =>
          scheduled.name === "internal/notificationScheduler:reconcileDueWork",
      ),
    );
    expect(continuation).toBeDefined();
    if (!continuation) throw new Error("Expected a due-work continuation");
    const continuationArgs = continuation?.args[0];
    expect(continuationArgs).toMatchObject({ kind: "prediction_window" });
    if (
      typeof continuationArgs !== "object" ||
      continuationArgs === null ||
      !("cursor" in continuationArgs)
    ) {
      throw new Error("Expected a due-work continuation cursor");
    }
    expect(continuationArgs.cursor).toBe(staleFirstPage.continueCursor);

    await t.run((ctx) => ctx.scheduler.cancel(continuation._id));
    await t.mutation(reconcileDueWorkRef, {
      kind: "prediction_window",
      cursor: staleFirstPage.continueCursor,
    });
    const recoveredWake = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(100)).find(
        (scheduled) => {
          const arg = scheduled.args[0];
          return (
            scheduled.name === "internal/notificationScheduler:wakeDueWork" &&
            typeof arg === "object" &&
            arg !== null &&
            "workId" in arg &&
            arg.workId === work._id
          );
        },
      ),
    );
    expect(recoveredWake).toBeDefined();
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: work._id,
        generation: work.generation,
      }),
    ).resolves.toEqual({ status: "ready" });
    expect((await t.run((ctx) => ctx.db.get(work._id)))?.state).toBe("claimed");
  });

  test("valid wakes claim each bounded page so later due work cannot starve", async () => {
    const start = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const original = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!original) throw new Error("Expected prediction-window due work");
    const dueDay = toCalendarDateInTimeZone(
      new Date(original.dueAt),
      "America/Los_Angeles",
    );
    const dueIds = await t.run(async (ctx) => {
      const ids = [original._id];
      for (let index = 0; index < 60; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "prediction_window",
            state: "pending",
            dueAt: original.dueAt,
            generation: original.generation,
            sourceAuthorityVersion: original.sourceAuthorityVersion,
            reminderWindowVersion: original.reminderWindowVersion,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
        );
      }
      return ids;
    });

    vi.setSystemTime(
      resolveLocalReminderInstant(dueDay, "12:00", "America/Los_Angeles"),
    );
    const indexedDue = await pendingScheduleRows(t, primaryId);
    const firstPage = indexedDue.slice(0, 50);
    expect(indexedDue).toHaveLength(61);

    expect(await t.mutation(reconcileDueWorkRef, {})).toEqual({ scheduled: 50 });
    for (const work of firstPage) {
      await expect(
        t.mutation(wakeDueWorkRef, {
          workId: work._id,
          generation: work.generation,
        }),
      ).resolves.toEqual({ status: "ready" });
    }
    const afterFirstPage = await allScheduleRows(t, primaryId);
    expect(
      firstPage.map(
        ({ _id }) => afterFirstPage.find((row) => row._id === _id)?.state,
      ),
    ).toEqual(Array.from({ length: 50 }, () => "claimed"));
    expect(afterFirstPage.filter((row) => row.state === "pending")).toHaveLength(11);

    expect(await t.mutation(reconcileDueWorkRef, {})).toEqual({ scheduled: 11 });
    const secondPage = await pendingScheduleRows(t, primaryId);
    expect(secondPage).toHaveLength(11);
    for (const work of secondPage) {
      await expect(
        t.mutation(wakeDueWorkRef, {
          workId: work._id,
          generation: work.generation,
        }),
      ).resolves.toEqual({ status: "ready" });
    }
    const afterSecondPage = await allScheduleRows(t, primaryId);
    expect(afterSecondPage.filter((row) => row.state === "pending")).toEqual([]);
    expect(afterSecondPage.filter((row) => row.state === "claimed")).toHaveLength(61);
    expect(dueIds).toHaveLength(61);
  });

  test("reconciliation does not replay a claimed generation", async () => {
    const start = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    const [work] = await pendingScheduleRows(t, primaryId);
    if (!work) throw new Error("Expected prediction-window due work");
    const dueDay = toCalendarDateInTimeZone(
      new Date(work.dueAt),
      "America/Los_Angeles",
    );
    vi.setSystemTime(
      resolveLocalReminderInstant(dueDay, "12:00", "America/Los_Angeles"),
    );

    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: work._id,
        generation: work.generation,
      }),
    ).resolves.toEqual({ status: "ready" });
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );

    const rows = await allScheduleRows(t, primaryId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: work._id, state: "claimed" });
  });

  test("scheduler flag stays default-off for snapshot scheduling", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "false");
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "UTC",
      localReminderTime: "09:00",
    });

    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );

    expect(await pendingScheduleRows(t, primaryId)).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10)),
    ).toEqual([]);
  });

  test("unavailable latest snapshot cancels all active schedule work", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      sourceRevision: 0,
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) throw new Error("Expected a current V2 snapshot");
    const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
    if (!servedSnapshot) throw new Error("Expected the served V2 snapshot");
    const pendingBefore = await pendingScheduleRows(t, primaryId);
    expect(pendingBefore).toHaveLength(2);
    const pendingPrediction = pendingBefore.find(
      (row) => row.kind === "prediction_window",
    );
    if (!pendingPrediction) throw new Error("Expected prediction-window work");
    const staleSourceAuthorityVersion = makeSourceAuthorityVersion({
      sourceRevision: 0,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "different-estimator-v1",
      calibrationMethodVersion: "different-calibration-v1",
    });
    const claimedId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: pendingPrediction.kind,
        state: "claimed",
        dueAt: pendingPrediction.dueAt,
        generation: pendingPrediction.generation,
        sourceAuthorityVersion: pendingPrediction.sourceAuthorityVersion,
        reminderWindowVersion: (pendingPrediction.reminderWindowVersion ?? 0) - 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const staleTupleClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: pendingPrediction.kind,
        state: "claimed",
        dueAt: pendingPrediction.dueAt,
        generation: pendingPrediction.generation,
        sourceAuthorityVersion: staleSourceAuthorityVersion,
        reminderWindowVersion: pendingPrediction.reminderWindowVersion,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const matchingFenceClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: pendingPrediction.kind,
        state: "claimed",
        dueAt: pendingPrediction.dueAt,
        generation: pendingPrediction.generation,
        sourceAuthorityVersion: pendingPrediction.sourceAuthorityVersion,
        reminderWindowVersion: pendingPrediction.reminderWindowVersion,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const { qualityScoreV1, ...shadow } = snapshotRefreshArgs(
          servedSnapshot,
          servedSnapshot.generatedAt + 1_000 + index,
        );
        await ctx.db.insert("predictionSnapshots", {
          ...shadow,
          displayStatus: "shadow",
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
      }
    });

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));

    const after = await allScheduleRows(t, primaryId);
    expect(after.find(({ _id }) => _id === claimedId)?.state).toBe("cancelled");
    expect(after.find(({ _id }) => _id === staleTupleClaimId)?.state).toBe(
      "cancelled",
    );
    expect(after.find(({ _id }) => _id === matchingFenceClaimId)?.state).toBe(
      "cancelled",
    );
    expect(
      after.filter(({ state }) => state === "pending").map(({ _id }) => _id),
    ).toEqual([]);
    expect(
      after
        .filter(({ _id }) => pendingBefore.some((row) => row._id === _id))
        .every(({ state }) => state === "cancelled"),
    ).toBe(true);
  });

  test("indeterminate cleanup skips unrelated claimed work without broad paging", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      sourceRevision: 0,
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) {
      throw new Error("Expected a current V2 snapshot");
    }
    const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
    if (!servedSnapshot) throw new Error("Expected the served V2 snapshot");
    const pending = await pendingScheduleRows(t, primaryId);
    const prediction = pending.find((row) => row.kind === "prediction_window");
    if (!prediction) throw new Error("Expected prediction-window work");

    const unrelatedIds = await t.run(async (ctx) => {
      const ids: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "pain_reminder",
            state: "claimed",
            dueAt: prediction.dueAt - 1_000 + index,
            generation: 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return ids;
    });
    const targetClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: prediction.kind,
        state: "claimed",
        dueAt: prediction.dueAt,
        generation: prediction.generation,
        sourceAuthorityVersion: prediction.sourceAuthorityVersion,
        reminderWindowVersion: prediction.reminderWindowVersion,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const { qualityScoreV1, ...shadow } = snapshotRefreshArgs(
          servedSnapshot,
          servedSnapshot.generatedAt + 1_000 + index,
        );
        await ctx.db.insert("predictionSnapshots", {
          ...shadow,
          displayStatus: "shadow",
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
      }
    });

    const predictionPage = await t.run((ctx) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex(
          "by_owner_and_kind_and_state_and_due_at_and_generation_and_source_authority_version_and_reminder_window_version",
          (q) =>
            q
              .eq("ownerUserId", primaryId)
              .eq("kind", "prediction_window")
              .eq("state", "claimed"),
        )
        .paginate({ numItems: 100, cursor: null }),
    );
    expect(predictionPage.page.map(({ _id }) => _id)).toEqual([targetClaimId]);
    expect(predictionPage.isDone).toBe(true);

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const continuationQueued = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(20)).some(
        ({ args }) =>
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "cursor" in args[0],
      ),
    );
    expect(continuationQueued).toBe(false);

    const states = await t.run(async (ctx) => ({
      target: (await ctx.db.get(targetClaimId))?.state,
      unrelated: await Promise.all(
        unrelatedIds.map(async (id) => (await ctx.db.get(id))?.state),
      ),
    }));
    expect(states.target).toBe("cancelled");
    expect(states.unrelated).toEqual(
      Array.from({ length: 100 }, () => "claimed"),
    );
  });

  test("current reconciliation pages past unrelated claimed work", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) {
      throw new Error("Expected a current V2 snapshot");
    }
    const prediction = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!prediction) throw new Error("Expected prediction-window work");

    const unrelatedIds = await t.run(async (ctx) => {
      const ids: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "pain_reminder",
            state: "claimed",
            dueAt: prediction.dueAt - 100 + index,
            generation: 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return ids;
    });
    const staleClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: prediction.dueAt,
        generation: prediction.generation,
        sourceAuthorityVersion: prediction.sourceAuthorityVersion,
        reminderWindowVersion: (prediction.reminderWindowVersion ?? 0) - 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const continuation = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(200)).find(
        ({ args }) =>
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "phase" in args[0] &&
          args[0].phase === "current",
      ),
    );
    if (continuation) {
      await t.mutation(
        continueScheduleReconciliationRef,
        continuation.args[0] as never,
      );
    }

    const after = await t.run(async (ctx) => ({
      stale: (await ctx.db.get(staleClaimId))?.state,
      unrelated: await Promise.all(
        unrelatedIds.map(async (id) => (await ctx.db.get(id))?.state),
      ),
    }));
    expect(after.stale).toBe("cancelled");
    expect(after.unrelated).toEqual(
      Array.from({ length: 100 }, () => "claimed"),
    );
  });

  test.each([
    ["pending", 0],
    ["pending", 101],
    ["claimed", 101],
  ] as const)("final reconciliation deduplicates %s work behind a stale cursor and %i newer same-time rows", async (state, newerRows) => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const original = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!original) throw new Error("Expected prediction-window work");

    await t.run(async (ctx) => {
      for (const row of await ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId).eq("state", "pending"),
        )
        .take(100)) {
        await ctx.db.patch(row._id, { state: "cancelled", updatedAt: now });
      }
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "prediction_window",
          state: "pending",
          dueAt: original.dueAt + 1_000 + index,
          generation: original.generation - 1,
          sourceAuthorityVersion: original.sourceAuthorityVersion,
          reminderWindowVersion: original.reminderWindowVersion,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const continuation = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(200)).find(
        ({ name, args }) =>
          name === "internal/notificationScheduler:continueScheduleReconciliation" &&
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "phase" in args[0] &&
          args[0].phase === "current",
      ),
    );
    expect(continuation).toBeDefined();
    if (!continuation) throw new Error("Expected a schedule continuation");
    const continuationArgs = continuation.args[0];
    if (
      typeof continuationArgs !== "object" ||
      continuationArgs === null ||
      !("pendingPredictionCursor" in continuationArgs) ||
      !("candidates" in continuationArgs)
    ) {
      throw new Error("Expected a paginated schedule continuation");
    }
    expect(continuationArgs.candidates).toMatchObject({
      pendingPredictionId: null,
      claimedPredictionId: null,
    });
    expect(continuationArgs.pendingPredictionDone).toBe(false);

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    await t.run(async (ctx) => {
      const current = await ctx.db
        .query("notificationDueWork")
        .withIndex("by_owner_and_state_and_due_at", (q) =>
          q.eq("ownerUserId", primaryId).eq("state", "pending").eq("dueAt", original.dueAt),
        )
        .first();
      if (!current) throw new Error("Expected concurrently inserted work");
      await ctx.db.patch(current._id, { state });
      for (let index = 0; index < newerRows; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "delivery",
          state,
          dueAt: original.dueAt,
          generation: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    await t.mutation(
      continueScheduleReconciliationRef,
      continuationArgs as never,
    );

    const activePredictionWork = await t.run(async (ctx) =>
      (await Promise.all((["pending", "claimed"] as const).map((activeState) => ctx.db
          .query("notificationDueWork")
          .withIndex("by_owner_and_state_and_due_at", (q) =>
            q.eq("ownerUserId", primaryId).eq("state", activeState),
          )
          .take(200)))).flat().filter((row) => row.kind === "prediction_window"),
    );
    expect(activePredictionWork).toEqual([
      expect.objectContaining({
        dueAt: original.dueAt,
        generation: original.generation,
        sourceAuthorityVersion: original.sourceAuthorityVersion,
        reminderWindowVersion: original.reminderWindowVersion,
        state,
      }),
    ]);
  });

  test("current reconciliation rechecks candidates claimed between pages", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
      includeLateStatus: false,
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const original = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!original) throw new Error("Expected prediction-window work");

    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "prediction_window",
          state: "pending",
          dueAt: original.dueAt + index + 1,
          generation: original.generation - 1,
          sourceAuthorityVersion: original.sourceAuthorityVersion,
          reminderWindowVersion: original.reminderWindowVersion,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const continuation = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(200)).find(
        ({ name, args }) =>
          name === "internal/notificationScheduler:continueScheduleReconciliation" &&
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "phase" in args[0] &&
          args[0].phase === "current",
      ),
    );
    expect(continuation).toBeDefined();
    if (!continuation) throw new Error("Expected a schedule continuation");
    const continuationArgs = continuation.args[0];
    if (
      typeof continuationArgs !== "object" ||
      continuationArgs === null ||
      !("candidates" in continuationArgs)
    ) {
      throw new Error("Expected carried schedule candidates");
    }
    expect(continuationArgs.candidates).toMatchObject({
      pendingPredictionId: original._id,
      claimedPredictionId: null,
    });
    expect(continuationArgs.claimedPredictionDone).toBe(true);

    await t.run((ctx) => ctx.db.patch(original._id, { state: "claimed" }));
    await t.mutation(
      continueScheduleReconciliationRef,
      continuationArgs as never,
    );

    const activePredictionWork = (await allScheduleRows(t, primaryId)).filter(
      (row) =>
        row.kind === "prediction_window" &&
        (row.state === "pending" || row.state === "claimed"),
    );
    expect(activePredictionWork).toEqual([
      expect.objectContaining({ _id: original._id, state: "claimed" }),
    ]);
  });

  test("claimed cleanup continues when the first page is cancelled", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const servedSnapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (servedSnapshotId === null) {
      throw new Error("Expected a current V2 snapshot");
    }
    const servedSnapshot = await t.run((ctx) => ctx.db.get(servedSnapshotId));
    const prediction = (await pendingScheduleRows(t, primaryId)).find(
      (row) => row.kind === "prediction_window",
    );
    if (!servedSnapshot || !prediction) {
      throw new Error("Expected a served snapshot and prediction work");
    }
    const firstPageClaimIds = await t.run(async (ctx) => {
      const ids: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "prediction_window",
            state: "claimed",
            dueAt: prediction.dueAt - 100 + index,
            generation: prediction.generation,
            sourceAuthorityVersion: prediction.sourceAuthorityVersion,
            reminderWindowVersion: (prediction.reminderWindowVersion ?? 0) - 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return ids;
    });
    const targetClaimId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "claimed",
        dueAt: prediction.dueAt,
        generation: prediction.generation,
        sourceAuthorityVersion: prediction.sourceAuthorityVersion,
        reminderWindowVersion: (prediction.reminderWindowVersion ?? 0) - 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const { qualityScoreV1, ...shadow } = snapshotRefreshArgs(
          servedSnapshot,
          servedSnapshot.generatedAt + 1_000 + index,
        );
        await ctx.db.insert("predictionSnapshots", {
          ...shadow,
          displayStatus: "shadow",
          ...(qualityScoreV1 === null ? {} : { qualityScoreV1 }),
        });
      }
    });
    const firstPage = await t.run((ctx) =>
      ctx.db
        .query("notificationDueWork")
        .withIndex(
          "by_owner_and_kind_and_state_and_due_at_and_generation_and_source_authority_version_and_reminder_window_version",
          (q) =>
            q
              .eq("ownerUserId", primaryId)
              .eq("kind", "prediction_window")
              .eq("state", "claimed"),
        )
        .paginate({ numItems: 100, cursor: null }),
    );
    expect(firstPage.page.map(({ _id }) => _id)).toEqual(firstPageClaimIds);
    expect(firstPage.isDone).toBe(false);

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    await t.mutation(continueClaimedScheduleCancellationRef, {
      userId: primaryId,
      predictionCursor: firstPage.continueCursor,
      predictionDone: false,
      lateCursor: null,
      lateDone: true,
    });

    const after = await t.run(async (ctx) => ({
      firstPage: await Promise.all(
        firstPageClaimIds.map(async (id) => (await ctx.db.get(id))?.state),
      ),
      target: (await ctx.db.get(targetClaimId))?.state,
    }));
    expect(after.firstPage).toEqual(
      Array.from({ length: 100 }, () => "cancelled"),
    );
    expect(after.target).toBe("cancelled");
  });

  test("unavailable cleanup pages past unrelated pending work", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const unrelatedIds = await t.run(async (ctx) => {
      const ids: Id<"notificationDueWork">[] = [];
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("notificationDueWork", {
            ownerUserId: primaryId,
            kind: "pain_reminder",
            state: "pending",
            dueAt: now + index,
            generation: 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      return ids;
    });
    const stalePendingId = await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "pending",
        dueAt: now + 1_000,
        generation: 7,
        sourceAuthorityVersion: makeSourceAuthorityVersion({
          sourceRevision: 7,
          servedCycleContract: "cycle-read-model-v1",
          servedPredictionContract: "prediction-serving-v2",
          estimatorMethodVersion: "period-estimator-v1",
          calibrationMethodVersion: "prediction-calibration-v1",
        }),
        reminderWindowVersion: 3,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await t.run((ctx) => reconcileUserSchedule(ctx, primaryId));
    const continuation = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(200)).find(
        ({ args }) =>
          args.length === 1 &&
          typeof args[0] === "object" &&
          args[0] !== null &&
          "phase" in args[0] &&
          args[0].phase === "unavailable",
      ),
    );
    if (continuation) {
      await t.mutation(
        continueUnavailableScheduleCancellationRef,
        continuation.args[0] as never,
      );
    }

    const after = await t.run(async (ctx) => ({
      stale: (await ctx.db.get(stalePendingId))?.state,
      unrelated: await Promise.all(
        unrelatedIds.map(async (id) => (await ctx.db.get(id))?.state),
      ),
    }));
    expect(after.stale).toBe("cancelled");
    expect(after.unrelated).toEqual(
      Array.from({ length: 100 }, () => "pending"),
    );
  });

  test("scheduler-off reconciliation cancels disabled and expired work without creating wakeups", async () => {
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await seedScheduleInputs(t, primaryId, {
      timeZone: "America/Los_Angeles",
      localReminderTime: "09:00",
    });
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
    const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    if (!snapshot) throw new Error("Expected the served V2 snapshot");
    const originalPending = await pendingScheduleRows(t, primaryId);
    expect(originalPending).toHaveLength(2);
    const originalWakeups = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10),
    );
    expect(originalWakeups).toHaveLength(2);

    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "late_status"),
        )
        .unique();
      if (!preference) throw new Error("Expected Late preference");
      await ctx.db.patch(preference._id, {
        inAppEnabled: false,
        updatedAt: Date.now(),
      });
    });
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "false");
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );

    const afterDisable = await allScheduleRows(t, primaryId);
    expect(afterDisable.find(({ kind }) => kind === "late_boundary")?.state).toBe(
      "cancelled",
    );
    expect(
      afterDisable.find(({ kind }) => kind === "prediction_window")?.state,
    ).toBe("pending");
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.query("_scheduled_functions").take(10),
      ),
    ).toEqual(originalWakeups);

    const predictionDay = addCalendarDays(snapshot.pointDate, -3);
    vi.setSystemTime(
      resolveLocalReminderInstant(
        addCalendarDays(predictionDay, 1),
        "12:00",
        "America/Los_Angeles",
      ),
    );
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    const afterExpiry = await allScheduleRows(t, primaryId);
    expect(afterExpiry.every(({ state }) => state === "cancelled")).toBe(true);
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.query("_scheduled_functions").take(10),
      ),
    ).toEqual(originalWakeups);
  });
});
