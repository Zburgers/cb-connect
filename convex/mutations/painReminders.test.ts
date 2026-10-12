import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import {
  addCalendarDays,
} from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

type SetPainReminderArgs = {
  painLogId: Id<"painLogs">;
  selectedLocalDay: string;
};
type SetPainReminderResult = "saved";

const setMyPainReminder = makeFunctionReference<
  "mutation",
  SetPainReminderArgs,
  SetPainReminderResult
>("mutations/painReminders:setMyPainReminder");
const cancelMyPainReminder = makeFunctionReference<
  "mutation",
  { painLogId: Id<"painLogs"> },
  null
>("mutations/painReminders:cancelMyPainReminder");
const revokeMyPainReminder = makeFunctionReference<
  "mutation",
  { painLogId: Id<"painLogs"> },
  null
>("mutations/painReminders:revokeMyPainReminder");

const OUTBOX_FLAG = "CB_CONNECT_NOTIFICATION_OUTBOX_V1";
type TestBackend = ReturnType<typeof import("convex-test")["convexTest"]>;

afterEach(() => vi.unstubAllEnvs());

function enableOutbox() {
  vi.stubEnv(OUTBOX_FLAG, "true");
}

function todayUtc() {
  return toCalendarDateInTimeZone(new Date(), "UTC");
}

