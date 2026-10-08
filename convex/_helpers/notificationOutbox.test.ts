import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { addCalendarDays } from "./cycleCalculations";
import {
  makeDeliveryIdempotencyKey,
  makeEventIdempotencyKey,
} from "./notificationDelivery";
import { makeSourceAuthorityVersion } from "./notificationSourceAuthority";
import {
  cancelCurrentLateStatusSource,
  cancelSource,
  ensureAssistedPeriodEvent,
  lateStatusSourceReference,
} from "./notificationOutbox";
import * as notificationCycleState from "./notificationCycleState";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("notification outbox", () => {
  test("creates one opaque event for a confirmed, certain assisted period start", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const periodEventId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startDate: "2026-06-20",
        startCertainty: "exact",
        authorityVersion: 7,
        createdAt: 10,
        updatedAt: 10,
      }),
    );

    const first = await t.run((ctx) =>
      ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 20),
    );
    const replay = await t.run((ctx) =>
      ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 30),
    );

    expect(first).not.toBeNull();
    expect(replay).toBe(first);
    await t.run(async (ctx) => {
      const event = await ctx.db.get(first!);
      expect(event).toMatchObject({
        eventType: "assisted_period_start.v1",
        sourceReference: `period:${periodEventId}`,
        sourceAuthorityVersion: "period-authority:7",
        sourceIdentity: {
          eventType: "assisted_period_start.v1",
          sourceId: periodEventId,
          authorityVersion: 7,
          primaryId,
        },
        ownerUserId: primaryId,
        recipientUserId: primaryId,
        allowedChannel: "in_app",
      });
      expect(event).not.toHaveProperty("startDate");
      expect(event).not.toHaveProperty("partnerName");
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("rejects a replay whose persisted typed source identity changed", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const periodEventId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startDate: "2026-06-20",
        startCertainty: "exact",
        authorityVersion: 7,
        createdAt: 10,
        updatedAt: 10,
      }),
    );
    const { ensureAssistedPeriodEvent } = await import("./notificationOutbox");
    const eventId = await t.run((ctx) =>
      ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 20),
    );
    if (!eventId) throw new Error("Expected an assisted period event");
    await t.run((ctx) =>
      ctx.db.patch(eventId, {
        sourceIdentity: {
          eventType: "assisted_period_start.v1",
          sourceId: periodEventId,
          authorityVersion: 8,
          primaryId,
        },
      }),
    );

    await expect(
      t.run((ctx) =>
        ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 30),
      ),
    ).rejects.toThrow("Notification event key conflicts with its source authority");
  });

  test("does not create events for unreviewed or legacy-unknown assisted facts", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const periodEventId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startDate: "2026-06-20",
        startCertainty: "legacy_unknown",
        authorityVersion: 1,
        createdAt: 10,
        updatedAt: 10,
      }),
    );
    const unreviewedPeriodEventId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "unreviewed",
        startDate: "2026-06-21",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: 10,
        updatedAt: 10,
      }),
    );

    await expect(
      t.run((ctx) =>
        ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 20),
      ),
    ).resolves.toBeNull();
    await expect(
      t.run((ctx) =>
        ensureAssistedPeriodEvent(
          ctx,
          "assisted_period_start.v1",
          unreviewedPeriodEventId,
          20,
        ),
      ),
    ).resolves.toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
    });
  });

  test("cancels pending work and hides its inbox item without deleting records", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const periodEventId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        createdByUserId: partnerId,
        updatedByUserId: partnerId,
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startDate: "2026-06-20",
        startCertainty: "exact",
        authorityVersion: 7,
        createdAt: 10,
        updatedAt: 10,
      }),
    );
    const eventId = await t.run((ctx) =>
      ensureAssistedPeriodEvent(ctx, "assisted_period_start.v1", periodEventId, 20),
    );
    expect(eventId).not.toBeNull();

    const deliveryId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("notificationDeliveries", {
        eventId: eventId!,
        recipientUserId: primaryId,
        channel: "in_app",
        stableDestinationId: String(primaryId),
        logicalKey: makeDeliveryIdempotencyKey(String(eventId), "in_app", String(primaryId)),
        notBefore: 20,
        state: "pending",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 0,
        claimGeneration: 1,
        renderIdentity: {
          templateVersion: "g4-static-v1",
          locale: "en",
          variableSchemaVersion: "g4-v1",
          payloadHash: "safe-static-test-payload-v1",
        },
        createdAt: 20,
        updatedAt: 20,
      });
      await ctx.db.insert("notificationInboxItems", {
        eventId: eventId!,
        recipientUserId: primaryId,
        idempotencyKey: `inbox:${eventId}`,
        templateVersion: "g4-static-v1",
        route: "periods",
        state: "current",
        createdAt: 20,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "delivery",
        state: "claimed",
        dueAt: 20,
        generation: 1,
        deliveryId: id,
        createdAt: 20,
        updatedAt: 20,
      });
      return id;
    });

    await t.run((ctx) =>
      cancelSource(ctx, `period:${periodEventId}`, "source_changed", 40),
    );

    await t.run(async (ctx) => {
      expect(await ctx.db.get(eventId!)).not.toBeNull();
      expect(await ctx.db.get(deliveryId)).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
        cancellationReason: "source_changed",
      });
      expect(await ctx.db.query("notificationInboxItems").collect()).toMatchObject([
        { state: "hidden" },
      ]);
      expect(await ctx.db.query("notificationDueWork").collect()).toMatchObject([
        { state: "cancelled", generation: 2 },
      ]);
    });
  });
});

