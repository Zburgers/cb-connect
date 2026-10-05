import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import { renderFrozen } from "../_helpers/notificationTemplates";
import {
  initializeNotificationSourceAuthority,
  makeSourceAuthorityVersion,
  persistNotificationSourceAuthorityVersion,
} from "../_helpers/notificationSourceAuthority";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

type ProjectArgs = { eventId: Id<"notificationEvents">; expectedGeneration: number };
type ProjectResult = {
  status: "projected" | "replayed" | "denied" | "stale" | "disabled" | "expired";
  eventId: Id<"notificationEvents">;
  deliveryId: Id<"notificationDeliveries"> | null;
  inboxItemId: Id<"notificationInboxItems"> | null;
};
const projectInAppReference = makeFunctionReference<"mutation", ProjectArgs, ProjectResult>(
  "internal/notificationDelivery:projectInApp",
) as unknown as FunctionReference<"mutation", "internal", ProjectArgs, ProjectResult>;

function enableInAppInbox() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_INBOX_V1", "true");
}

describe("notification recipient queries", () => {
  test("missing preferences stay off even when legacy external consent is true", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run((ctx) => ctx.db.patch(primaryId, { externalNotificationConsent: true }));

    const preferences = await asPrimary.query(
      api.queries.notifications.getMyPreferences,
      {},
    );

    expect(preferences.length).toBeGreaterThan(0);
    expect(preferences.every((preference) => preference.inAppEnabled === false)).toBe(true);
    expect(preferences.some((preference) => preference.purpose === "pain_check_in")).toBe(true);
  });

  test("returns only caller inbox rows and rejects a caller-supplied recipient", async () => {
    enableInAppInbox();
    const t = convexTest(schema, modules);
    const { asPartner, asPrimary, coupleId, primaryId, partnerId } =
      await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "partner_message",
      inAppEnabled: true,
    });
    const messageId = await t.run(async (ctx) => {
      const partnerMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      if (!partnerMembership) throw new Error("Expected a current partner membership");
      return await ctx.db.insert("coupleMessages", {
        coupleId,
        relationshipMembershipId: partnerMembership._id,
        senderId: primaryId,
        body: "body is not notification data",
        createdAt: 100,
      });
    });
    const rendered = await renderFrozen({
      eventType: "partner_message.v1",
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v1",
    });
    const prepared = await t.mutation(
      internal.mutations.notifications.ensureInAppRecords,
      {
      envelope: {
        eventType: "partner_message.v1",
        eventVersion: 1,
        purpose: "partner_message",
        producerKind: "new_couple_message",
        sourceReference: `message:${messageId}`,
        sourceAuthorityVersion: "link-generation:1",
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
      },
      route: "messages",
      templateVersion: "g4-static-v1",
      renderIdentity: rendered.identity,
      createdAt: 100,
      notBefore: 100,
      },
    );
    const projected = await t.mutation(
      projectInAppReference,
      { eventId: prepared.eventId!, expectedGeneration: 0 },
    );

    const [partnerInbox, primaryInbox] = await Promise.all([
      asPartner.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ]);

    expect(partnerInbox.page).toHaveLength(1);
    expect(partnerInbox.page[0]).not.toHaveProperty("recipientUserId");
    expect(partnerInbox.page[0]).not.toHaveProperty("idempotencyKey");
    expect(partnerInbox.page[0]).not.toHaveProperty("sourceReference");
    expect(primaryInbox.page).toHaveLength(0);
    await expect(
      asPrimary.mutation(api.mutations.notifications.markMyInboxItemRead, {
        itemId: projected.inboxItemId!,
      }),
    ).rejects.toThrow(/not found/i);
    await asPartner.mutation(api.mutations.notifications.dismissMyInboxItem, {
      itemId: projected.inboxItemId!,
    });
    await expect(
      asPartner.mutation(api.mutations.notifications.dismissMyInboxItem, {
        itemId: projected.inboxItemId!,
      }),
    ).resolves.toBeNull();
    await expect(
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 20, cursor: null },
        userId: partnerId,
      } as never),
    ).rejects.toThrow();
  });

  test("fails closed with an absent inbox flag and rejects pages above the fixed bound", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t);

    await expect(
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow(/disabled/i);

    vi.stubEnv("CB_CONNECT_NOTIFICATION_INBOX_V1", "true");
    await expect(
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 51, cursor: null },
      }),
    ).rejects.toThrow(/bound|maximum|limit/i);
    await expect(
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: {
          numItems: 20,
          cursor: null,
          maximumRowsRead: 1_000_000,
        },
      } as never),
    ).rejects.toThrow();
    await expect(
      asPrimary.query(api.queries.notifications.getMyInbox, {
        paginationOpts: { numItems: 20, cursor: "x".repeat(2_049) },
      }),
    ).rejects.toThrow(/cursor.*bound/i);
  });

  test("bounds and filters internal due-work reads", async () => {
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run((ctx) =>
      ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "source_reconcile",
        state: "pending",
        dueAt: 5,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    await expect(
      t.query(internal.queries.notifications.getDueWork, {
        now: 10,
        limit: 101,
      }),
    ).rejects.toThrow(/bound|maximum|limit/i);
  });

  test("kind-scoped due pages bypass other kinds and continue past stale rows", async () => {
    vi.stubEnv("CB_CONNECT_NOTIFICATION_SCHEDULER_V1", "true");
    const t = convexTest(schema, modules);
    const { primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId: primaryId,
        purpose: "period_window_approaching",
        inAppEnabled: true,
        localReminderTime: "09:00",
        reminderWindowVersion: 4,
        updatedAt: 1,
      });
      await initializeNotificationSourceAuthority(ctx, primaryId, 1);
    });
    const sourceAuthorityVersion = makeSourceAuthorityVersion({
      sourceRevision: 0,
      servedCycleContract: "cycle-read-model-v1",
      servedPredictionContract: "prediction-serving-v2",
      estimatorMethodVersion: "estimate-v3",
      calibrationMethodVersion: "calibrate-v2",
    });
    await t.run((ctx) =>
      persistNotificationSourceAuthorityVersion(ctx, primaryId, sourceAuthorityVersion, 2),
    );
    await t.run(async (ctx) => {
      for (const dueAt of [1, 2]) {
        await ctx.db.insert("notificationDueWork", {
          ownerUserId: primaryId,
          kind: "source_reconcile",
          state: "pending",
          dueAt,
          generation: 1,
          createdAt: 1,
          updatedAt: 1,
        });
      }
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "pending",
        dueAt: 3,
        generation: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("notificationDueWork", {
        ownerUserId: primaryId,
        kind: "prediction_window",
        state: "pending",
        dueAt: 4,
        generation: 1,
        sourceAuthorityVersion,
        reminderWindowVersion: 4,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const genericPrefix = await t.query(internal.queries.notifications.getDueWork, {
      now: 10,
      limit: 1,
    });
    expect(genericPrefix[0]?.kind).toBe("source_reconcile");

    const stalePage = await t.query(internal.queries.notifications.getDueWorkByKind, {
      kind: "prediction_window",
      now: 10,
      limit: 1,
      cursor: null,
    });
    expect(stalePage.page).toEqual([]);
    expect(stalePage.isDone).toBe(false);

    const nextPage = await t.query(internal.queries.notifications.getDueWorkByKind, {
      kind: "prediction_window",
      now: 10,
      limit: 1,
      cursor: stalePage.continueCursor,
    });
    expect(nextPage.page).toHaveLength(1);
    expect(nextPage.page[0]).toMatchObject({
      kind: "prediction_window",
      sourceAuthorityVersion,
      reminderWindowVersion: 4,
      dueAt: 4,
    });
  });

  test("rejects fractional and unsafe due-work query timestamps", async () => {
    const t = convexTest(schema, modules);
    for (const now of [
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(
        t.query(internal.queries.notifications.getDueWork, { now, limit: 10 }),
      ).rejects.toThrow(/time|timestamp|integer|safe/i);
    }
  });
});
