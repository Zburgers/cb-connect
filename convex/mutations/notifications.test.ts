import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { addCalendarDays } from "../_helpers/cycleCalculations";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import { renderFrozen } from "../_helpers/notificationTemplates";
import { resolveLocalReminderInstant } from "../internal/notificationScheduler";
import schema from "../schema";
import {
  notificationControlValidator,
  notificationDueWorkValidator,
  notificationInAppAttemptValidator,
  notificationInAppDeliveryValidator,
  painReminderRequestValidator,
  notificationScheduleStateValidator,
} from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

const wakeDueWorkRef = makeFunctionReference<"mutation">(
  "internal/notificationScheduler:wakeDueWork",
);

type TestBackend = TestConvex<typeof schema>;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function enableOutboxProjection() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_INBOX_V1", "true");
}

function indexDefinitions(table: unknown) {
  return (table as unknown as {
    indexes: Array<{ indexDescriptor: string; fields: string[] }>;
  }).indexes;
}

function enableScheduleInputs() {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
}

async function seedCurrentPrediction(
  t: TestBackend,
  userId: Id<"users">,
  sourceRevision = 7,
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.patch(userId, { timeZone: "UTC" });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-03-01",
      startCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.UTC(2026, 2, 1),
      updatedAt: Date.UTC(2026, 2, 1),
    });
    await ctx.db.insert("cyclePredictionSegments", {
      userId,
      startDate: "2026-03-01",
      status: "active",
      createdAt: Date.UTC(2026, 2, 1),
    });
    await ctx.db.insert("notificationScheduleState", {
      userId,
      sourceRevision,
      createdAt: now,
      updatedAt: now,
    });
  });

  const snapshotId = await t.mutation(
    internal.internal.predictionSnapshots.ensureCurrentForUser,
    { userId },
  );
  if (snapshotId === null) throw new Error("Expected a current V2 snapshot");
  const snapshot = await t.run((ctx) => ctx.db.get(snapshotId));
  if (!snapshot) throw new Error("Expected a stored V2 snapshot");
  return snapshot;
}

async function readPreferenceScheduleState(t: TestBackend, userId: Id<"users">) {
  return await t.run(async (ctx) => ({
    preference: await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", userId).eq("purpose", "period_window_approaching"),
      )
      .unique(),
    source: await ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique(),
    snapshots: await ctx.db
      .query("predictionSnapshots")
      .withIndex("by_user_and_generated_at", (q) => q.eq("userId", userId))
      .take(10),
    work: await ctx.db
      .query("notificationDueWork")
      .withIndex("by_owner_and_state_and_due_at", (q) =>
        q.eq("ownerUserId", userId),
      )
      .take(100),
    scheduled: await ctx.db.system.query("_scheduled_functions").take(50),
    events: await ctx.db.query("notificationEvents").take(50),
  }));
}

