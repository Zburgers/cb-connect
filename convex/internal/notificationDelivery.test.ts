import { convexTest } from "convex-test";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeEventIdempotencyKey,
  transitionDeliveryState,
  transitionDeliveryStateFenced,
  transitionProviderReceiptFactual,
  type ProjectInAppArgs,
} from "../_helpers/notificationDelivery";
import { renderFrozen } from "../_helpers/notificationTemplates";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

type ProjectArgs = ProjectInAppArgs;
type ProjectResult = {
  status: "projected" | "replayed" | "denied" | "stale" | "disabled" | "expired";
  eventId: Id<"notificationEvents">;
  deliveryId: Id<"notificationDeliveries"> | null;
  inboxItemId: Id<"notificationInboxItems"> | null;
};
const projectInAppReference = makeFunctionReference<"mutation", ProjectArgs, ProjectResult>(
  "internal/notificationDelivery:projectInApp",
) as unknown as FunctionReference<"mutation", "internal", ProjectArgs, ProjectResult>;

afterEach(() => vi.unstubAllEnvs());

function enableProjection() {
  vi.stubEnv("CB_CONNECT_NOTIFICATION_OUTBOX_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_PROJECTION_V1", "true");
  vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "true");
  // Projection must not depend on whether the inbox read surface is enabled.
  vi.stubEnv("CB_CONNECT_NOTIFICATION_INBOX_V1", "false");
}

async function seedMessageDelivery(templateVersion = "g4-static-v1") {
  enableProjection();
  const t = convexTest(schema, modules);
  const { asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
  await asPartner.mutation(api.mutations.notifications.setMyPreference, {
    purpose: "partner_message",
    inAppEnabled: true,
  } as never);

  const now = Date.now();
  const { messageId, relationshipMembershipId } = await t.run(async (ctx) => {
    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role_and_revoked_at", (q) =>
        q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
      )
      .unique();
    if (!partnerMembership) throw new Error("Expected the active relationship generation");
    const messageId = await ctx.db.insert("coupleMessages", {
      coupleId,
      relationshipMembershipId: partnerMembership._id,
      senderId: primaryId,
      body: "This private source text must never enter notification storage",
      createdAt: now,
    });
    return { messageId, relationshipMembershipId: partnerMembership._id };
  });

  const envelope = {
    eventType: "partner_message.v1" as const,
    eventVersion: 1 as const,
    purpose: "partner_message" as const,
    producerKind: "new_couple_message" as const,
    sourceReference: `message:${messageId}`,
    sourceAuthorityVersion: `relationship-membership:${relationshipMembershipId}`,
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
    sourceIdentity: {
      eventType: "partner_message.v1" as const,
      sourceId: messageId,
      coupleId,
      relationshipMembershipId,
      ownerUserId: primaryId,
      recipientUserId: partnerId,
    },
  };
  const rendered = await renderFrozen({
    eventType: envelope.eventType,
    templateVersion,
    locale: "en",
    variableSchemaVersion: templateVersion === "g4-static-v1"
      ? "g4-no-variables-v1"
      : "g4-no-variables-v2",
  });
  const ready = await t.mutation(internal.mutations.notifications.ensureInAppRecords, {
    envelope,
    route: rendered.payload.route,
    templateVersion,
    renderIdentity: rendered.identity,
    createdAt: now,
    notBefore: now,
  });
  if (!ready.eventId || !ready.deliveryId) {
    throw new Error("Expected an event and a pending in-app delivery");
  }
  return { t, coupleId, primaryId, partnerId, messageId, ready, envelope, now };
}

