import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { makeDeliveryIdempotencyKey } from "./notificationDelivery";
import {
  cancelSource,
  ensureAssistedPeriodEvent,
} from "./notificationOutbox";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

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