describe("notification persistence", () => {
  test("deduplicates an in-app event, delivery, and inbox item under concurrent writes", async () => {
    enableOutboxProjection();
    const t = convexTest(schema, modules);
    const { asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "partner_message",
      inAppEnabled: true,
    });

    const messageId = await t.run((ctx) =>
      ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "Private message body must not be copied",
        createdAt: 1_800_000_000_000,
      }),
    );
    const event = {
      eventType: "partner_message.v1" as const,
      eventVersion: 1 as const,
      purpose: "partner_message" as const,
      producerKind: "new_couple_message" as const,
      sourceReference: `message:${messageId}`,
      sourceAuthorityVersion: "link-generation:1",
      ownerUserId: primaryId,
      recipientUserId: partnerId,
      recipientScope: "other_active_member" as const,
      privacyClass: "relationship_private_free_text_source" as const,
      validityRule: "while_message_and_active_link_exist" as const,
      idempotencyKey: makeEventIdempotencyKey("partner_message.v1", {
        messageId: String(messageId),
        recipientId: String(partnerId),
      }),
      allowedChannel: "in_app" as const,
    };
    const rendered = await renderFrozen({
      eventType: event.eventType,
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v1",
    });
    const args = {
      envelope: event,
      route: rendered.payload.route,
      templateVersion: "g4-static-v1",
      renderIdentity: rendered.identity,
      createdAt: 1_800_000_000_000,
      notBefore: 1_800_000_000_000,
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        t.mutation(internal.mutations.notifications.ensureInAppRecords, args),
      ),
    );

    expect(new Set(results.map((result) => result.eventId)).size).toBe(1);
    expect(new Set(results.map((result) => result.deliveryId)).size).toBe(1);
    expect(results.map((result) => result.status)).toEqual(
      Array(8).fill("delivery_ready"),
    );
    expect(results.every((result) => result.inboxItemId === null)).toBe(true);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { channel: "in_app", state: "pending", providerOutcome: "none" },
      ]);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
    });

    await t.run(async (ctx) => {
      const delivery = await ctx.db.query("notificationDeliveries").first();
      if (!delivery) throw new Error("Expected the private in-app delivery");

      await ctx.db.patch(delivery._id, {
        state: "retry_wait",
        nextAttemptAt: 1_800_000_000_100,
        updatedAt: 1_800_000_000_100,
      });
      await ctx.db.patch(delivery._id, {
        state: "failed_permanent",
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        updatedAt: 1_800_000_000_200,
      });
    });
  });

  test("rejects fractional and unsafe event timestamps before persistence", async () => {
    enableOutboxProjection();
    const t = convexTest(schema, modules);
    const { asPartner, primaryId, partnerId } = await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "partner_message",
      inAppEnabled: true,
    });
    const rendered = await renderFrozen({
      eventType: "partner_message.v1",
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v1",
    });
    const args = {
      envelope: {
        eventType: "partner_message.v1" as const,
        eventVersion: 1 as const,
        purpose: "partner_message" as const,
        producerKind: "new_couple_message" as const,
        sourceReference: "message:opaque",
        sourceAuthorityVersion: "link-generation:1",
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        recipientScope: "other_active_member" as const,
        privacyClass: "relationship_private_free_text_source" as const,
        validityRule: "while_message_and_active_link_exist" as const,
        idempotencyKey: makeEventIdempotencyKey("partner_message.v1", {
          messageId: "coupleMessages:opaque",
          recipientId: String(partnerId),
        }),
        allowedChannel: "in_app" as const,
      },
      route: "messages" as const,
      templateVersion: "g4-static-v1",
      renderIdentity: rendered.identity,
      createdAt: 100,
      notBefore: 100,
    };

    for (const createdAt of [
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(
        t.mutation(internal.mutations.notifications.ensureInAppRecords, {
          ...args,
          createdAt,
        }),
      ).rejects.toThrow(/timestamp|createdAt/i);
    }
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
    });
  });

  test("does not create new storage while the absent outbox flag is off", async () => {
    const t = convexTest(schema, modules);
    const { primaryId, partnerId } = await seedActiveCouple(t);
    const result = await t.mutation(
      internal.mutations.notifications.ensureInAppRecords,
      {
        envelope: {
          eventType: "partner_message.v1",
          eventVersion: 1,
          purpose: "partner_message",
          producerKind: "new_couple_message",
          sourceReference: "message:opaque",
          sourceAuthorityVersion: "link-generation:1",
          ownerUserId: primaryId,
          recipientUserId: partnerId,
          recipientScope: "other_active_member",
          privacyClass: "relationship_private_free_text_source",
          validityRule: "while_message_and_active_link_exist",
          idempotencyKey: "event:v1:opaque",
          allowedChannel: "in_app",
        },
          route: "messages",
          templateVersion: "g4-static-v1",
          renderIdentity: {
            templateVersion: "g4-static-v1",
            locale: "en",
            variableSchemaVersion: "g4-no-variables-v1",
            payloadHash: "test-static-message-v1",
          },
          createdAt: 1_800_000_000_000,
        notBefore: 1_800_000_000_000,
      },
    );

    expect(result).toMatchObject({ status: "disabled" });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("advances only the changed purpose schedule version and clears local time explicitly", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const write = (localReminderTime?: string | null) =>
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "pain_check_in",
        inAppEnabled: true,
        ...(localReminderTime === undefined ? {} : { localReminderTime }),
      });

    await write();
    await write();
    let row = await t.run((ctx) =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "pain_check_in"),
        )
        .unique(),
    );
    expect(row?.reminderWindowVersion).toBe(1);

    await write("09:30");
    await write(null);
    row = await t.run((ctx) =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "pain_check_in"),
        )
        .unique(),
    );
    expect(row?.reminderWindowVersion).toBe(3);
    expect(row?.localReminderTime).toBeUndefined();
    await t.run(async (ctx) => {
      const unrelated = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "partner_message"),
        )
        .unique();
      expect(unrelated).toBeNull();
    });
  });

  test("preference API enables, moves, and disables work without refreshing its source snapshot", async () => {
    enableScheduleInputs();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const snapshot = await seedCurrentPrediction(t, primaryId);
    const before = await readPreferenceScheduleState(t, primaryId);

    expect(before.source?.sourceRevision).toBe(7);
    expect(before.snapshots.map(({ _id }) => _id)).toEqual([snapshot._id]);
    expect(before.work).toHaveLength(0);
    expect(before.scheduled).toHaveLength(0);

    await asPrimary.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "09:00",
    });
    const enabled = await readPreferenceScheduleState(t, primaryId);
    const firstWork = enabled.work.find(
      ({ kind, state }) => kind === "prediction_window" && state === "pending",
    );
    expect(enabled.preference?.reminderWindowVersion).toBe(1);
    expect(firstWork?.dueAt).toBe(
      resolveLocalReminderInstant(
        addCalendarDays(snapshot.pointDate, -3),
        "09:00",
        "UTC",
      ),
    );
    expect(enabled.scheduled.map(({ scheduledTime }) => scheduledTime)).toContain(
      firstWork?.dueAt,
    );
    expect(enabled.source?._id).toBe(before.source?._id);
    expect(enabled.source?.sourceRevision).toBe(before.source?.sourceRevision);
    expect(enabled.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt }))).toEqual(
      before.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt })),
    );
    if (!firstWork) throw new Error("Expected enabled prediction-window work");

    await asPrimary.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "11:30",
    });
    const edited = await readPreferenceScheduleState(t, primaryId);
    const editedWork = edited.work.find(
      ({ kind, state }) => kind === "prediction_window" && state === "pending",
    );
    expect(edited.preference?.reminderWindowVersion).toBe(2);
    expect(edited.work.find(({ _id }) => _id === firstWork._id)?.state).toBe("cancelled");
    expect(editedWork?.dueAt).toBe(
      resolveLocalReminderInstant(
        addCalendarDays(snapshot.pointDate, -3),
        "11:30",
        "UTC",
      ),
    );
    expect(edited.source?.sourceRevision).toBe(before.source?.sourceRevision);
    expect(edited.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt }))).toEqual(
      before.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt })),
    );
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: firstWork._id,
        generation: firstWork.generation,
      }),
    ).resolves.toEqual({ status: "stale" });
    if (!editedWork) throw new Error("Expected moved prediction-window work");

    await asPrimary.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: false,
      localReminderTime: "11:30",
    });
    const disabled = await readPreferenceScheduleState(t, primaryId);
    expect(disabled.preference?.inAppEnabled).toBe(false);
    expect(disabled.preference?.reminderWindowVersion).toBe(3);
    expect(disabled.work.find(({ _id }) => _id === editedWork._id)?.state).toBe(
      "cancelled",
    );
    expect(disabled.source?.sourceRevision).toBe(before.source?.sourceRevision);
    expect(disabled.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt }))).toEqual(
      before.snapshots.map(({ _id, generatedAt }) => ({ _id, generatedAt })),
    );
    expect(disabled.events).toEqual([]);
    await expect(
      t.mutation(wakeDueWorkRef, {
        workId: editedWork._id,
        generation: editedWork.generation,
      }),
    ).resolves.toEqual({ status: "stale" });
  });

  test("identical scheduling preference writes dedupe revisions and wakeups", async () => {
    enableScheduleInputs();
    const now = Date.parse("2026-03-07T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await seedCurrentPrediction(t, primaryId);
    const write = () =>
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
      });

    await write();
    const first = await readPreferenceScheduleState(t, primaryId);
    vi.setSystemTime(now + 60_000);
    await write();
    const repeated = await readPreferenceScheduleState(t, primaryId);

    expect(repeated.preference?.reminderWindowVersion).toBe(
      first.preference?.reminderWindowVersion,
    );
    expect(repeated.preference?.updatedAt).toBe(first.preference?.updatedAt);
    expect(repeated.work.map(({ _id, state, dueAt }) => ({ _id, state, dueAt }))).toEqual(
      first.work.map(({ _id, state, dueAt }) => ({ _id, state, dueAt })),
    );
    expect(repeated.scheduled.map(({ _id, scheduledTime }) => ({ _id, scheduledTime }))).toEqual(
      first.scheduled.map(({ _id, scheduledTime }) => ({ _id, scheduledTime })),
    );
  });

  test("invalid-time and wrong-recipient preference writes leave no records or work", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId, partnerId } = await seedActiveCouple(t);

    await expect(
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "24:00",
      }),
    ).rejects.toThrow();
    await expect(
      asPartner.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
      }),
    ).rejects.toThrow();
    await expect(
      asPartner.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "partner_message",
        inAppEnabled: true,
        userId: primaryId,
      } as never),
    ).rejects.toThrow();

    const after = await t.run(async (ctx) => ({
      preferences: await ctx.db.query("notificationPreferences").take(10),
      source: await ctx.db.query("notificationScheduleState").take(10),
      work: await ctx.db.query("notificationDueWork").take(10),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
      primary: await ctx.db.get(primaryId),
      partner: await ctx.db.get(partnerId),
    }));
    expect(after.preferences).toEqual([]);
    expect(after.source).toEqual([]);
    expect(after.work).toEqual([]);
    expect(after.scheduled).toEqual([]);
    expect(after.primary?.externalNotificationConsent).toBeUndefined();
    expect(after.partner?.externalNotificationConsent).toBeUndefined();
  });

  test("absent scheduler flag stores consent without source rows, due work, or wakeups", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "09:00",
    });

    const after = await readPreferenceScheduleState(t, primaryId);
    expect(after.preference).toMatchObject({
      inAppEnabled: true,
      reminderWindowVersion: 1,
      localReminderTime: "09:00",
    });
    expect(after.source).toBeNull();
    expect(after.work).toEqual([]);
    expect(after.scheduled).toEqual([]);
  });

  test("does not catch up an enabled reminder after its local validity day", async () => {
    enableScheduleInputs();
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-04-15T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const snapshot = await seedCurrentPrediction(t, primaryId);

    await asPrimary.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "09:00",
    });

    const after = await readPreferenceScheduleState(t, primaryId);
    expect(snapshot.pointDate < "2026-04-15").toBe(true);
    expect(after.preference?.inAppEnabled).toBe(true);
    expect(after.source?.sourceRevision).toBe(7);
    expect(after.snapshots.map(({ _id }) => _id)).toEqual([snapshot._id]);
    expect(after.work).toEqual([]);
    expect(after.scheduled).toEqual([]);
  });

  test("rejects external-channel fields on new preference and persistence paths", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, partnerId } = await seedActiveCouple(t);
    const args = {
      envelope: {
        eventType: "partner_message.v1" as const,
        eventVersion: 1 as const,
        purpose: "partner_message" as const,
        producerKind: "new_couple_message" as const,
        sourceReference: "message:opaque",
        sourceAuthorityVersion: "link-generation:1",
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        recipientScope: "other_active_member" as const,
        privacyClass: "relationship_private_free_text_source" as const,
        validityRule: "while_message_and_active_link_exist" as const,
        idempotencyKey: "event:v1:opaque",
        allowedChannel: "in_app" as const,
      },
      route: "messages" as const,
      templateVersion: "g4-static-v1",
      renderIdentity: {
        templateVersion: "g4-static-v1",
        locale: "en",
        variableSchemaVersion: "g4-no-variables-v1",
        payloadHash: "test-static-message-v1",
      },
      createdAt: 1_800_000_000_000,
      notBefore: 1_800_000_000_000,
    };

    await expect(
      t.mutation(internal.mutations.notifications.ensureInAppRecords, {
        ...args,
        channel: "discord",
      } as never),
    ).rejects.toThrow();
    await expect(
      asPrimary.mutation(api.mutations.notifications.setMyPreference, {
        purpose: "partner_message",
        inAppEnabled: true,
        channel: "discord",
      } as never),
    ).rejects.toThrow();
  });

  test("bounds due-work reads to pending rows at or before the supplied time", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "pending",
        dueAt: 10,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "pending",
        dueAt: 20,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "completed",
        dueAt: 5,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const rows = await t.query(internal.queries.notifications.getDueWork, {
      now: 10,
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].dueAt).toBe(10);
  });

  test("accepts scheduled prediction and Late boundary work kinds", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const kinds = ["prediction_window", "late_boundary"] as const;

    await t.run(async (ctx) => {
      for (const kind of kinds) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind,
          state: "pending",
          dueAt: 10,
          generation: 1,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("notificationDueWork").collect();
      expect(rows.map((row) => row.kind)).toEqual(kinds);
    });
  });

  test("keeps pain requests minimal and schedule authority unbackfilled", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationScheduleState").collect()).toHaveLength(0);
    });
  });

  test("freezes strict in-app, deny-only, content-free storage shapes", () => {
    expect(Object.keys(notificationInAppDeliveryValidator.fields)).not.toContain(
      "providerMessageId",
    );
    expect(
      Object.keys(notificationInAppAttemptValidator.fields.result.fields),
    ).toEqual(["kind"]);
    expect(Object.keys(notificationControlValidator.fields).sort()).toEqual([
      "key",
      "operatorReference",
      "scope",
      "updatedAt",
      "version",
    ]);
    expect(Object.keys(painReminderRequestValidator.fields).sort()).toEqual([
      "createdAt",
      "ownerUserId",
      "painLogId",
      "requestVersion",
      "selectedLocalDay",
      "state",
      "updatedAt",
    ]);
    expect(indexDefinitions(schema.tables.notificationDueWork)).toContainEqual({
      indexDescriptor: "by_state_and_due_at",
      fields: ["state", "dueAt"],
    });
    expect(indexDefinitions(schema.tables.notificationDueWork)).toContainEqual({
      indexDescriptor: "by_kind_and_state_and_due_at",
      fields: ["kind", "state", "dueAt"],
    });
    expect(Object.keys(notificationScheduleStateValidator.fields).sort()).toEqual([
      "createdAt",
      "sourceAuthorityVersion",
      "sourceRevision",
      "updatedAt",
      "userId",
    ]);
    expect(Object.keys(notificationDueWorkValidator.fields)).toEqual(
      expect.arrayContaining(["sourceAuthorityVersion", "reminderWindowVersion"]),
    );
    expect(indexDefinitions(schema.tables.notificationScheduleState)).toContainEqual({
      indexDescriptor: "by_user_id",
      fields: ["userId"],
    });
    expect(indexDefinitions(schema.tables.notificationDeliveries)).toContainEqual({
      indexDescriptor: "by_state_and_expires_at",
      fields: ["state", "expiresAt"],
    });
    expect(indexDefinitions(schema.tables.notificationDeliveries)).toContainEqual({
      indexDescriptor: "by_state_and_next_receipt_check_at",
      fields: ["state", "nextReceiptCheckAt"],
    });
    expect(indexDefinitions(schema.tables.notificationDeliveries)).not.toContainEqual({
      indexDescriptor: "by_state_and_receipt_check_at",
      fields: ["state", "nextReceiptCheckAt"],
    });
  });
});