describe("N2d transactional in-app delivery", () => {
  test("does not mutate a scheduled delivery when its semantic fences are missing", async () => {
    const { t, ready } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      const event = await ctx.db.get(ready.eventId!);
      if (!event) throw new Error("Expected scheduled source event");
      await ctx.db.patch(event._id, { eventType: "period_window_approaching.v1" });
    });
    const before = await t.run((ctx) => ctx.db.get(ready.deliveryId!));

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.get(ready.deliveryId!)).toEqual(before);
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
    });
  });

  test("duplicate wakeups and replays persist one attempt and one recipient inbox item", async () => {
    const { t, partnerId, ready, messageId, coupleId } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      const message = await ctx.db.get(messageId);
      const event = await ctx.db.get(ready.eventId!);
      const couple = await ctx.db.get(coupleId);
      const ownerMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary").eq("revokedAt", undefined),
        )
        .unique();
      const partnerMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      expect(message?.relationshipMembershipId).toBe(partnerMembership?._id);
      expect(event?.sourceReference).toBe(`message:${messageId}`);
      expect(message?.senderId).toBe(event?.ownerUserId);
      expect(message?.clearedAt).toBeUndefined();
      expect(couple?.chatClearedAt).toBeUndefined();
      expect(couple?.status).toBe("active");
      expect(ownerMembership?.coupleId).toBe(coupleId);
    });
    const args = { eventId: ready.eventId!, expectedGeneration: 0 };

    const results = await Promise.all([
      t.mutation(projectInAppReference, args),
      t.mutation(projectInAppReference, args),
    ]);
    await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 1,
    });

    await t.run(async (ctx) => {
      const deliveries = await ctx.db.query("notificationDeliveries").collect();
      const attempts = await ctx.db.query("notificationDeliveryAttempts").collect();
      const items = await ctx.db.query("notificationInboxItems").collect();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({
        state: "delivered",
        eligibility: "eligible",
        providerOutcome: "none",
        attemptCount: 1,
        claimGeneration: 1,
      });
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        deliveryId: ready.deliveryId,
        attemptOrdinal: 1,
        claimGeneration: 1,
        result: { kind: "in_app_persisted" },
      });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        recipientUserId: partnerId,
        templateVersion: "g4-static-v1",
        route: "messages",
        state: "current",
      });
      expect(JSON.stringify({ deliveries, attempts, items })).not.toContain(
        "This private source text",
      );
    });
    expect(results.filter((result) => result.status === "projected")).toHaveLength(1);
  });

  test("keeps the delivery's original render identity after a template version change", async () => {
    const { t, ready, envelope, now } = await seedMessageDelivery("g4-static-v1");
    const changedTemplate = await renderFrozen({
      eventType: envelope.eventType,
      templateVersion: "g4-static-v2",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v2",
    });
    expect(changedTemplate.identity.templateVersion).toBe("g4-static-v2");
    const updated = await t.mutation(internal.mutations.notifications.ensureInAppRecords, {
      envelope,
      route: changedTemplate.payload.route,
      templateVersion: "g4-static-v2",
      renderIdentity: changedTemplate.identity,
      createdAt: now + 1,
      notBefore: now,
    });
    expect(updated.deliveryId).toBe(ready.deliveryId);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.get(ready.deliveryId!)).toMatchObject({
        renderIdentity: {
          templateVersion: "g4-static-v1",
          variableSchemaVersion: "g4-no-variables-v1",
        },
      });
    });

    await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    await t.run(async (ctx) => {
      const delivery = await ctx.db.get(ready.deliveryId!);
      const item = await ctx.db.query("notificationInboxItems").first();
      expect(delivery?.renderIdentity).toMatchObject({
        templateVersion: "g4-static-v1",
        variableSchemaVersion: "g4-no-variables-v1",
      });
      expect(item?.templateVersion).toBe("g4-static-v1");
    });
  });

  test("does not project a persisted message after the current chat clear", async () => {
    const { t, coupleId, ready, messageId, now } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      const couple = await ctx.db.get(coupleId);
      if (!couple) throw new Error("Expected current source authority");
      await ctx.db.patch(couple._id, { chatClearedAt: now + 1 });
      expect(await ctx.db.get(messageId)).toMatchObject({
        _id: messageId,
        body: "This private source text must never enter notification storage",
      });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { state: "cancelled", eligibility: "cancelled" },
      ]);
    });
  });

  test("does not project a message after recipient membership revocation", async () => {
    const { t, coupleId, ready, messageId } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      const recipientMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      if (!recipientMembership) throw new Error("Expected current source authority");
      await ctx.db.patch(recipientMembership._id, { revokedAt: Date.now() + 1 });
      const message = await ctx.db.get(messageId);
      expect(message?._id).toBe(messageId);
      expect(message?.clearedAt).toBeUndefined();
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { state: "cancelled", eligibility: "cancelled" },
      ]);
    });
  });

  test("rejects an event whose persisted envelope no longer matches the frozen catalog", async () => {
    const { t, ready } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      await ctx.db.patch(ready.eventId!, { producerKind: "new_nudge" });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.get(ready.deliveryId!)).toMatchObject({
        state: "suppressed",
        eligibility: "suppressed",
      });
    });
  });

  test("does not create a second inbox row for the same event and recipient", async () => {
    const { t, ready, partnerId, now } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationInboxItems", {
        eventId: ready.eventId!,
        recipientUserId: partnerId,
        idempotencyKey: "inbox:v1:unexpected-existing-key",
        templateVersion: "g4-static-v1",
        route: "messages",
        state: "current",
        createdAt: now,
      });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toMatchObject([
        {
          eventId: ready.eventId,
          recipientUserId: partnerId,
          idempotencyKey: "inbox:v1:unexpected-existing-key",
        },
      ]);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { state: "suppressed", eligibility: "suppressed" },
      ]);
    });
  });

  test("does not project a chat-clear event after a newer clear transition", async () => {
    enableProjection();
    const t = convexTest(schema, modules);
    const { asPartner, coupleId, primaryId, partnerId } = await seedActiveCouple(t);
    await asPartner.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "partner_chat_cleared",
      inAppEnabled: true,
    } as never);
    const now = Date.now();
    const relationshipMembershipId = await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role_and_revoked_at", (q) =>
          q.eq("coupleId", coupleId).eq("role", "partner").eq("revokedAt", undefined),
        )
        .unique();
      if (!membership) throw new Error("Expected the active relationship generation");
      return membership._id;
    });
    const event = {
      eventType: "partner_chat_cleared.v1" as const,
      eventVersion: 1 as const,
      purpose: "partner_chat_cleared" as const,
      producerKind: "explicit_chat_clear_transition" as const,
      sourceReference: `couple-chat:${coupleId}`,
      sourceAuthorityVersion: `chat-clear:${now}`,
      ownerUserId: primaryId,
      recipientUserId: partnerId,
      recipientScope: "other_active_member" as const,
      privacyClass: "account_relationship_sensitive" as const,
      validityRule: "until_newer_chat_state_or_link_revocation" as const,
      idempotencyKey: makeEventIdempotencyKey("partner_chat_cleared.v1", {
        coupleId: String(coupleId),
        clearOperationId: `chat-clear:${now}`,
        relationshipMembershipId: String(relationshipMembershipId),
        recipientId: String(partnerId),
      }),
      allowedChannel: "in_app" as const,
      sourceIdentity: {
        eventType: "partner_chat_cleared.v1" as const,
        sourceId: coupleId,
        coupleId,
        relationshipMembershipId,
        ownerUserId: primaryId,
        recipientUserId: partnerId,
        clearOperationVersion: now,
      },
    };
    await t.run(async (ctx) => {
      await ctx.db.patch(coupleId, { chatClearedAt: now + 1 });
    });
    const rendered = await renderFrozen({
      eventType: event.eventType,
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-no-variables-v1",
    });
    const ready = await t.mutation(internal.mutations.notifications.ensureInAppRecords, {
      envelope: event,
      route: rendered.payload.route,
      templateVersion: "g4-static-v1",
      renderIdentity: rendered.identity,
      createdAt: now,
      notBefore: now,
    });
    if (!ready.eventId) throw new Error("Expected the persisted chat-clear event");

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test.each([
    { scope: "global" as const, key: "delivery" },
    { scope: "channel" as const, key: "in_app" },
    { scope: "purpose" as const, key: "partner_message" },
  ])("honors the $scope/$key deny control in the projection transaction", async ({ scope, key }) => {
    const { t, ready, now } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationControls", {
        scope,
        key,
        version: 1,
        operatorReference: "synthetic-test-deny",
        updatedAt: now,
      });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("denied");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { state: "suppressed", eligibility: "suppressed" },
      ]);
    });
  });

  test("global delivery-off pauses execution without changing inbox reads or pending work", async () => {
    const { t, ready } = await seedMessageDelivery();
    vi.stubEnv("CB_CONNECT_NOTIFICATION_DELIVERY_V1", "false");

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 0,
    });

    expect(result.status).toBe("disabled");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationDeliveries").collect()).toMatchObject([
        { state: "pending", eligibility: "eligible" },
      ]);
    });
  });

  test("does not trust caller-supplied attempt numbers or accept a stale generation", async () => {
    const { t, ready } = await seedMessageDelivery();
    const stale = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: 99,
    });
    expect(stale.status).toBe("stale");

    await expect(
      t.mutation(projectInAppReference, {
        eventId: ready.eventId!,
        expectedGeneration: 0,
        attemptOrdinal: 5,
        claimGeneration: 5,
      } as never),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("notificationDeliveryAttempts").collect()).toHaveLength(0);
      expect(await ctx.db.query("notificationInboxItems").collect()).toHaveLength(0);
    });
  });

  test("cannot terminalize an exhausted generation or leave MAX_SAFE_INTEGER current", async () => {
    const { t, ready } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      await ctx.db.patch(ready.deliveryId!, {
        claimGeneration: Number.MAX_SAFE_INTEGER,
        expiresAt: Date.now(),
      });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: Number.MAX_SAFE_INTEGER,
    });

    expect(result.status).toBe("stale");
    await t.run(async (ctx) => {
      expect(await ctx.db.get(ready.deliveryId!)).toMatchObject({
        state: "pending",
        eligibility: "eligible",
        claimGeneration: Number.MAX_SAFE_INTEGER,
      });
    });
  });

  test("attempt exhaustion at MAX_SAFE_INTEGER is a no-op, while late receipts remain factual", async () => {
    const { t, ready } = await seedMessageDelivery();
    await t.run(async (ctx) => {
      await ctx.db.patch(ready.deliveryId!, {
        claimGeneration: Number.MAX_SAFE_INTEGER,
        attemptCount: 4,
      });
    });

    const result = await t.mutation(projectInAppReference, {
      eventId: ready.eventId!,
      expectedGeneration: Number.MAX_SAFE_INTEGER,
    });

    expect(result.status).toBe("stale");
    await t.run(async (ctx) => {
      expect(await ctx.db.get(ready.deliveryId!)).toMatchObject({
        state: "pending",
        eligibility: "eligible",
        claimGeneration: Number.MAX_SAFE_INTEGER,
      });
    });

    const cancelled = transitionDeliveryState(
      {
        channel: "push",
        status: "processing",
        eligibility: "eligible",
        providerOutcome: "none",
      },
      { kind: "cancelled" },
    ).state;
    expect(
      transitionDeliveryStateFenced(cancelled, {
        expectedGeneration: Number.MAX_SAFE_INTEGER,
        currentGeneration: Number.MAX_SAFE_INTEGER,
        fact: { kind: "unknown", errorCode: "timeout" },
      }).applied,
    ).toBe(false);
    expect(
      transitionProviderReceiptFactual(cancelled, {
        kind: "provider_receipt",
        outcome: "delivered",
        providerMessageId: "synthetic-late-fact",
      }).state,
    ).toMatchObject({
      status: "cancelled",
      eligibility: "cancelled",
      providerOutcome: "delivered",
    });
  });
});
