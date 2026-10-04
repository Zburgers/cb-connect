import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import { makeEventIdempotencyKey } from "../_helpers/notificationDelivery";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

afterEach(() => vi.unstubAllEnvs());

function enableInAppInbox() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
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
    const messageId = await t.run((ctx) =>
      ctx.db.insert("coupleMessages", {
        coupleId,
        senderId: primaryId,
        body: "body is not notification data",
        createdAt: 100,
      }),
    );
    const projected = await t.mutation(
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
      renderIdentity: {
        templateVersion: "g4-static-v1",
        locale: "en",
        variableSchemaVersion: "g4-v1",
        payloadHash: "test-static-message-v1",
      },
      createdAt: 100,
      notBefore: 100,
      },
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
});