async function seedPainLog(
  t: TestBackend,
  ownerUserId: Id<"users">,
  date = todayUtc(),
) {
  return await t.run((ctx) =>
    ctx.db.insert("painLogs", {
      userId: ownerUserId,
      date,
      painScore: 9,
      tags: ["cramps", "headache"],
      note: "private-pain-note-do-not-copy-73d1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

async function latestRequest(ctx: QueryCtx, painLogId: Id<"painLogs">) {
  return await ctx.db
    .query("painReminderRequests")
    .withIndex("by_pain_log_and_version", (q) => q.eq("painLogId", painLogId))
    .order("desc")
    .first();
}

async function eventForRequest(
  ctx: QueryCtx,
  requestId: Id<"painReminderRequests">,
) {
  return await ctx.db
    .query("notificationEvents")
    .withIndex("by_source_reference_and_authority", (q) =>
      q.eq("sourceReference", String(requestId)),
    )
    .order("desc")
    .first();
}

describe("user-requested pain reminders", () => {
  test("creates one opaque primary-only event for an owned pain log and retries idempotently", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId, coupleId } = await seedActiveCouple(t);
    const painLogDate = addCalendarDays(todayUtc(), -2);
    const painLogId = await seedPainLog(t, primaryId, painLogDate);
    const selectedLocalDay = addCalendarDays(todayUtc(), 2);

    await t.run(async (ctx) => {
      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary").eq("revokedAt", undefined),
        )
        .unique();
      if (!primaryMembership) throw new Error("Expected the primary membership");
      await ctx.db.patch(primaryMembership._id, { sharingPain: true });
    });

    const first = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay,
    });
    const retry = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay,
    });

    expect(first).toEqual("saved");
    expect(retry).toEqual("saved");
    await t.run(async (ctx) => {
      const request = await ctx.db
        .query("painReminderRequests")
        .withIndex("by_pain_log_and_version", (q) => q.eq("painLogId", painLogId))
        .order("desc")
        .first();
      if (!request) throw new Error("Expected the pain reminder request");
      const event = await ctx.db
        .query("notificationEvents")
        .withIndex("by_source_reference_and_authority", (q) =>
          q.eq("sourceReference", String(request._id)),
        )
        .first();
      if (!event) throw new Error("Expected the pain reminder event");
      expect(request).toMatchObject({
        ownerUserId: primaryId,
        painLogId,
        selectedLocalDay,
        requestVersion: 1,
        state: "active",
      });
      expect(event).toMatchObject({
        eventType: "pain_check_in.v1",
        eventVersion: 1,
        purpose: "pain_check_in",
        producerKind: "explicit_primary_request",
        sourceReference: String(request._id),
        sourceAuthorityVersion: "pain-reminder-request:v1",
        sourceIdentity: {
          eventType: "pain_check_in.v1",
          requestId: request._id,
          painLogId,
          requestVersion: 1,
          primaryId,
          selectedLocalDay,
        },
        ownerUserId: primaryId,
        recipientUserId: primaryId,
        recipientScope: "primary",
        privacyClass: "primary_private_health",
        validityRule: "selected_local_day_while_request_is_active",
        idempotencyKey: makeEventIdempotencyKey("pain_check_in.v1", {
          requestId: String(request._id),
          requestVersion: "1",
          primaryId: String(primaryId),
        }),
        allowedChannel: "in_app",
      });
      const eventText = JSON.stringify(event);
      expect(eventText).not.toContain(painLogDate);
      expect(eventText).not.toContain("private-pain-note-do-not-copy-73d1");
      expect(event).not.toHaveProperty("painLogId");
      expect(event).not.toHaveProperty("painScore");
      expect(event).not.toHaveProperty("tags");
      expect(event).not.toHaveProperty("note");
      expect(event).not.toHaveProperty("selectedLocalDay");
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(1);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDueWork").collect()).toHaveLength(0);
    });
  });

  test("rejects a replay whose persisted pain source identity changed", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const painLogId = await seedPainLog(t, primaryId);
    const selectedLocalDay = addCalendarDays(todayUtc(), 2);
    await asPrimary.mutation(setMyPainReminder, { painLogId, selectedLocalDay });
    const request = await t.run((ctx) => latestRequest(ctx, painLogId));
    if (!request) throw new Error("Expected the pain reminder request");
    const event = await t.run((ctx) => eventForRequest(ctx, request._id));
    if (!event) throw new Error("Expected the pain reminder event");
    await t.run((ctx) =>
      ctx.db.patch(event._id, {
        sourceIdentity: {
          eventType: "pain_check_in.v1",
          requestId: request._id,
          painLogId,
          requestVersion: request.requestVersion,
          primaryId,
          selectedLocalDay: addCalendarDays(selectedLocalDay, 1),
        },
      }),
    );

    await expect(
      asPrimary.mutation(setMyPainReminder, { painLogId, selectedLocalDay }),
    ).rejects.toThrow("Pain reminder event key conflicts with its source authority");
  });

  test("rejects partners, non-owned logs, malformed days, and past selected days", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, asPartner, primaryId, partnerId, coupleId } = await seedActiveCouple(t);
    const primaryPainLogId = await seedPainLog(t, primaryId);
    const partnerPainLogId = await seedPainLog(t, partnerId);
    const selectedLocalDay = addCalendarDays(todayUtc(), 1);
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary").eq("revokedAt", undefined),
        )
        .unique();
      if (!membership) throw new Error("Expected the primary membership");
      await ctx.db.patch(membership._id, { sharingPain: true });
    });

    await expect(
      asPartner.mutation(setMyPainReminder, {
        painLogId: primaryPainLogId,
        selectedLocalDay,
      }),
    ).rejects.toThrow("Only primary users can request pain reminders");
    await expect(
      asPrimary.mutation(setMyPainReminder, {
        painLogId: partnerPainLogId,
        selectedLocalDay,
      }),
    ).rejects.toThrow("Pain log not found");
    await expect(
      asPrimary.mutation(setMyPainReminder, {
        painLogId: primaryPainLogId,
        selectedLocalDay: "2026-99-99",
      }),
    ).rejects.toThrow("Selected local day must be a valid date");
    await expect(
      asPrimary.mutation(setMyPainReminder, {
        painLogId: primaryPainLogId,
        selectedLocalDay: addCalendarDays(todayUtc(), -1),
      }),
    ).rejects.toThrow("Selected local day cannot be in the past");

    await t.run(async (ctx) => {
      expect(await ctx.db.query("painReminderRequests").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
    });
  });

  test("edits advance the request key and cancel existing source work without deletion", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const painLogId = await seedPainLog(t, primaryId);
    const firstDay = addCalendarDays(todayUtc(), 2);
    const firstResult = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay: firstDay,
    });
    expect(firstResult).toBe("saved");
    const firstRequest = await t.run((ctx) => latestRequest(ctx, painLogId));
    if (!firstRequest) throw new Error("Expected the first pain reminder request");
    const firstEvent = await t.run((ctx) => eventForRequest(ctx, firstRequest._id));
    if (!firstEvent) throw new Error("Expected the first pain reminder event");
    const oldProjection = await t.run(async (ctx) => {
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        eventId: firstEvent._id,
        recipientUserId: primaryId,
        channel: "in_app",
        stableDestinationId: String(primaryId),
        logicalKey: `delivery:v1:${JSON.stringify([String(firstEvent._id), "in_app", String(primaryId)])}`,
        notBefore: Date.now(),
        state: "pending",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 0,
        claimGeneration: 1,
        renderIdentity: {
          templateVersion: "g4-static-v1",
          locale: "en",
          variableSchemaVersion: "g4-v1",
          payloadHash: "safe-static-pain-check-in-v1",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const inboxItemId = await ctx.db.insert("notificationInboxItems", {
        eventId: firstEvent._id,
        recipientUserId: primaryId,
        idempotencyKey: `inbox:v1:${JSON.stringify([String(firstEvent._id), String(primaryId)])}`,
        templateVersion: "g4-static-v1",
        route: "pain",
        state: "current",
        createdAt: Date.now(),
      });
      const dueWorkId = await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "delivery",
        state: "pending",
        dueAt: Date.now(),
        generation: 1,
        deliveryId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { deliveryId, inboxItemId, dueWorkId };
    });

    const secondDay = addCalendarDays(firstDay, 1);
    const editedResult = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay: secondDay,
    });

    expect(editedResult).toBe("saved");
    await t.run(async (ctx) => {
      const request = await ctx.db.get(firstRequest._id);
      const events = await ctx.db.query("notificationEvents").collect();
      const delivery = await ctx.db.get(oldProjection.deliveryId);
      const inboxItem = await ctx.db.get(oldProjection.inboxItemId);
      const dueWork = await ctx.db.get(oldProjection.dueWorkId);
      expect(request).toMatchObject({
        selectedLocalDay: secondDay,
        requestVersion: 2,
        state: "active",
      });
      expect(events.map((event) => event.idempotencyKey)).toContain(
        makeEventIdempotencyKey("pain_check_in.v1", {
          requestId: String(firstRequest._id),
          requestVersion: "1",
          primaryId: String(primaryId),
        }),
      );
      expect(
        events.find(
          (event) =>
            event.idempotencyKey ===
            makeEventIdempotencyKey("pain_check_in.v1", {
              requestId: String(firstRequest._id),
              requestVersion: "2",
              primaryId: String(primaryId),
            }),
        )?.sourceIdentity,
      ).toEqual({
        eventType: "pain_check_in.v1",
        requestId: firstRequest._id,
        painLogId,
        requestVersion: 2,
        primaryId,
        selectedLocalDay: secondDay,
      });
      expect(events.map((event) => event.idempotencyKey)).toContain(
        makeEventIdempotencyKey("pain_check_in.v1", {
          requestId: String(firstRequest._id),
          requestVersion: "2",
          primaryId: String(primaryId),
        }),
      );
      expect(delivery).toMatchObject({
        state: "cancelled",
        eligibility: "cancelled",
        cancellationReason: "source_changed",
      });
      expect(inboxItem).toMatchObject({ state: "hidden" });
      expect(dueWork).toMatchObject({ state: "cancelled", generation: 2 });
      expect(await ctx.db.query("painReminderRequests").collect()).toHaveLength(1);
    });
  });

  test("cancel and revoke invalidate existing rows, retain history, and allow a fresh request", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const painLogId = await seedPainLog(t, primaryId);
    const selectedLocalDay = addCalendarDays(todayUtc(), 2);
    const firstResult = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay,
    });
    expect(firstResult).toBe("saved");
    const firstRequest = await t.run((ctx) => latestRequest(ctx, painLogId));
    if (!firstRequest) throw new Error("Expected the first pain reminder request");
    const firstEvent = await t.run((ctx) => eventForRequest(ctx, firstRequest._id));
    if (!firstEvent) throw new Error("Expected the first pain reminder event");

    const oldProjection = await t.run(async (ctx) => {
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        eventId: firstEvent._id,
        recipientUserId: primaryId,
        channel: "in_app",
        stableDestinationId: String(primaryId),
        logicalKey: `delivery:v1:${JSON.stringify([String(firstEvent._id), "in_app", String(primaryId)])}`,
        notBefore: Date.now(),
        state: "pending",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 0,
        claimGeneration: 1,
        renderIdentity: {
          templateVersion: "g4-static-v1",
          locale: "en",
          variableSchemaVersion: "g4-v1",
          payloadHash: "safe-static-pain-check-in-v1",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const inboxItemId = await ctx.db.insert("notificationInboxItems", {
        eventId: firstEvent._id,
        recipientUserId: primaryId,
        idempotencyKey: `inbox:v1:${JSON.stringify([String(firstEvent._id), String(primaryId)])}`,
        templateVersion: "g4-static-v1",
        route: "pain",
        state: "current",
        createdAt: Date.now(),
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "delivery",
        state: "pending",
        dueAt: Date.now(),
        generation: 1,
        deliveryId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { deliveryId, inboxItemId };
    });

    await asPrimary.mutation(revokeMyPainReminder, { painLogId });
    await asPrimary.mutation(revokeMyPainReminder, { painLogId });
    expect(await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay,
    })).toBe("saved");
    const nextRequest = await t.run((ctx) => latestRequest(ctx, painLogId));
    if (!nextRequest) throw new Error("Expected the replacement pain reminder request");

    await asPrimary.mutation(cancelMyPainReminder, { painLogId });
    await asPrimary.mutation(cancelMyPainReminder, { painLogId });
    await t.run(async (ctx) => {
      expect(await ctx.db.get(firstRequest._id)).toMatchObject({ state: "cancelled" });
      expect(await ctx.db.get(nextRequest._id)).toMatchObject({ state: "cancelled" });
      expect(await ctx.db.get(oldProjection.deliveryId)).toMatchObject({
        state: "cancelled",
        cancellationReason: "authority_revoked",
      });
      expect(await ctx.db.get(oldProjection.inboxItemId)).toMatchObject({ state: "hidden" });
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(2);
      expect(await ctx.db.query("painReminderRequests").collect()).toHaveLength(2);
    });
  });

  test("keeps request records but creates no event while the outbox flag is absent", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    const painLogId = await seedPainLog(t, primaryId);
    const result = await asPrimary.mutation(setMyPainReminder, {
      painLogId,
      selectedLocalDay: addCalendarDays(todayUtc(), 1),
    });

    expect(result).toBe("saved");
    await t.run(async (ctx) => {
      const request = await ctx.db
        .query("painReminderRequests")
        .withIndex("by_pain_log_and_version", (q) => q.eq("painLogId", painLogId))
        .order("desc")
        .first();
      expect(request).toMatchObject({ state: "active" });
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDueWork").collect()).toHaveLength(0);
    });
  });

  test("high pain scores do not implicitly create requests", async () => {
    enableOutbox();
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);

    await asPrimary.mutation(api.mutations.painLog.createOrUpdatePainLog, {
      date: todayUtc(),
      painScore: 10,
      tags: ["cramps", "back"],
      note: "high score remains outside the request path",
    });

    await t.run(async (ctx) => {
      expect(await ctx.db.query("painReminderRequests").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationLog").collect()).toHaveLength(0);
      expect(await ctx.db.get(primaryId)).not.toBeNull();
    });
  });
});