describe("current Late-state outbox events", () => {
  async function seedLateContext() {
    vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
    vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));

    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t, { fixtureRunId: "n3e-late" });
    const periodEventId = await t.run(async (ctx) => {
      await ctx.db.patch(primaryId, { timeZone: "America/Los_Angeles" });
      const periodEventId = await ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-03-01",
        startCertainty: "exact",
        authorityVersion: 1,
        createdAt: Date.parse("2026-03-01T08:00:00.000Z"),
        updatedAt: Date.parse("2026-03-01T08:00:00.000Z"),
      });
      await ctx.db.insert("cyclePredictionSegments", {
        userId: primaryId,
        startDate: "2026-03-01",
        status: "active",
        createdAt: Date.parse("2026-03-01T08:00:00.000Z"),
      });
      await ctx.db.insert("notificationScheduleState", {
        userId: primaryId,
        sourceRevision: 7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "late_status",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 3,
        updatedAt: Date.now(),
      });
      return periodEventId;
    });
    const { internal } = await import("../_generated/api");
    const snapshotId = await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    if (snapshotId === null) throw new Error("Expected a served V2 snapshot");
    const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
    if (!snapshot) throw new Error("Expected a served V2 snapshot");
    const lateInstant = Date.parse(
      `${addCalendarDays(snapshot.latestDate, 1)}T20:00:00.000Z`,
    );
    vi.setSystemTime(lateInstant);
    return { t, primaryId, periodEventId, snapshot, snapshotId, lateInstant };
  }

  test("uses the full canonical authority in bounded Late references", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t, {
      fixtureRunId: "n3e-late-authority-reference",
    });
    const localDay = "2026-03-08";
    const sourceRevision = 7;
    const reminderWindowVersion = 3;
    const firstAuthority = makeSourceAuthorityVersion({
      sourceRevision,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-a-v1",
      calibrationMethodVersion: "calibrate-v2",
    });
    const secondAuthority = makeSourceAuthorityVersion({
      sourceRevision,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-b-v1",
      calibrationMethodVersion: "calibrate-v2",
    });
    const [firstReference, secondReference] = await Promise.all([
      lateStatusSourceReference(
        primaryId,
        firstAuthority,
        sourceRevision,
        localDay,
        reminderWindowVersion,
      ),
      lateStatusSourceReference(
        primaryId,
        secondAuthority,
        sourceRevision,
        localDay,
        reminderWindowVersion,
      ),
    ]);

    expect(firstReference).not.toBe(secondReference);
    expect(firstReference).toBe(
      `late:v1:${String(primaryId)}:${firstAuthority}:${localDay}:${reminderWindowVersion}`,
    );
    expect(secondReference).toBe(
      `late:v1:${String(primaryId)}:${secondAuthority}:${localDay}:${reminderWindowVersion}`,
    );
    expect(firstReference).toContain(String(primaryId));
    expect(firstReference).toContain(firstAuthority);
    expect(firstReference.length).toBeLessThanOrEqual(1_024);

    const firstEventKey = makeEventIdempotencyKey("late_status.v1", {
      primaryId: String(primaryId),
      sourceAuthorityVersion: firstAuthority,
      localDay,
      reminderWindowVersion: String(reminderWindowVersion),
    });
    expect(
      makeEventIdempotencyKey("late_status.v1", {
        primaryId: String(primaryId),
        sourceAuthorityVersion: firstAuthority,
        localDay: "2026-03-09",
        reminderWindowVersion: String(reminderWindowVersion),
      }),
    ).not.toBe(firstEventKey);
    expect(
      makeEventIdempotencyKey("late_status.v1", {
        primaryId: String(primaryId),
        sourceAuthorityVersion: secondAuthority,
        localDay,
        reminderWindowVersion: String(reminderWindowVersion),
      }),
    ).not.toBe(firstEventKey);
    expect(
      makeEventIdempotencyKey("late_status.v1", {
        primaryId: String(primaryId),
        sourceAuthorityVersion: firstAuthority,
        localDay,
        reminderWindowVersion: String(reminderWindowVersion + 1),
      }),
    ).not.toBe(firstEventKey);

    await expect(
      lateStatusSourceReference(
        primaryId,
        firstAuthority,
        sourceRevision + 1,
        localDay,
        reminderWindowVersion,
      ),
    ).rejects.toThrow("Late-status source authority version is invalid");
    await expect(
      lateStatusSourceReference(
        primaryId,
        `${firstAuthority} `,
        sourceRevision,
        localDay,
        reminderWindowVersion,
      ),
    ).rejects.toThrow("Late-status source authority version is invalid");

    const [firstEventId, secondEventId] = await t.run(async (ctx) => {
      const insertLateEvent = async (
        sourceAuthorityVersion: string,
        sourceReference: string,
      ) => {
        const eventId = await ctx.db.insert("notificationEvents", {
          eventType: "late_status.v1",
          eventVersion: 1,
          purpose: "late_status",
          producerKind: "approved_served_late_state",
          sourceReference,
          sourceAuthorityVersion,
          ownerUserId: primaryId,
          recipientUserId: primaryId,
          recipientScope: "primary",
          privacyClass: "primary_private_inferred_health",
          validityRule: "while_current_late_state_is_valid",
          idempotencyKey: makeEventIdempotencyKey("late_status.v1", {
            primaryId: String(primaryId),
            sourceAuthorityVersion,
            localDay,
            reminderWindowVersion: String(reminderWindowVersion),
          }),
          allowedChannel: "in_app",
          createdAt: 100,
        });
        await ctx.db.insert("notificationDeliveries", {
          eventId,
          recipientUserId: primaryId,
          channel: "in_app",
          stableDestinationId: String(primaryId),
          logicalKey: makeDeliveryIdempotencyKey(
            String(eventId),
            "in_app",
            String(primaryId),
          ),
          notBefore: 100,
          state: "pending",
          eligibility: "eligible",
          providerOutcome: "none",
          attemptCount: 0,
          claimGeneration: 1,
          renderIdentity: {
            templateVersion: "g4-static-v1",
            locale: "en",
            variableSchemaVersion: "g4-v1",
            payloadHash: "safe-static-test-payload-v1",
          },
          createdAt: 100,
          updatedAt: 100,
        });
        return eventId;
      };

      const firstEventId = await insertLateEvent(firstAuthority, firstReference);
      const secondEventId = await insertLateEvent(secondAuthority, secondReference);
      return [firstEventId, secondEventId] as const;
    });

    await t.run((ctx) =>
      cancelSource(ctx, firstReference, "source_changed", 200),
    );
    await t.run(async (ctx) => {
      const first = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_event_id", (q) => q.eq("eventId", firstEventId))
        .unique();
      const second = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_event_id", (q) => q.eq("eventId", secondEventId))
        .unique();
      expect(first).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
      });
      expect(second).toMatchObject({
        state: "pending",
        eligibility: "eligible",
      });
    });

    await t.run((ctx) =>
      cancelSource(ctx, secondReference, "source_changed", 300),
    );
    await t.run(async (ctx) => {
      const second = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_event_id", (q) => q.eq("eventId", secondEventId))
        .unique();
      expect(second).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
      });
    });
  });

  test("creates and cancels the first Late reminder-window generation", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "late_status"),
        )
        .unique();
      await ctx.db.patch(preference!._id, { reminderWindowVersion: 1 });
    });
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const eventId = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );
    expect(eventId).not.toBeNull();
    await expect(t.run((ctx) =>
      cancelCurrentLateStatusSource(ctx, primaryId, "preference_off", lateInstant),
    )).resolves.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(eventId!))).not.toBeNull();
  });

  test.each([undefined, 0])("cancellation ignores an unversioned Late preference (%s)", async (version) => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "late_status"),
        )
        .unique();
      if (version === undefined) await ctx.db.delete(preference!._id);
      else await ctx.db.patch(preference!._id, { reminderWindowVersion: version });
    });
    await expect(t.run((ctx) =>
      cancelCurrentLateStatusSource(ctx, primaryId, "source_changed", lateInstant),
    )).resolves.toBeNull();
    expect(await t.run((ctx) => ctx.db.query("notificationEvents").take(1))).toEqual([]);
  });

  test("creates one stable late_status.v1 event and dedupes an incidental snapshot refresh", async () => {
    const { t, primaryId, periodEventId, snapshot, snapshotId, lateInstant } =
      await seedLateContext();
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const first = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );
    expect(first).not.toBeNull();
    const localDay = addCalendarDays(snapshot.latestDate, 1);
    const { readCurrentNotificationCycleState } = await import(
      "./notificationCycleState"
    );
    const current = await t.run((ctx) =>
      readCurrentNotificationCycleState(ctx, primaryId, lateInstant),
    );
    expect(current).not.toBeNull();
    const expectedSourceReference = await lateStatusSourceReference(
      primaryId,
      current!.sourceAuthorityVersion,
      7,
      localDay,
      3,
    );
    expect(
      await lateStatusSourceReference(
        primaryId,
        current!.sourceAuthorityVersion,
        7,
        localDay,
        4,
      ),
    ).not.toBe(expectedSourceReference);

    await t.run(async (ctx) => {
      const event = await ctx.db.get(first!);
      expect(event).toMatchObject({
        eventType: "late_status.v1",
        eventVersion: 1,
        purpose: "late_status",
        producerKind: "approved_served_late_state",
        sourceIdentity: {
          eventType: "late_status.v1",
          primaryId,
          latestEligibleStartEventId: periodEventId,
          sourceAuthorityVersion: event!.sourceAuthorityVersion,
          reminderWindowVersion: 3,
          localDay,
        },
        sourceReference: expectedSourceReference,
        ownerUserId: primaryId,
        recipientUserId: primaryId,
        recipientScope: "primary",
        privacyClass: "primary_private_inferred_health",
        validityRule: "while_current_late_state_is_valid",
        allowedChannel: "in_app",
      });
      expect(event?.sourceAuthorityVersion).toContain('g4-source-v1:[7,"cycle-read-model-v1","prediction-serving-v2"');
      expect(event?.idempotencyKey).toBe(
        makeEventIdempotencyKey("late_status.v1", {
          primaryId: String(primaryId),
          sourceAuthorityVersion: event!.sourceAuthorityVersion,
          localDay,
          reminderWindowVersion: "3",
        }),
      );
      expect(event).not.toHaveProperty("payload");
      expect(event).not.toHaveProperty("phase");
      expect(await ctx.db.query("notificationEvents").take(5)).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").take(5)).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").take(5)).toHaveLength(0);
    });

    vi.setSystemTime(lateInstant + 10_000);
    const { internal } = await import("../_generated/api");
    await t.mutation(
      internal.internal.predictionSnapshots.ensureCurrentForUser,
      { userId: primaryId },
    );
    const replay = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, Date.now()),
    );

    expect(replay).toBe(first);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(snapshotId)).toEqual(snapshot);
      expect(await ctx.db.query("predictionSnapshots").take(5)).toHaveLength(2);
      expect(await ctx.db.query("notificationEvents").take(5)).toHaveLength(1);
    });
  });

  test("fails closed when the selected Late anchor has no source event ID", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    const current = await t.run((ctx) =>
      notificationCycleState.readCurrentNotificationCycleState(ctx, primaryId, lateInstant),
    );
    if (!current) throw new Error("Expected current Late source state");
    const readState = vi
      .spyOn(notificationCycleState, "readCurrentNotificationCycleState")
      .mockResolvedValue({ ...current, latestEligibleStartEventId: undefined });
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");

    const eventId = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );

    expect(readState).toHaveBeenCalledOnce();
    expect(eventId).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("notificationEvents").take(5))).toEqual([]);
  });

  test("bounds retained same-day Late history by the reminder-window generation", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const retainedWindowVersions = 258;
    let latestEventId = null as Awaited<
      ReturnType<typeof ensureCurrentLateStatusEvent>
    >;

    for (let offset = 0; offset < retainedWindowVersions; offset += 1) {
      const reminderWindowVersion = 3 + offset;
      if (offset > 0) {
        await t.run(async (ctx) => {
          const preference = await ctx.db
            .query("notificationPreferences")
            .withIndex("by_user_and_purpose", (q) =>
              q.eq("userId", primaryId).eq("purpose", "late_status"),
            )
            .unique();
          if (!preference) throw new Error("Expected the Late preference");
          await ctx.db.patch(preference._id, { reminderWindowVersion });
        });
      }
      latestEventId = await t.run((ctx) =>
        ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
      );
      if (latestEventId === null) {
        throw new Error(`Expected Late event for window version ${reminderWindowVersion}`);
      }
    }

    await t.run(async (ctx) => {
      const events = await ctx.db.query("notificationEvents").take(retainedWindowVersions + 1);
      expect(events).toHaveLength(retainedWindowVersions);
      expect(new Set(events.map((event) => event.sourceReference)).size).toBe(
        retainedWindowVersions,
      );
      expect((await ctx.db.get(latestEventId!))?.idempotencyKey).toContain(
        `,"${retainedWindowVersions + 2}"]`,
      );
    });
  });

  test("leaves current Late state dark while outbox creation is disabled", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "false");
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const result = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );

    expect(result).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").take(5)).toEqual([]);
      expect(await ctx.db.query("notificationDeliveries").take(5)).toEqual([]);
      expect(await ctx.db.query("notificationInboxItems").take(5)).toEqual([]);
    });
  });

  test("requires the primary's explicit Late-purpose preference", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "late_status"),
        )
        .unique();
      if (!preference) throw new Error("Expected Late-purpose preference");
      await ctx.db.patch(preference._id, { inAppEnabled: false });
    });
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const result = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );

    expect(result).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").take(5)).toEqual([]);
    });
  });

  test("does not emit for an estimated cycle state", async () => {
    const { t, primaryId } = await seedLateContext();
    const { readCurrentNotificationCycleState } = await import(
      "./notificationCycleState"
    );
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const timeBeforeBound = Date.parse("2026-03-07T20:00:00.000Z");
    const current = await t.run((ctx) =>
      readCurrentNotificationCycleState(ctx, primaryId, timeBeforeBound),
    );
    expect(current?.state.status).toBe("estimated");
    const result = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, timeBeforeBound),
    );

    expect(result).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").take(5)).toEqual([]);
    });
  });

  test.each(["insufficient", "paused"] as const)(
    "does not emit for a %s cycle state",
    async (nonLateState) => {
      const { t, primaryId, lateInstant } = await seedLateContext();
      await t.run(async (ctx) => {
        if (nonLateState === "insufficient") {
          await ctx.db.patch(primaryId, { timeZone: undefined });
          return;
        }
        await ctx.db.insert("cycleSettings", {
          userId: primaryId,
          cycleLength: 28,
          periodLength: 5,
          predictionPaused: true,
          predictionPausedAt: lateInstant,
          lastUpdatedAt: lateInstant,
        });
      });
      const { readCurrentNotificationCycleState } = await import(
        "./notificationCycleState"
      );
      const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
      const current = await t.run((ctx) =>
        readCurrentNotificationCycleState(ctx, primaryId, lateInstant),
      );
      expect(current?.state.status).toBe(
        nonLateState === "insufficient" ? "insufficient_data" : "prediction_paused",
      );
      const result = await t.run((ctx) =>
        ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
      );

      expect(result).toBeNull();
      await t.run(async (ctx) => {
        expect(await ctx.db.query("notificationEvents").take(5)).toEqual([]);
      });
    },
  );

  test("uses a new source-authority key on a same-day source revision and supersedes old work", async () => {
    const { t, primaryId, lateInstant } = await seedLateContext();
    const { ensureCurrentLateStatusEvent } = await import("./notificationOutbox");
    const first = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );
    if (first === null) throw new Error("Expected initial Late event");
    const linked = await t.run(async (ctx) => {
      const event = await ctx.db.get(first);
      if (!event) throw new Error("Expected initial event row");
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        eventId: first,
        recipientUserId: primaryId,
        channel: "in_app",
        stableDestinationId: String(primaryId),
        logicalKey: makeDeliveryIdempotencyKey(String(first), "in_app", String(primaryId)),
        notBefore: lateInstant,
        state: "pending",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 0,
        claimGeneration: 1,
        renderIdentity: {
          templateVersion: "g4-static-v1",
          locale: "en",
          variableSchemaVersion: "g4-v1",
          payloadHash: "safe-static-test-payload-v1",
        },
        createdAt: lateInstant,
        updatedAt: lateInstant,
      });
      await ctx.db.insert("notificationInboxItems", {
        eventId: first,
        recipientUserId: primaryId,
        idempotencyKey: `inbox:${first}`,
        templateVersion: "g4-static-v1",
        route: "periods",
        state: "current",
        createdAt: lateInstant,
      });
      return { event, deliveryId };
    });

    await t.run(async (ctx) => {
      const state = await ctx.db
        .query("notificationScheduleState")
        .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
        .unique();
      if (!state) throw new Error("Expected schedule authority");
      await cancelCurrentLateStatusSource(
        ctx,
        primaryId,
        "source_changed",
        lateInstant,
      );
      await ctx.db.patch(state._id, { sourceRevision: state.sourceRevision + 1 });
    });
    const replacement = await t.run((ctx) =>
      ensureCurrentLateStatusEvent(ctx, primaryId, lateInstant),
    );

    expect(replacement).not.toBeNull();
    expect(replacement).not.toBe(first);
    await t.run(async (ctx) => {
      const events = await ctx.db.query("notificationEvents").take(5);
      expect(events).toHaveLength(2);
      expect(events.find((event) => event._id === first)?.idempotencyKey).toBe(
        linked.event.idempotencyKey,
      );
      expect(events.find((event) => event._id === replacement)?.idempotencyKey).not.toBe(
        linked.event.idempotencyKey,
      );
      expect(await ctx.db.get(linked.deliveryId)).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
        cancellationReason: "source_changed",
      });
      expect(await ctx.db.query("notificationInboxItems").take(5)).toMatchObject([
        { state: "hidden" },
      ]);
    });
  });

  test("rejects composed Late source references over 1,024 characters", async () => {
    const sourceRevision = 7;
    const authority = makeSourceAuthorityVersion({
      sourceRevision,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v1",
      calibrationMethodVersion: "calibrate-v1",
    });
    const oversizedPrimaryId = "u".repeat(1_024) as Id<"users">;

    await expect(
      lateStatusSourceReference(
        oversizedPrimaryId,
        authority,
        sourceRevision,
        "2026-03-08",
        3,
      ),
    ).rejects.toThrow("Late-status source reference is outside its fixed bound");
  });

  test("keeps local day, reminder window, and method version in Late event keys", () => {
    const primaryId = "primary-test-id";
    const localDay = "2026-03-08";
    const sourceRevision = 7;
    const firstAuthority = makeSourceAuthorityVersion({
      sourceRevision,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-a-v1",
      calibrationMethodVersion: "calibrate-v2",
    });
    const secondAuthority = makeSourceAuthorityVersion({
      sourceRevision,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-b-v1",
      calibrationMethodVersion: "calibrate-v2",
    });
    const eventKey = (
      sourceAuthorityVersion: string,
      day: string,
      reminderWindowVersion: number,
    ) =>
      makeEventIdempotencyKey("late_status.v1", {
        primaryId,
        sourceAuthorityVersion,
        localDay: day,
        reminderWindowVersion: String(reminderWindowVersion),
      });
    const firstKey = eventKey(firstAuthority, localDay, 3);

    expect(eventKey(firstAuthority, "2026-03-09", 3)).not.toBe(firstKey);
    expect(eventKey(firstAuthority, localDay, 4)).not.toBe(firstKey);
    expect(eventKey(secondAuthority, localDay, 3)).not.toBe(firstKey);
  });
});
