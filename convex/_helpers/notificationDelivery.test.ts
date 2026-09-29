import { describe, expect, test } from "vitest";

import { notificationEventDefinitions } from "./notificationTypes";
import {
  canRebindDestinationVersion,
  createProviderIdempotencyKey,
  isEventChannelAllowed,
  isValidDeliveryState,
  isValidFrozenNotificationPayload,
  isValidFrozenRenderIdentity,
  isValidProviderIdempotencyCapability,
  isValidResolvedDestination,
  makeDeliveryIdempotencyKey,
  makeEventIdempotencyKey,
  notificationAdapterResultValidator,
  frozenNotificationPayloadValidator,
  notificationDispatchAuthorizationValidator,
  notificationDeliveryAttemptRecordValidator,
  notificationDeliveryRecordValidator,
  notificationInboxItemRecordValidator,
  renderFrozenArgsValidator,
  sameFrozenRenderIdentity,
  transitionDeliveryState,
  type DeliveryState,
} from "./notificationDelivery";

const componentSamples: Record<string, string> = {
  type: "unused",
  periodEventId: "periodEvents:1",
  authorityVersion: "4",
  primaryId: "users:1",
  latestEligibleStartEventId: "periodEvents:2",
  sourceAuthorityVersion: "4:served-v2",
  dueLocalDay: "2026-10-04",
  reminderWindowVersion: "2",
  localDay: "2026-10-05",
  requestId: "painReminders:1",
  requestVersion: "3",
  coupleId: "couples:1",
  linkGeneration: "8",
  recipientId: "users:2",
  messageId: "coupleMessages:1",
  nudgeId: "nudges:1",
  receiverId: "users:2",
  clearOperationId: "clear:1",
  settingVersion: "6",
};

const processingExternalDelivery = (): DeliveryState => ({
  channel: "push",
  status: "processing",
  eligibility: "eligible",
  providerOutcome: "none",
});

