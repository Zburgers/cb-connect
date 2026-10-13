import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { Doc } from "../_generated/dataModel";
import { addCalendarDays } from "./cycleCalculations";
import { makeEventIdempotencyKey } from "./notificationDelivery";
import {
  makeSourceAuthorityVersion,
} from "./notificationSourceAuthority";
import { isNotificationSourceCurrent } from "./notificationSourceReader";
import { readCurrentNotificationCycleState } from "./notificationCycleState";
import {
  notificationEventDefinitions,
  type NotificationEventWrite,
  type NotificationSourceIdentity,
} from "./notificationTypes";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

type TestBackend = TestConvex<typeof schema>;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

let eventCounter = 0;

async function insertTypedEvent(
  t: TestBackend,
  identity: NotificationSourceIdentity,
  sourceAuthorityVersion: string,
) {
  const definition = notificationEventDefinitions[identity.eventType];
  const ownerUserId = "primaryId" in identity ? identity.primaryId : identity.ownerUserId;
  const recipientUserId = "primaryId" in identity
    ? identity.primaryId
    : identity.recipientUserId;
  const envelope: NotificationEventWrite = {
    eventType: identity.eventType,
    eventVersion: 1,
    purpose: definition.purpose as NotificationEventWrite["purpose"],
    producerKind: definition.producer as NotificationEventWrite["producerKind"],
    sourceReference: "deliberately-untrusted-reference",
    sourceAuthorityVersion,
    ownerUserId,
    recipientUserId,
    recipientScope: definition.recipient as NotificationEventWrite["recipientScope"],
    privacyClass: definition.privacyClass as NotificationEventWrite["privacyClass"],
    validityRule: definition.validity as NotificationEventWrite["validityRule"],
    idempotencyKey: `event:v1:source-reader:${++eventCounter}`,
    allowedChannel: "in_app",
    sourceIdentity: identity,
  };
  return await t.run((ctx) =>
    ctx.db.insert("notificationEvents", { ...envelope, createdAt: Date.now() }),
  );
}

async function seedCurrentPredictionWindow(t: TestBackend) {
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "true");
  vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "true");
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-03-07T20:00:00.000Z"));
  const { primaryId } = await seedActiveCouple(t, { fixtureRunId: "n8c-source-reader" });
  const periodEventId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("periodEvents", {
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
    await ctx.db.insert("notificationPreferences", {
      userId: primaryId,
      purpose: "period_window_approaching",
      inAppEnabled: true,
      localReminderTime: "09:00",
      reminderWindowVersion: 2,
      updatedAt: now,
    });
    await ctx.db.insert("notificationScheduleState", {
      userId: primaryId,
      sourceRevision: 7,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
  const snapshotId = await t.mutation(
    internal.internal.predictionSnapshots.ensureCurrentForUser,
    { userId: primaryId },
  );
  if (!snapshotId) throw new Error("Expected the served V2 snapshot");
  const current = await t.run((ctx) =>
    readCurrentNotificationCycleState(ctx, primaryId, Date.now()),
  );
  if (
    !current ||
    current.state.status !== "estimated" ||
    current.latestEligibleStartEventId !== periodEventId
  ) {
    throw new Error("Expected current served V2 prediction authority");
  }
  if (
    current.state.bounds.version !== 2 ||
    current.state.bounds.source !== "period_prediction_v2"
  ) {
    throw new Error("Expected current served V2 prediction bounds");
  }
  const dueLocalDay = addCalendarDays(current.state.bounds.pointDate, -3);
  vi.setSystemTime(Date.parse(`${dueLocalDay}T12:00:00.000Z`));
  const currentOnDueDay = await t.run((ctx) =>
    readCurrentNotificationCycleState(ctx, primaryId, Date.now()),
  );
  if (
    !currentOnDueDay ||
    currentOnDueDay.state.status !== "estimated" ||
    currentOnDueDay.localDay !== dueLocalDay ||
    currentOnDueDay.latestEligibleStartEventId !== periodEventId
  ) {
    throw new Error("Expected current served V2 authority on its designated due day");
  }
  await t.run(async (ctx) => {
    const state = await ctx.db
      .query("notificationScheduleState")
      .withIndex("by_user_id", (q) => q.eq("userId", primaryId))
      .unique();
    if (!state) throw new Error("Expected notification source state");
    await ctx.db.patch(state._id, {
      sourceAuthorityVersion: currentOnDueDay.sourceAuthorityVersion,
    });
  });
  return { primaryId, periodEventId, current: currentOnDueDay, dueLocalDay };
}

async function seedMessageEvent(t: TestBackend) {
  const { coupleId, primaryId, partnerId } = await seedActiveCouple(t);
  const now = 1_800_000_000_000;
  const { membershipId, messageId, eventId } = await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
      )
      .unique();
    if (!membership) throw new Error("Expected an active partner membership");
    const messageId = await ctx.db.insert("coupleMessages", {
      coupleId,
      relationshipMembershipId: membership._id,
      senderId: primaryId,
      body: "Private source body",
      createdAt: now,
    });
    const eventId = await ctx.db.insert("notificationEvents", {
      eventType: "partner_message.v1",
      eventVersion: 1,
      purpose: "partner_message",
      producerKind: "new_couple_message",
      sourceReference: `message:${messageId}`,
      sourceAuthorityVersion: `relationship-membership:${membership._id}`,
      ownerUserId: primaryId,
      recipientUserId: partnerId,
      recipientScope: "other_active_member",
      privacyClass: "relationship_private_free_text_source",
      validityRule: "while_message_and_active_link_exist",
      idempotencyKey: makeEventIdempotencyKey("partner_message.v1", {
        messageId: String(messageId),
        recipientId: String(partnerId),
      }),
      allowedChannel: "in_app",
      sourceIdentity: {
        eventType: "partner_message.v1",
        sourceId: messageId,
        coupleId,
        relationshipMembershipId: membership._id,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
      },
      createdAt: now,
    });
    return { membershipId: membership._id, messageId, eventId };
  });
  return { coupleId, primaryId, partnerId, membershipId, messageId, eventId };
}

