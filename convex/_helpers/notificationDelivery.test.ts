import { describe, expect, test } from "vitest";

import { notificationEventDefinitions } from "./notificationTypes";
import {
  assertValidNotificationDeliveryAttemptNumbers,
  canRebindDestinationVersion,
  createProviderIdempotencyKey,
  isEventChannelAllowed,
  isValidDeliveryState,
  isValidNotificationDeliveryRecord,
  isValidFrozenNotificationPayload,
  isValidFrozenRenderIdentity,
  isValidProviderIdempotencyCapability,
  isValidResolvedDestination,
  makeDeliveryIdempotencyKey,
  makeEventIdempotencyKey,
  calculateRetryDeadline,
  claimInAppDelivery,
  isValidNotificationOperationalLimits,
  markDeliveryDispatchStarted,
  normalizeNotificationAdapterResult,
  notificationAdapterResultValidator,
  recoverExpiredDeliveryClaim,
  frozenNotificationPayloadValidator,
  notificationDispatchAuthorizationValidator,
  notificationDeliveryAttemptRecordValidator,
  notificationDeliveryRecordValidator,
  notificationInboxItemRecordValidator,
  isValidProjectInAppArgs,
  projectInAppArgsValidator,
  renderFrozenArgsValidator,
  sameFrozenRenderIdentity,
  transitionDeliveryState,
  transitionDeliveryStateFenced,
  transitionProviderReceiptFactual,
  type DeliveryState,
  type NotificationDeliveryRecord,
  type NotificationOperationalLimits,
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

const testLimits: NotificationOperationalLimits = {
  version: "g4-limits-v1",
  maxBatchSize: 10,
  maxConcurrent: 2,
  maxAttempts: 4,
  leaseMs: 500,
  receiptDeadlineMs: 2_000,
  baseBackoffMs: 50,
  maxBackoffMs: 1_000,
  jitterRatio: 0.25,
};

function inAppDeliveryRecord(
  overrides: Partial<NotificationDeliveryRecord> = {},
): NotificationDeliveryRecord {
  return {
    eventId: "notificationEvents:1",
    recipientUserId: "users:1",
    channel: "in_app",
    stableDestinationId: "users:1",
    logicalKey: "delivery:v1:test",
    notBefore: 0,
    state: "pending",
    eligibility: "eligible",
    providerOutcome: "none",
    attemptCount: 0,
    claimGeneration: 0,
    renderIdentity: {
      templateVersion: "g4-static-v1",
      locale: "en",
      variableSchemaVersion: "g4-v1",
      payloadHash: "static-payload-v1",
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

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
      }).state.status,
    ).toBe("retry_wait");
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

  test("factual receipts bypass worker generations and preserve terminal eligibility", () => {
    const cancelled = transitionDeliveryState(processingExternalDelivery(), {
      kind: "cancelled",
    }).state;

    expect(
      transitionProviderReceiptFactual(cancelled, {
        kind: "provider_receipt",
        outcome: "delivered",
        providerMessageId: "late-provider-id",
      }),
    ).toEqual({
      state: {
        ...cancelled,
        providerOutcome: "delivered",
        providerMessageId: "late-provider-id",
      },
      anomaly: null,
    });
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
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "cancelled",
        eligibility: "eligible",
        providerOutcome: "none",
      }),
    ).toBe(false);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "expired",
        eligibility: "eligible",
        providerOutcome: "none",
      }),
    ).toBe(false);
  });

  test("versioned operational limits reject non-finite and inconsistent values", () => {
    expect(isValidNotificationOperationalLimits(testLimits)).toBe(true);
    expect(
      isValidNotificationOperationalLimits({ ...testLimits, maxConcurrent: 11 }),
    ).toBe(false);
    expect(
      isValidNotificationOperationalLimits({ ...testLimits, leaseMs: Number.POSITIVE_INFINITY }),
    ).toBe(false);
    expect(
      isValidNotificationOperationalLimits({ ...testLimits, maxBackoffMs: Number.NaN }),
    ).toBe(false);
    expect(
      isValidNotificationOperationalLimits({ ...testLimits, version: "latest" }),
    ).toBe(false);
    expect(
      isValidNotificationOperationalLimits({ ...testLimits, unexpected: 1 }),
    ).toBe(false);
  });

  test("retry deadlines inject clock and jitter and honor Retry-After as a minimum", () => {
    expect(
      calculateRetryDeadline({
        now: 1_000,
        attemptCount: 1,
        jitterFactor: 1,
        retryAfterMs: 200,
        expiresAt: 2_000,
        limits: testLimits,
      }),
    ).toEqual({ kind: "retry", dueAt: 1_200 });
    expect(
      calculateRetryDeadline({
        now: 1_000,
        attemptCount: 1,
        jitterFactor: 1,
        expiresAt: 2_000,
        limits: testLimits,
      }),
    ).toEqual({ kind: "retry", dueAt: 1_062 });
    expect(
      calculateRetryDeadline({
        now: 1_000,
        attemptCount: 1,
        jitterFactor: 0,
        retryAfterMs: 1_000,
        expiresAt: 1_900,
        limits: testLimits,
      }),
    ).toEqual({ kind: "expired" });
    expect(
      calculateRetryDeadline({
        now: 1_000,
        attemptCount: 4,
        jitterFactor: 0,
        limits: testLimits,
      }),
    ).toEqual({ kind: "exhausted" });
    expect(
      calculateRetryDeadline({
        now: 1_000,
        attemptCount: 3,
        jitterFactor: 0.5,
        limits: { ...testLimits, maxBackoffMs: 150 },
      }),
    ).toEqual({ kind: "retry", dueAt: 1_150 });
  });

  test("malformed retry hints normalize to unknown instead of an early retry", () => {
    expect(
      normalizeNotificationAdapterResult({
        kind: "retryable_failure",
        errorCode: "rate_limited",
        retryAfterMs: Number.NaN,
      } as never),
    ).toEqual({ kind: "unknown", errorCode: "rate_limited" });
    expect(
      normalizeNotificationAdapterResult({
        kind: "retryable_failure",
        errorCode: "rate_limited",
        retryAfterMs: -1,
      } as never),
    ).toEqual({ kind: "unknown", errorCode: "rate_limited" });
  });

  test("in-app claims are generation fenced and external claims are unavailable", () => {
    const firstClaimResult = claimInAppDelivery(inAppDeliveryRecord(), {
      expectedGeneration: 0,
      now: 100,
      limits: testLimits,
    });
    expect(firstClaimResult.kind).toBe("claimed");
    if (firstClaimResult.kind !== "claimed") throw new Error("Expected an in-app claim");
    const firstClaim = firstClaimResult.record;
    expect(firstClaim).toMatchObject({
      state: "processing",
      claimGeneration: 1,
      attemptCount: 1,
      leaseUntil: 600,
    });
    expect(
      claimInAppDelivery(firstClaim, {
        expectedGeneration: 0,
        now: 101,
        limits: testLimits,
      }),
    ).toEqual({ kind: "stale_generation" });
    expect(
      claimInAppDelivery(
        inAppDeliveryRecord({ state: "unknown", providerOutcome: "unknown" }),
        { expectedGeneration: 0, now: 100, limits: testLimits },
      ),
    ).toEqual({ kind: "not_claimable" });
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "unknown",
        eligibility: "eligible",
        providerOutcome: "unknown",
      }),
    ).toBe(true);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "unknown",
        eligibility: "eligible",
        providerOutcome: "none",
      }),
    ).toBe(false);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "expired",
        eligibility: "expired",
        providerOutcome: "unknown",
      }),
    ).toBe(true);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "unknown",
        eligibility: "cancelled",
        providerOutcome: "unknown",
      }),
    ).toBe(true);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "cancelled",
        eligibility: "cancelled",
        providerOutcome: "unknown",
      }),
    ).toBe(true);
    expect(
      isValidDeliveryState({
        channel: "in_app",
        status: "suppressed",
        eligibility: "suppressed",
        providerOutcome: "unknown",
      }),
    ).toBe(true);
    expect(
      claimInAppDelivery(
        inAppDeliveryRecord({ channel: "discord", stableDestinationId: "webhook:1" }),
        { expectedGeneration: 0, now: 100, limits: testLimits },
      ),
    ).toEqual({ kind: "external_channel_denied" });
  });

  test("an in-app claim at its attempt limit returns terminal state instead of stranding due work", () => {
    const exhausted = claimInAppDelivery(
      inAppDeliveryRecord({
        state: "retry_wait",
        attemptCount: testLimits.maxAttempts,
        nextAttemptAt: 100,
      }),
      { expectedGeneration: 0, now: 100, limits: testLimits },
    );

    expect(exhausted).toMatchObject({
      kind: "attempts_exhausted",
      record: {
        state: "failed_permanent",
        eligibility: "eligible",
        providerOutcome: "none",
        errorCode: "attempts_exhausted",
        updatedAt: 100,
      },
    });
    if (exhausted.kind !== "attempts_exhausted") {
      throw new Error("Expected an exhausted claim");
    }
    expect(exhausted.record.leaseUntil).toBeUndefined();
    expect(
      isValidDeliveryState({
        channel: exhausted.record.channel,
        status: exhausted.record.state,
        eligibility: exhausted.record.eligibility,
        providerOutcome: exhausted.record.providerOutcome,
        errorCode: exhausted.record.errorCode,
      }),
    ).toBe(true);
  });

  test("expired undispatched claims retry safely while marked dispatches become unknown", () => {
    const undispatched = inAppDeliveryRecord({
      channel: "push",
      state: "processing",
      attemptCount: 1,
      claimGeneration: 2,
      leaseUntil: 500,
    });
    expect(
      recoverExpiredDeliveryClaim(undispatched, {
        expectedGeneration: 2,
        now: 600,
        jitterFactor: 0.5,
        limits: testLimits,
      }),
    ).toMatchObject({
      kind: "retry",
      record: { state: "retry_wait", providerOutcome: "none", nextAttemptAt: 650 },
    });
    expect(
      recoverExpiredDeliveryClaim(
        { ...undispatched, providerOutcome: "retryable_failure" },
        { expectedGeneration: 2, now: 600, jitterFactor: 0.5, limits: testLimits },
      ),
    ).toMatchObject({
      kind: "retry",
      record: { state: "retry_wait", providerOutcome: "retryable_failure", nextAttemptAt: 650 },
    });

    const dispatchMarker = markDeliveryDispatchStarted(
      { ...undispatched, leaseUntil: 700 },
      { expectedGeneration: 2, now: 450 },
    );
    expect(dispatchMarker.kind).toBe("marked");
    if (dispatchMarker.kind !== "marked") throw new Error("Expected a dispatch marker");
    expect(
      recoverExpiredDeliveryClaim(
        dispatchMarker.record,
        { expectedGeneration: 2, now: 800, jitterFactor: 0, limits: testLimits },
      ),
    ).toMatchObject({
      kind: "unknown",
      record: { state: "unknown", providerOutcome: "unknown" },
    });
    expect(
      recoverExpiredDeliveryClaim(
        { ...dispatchMarker.record, expiresAt: 750 },
        { expectedGeneration: 2, now: 800, jitterFactor: 0, limits: testLimits },
      ),
    ).toMatchObject({
      kind: "expired",
      record: { state: "expired", eligibility: "expired", providerOutcome: "unknown" },
    });
    expect(
      recoverExpiredDeliveryClaim(undispatched, {
        expectedGeneration: 1,
        now: 600,
        jitterFactor: 0,
        limits: testLimits,
      }),
    ).toEqual({ kind: "stale_generation" });
  });

  test("an undispatched claim at its attempt limit becomes terminal and preserves provider facts", () => {
    const exhaustedClaim = {
      ...inAppDeliveryRecord({
        channel: "push",
        state: "processing",
        attemptCount: testLimits.maxAttempts,
        claimGeneration: 2,
        leaseUntil: 500,
        providerOutcome: "retryable_failure" as const,
      }),
    };

    const recovered = recoverExpiredDeliveryClaim(exhaustedClaim, {
      expectedGeneration: 2,
      now: 600,
      jitterFactor: 0,
      limits: testLimits,
    });

    expect(recovered).toMatchObject({
      kind: "exhausted",
      record: {
        state: "failed_permanent",
        eligibility: "eligible",
        providerOutcome: "retryable_failure",
        errorCode: "attempts_exhausted",
        updatedAt: 600,
      },
    });
    if (recovered.kind !== "exhausted") throw new Error("Expected an exhausted claim");
    expect(recovered.record.leaseUntil).toBeUndefined();
    expect(
      recoverExpiredDeliveryClaim(recovered.record, {
        expectedGeneration: recovered.record.claimGeneration,
        now: 700,
        jitterFactor: 0,
        limits: testLimits,
      }),
    ).toEqual({ kind: "not_expired" });
    expect(
      isValidDeliveryState({
        channel: recovered.record.channel,
        status: recovered.record.state,
        eligibility: recovered.record.eligibility,
        providerOutcome: recovered.record.providerOutcome,
        errorCode: recovered.record.errorCode,
      }),
    ).toBe(true);
  });

  test("a stale worker fact cannot overwrite a newer generation", () => {
    const current = processingExternalDelivery();
    expect(
      transitionDeliveryStateFenced(current, {
        expectedGeneration: 3,
        currentGeneration: 4,
        fact: { kind: "accepted", providerMessageId: "late-provider-id" },
      }),
    ).toEqual({ applied: false, state: current, anomaly: null });
    expect(
      transitionDeliveryStateFenced(current, {
        expectedGeneration: 4,
        currentGeneration: 4,
        fact: { kind: "unknown", errorCode: "timeout" },
      }).state.status,
    ).toBe("unknown");
  });

  test("rejects an exhausted safe-integer worker generation even when it matches", () => {
    const current = processingExternalDelivery();
    expect(
      transitionDeliveryStateFenced(current, {
        expectedGeneration: Number.MAX_SAFE_INTEGER,
        currentGeneration: Number.MAX_SAFE_INTEGER,
        fact: { kind: "accepted", providerMessageId: "late-provider-id" },
      }),
    ).toEqual({ applied: false, state: current, anomaly: null });
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

  test("projector requests can carry only a complete semantic source and preference fence", () => {
    const base = {
      eventId: "notificationEvents:1",
      expectedGeneration: 1,
    };
    expect(isValidProjectInAppArgs(base)).toBe(true);
    expect(
      isValidProjectInAppArgs(base, { requireScheduleFences: true }),
    ).toBe(false);
    expect(
      isValidProjectInAppArgs({
        ...base,
        expectedSourceAuthorityVersion:
          'g4-source-v1:[1,"cycle-read-model-v1",null,null,null]',
        expectedReminderWindowVersion: 2,
      }),
    ).toBe(true);
    expect(
      isValidProjectInAppArgs(
        {
          ...base,
          expectedSourceAuthorityVersion:
            'g4-source-v1:[1,"cycle-read-model-v1",null,null,null]',
          expectedReminderWindowVersion: 2,
        },
        { requireScheduleFences: true },
      ),
    ).toBe(true);
    expect(
      isValidProjectInAppArgs({
        ...base,
        expectedSourceAuthorityVersion:
          'g4-source-v1:[1,"cycle-read-model-v1",null,null,null]',
      }),
    ).toBe(false);
    expect(
      isValidProjectInAppArgs({
        ...base,
        expectedSourceAuthorityVersion: "",
        expectedReminderWindowVersion: 2,
      }),
    ).toBe(false);
    expect(
      isValidProjectInAppArgs({
        ...base,
        expectedSourceAuthorityVersion:
          'g4-source-v1:[1,"cycle-read-model-v1",null,null,null]',
        expectedReminderWindowVersion: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false);
    expect(Object.keys(projectInAppArgsValidator.fields).sort()).toEqual([
      "eventId",
      "expectedGeneration",
      "expectedReminderWindowVersion",
      "expectedSourceAuthorityVersion",
    ]);
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

  test("checked delivery writes reject non-finite timestamps and unsafe counters", () => {
    const timestampFields = [
      "notBefore",
      "expiresAt",
      "nextAttemptAt",
      "leaseUntil",
      "dispatchStartedAt",
      "nextReceiptCheckAt",
      "reviewAt",
      "createdAt",
      "updatedAt",
    ] as const;
    for (const field of timestampFields) {
      for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
        expect(
          isValidNotificationDeliveryRecord({
            ...inAppDeliveryRecord(),
            [field]: invalid,
          } as never),
        ).toBe(false);
      }
    }

    for (const field of ["attemptCount", "claimGeneration"] as const) {
      for (const invalid of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(
          isValidNotificationDeliveryRecord({
            ...inAppDeliveryRecord(),
            [field]: invalid,
          } as never),
        ).toBe(false);
      }
    }
    expect(isValidNotificationDeliveryRecord(inAppDeliveryRecord())).toBe(true);
  });

  test("checks attempt numeric bounds before persistence", () => {
    const validAttempt = {
      deliveryId: "notificationDeliveries:1",
      attemptOrdinal: 1,
      claimGeneration: 1,
      startedAt: 10,
      completedAt: 12,
      result: { kind: "in_app_persisted" as const },
    };
    expect(() => assertValidNotificationDeliveryAttemptNumbers(validAttempt)).not.toThrow();

    for (const field of ["attemptOrdinal", "claimGeneration", "startedAt", "completedAt"]) {
      for (const invalid of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(() =>
          assertValidNotificationDeliveryAttemptNumbers({ ...validAttempt, [field]: invalid }),
        ).toThrow();
      }
    }
    expect(() =>
      assertValidNotificationDeliveryAttemptNumbers({ ...validAttempt, attemptOrdinal: 0 }),
    ).toThrow();
    expect(() =>
      assertValidNotificationDeliveryAttemptNumbers({ ...validAttempt, claimGeneration: 0 }),
    ).toThrow();
    expect(() =>
      assertValidNotificationDeliveryAttemptNumbers({ ...validAttempt, completedAt: 9 }),
    ).toThrow();
  });
});