describe("G4-DELIVERY-V1 keys", () => {
  test("event keys use exactly the catalog components in catalog order", () => {
    for (const type of Object.keys(notificationEventDefinitions) as Array<
      keyof typeof notificationEventDefinitions
    >) {
      const definition = notificationEventDefinitions[type];
      const components = Object.fromEntries(
        definition.idempotencyComponents
          .filter((component) => component !== "type")
          .map((component) => [component, componentSamples[component]]),
      );

      expect(makeEventIdempotencyKey(type, components)).toBe(
        `event:v1:${JSON.stringify(
          definition.idempotencyComponents.map((component) =>
            component === "type" ? type : components[component],
          ),
        )}`,
      );
      expect(() =>
        makeEventIdempotencyKey(type, { ...components, snapshotId: "snapshots:1" }),
      ).toThrow("Unexpected event idempotency component");
    }
  });

  test("event keys reject missing or empty frozen components", () => {
    expect(() =>
      makeEventIdempotencyKey("partner_message.v1", { messageId: "coupleMessages:1" }),
    ).toThrow("Missing event idempotency component: recipientId");
    expect(() =>
      makeEventIdempotencyKey("partner_message.v1", {
        messageId: "coupleMessages:1",
        recipientId: "",
      }),
    ).toThrow("Event idempotency components must be non-empty strings");
  });

  test("logical delivery identity uses event, channel, and stable destination only", () => {
    const key = makeDeliveryIdempotencyKey("notificationEvents:1", "in_app", "users:2");

    expect(key).toBe(
      makeDeliveryIdempotencyKey("notificationEvents:1", "in_app", "users:2"),
    );
    expect(key).not.toBe(
      makeDeliveryIdempotencyKey("notificationEvents:1", "in_app", "users:3"),
    );
    expect(key).not.toBe(
      makeDeliveryIdempotencyKey("notificationEvents:2", "in_app", "users:2"),
    );
    expect(key).not.toBe(
      makeDeliveryIdempotencyKey("notificationEvents:1", "push", "users:2"),
    );
  });

  test("partner message idempotency is a distinct fixed event scope", () => {
    expect(
      makeEventIdempotencyKey("partner_message.v1", {
        messageId: "coupleMessages:1",
        recipientId: "users:2",
      }),
    ).toBe('event:v1:["partner_message.v1","coupleMessages:1","users:2"]');
  });

  test("every current event denies external channels", () => {
    for (const type of Object.keys(notificationEventDefinitions) as Array<
      keyof typeof notificationEventDefinitions
    >) {
      expect(isEventChannelAllowed(type, "in_app")).toBe(true);
      expect(isEventChannelAllowed(type, "push")).toBe(false);
      expect(isEventChannelAllowed(type, "email")).toBe(false);
      expect(isEventChannelAllowed(type, "sms")).toBe(false);
      expect(isEventChannelAllowed(type, "discord")).toBe(false);
    }
  });

  test("provider capabilities require a finite positive dedupe lifetime", () => {
    expect(isValidProviderIdempotencyCapability({ supported: false })).toBe(true);
    expect(
      isValidProviderIdempotencyCapability({
        supported: true,
        scope: "destination",
        retentionMs: 60_000,
      }),
    ).toBe(true);
    expect(
      isValidProviderIdempotencyCapability({
        supported: true,
        scope: "provider",
        retentionMs: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false);
    expect(
      isValidProviderIdempotencyCapability({
        supported: true,
        scope: "provider",
        retentionMs: 0,
      }),
    ).toBe(false);
  });

  test("provider keys are opt-in, stable, opaque, and require compatible retention", async () => {
    const deliveryKey = makeDeliveryIdempotencyKey(
      "notificationEvents:1",
      "push",
      "installations:opaque",
    );

    await expect(
      createProviderIdempotencyKey(deliveryKey, { supported: false }, 60_000),
    ).resolves.toBeNull();
    await expect(
      createProviderIdempotencyKey(
        deliveryKey,
        { supported: true, scope: "destination", retentionMs: 59_999 },
        60_000,
      ),
    ).resolves.toBeNull();

    const capability = {
      supported: true as const,
      scope: "provider" as const,
      retentionMs: 60_000,
    };
    const key = await createProviderIdempotencyKey(deliveryKey, capability, 60_000);

    expect(key).toMatch(/^g4p1_[a-f0-9]{64}$/);
    expect(key).not.toContain("installations:opaque");
    await expect(
      createProviderIdempotencyKey(deliveryKey, capability, 60_000),
    ).resolves.toBe(key);
  });
});

describe("G4-DELIVERY-V1 lifecycle", () => {
  test("in-app delivered means inbox persistence, not a provider or read receipt", () => {
    const result = transitionDeliveryState(
      {
        channel: "in_app",
        status: "processing",
        eligibility: "eligible",
        providerOutcome: "none",
      },
      { kind: "in_app_persisted" },
    );

    expect(result).toEqual({
      state: {
        channel: "in_app",
        status: "delivered",
        eligibility: "eligible",
        providerOutcome: "none",
      },
      anomaly: null,
    });
  });

  test("unknown outcomes are not retried by a later claim", () => {
    const unknown = transitionDeliveryState(processingExternalDelivery(), {
      kind: "unknown",
      errorCode: "timeout",
    }).state;

    expect(unknown.status).toBe("unknown");
    expect(
      transitionDeliveryState(unknown, { kind: "claim" }),
    ).toEqual({ state: unknown, anomaly: null });
  });

  test("only known not-accepted retryable failures enter retry_wait", () => {
    expect(
      transitionDeliveryState(processingExternalDelivery(), {
        kind: "retryable_failure",
        errorCode: "rate_limited",
        definitelyNotAccepted: true,
      }).state.status,
    ).toBe("retry_wait");

    expect(
      transitionDeliveryState(processingExternalDelivery(), {
        kind: "retryable_failure",
        errorCode: "transport_unavailable",
        definitelyNotAccepted: false,
      }).state.status,
    ).toBe("unknown");
  });

  test("acceptance, delivery, and permanent failure remain distinct outcomes", () => {
    const accepted = transitionDeliveryState(processingExternalDelivery(), {
      kind: "accepted",
      providerMessageId: "provider-id",
    }).state;
    expect(accepted.status).toBe("accepted");
    expect(accepted.providerOutcome).toBe("accepted");

    const delivered = transitionDeliveryState(accepted, {
      kind: "provider_receipt",
      outcome: "delivered",
    }).state;
    expect(delivered.status).toBe("delivered");
    expect(delivered.providerOutcome).toBe("delivered");

    const failed = transitionDeliveryState(processingExternalDelivery(), {
      kind: "permanent_failure",
      errorCode: "destination_invalid",
    }).state;
    expect(failed.status).toBe("failed_permanent");
    expect(failed.providerOutcome).toBe("permanent_failure");
  });

  test("late receipts update factual outcome without reviving cancelled eligibility", () => {
    const cancelled = transitionDeliveryState(processingExternalDelivery(), {
      kind: "cancelled",
    }).state;
    const received = transitionDeliveryState(cancelled, {
      kind: "provider_receipt",
      outcome: "delivered",
    });

    expect(received.state.status).toBe("cancelled");
    expect(received.state.eligibility).toBe("cancelled");
    expect(received.state.providerOutcome).toBe("delivered");
  });

  test("duplicate receipts are idempotent and conflicting terminal receipts are anomalies", () => {
    const accepted = transitionDeliveryState(processingExternalDelivery(), {
      kind: "accepted",
    }).state;
    const delivered = transitionDeliveryState(accepted, {
      kind: "provider_receipt",
      outcome: "delivered",
    }).state;

    expect(
      transitionDeliveryState(delivered, {
        kind: "provider_receipt",
        outcome: "accepted",
      }).state,
    ).toEqual(delivered);
    expect(
      transitionDeliveryState(delivered, {
        kind: "provider_receipt",
        outcome: "permanent_failure",
      }),
    ).toEqual({ state: delivered, anomaly: "conflicting_terminal_provider_outcome" });
  });

  test("frozen render identity changes only when a logical delivery is newly created", () => {
    const original = {
      templateVersion: "v1",
      locale: "en",
      variableSchemaVersion: "1",
      payloadHash: "safe-hash",
    };

    expect(sameFrozenRenderIdentity(original, { ...original })).toBe(true);
    expect(
      sameFrozenRenderIdentity(original, { ...original, templateVersion: "v2" }),
    ).toBe(false);
    expect(
      sameFrozenRenderIdentity(original, { ...original, payloadHash: "changed" }),
    ).toBe(false);
  });

  test("destination token version can rebind only before possible acceptance to the same identity", () => {
    const current = { stableDestinationId: "installations:1", version: "3" };
    const rotated = { stableDestinationId: "installations:1", version: "4" };
    const newDestination = { stableDestinationId: "installations:2", version: "1" };

    expect(
      canRebindDestinationVersion(
        { ...processingExternalDelivery(), status: "pending" },
        current,
        rotated,
      ),
    ).toBe(true);
    expect(
      canRebindDestinationVersion(
        {
          ...processingExternalDelivery(),
          status: "retry_wait",
          providerOutcome: "retryable_failure",
        },
        current,
        rotated,
      ),
    ).toBe(true);
    expect(
      canRebindDestinationVersion(
        { ...processingExternalDelivery(), status: "accepted", providerOutcome: "accepted" },
        current,
        rotated,
      ),
    ).toBe(false);
    expect(
      canRebindDestinationVersion(
        { ...processingExternalDelivery(), status: "unknown", providerOutcome: "unknown" },
        current,
        rotated,
      ),
    ).toBe(false);
    expect(
      canRebindDestinationVersion(
        { ...processingExternalDelivery(), status: "pending" },
        current,
        newDestination,
      ),
    ).toBe(false);
  });

  test("delivery states keep in-app persistence separate from external outcomes", () => {
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "delivered",
        eligibility: "eligible",
        providerOutcome: "none",
      }),
    ).toBe(true);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "accepted",
        eligibility: "eligible",
        providerOutcome: "accepted",
      }),
    ).toBe(false);
    expect(
      isValidDeliveryState({
        channel: "push",
        status: "delivered",
        eligibility: "eligible",
        providerOutcome: "accepted",
      }),
    ).toBe(false);
    expect(
      isValidDeliveryState({
        channel: "push",
        status: "cancelled",
        eligibility: "cancelled",
        providerOutcome: "delivered",
        providerMessageId: "provider-id",
      }),
    ).toBe(true);
  });

  test("destination and render identities reject empty identity parts", () => {
    expect(isValidResolvedDestination({ stableDestinationId: "installations:1", version: "2" })).toBe(true);
    expect(isValidResolvedDestination({ stableDestinationId: "", version: "2" })).toBe(false);
    expect(
      isValidFrozenRenderIdentity({
        templateVersion: "v1",
        locale: "en",
        variableSchemaVersion: "1",
        payloadHash: "safe-hash",
      }),
    ).toBe(true);
    expect(
      isValidFrozenRenderIdentity({
        templateVersion: "v1",
        locale: "",
        variableSchemaVersion: "1",
        payloadHash: "safe-hash",
      }),
    ).toBe(false);
  });

  test("frozen interfaces exclude recipient identity and caller-supplied variables", () => {
    expect(Object.keys(renderFrozenArgsValidator.fields).sort()).toEqual(
      ["eventType", "templateVersion", "locale", "variableSchemaVersion"].sort(),
    );
    expect(Object.keys(notificationDispatchAuthorizationValidator.fields).sort()).toEqual(
      [
        "channel",
        "destination",
        "deliveryKey",
        "providerIdempotencyKey",
        "expiresAt",
        "renderIdentity",
        "payload",
      ].sort(),
    );
    expect(notificationAdapterResultValidator).toBeDefined();
  });

  test("render payload only accepts finite code-owned copy keys and routes", () => {
    expect(
      isValidFrozenNotificationPayload({
        titleKey: "g4.partner_message.title",
        bodyKey: "g4.partner_message.body",
        route: "messages",
      }),
    ).toBe(true);
    expect(
      isValidFrozenNotificationPayload({
        titleKey: "user supplied title" as never,
        bodyKey: "g4.partner_message.body",
        route: "messages",
      }),
    ).toBe(false);
    expect(Object.keys(frozenNotificationPayloadValidator.fields).sort()).toEqual(
      ["titleKey", "bodyKey", "route"].sort(),
    );
  });

  test("logical delivery, attempt, and inbox record validators freeze separate storage shapes", () => {
    expect(Object.keys(notificationDeliveryRecordValidator.fields).sort()).toEqual(
      [
        "eventId",
        "recipientUserId",
        "channel",
        "stableDestinationId",
        "destinationVersion",
        "logicalKey",
        "notBefore",
        "expiresAt",
        "state",
        "eligibility",
        "providerOutcome",
        "providerMessageId",
        "attemptCount",
        "nextAttemptAt",
        "claimGeneration",
        "leaseUntil",
        "dispatchStartedAt",
        "nextReceiptCheckAt",
        "reviewAt",
        "cancellationReason",
        "errorCode",
        "renderIdentity",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(notificationDeliveryAttemptRecordValidator.fields).sort()).toEqual(
      [
        "deliveryId",
        "attemptOrdinal",
        "claimGeneration",
        "startedAt",
        "completedAt",
        "destinationVersion",
        "result",
      ].sort(),
    );
    expect(Object.keys(notificationInboxItemRecordValidator.fields).sort()).toEqual(
      [
        "eventId",
        "recipientUserId",
        "idempotencyKey",
        "templateVersion",
        "route",
        "state",
        "createdAt",
        "readAt",
        "dismissedAt",
      ].sort(),
    );
    expect(notificationDeliveryRecordValidator.fields).not.toHaveProperty("payload");
    expect(notificationDeliveryAttemptRecordValidator.fields).not.toHaveProperty("response");
    expect(notificationInboxItemRecordValidator.fields).not.toHaveProperty("message");
  });
});