async function readEvent(t: TestBackend, eventId: Id<"notificationEvents">) {
  return await t.run(async (ctx) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Expected a notification event");
    return await isNotificationSourceCurrent(ctx, event);
  });
}

describe("N8c notification source authority reader", () => {
  test("accepts an exact source row in the current relationship generation", async () => {
    const t = convexTest(schema, modules);
    const { eventId } = await seedMessageEvent(t);

    await expect(readEvent(t, eventId)).resolves.toBe(true);
  });

  test("does not parse the compatibility sourceReference for authority", async () => {
    const t = convexTest(schema, modules);
    const { eventId } = await seedMessageEvent(t);
    await t.run((ctx) =>
      ctx.db.patch(eventId, { sourceReference: "period:not-the-message-id" }),
    );

    await expect(readEvent(t, eventId)).resolves.toBe(true);
  });

  test("denies a legacy event without typed source identity", async () => {
    const t = convexTest(schema, modules);
    const { coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const eventId = await t.run((ctx) =>
      ctx.db.insert("notificationEvents", {
        eventType: "partner_message.v1",
        eventVersion: 1,
        purpose: "partner_message",
        producerKind: "new_couple_message",
        sourceReference: "message:legacy",
        sourceAuthorityVersion: "relationship-membership:legacy",
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        recipientScope: "other_active_member",
        privacyClass: "relationship_private_free_text_source",
        validityRule: "while_message_and_active_link_exist",
        idempotencyKey: "event:v1:legacy",
        allowedChannel: "in_app",
        createdAt: Date.now(),
      }),
    );

    await expect(readEvent(t, eventId)).resolves.toBe(false);
    expect(coupleId).toBeDefined();
  });

  test("denies an old message after its partner membership is revoked and relinked", async () => {
    const t = convexTest(schema, modules);
    const { coupleId, partnerId, membershipId, eventId } = await seedMessageEvent(t);
    await t.run(async (ctx) => {
      const oldMembership = await ctx.db.get(membershipId);
      if (!oldMembership) throw new Error("Expected the original membership");
      await ctx.db.patch(membershipId, { revokedAt: Date.now() });
      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: partnerId,
        role: "partner",
        sharingPain: false,
        sharingPhase: false,
        joinedAt: Date.now() + 1,
      });
    });

    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test("denies a source identity whose recipient differs from the event envelope", async () => {
    const t = convexTest(schema, modules);
    const { coupleId, eventId, membershipId, messageId, partnerId, primaryId } =
      await seedMessageEvent(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(eventId, {
        sourceIdentity: {
          eventType: "partner_message.v1",
          sourceId: messageId,
          coupleId,
          relationshipMembershipId: membershipId,
          ownerUserId: primaryId,
          recipientUserId: primaryId,
        },
      });
    });

    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test("denies legacy relationship source rows without a membership generation", async () => {
    const t = convexTest(schema, modules);
    const { coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const { membershipId, messageId } = await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      if (!membership) throw new Error("Expected an active partner membership");
      const messageId = await ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "legacy message row",
        createdAt: Date.now(),
      });
      return { membershipId: membership._id, messageId };
    });
    const eventId = await insertTypedEvent(
      t,
      {
        eventType: "partner_message.v1",
        sourceId: messageId,
        coupleId,
        relationshipMembershipId: membershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
      },
      `relationship-membership:${membershipId}`,
    );

    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test("binds assisted events to the exact confirmed period authority", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const periodId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-10-01",
        source: "partner_assist",
        confirmationStatus: "confirmed",
        startCertainty: "exact",
        authorityVersion: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const eventId = await insertTypedEvent(
      t,
      {
        eventType: "assisted_period_start.v1",
        sourceId: periodId,
        authorityVersion: 3,
        primaryId,
      },
      "period-authority:3",
    );

    await expect(readEvent(t, eventId)).resolves.toBe(true);
    await t.run((ctx) => ctx.db.patch(periodId, { authorityVersion: 4 }));
    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test("binds pain reminders to an active request, exact log, and selected day", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const selectedLocalDay = new Date().toISOString().slice(0, 10);
    const { requestId, painLogId } = await t.run(async (ctx) => {
      const painLogId = await ctx.db.insert("painLogs", {
        userId: primaryId,
        date: selectedLocalDay,
        painScore: 3,
        tags: ["cramps"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const requestId = await ctx.db.insert("painReminderRequests", {
        ownerUserId: primaryId,
        painLogId,
        selectedLocalDay,
        requestVersion: 1,
        state: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { requestId, painLogId };
    });
    const eventId = await insertTypedEvent(
      t,
      {
        eventType: "pain_check_in.v1",
        requestId,
        painLogId,
        requestVersion: 1,
        primaryId,
        selectedLocalDay,
      },
      "pain-reminder-request:v1",
    );

    await expect(readEvent(t, eventId)).resolves.toBe(true);
    await t.run((ctx) => ctx.db.patch(painLogId, { date: "1900-01-01" }));
    await expect(readEvent(t, eventId)).resolves.toBe(false);
    await t.run((ctx) => ctx.db.patch(painLogId, { date: selectedLocalDay }));
    await expect(readEvent(t, eventId)).resolves.toBe(true);
    await t.run(async (ctx) => {
      const event = await ctx.db.get(eventId);
      if (!event?.sourceIdentity || event.sourceIdentity.eventType !== "pain_check_in.v1") {
        throw new Error("Expected the typed pain reminder identity");
      }
      await ctx.db.patch(requestId, { selectedLocalDay: "2026-02-30" });
      await ctx.db.patch(painLogId, { date: "2026-02-30" });
      await ctx.db.patch(eventId, {
        sourceIdentity: { ...event.sourceIdentity, selectedLocalDay: "2026-02-30" },
      });
    });
    await expect(readEvent(t, eventId)).resolves.toBe(false);
    await t.run(async (ctx) => {
      const event = await ctx.db.get(eventId);
      if (!event?.sourceIdentity || event.sourceIdentity.eventType !== "pain_check_in.v1") {
        throw new Error("Expected the typed pain reminder identity");
      }
      await ctx.db.patch(requestId, { selectedLocalDay });
      await ctx.db.patch(painLogId, { date: selectedLocalDay });
      await ctx.db.patch(eventId, {
        sourceIdentity: { ...event.sourceIdentity, selectedLocalDay },
      });
    });
    await expect(readEvent(t, eventId)).resolves.toBe(true);
    await t.run((ctx) => ctx.db.patch(requestId, { state: "cancelled" }));
    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test("checks link, nudge, chat-clear, and setting sources against active generation", async () => {
    const t = convexTest(schema, modules);
    const { coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    const now = Date.now();
    const { partnerMembershipId, nudgeId } = await t.run(async (ctx) => {
      const partnerMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      if (!partnerMembership) throw new Error("Expected an active partner membership");
      const nudgeId = await ctx.db.insert("nudges", {
        coupleId,
        relationshipMembershipId: partnerMembership._id,
        senderId: primaryId,
        receiverId: partnerId,
        emoji: "💜",
        message: "private source message",
        createdAt: now,
      });
      await ctx.db.patch(coupleId, {
        chatClearedAt: now,
        chatClearedBy: primaryId,
        connectedSinceUpdatedAt: now + 1,
        connectedSinceUpdatedBy: primaryId,
      });
      return { partnerMembershipId: partnerMembership._id, nudgeId };
    });
    const linkedEventId = await insertTypedEvent(
      t,
      {
        eventType: "partner_linked.v1",
        sourceId: partnerMembershipId,
        coupleId,
        relationshipMembershipId: partnerMembershipId,
        ownerUserId: partnerId,
        recipientUserId: primaryId,
      },
      `relationship-membership:${partnerMembershipId}`,
    );
    const nudgeEventId = await insertTypedEvent(
      t,
      {
        eventType: "partner_nudge.v1",
        sourceId: nudgeId,
        coupleId,
        relationshipMembershipId: partnerMembershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
      },
      `relationship-membership:${partnerMembershipId}`,
    );
    const clearedEventId = await insertTypedEvent(
      t,
      {
        eventType: "partner_chat_cleared.v1",
        sourceId: coupleId,
        coupleId,
        relationshipMembershipId: partnerMembershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        clearOperationVersion: now,
      },
      `chat-clear:${now}`,
    );
    const settingEventId = await insertTypedEvent(
      t,
      {
        eventType: "connected_since_updated.v1",
        sourceId: coupleId,
        coupleId,
        relationshipMembershipId: partnerMembershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        settingVersion: now + 1,
      },
      `connected-since-setting:${now + 1}`,
    );

    for (const eventId of [linkedEventId, nudgeEventId, clearedEventId, settingEventId]) {
      await expect(readEvent(t, eventId)).resolves.toBe(true);
    }
  });

  test("requires a current served V2 snapshot and unchanged purpose fence", async () => {
    const t = convexTest(schema, modules);
    const { primaryId, periodEventId, current, dueLocalDay } = await seedCurrentPredictionWindow(t);
    const eventId = await insertTypedEvent(
      t,
      {
        eventType: "period_window_approaching.v1",
        primaryId,
        latestEligibleStartEventId: periodEventId,
        sourceAuthorityVersion: current.sourceAuthorityVersion,
        reminderWindowVersion: 2,
        dueLocalDay,
      },
      current.sourceAuthorityVersion,
    );

    await expect(readEvent(t, eventId)).resolves.toBe(true);
    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "period_window_approaching"),
        )
        .unique();
      if (!preference) throw new Error("Expected the current purpose preference");
      await ctx.db.patch(preference._id, { reminderWindowVersion: 3 });
    });
    await expect(readEvent(t, eventId)).resolves.toBe(false);
    await t.run(async (ctx) => {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_purpose", (q) =>
          q.eq("userId", primaryId).eq("purpose", "period_window_approaching"),
        )
        .unique();
      const period = await ctx.db.get(periodEventId);
      if (!preference || !period) throw new Error("Expected current source fixtures");
      await ctx.db.patch(preference._id, { reminderWindowVersion: 2 });
      await ctx.db.patch(periodEventId, { updatedAt: Date.now() + 1_000 });
    });
    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });

  test.each([-1, 1])(
    "denies prediction reminders on a day %s from the V2 point-date window",
    async (offset) => {
      const t = convexTest(schema, modules);
      const { primaryId, periodEventId, current } = await seedCurrentPredictionWindow(t);
      if (current.state.status !== "estimated" || current.state.bounds.version !== 2) {
        throw new Error("Expected current V2 point-date bounds");
      }
      const designatedDay = addCalendarDays(current.state.bounds.pointDate, -3);
      const requestedDay = addCalendarDays(designatedDay, offset);
      vi.setSystemTime(Date.parse(`${requestedDay}T12:00:00.000Z`));
      const eventId = await insertTypedEvent(
        t,
        {
          eventType: "period_window_approaching.v1",
          primaryId,
          latestEligibleStartEventId: periodEventId,
          sourceAuthorityVersion: current.sourceAuthorityVersion,
          reminderWindowVersion: 2,
          dueLocalDay: requestedDay,
        },
        current.sourceAuthorityVersion,
      );

      await expect(readEvent(t, eventId)).resolves.toBe(false);
    },
  );

  test("keeps D-011 Late events out of current reads", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    const periodId = await t.run((ctx) =>
      ctx.db.insert("periodEvents", {
        userId: primaryId,
        startDate: "2026-10-01",
        startCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const sourceAuthorityVersion = makeSourceAuthorityVersion({
      sourceRevision: 1,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v3",
      calibrationMethodVersion: "calibrate-v2",
    });
    const eventId = await insertTypedEvent(
      t,
      {
        eventType: "late_status.v1",
        primaryId,
        latestEligibleStartEventId: periodId,
        sourceAuthorityVersion,
        reminderWindowVersion: 1,
        localDay: "2026-10-09",
      },
      sourceAuthorityVersion,
    );

    await expect(readEvent(t, eventId)).resolves.toBe(false);
  });
});
