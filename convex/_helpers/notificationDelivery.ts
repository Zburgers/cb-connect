import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

import {
  notificationEventDefinitions,
  notificationEventTypeValidator,
  type NotificationEventType,
} from "./notificationTypes";

export const notificationDeliveryChannels = [
  "in_app",
  "push",
  "email",
  "sms",
  "discord",
] as const;

export type NotificationDeliveryChannel = (typeof notificationDeliveryChannels)[number];
export type DeliveryStatus =
  | "pending"
  | "processing"
  | "accepted"
  | "delivered"
  | "retry_wait"
  | "failed_permanent"
  | "unknown"
  | "expired"
  | "suppressed"
  | "cancelled";
export type DeliveryEligibility = "eligible" | "expired" | "suppressed" | "cancelled";
export type ProviderOutcome =
  | "none"
  | "accepted"
  | "delivered"
  | "retryable_failure"
  | "permanent_failure"
  | "unknown";

export const deliveryErrorCodes = [
  "timeout",
  "rate_limited",
  "transport_unavailable",
  "provider_rejected",
  "destination_invalid",
  "authorization_revoked",
  "expired",
  "payload_invalid",
  "internal_error",
] as const;

export type DeliveryErrorCode = (typeof deliveryErrorCodes)[number];
export type DeliveryTerminalReason = DeliveryErrorCode | "attempts_exhausted";

/** Operational settings are supplied by the owning runtime lane; this module invents no defaults. */
export type NotificationOperationalLimits = {
  version: "g4-limits-v1";
  maxBatchSize: number;
  maxConcurrent: number;
  maxAttempts: number;
  leaseMs: number;
  receiptDeadlineMs: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
};

export const notificationOperationalLimitsValidator = v.object({
  version: v.literal("g4-limits-v1"),
  maxBatchSize: v.number(),
  maxConcurrent: v.number(),
  maxAttempts: v.number(),
  leaseMs: v.number(),
  receiptDeadlineMs: v.number(),
  baseBackoffMs: v.number(),
  maxBackoffMs: v.number(),
  jitterRatio: v.number(),
});

const channelValidator = v.union(
  v.literal("in_app"),
  v.literal("push"),
  v.literal("email"),
  v.literal("sms"),
  v.literal("discord"),
);

const deliveryStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("retry_wait"),
  v.literal("failed_permanent"),
  v.literal("unknown"),
  v.literal("expired"),
  v.literal("suppressed"),
  v.literal("cancelled"),
);

const eligibilityValidator = v.union(
  v.literal("eligible"),
  v.literal("expired"),
  v.literal("suppressed"),
  v.literal("cancelled"),
);

const providerOutcomeValidator = v.union(
  v.literal("none"),
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("retryable_failure"),
  v.literal("permanent_failure"),
  v.literal("unknown"),
);

const errorCodeValidator = v.union(
  v.literal("timeout"),
  v.literal("rate_limited"),
  v.literal("transport_unavailable"),
  v.literal("provider_rejected"),
  v.literal("destination_invalid"),
  v.literal("authorization_revoked"),
  v.literal("expired"),
  v.literal("payload_invalid"),
  v.literal("internal_error"),
);

const deliveryTerminalReasonValidator = v.union(
  errorCodeValidator,
  v.literal("attempts_exhausted"),
);

export const notificationDeliveryStateValidator = v.object({
  channel: channelValidator,
  status: deliveryStatusValidator,
  eligibility: eligibilityValidator,
  providerOutcome: providerOutcomeValidator,
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(deliveryTerminalReasonValidator),
});

export const deliveryAttemptResultValidator = v.union(
  v.object({ kind: v.literal("in_app_persisted") }),
  v.object({
    kind: v.literal("accepted"),
    providerMessageId: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("retryable_failure"),
    errorCode: errorCodeValidator,
  }),
  v.object({ kind: v.literal("permanent_failure"), errorCode: errorCodeValidator }),
  v.object({ kind: v.literal("unknown"), errorCode: v.optional(errorCodeValidator) }),
);

export const frozenRenderIdentityValidator = v.object({
  templateVersion: v.string(),
  locale: v.string(),
  variableSchemaVersion: v.string(),
  payloadHash: v.string(),
});

export const resolvedDestinationValidator = v.object({
  stableDestinationId: v.string(),
  version: v.string(),
});

export const providerIdempotencyCapabilityValidator = v.union(
  v.object({ supported: v.literal(false) }),
  v.object({
    supported: v.literal(true),
    scope: v.union(v.literal("provider"), v.literal("destination")),
    retentionMs: v.number(),
  }),
);

export type DeliveryState = {
  channel: NotificationDeliveryChannel;
  status: DeliveryStatus;
  eligibility: DeliveryEligibility;
  providerOutcome: ProviderOutcome;
  providerMessageId?: string;
  errorCode?: DeliveryTerminalReason;
};

export type ProviderIdempotencyCapability =
  | { supported: false }
  | {
      supported: true;
      scope: "provider" | "destination";
      retentionMs: number;
    };

export type FrozenRenderIdentity = {
  readonly templateVersion: string;
  readonly locale: string;
  readonly variableSchemaVersion: string;
  readonly payloadHash: string;
};

export type ResolvedDestination = {
  readonly stableDestinationId: string;
  readonly version: string;
};

export const notificationInboxRoutes = ["periods", "messages", "pain", "settings"] as const;
export type NotificationInboxRoute = (typeof notificationInboxRoutes)[number];

export const notificationTemplateTitleKeys = [
  "g4.assisted_period_start.title",
  "g4.assisted_period_end.title",
  "g4.period_window_approaching.title",
  "g4.late_status.title",
  "g4.pain_check_in.title",
  "g4.partner_linked.title",
  "g4.partner_message.title",
  "g4.partner_nudge.title",
  "g4.partner_chat_cleared.title",
  "g4.connected_since_updated.title",
] as const;

export const notificationTemplateBodyKeys = [
  "g4.assisted_period_start.body",
  "g4.assisted_period_end.body",
  "g4.period_window_approaching.body",
  "g4.late_status.body",
  "g4.pain_check_in.body",
  "g4.partner_linked.body",
  "g4.partner_message.body",
  "g4.partner_nudge.body",
  "g4.partner_chat_cleared.body",
  "g4.connected_since_updated.body",
] as const;

export type NotificationTemplateTitleKey = (typeof notificationTemplateTitleKeys)[number];
export type NotificationTemplateBodyKey = (typeof notificationTemplateBodyKeys)[number];

/** Gate 4 templates are static. No event-derived or free-text values are interpolated. */
export type FrozenNotificationPayload = {
  titleKey: NotificationTemplateTitleKey;
  bodyKey: NotificationTemplateBodyKey;
  route: NotificationInboxRoute;
};

export type RenderFrozenArgs = {
  eventType: NotificationEventType;
  templateVersion: string;
  locale: string;
  variableSchemaVersion: string;
};

export type RenderFrozenResult = {
  identity: FrozenRenderIdentity;
  payload: FrozenNotificationPayload;
};

export type ReconcileSourceArgs = {
  sourceRef: string;
  authorityVersion: string;
};

export type ProjectInAppArgs = {
  eventId: Id<"notificationEvents">;
  expectedGeneration: number;
};

export type CancelSourceArgs = {
  sourceRef: string;
  reason: "source_changed" | "authority_revoked" | "preference_off" | "expired";
};

export type ReconcileUserScheduleArgs = {
  userId: Id<"users">;
};

export type NotificationDispatchAuthorization = {
  channel: Exclude<NotificationDeliveryChannel, "in_app">;
  destination: ResolvedDestination;
  deliveryKey: string;
  providerIdempotencyKey?: string;
  expiresAt?: number;
  renderIdentity: FrozenRenderIdentity;
  payload: FrozenNotificationPayload;
};

/** Only a definite, normalized adapter fact crosses this future-only boundary. */
export type NotificationAdapterResult =
  | { kind: "accepted"; providerMessageId?: string }
  | { kind: "retryable_failure"; errorCode: DeliveryErrorCode; retryAfterMs?: number }
  | { kind: "permanent_failure"; errorCode: DeliveryErrorCode }
  | { kind: "unknown"; errorCode?: DeliveryErrorCode };

export type NotificationDeliveryRecord = {
  eventId: string;
  recipientUserId: string;
  channel: NotificationDeliveryChannel;
  stableDestinationId: string;
  destinationVersion?: string;
  logicalKey: string;
  notBefore: number;
  expiresAt?: number;
  state: DeliveryStatus;
  eligibility: DeliveryEligibility;
  providerOutcome: ProviderOutcome;
  providerMessageId?: string;
  attemptCount: number;
  nextAttemptAt?: number;
  claimGeneration: number;
  leaseUntil?: number;
  dispatchStartedAt?: number;
  nextReceiptCheckAt?: number;
  reviewAt?: number;
  cancellationReason?: CancelSourceArgs["reason"];
  errorCode?: DeliveryTerminalReason;
  renderIdentity: FrozenRenderIdentity;
  createdAt: number;
  updatedAt: number;
};

export type NotificationDeliveryAttemptRecord = {
  deliveryId: string;
  attemptOrdinal: number;
  claimGeneration: number;
  startedAt: number;
  completedAt?: number;
  destinationVersion?: string;
  result: { kind: "in_app_persisted" } | NotificationAdapterResult;
};

export type NotificationInboxItemRecord = {
  eventId: string;
  recipientUserId: string;
  idempotencyKey: string;
  templateVersion: string;
  route?: NotificationInboxRoute;
  state: "current" | "hidden" | "dismissed";
  createdAt: number;
  readAt?: number;
  dismissedAt?: number;
};

export const notificationInboxRouteValidator = v.union(
  v.literal("periods"),
  v.literal("messages"),
  v.literal("pain"),
  v.literal("settings"),
);

export const frozenNotificationPayloadValidator = v.object({
  titleKey: v.union(
    v.literal("g4.assisted_period_start.title"),
    v.literal("g4.assisted_period_end.title"),
    v.literal("g4.period_window_approaching.title"),
    v.literal("g4.late_status.title"),
    v.literal("g4.pain_check_in.title"),
    v.literal("g4.partner_linked.title"),
    v.literal("g4.partner_message.title"),
    v.literal("g4.partner_nudge.title"),
    v.literal("g4.partner_chat_cleared.title"),
    v.literal("g4.connected_since_updated.title"),
  ),
  bodyKey: v.union(
    v.literal("g4.assisted_period_start.body"),
    v.literal("g4.assisted_period_end.body"),
    v.literal("g4.period_window_approaching.body"),
    v.literal("g4.late_status.body"),
    v.literal("g4.pain_check_in.body"),
    v.literal("g4.partner_linked.body"),
    v.literal("g4.partner_message.body"),
    v.literal("g4.partner_nudge.body"),
    v.literal("g4.partner_chat_cleared.body"),
    v.literal("g4.connected_since_updated.body"),
  ),
  route: notificationInboxRouteValidator,
});

export const renderFrozenArgsValidator = v.object({
  eventType: notificationEventTypeValidator,
  templateVersion: v.string(),
  locale: v.string(),
  variableSchemaVersion: v.string(),
});

export const renderFrozenResultValidator = v.object({
  identity: frozenRenderIdentityValidator,
  payload: frozenNotificationPayloadValidator,
});

export const reconcileSourceArgsValidator = v.object({
  sourceRef: v.string(),
  authorityVersion: v.string(),
});

export const projectInAppArgsValidator = v.object({
  eventId: v.id("notificationEvents"),
  expectedGeneration: v.number(),
});

export const cancelSourceArgsValidator = v.object({
  sourceRef: v.string(),
  reason: v.union(
    v.literal("source_changed"),
    v.literal("authority_revoked"),
    v.literal("preference_off"),
    v.literal("expired"),
  ),
});

export const reconcileUserScheduleArgsValidator = v.object({
  userId: v.id("users"),
});

export const notificationDispatchAuthorizationValidator = v.object({
  channel: v.union(v.literal("push"), v.literal("email"), v.literal("sms"), v.literal("discord")),
  destination: resolvedDestinationValidator,
  deliveryKey: v.string(),
  providerIdempotencyKey: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  renderIdentity: frozenRenderIdentityValidator,
  payload: frozenNotificationPayloadValidator,
});

export const notificationAdapterResultValidator = v.union(
  v.object({ kind: v.literal("accepted"), providerMessageId: v.optional(v.string()) }),
  v.object({
    kind: v.literal("retryable_failure"),
    errorCode: errorCodeValidator,
    retryAfterMs: v.optional(v.number()),
  }),
  v.object({ kind: v.literal("permanent_failure"), errorCode: errorCodeValidator }),
  v.object({ kind: v.literal("unknown"), errorCode: v.optional(errorCodeValidator) }),
);

export const notificationDeliveryRecordValidator = v.object({
  eventId: v.id("notificationEvents"),
  recipientUserId: v.id("users"),
  channel: channelValidator,
  stableDestinationId: v.string(),
  destinationVersion: v.optional(v.string()),
  logicalKey: v.string(),
  notBefore: v.number(),
  expiresAt: v.optional(v.number()),
  state: deliveryStatusValidator,
  eligibility: eligibilityValidator,
  providerOutcome: providerOutcomeValidator,
  providerMessageId: v.optional(v.string()),
  attemptCount: v.number(),
  nextAttemptAt: v.optional(v.number()),
  claimGeneration: v.number(),
  leaseUntil: v.optional(v.number()),
  dispatchStartedAt: v.optional(v.number()),
  nextReceiptCheckAt: v.optional(v.number()),
  reviewAt: v.optional(v.number()),
  cancellationReason: v.optional(
    v.union(
      v.literal("source_changed"),
      v.literal("authority_revoked"),
      v.literal("preference_off"),
      v.literal("expired"),
    ),
  ),
  errorCode: v.optional(deliveryTerminalReasonValidator),
  renderIdentity: frozenRenderIdentityValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const notificationDeliveryAttemptRecordValidator = v.object({
  deliveryId: v.id("notificationDeliveries"),
  attemptOrdinal: v.number(),
  claimGeneration: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  destinationVersion: v.optional(v.string()),
  result: deliveryAttemptResultValidator,
});

export const notificationInboxItemRecordValidator = v.object({
  eventId: v.id("notificationEvents"),
  recipientUserId: v.id("users"),
  idempotencyKey: v.string(),
  templateVersion: v.string(),
  route: v.optional(notificationInboxRouteValidator),
  state: v.union(v.literal("current"), v.literal("hidden"), v.literal("dismissed")),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),
});

export type DeliveryFact =
  | { kind: "claim" }
  | { kind: "in_app_persisted" }
  | { kind: "accepted"; providerMessageId?: string }
  | {
      kind: "retryable_failure";
      errorCode: DeliveryErrorCode;
    }
  | { kind: "permanent_failure"; errorCode: DeliveryErrorCode }
  | { kind: "unknown"; errorCode?: DeliveryErrorCode }
  | { kind: "provider_receipt"; outcome: "accepted" | "delivered" | "permanent_failure"; providerMessageId?: string }
  | { kind: "expired" }
  | { kind: "suppressed" }
  | { kind: "cancelled" };

export type DeliveryTransition = {
  state: DeliveryState;
  anomaly: "conflicting_terminal_provider_outcome" | null;
};

/** Cross-field checks not expressible by Convex's structural object validators. */
export function isValidDeliveryState(state: DeliveryState): boolean {
  const inAppOnlyStatuses: DeliveryStatus[] = [
    "pending",
    "processing",
    "retry_wait",
    "failed_permanent",
    "delivered",
    "expired",
    "suppressed",
    "cancelled",
  ];
  if (state.channel === "in_app") {
    if (
      state.status === "failed_permanent" &&
      (state.eligibility !== "eligible" ||
        state.providerOutcome !== "none" ||
        state.errorCode !== "attempts_exhausted")
    ) {
      return false;
    }
    if (
      (state.status === "expired" || state.status === "suppressed" || state.status === "cancelled") &&
      state.eligibility !== state.status
    ) {
      return false;
    }
    if (
      state.eligibility !== "eligible" &&
      state.status !== state.eligibility &&
      state.status !== "delivered"
    ) {
      return false;
    }
    if (
      state.eligibility === "eligible" &&
      (state.status === "expired" || state.status === "suppressed" || state.status === "cancelled")
    ) {
      return false;
    }
    return (
      inAppOnlyStatuses.includes(state.status) &&
      state.providerOutcome === "none" &&
      state.providerMessageId === undefined
    );
  }

  if (
    (state.status === "expired" || state.status === "suppressed" || state.status === "cancelled") &&
    state.eligibility !== state.status
  ) {
    return false;
  }
  if (
    state.eligibility !== "eligible" &&
    !["accepted", "delivered", "failed_permanent", "expired", "suppressed", "cancelled"].includes(
      state.status,
    )
  ) {
    return false;
  }

  const requiredOutcomeByStatus: Partial<Record<DeliveryStatus, ProviderOutcome>> = {
    accepted: "accepted",
    delivered: "delivered",
    retry_wait: "retryable_failure",
    unknown: "unknown",
  };
  const requiredOutcome = requiredOutcomeByStatus[state.status];
  if (requiredOutcome && state.providerOutcome !== requiredOutcome) return false;
  if (
    state.status === "failed_permanent" &&
    state.providerOutcome !== "permanent_failure" &&
    (state.errorCode !== "attempts_exhausted" ||
      (state.providerOutcome !== "none" && state.providerOutcome !== "retryable_failure"))
  ) {
    return false;
  }
  if (
    (state.status === "pending" || state.status === "processing") &&
    state.providerOutcome !== "none" &&
    state.providerOutcome !== "retryable_failure"
  ) {
    return false;
  }
  if (
    state.providerMessageId !== undefined &&
    state.providerOutcome !== "accepted" &&
    state.providerOutcome !== "delivered"
  ) {
    return false;
  }
  return true;
}

export function isValidFrozenRenderIdentity(identity: FrozenRenderIdentity): boolean {
  return [
    identity.templateVersion,
    identity.locale,
    identity.variableSchemaVersion,
    identity.payloadHash,
  ].every((value) => value.length > 0);
}

export function isValidFrozenNotificationPayload(payload: FrozenNotificationPayload): boolean {
  return (
    notificationTemplateTitleKeys.includes(payload.titleKey) &&
    notificationTemplateBodyKeys.includes(payload.bodyKey) &&
    notificationInboxRoutes.includes(payload.route)
  );
}

export function isValidResolvedDestination(destination: ResolvedDestination): boolean {
  return destination.stableDestinationId.length > 0 && destination.version.length > 0;
}

export function isValidProviderIdempotencyCapability(
  capability: ProviderIdempotencyCapability,
): boolean {
  return (
    !capability.supported ||
    (capability.retentionMs > 0 &&
      Number.isFinite(capability.retentionMs) &&
      (capability.scope === "provider" || capability.scope === "destination"))
  );
}

export function isEventChannelAllowed(
  type: NotificationEventType,
  channel: NotificationDeliveryChannel,
): boolean {
  return notificationEventDefinitions[type].allowedChannels.some((allowed) => allowed === channel);
}

/**
 * Builds an event idempotency key from only the ordered components frozen in G4-EVENT-V1.
 *
 * @throws Error when a required component is missing, empty, or not in the catalog.
 */
export function makeEventIdempotencyKey(
  type: NotificationEventType,
  components: Record<string, string>,
): string {
  const componentNames = notificationEventDefinitions[type].idempotencyComponents;
  const expectedNames: readonly string[] = componentNames.filter((name) => name !== "type");

  for (const name of Object.keys(components)) {
    if (!expectedNames.includes(name)) {
      throw new Error(`Unexpected event idempotency component: ${name}`);
    }
  }
  for (const name of expectedNames) {
    if (!(name in components)) {
      throw new Error(`Missing event idempotency component: ${name}`);
    }
    if (typeof components[name] !== "string" || components[name].length === 0) {
      throw new Error("Event idempotency components must be non-empty strings");
    }
  }

  return `event:v1:${JSON.stringify(componentNames.map((name) => (name === "type" ? type : components[name])))}`;
}

/**
 * Builds one logical destination key; destination versions never change this key.
 *
 * @throws Error when any stable key component is empty.
 */
export function makeDeliveryIdempotencyKey(
  eventId: string,
  channel: NotificationDeliveryChannel,
  stableDestinationId: string,
): string {
  if (!eventId || !stableDestinationId) {
    throw new Error("Delivery idempotency components must be non-empty strings");
  }
  return `delivery:v1:${JSON.stringify([eventId, channel, stableDestinationId])}`;
}

/**
 * Derives a provider-scoped opaque key only when provider dedupe covers the retry horizon.
 */
export async function createProviderIdempotencyKey(
  deliveryKey: string,
  capability: ProviderIdempotencyCapability,
  requiredRetentionMs: number,
): Promise<string | null> {
  if (
    !capability.supported ||
    !deliveryKey ||
    !Number.isFinite(requiredRetentionMs) ||
    requiredRetentionMs <= 0 ||
    !Number.isFinite(capability.retentionMs) ||
    capability.retentionMs < requiredRetentionMs
  ) {
    return null;
  }

  const source = new TextEncoder().encode(
    `cb-connect:provider-idempotency:v1:${capability.scope}:${deliveryKey}`,
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `g4p1_${hex}`;
}

/**
 * Rebinds a token version only before any possible send and only for the same destination.
 */
export function canRebindDestinationVersion(
  state: DeliveryState,
  current: ResolvedDestination,
  next: ResolvedDestination,
): boolean {
  return (
    state.channel !== "in_app" &&
    state.eligibility === "eligible" &&
    (state.status === "pending" || state.status === "retry_wait") &&
    (state.providerOutcome === "none" || state.providerOutcome === "retryable_failure") &&
    isValidResolvedDestination(current) &&
    isValidResolvedDestination(next) &&
    current.stableDestinationId === next.stableDestinationId
  );
}

/** Compares every immutable rendering/version field used by retries. */
export function sameFrozenRenderIdentity(
  current: FrozenRenderIdentity,
  next: FrozenRenderIdentity,
): boolean {
  return (
    current.templateVersion === next.templateVersion &&
    current.locale === next.locale &&
    current.variableSchemaVersion === next.variableSchemaVersion &&
    current.payloadHash === next.payloadHash
  );
}

const unchanged = (state: DeliveryState): DeliveryTransition => ({ state, anomaly: null });

function transitionEligibility(
  current: DeliveryState,
  fact: Extract<DeliveryFact, { kind: "expired" | "suppressed" | "cancelled" }>,
): DeliveryTransition {
  if (current.eligibility !== "eligible") return unchanged(current);
  const status =
    current.status === "delivered" || current.status === "failed_permanent"
      ? current.status
      : fact.kind;
  return { state: { ...current, status, eligibility: fact.kind }, anomaly: null };
}

function transitionProviderReceipt(
  current: DeliveryState,
  fact: Extract<DeliveryFact, { kind: "provider_receipt" }>,
): DeliveryTransition {
  if (current.channel === "in_app") return unchanged(current);
  if (
    (current.providerOutcome === "delivered" && fact.outcome === "permanent_failure") ||
    (current.providerOutcome === "permanent_failure" && fact.outcome === "delivered")
  ) {
    return { state: current, anomaly: "conflicting_terminal_provider_outcome" };
  }
  if (
    current.providerOutcome === "delivered" ||
    (current.providerOutcome === "permanent_failure" && fact.outcome !== "permanent_failure")
  ) {
    return unchanged(current);
  }

  const status =
    current.eligibility !== "eligible"
      ? current.status
      : fact.outcome === "delivered"
        ? "delivered"
        : fact.outcome === "accepted"
          ? "accepted"
          : "failed_permanent";
  return {
    state: {
      ...current,
      status,
      providerOutcome: fact.outcome,
      ...(fact.providerMessageId ? { providerMessageId: fact.providerMessageId } : {}),
    },
    anomaly: null,
  };
}

function transitionProcessingFact(current: DeliveryState, fact: DeliveryFact): DeliveryTransition {
  if (current.eligibility !== "eligible") return unchanged(current);
  if (fact.kind === "accepted") {
    return {
      state: {
        ...current,
        status: "accepted",
        providerOutcome: "accepted",
        ...(fact.providerMessageId ? { providerMessageId: fact.providerMessageId } : {}),
      },
      anomaly: null,
    };
  }
  if (fact.kind === "retryable_failure") {
    return {
      state: {
        ...current,
        status: "retry_wait",
        providerOutcome: "retryable_failure",
        errorCode: fact.errorCode,
      },
      anomaly: null,
    };
  }
  if (fact.kind === "permanent_failure") {
    return {
      state: {
        ...current,
        status: "failed_permanent",
        providerOutcome: "permanent_failure",
        errorCode: fact.errorCode,
      },
      anomaly: null,
    };
  }
  if (fact.kind === "unknown") {
    return {
      state: {
        ...current,
        status: "unknown",
        providerOutcome: "unknown",
        ...(fact.errorCode ? { errorCode: fact.errorCode } : {}),
      },
      anomaly: null,
    };
  }
  return unchanged(current);
}

export function isValidNotificationOperationalLimits(
  value: unknown,
): value is NotificationOperationalLimits {
  if (!value || typeof value !== "object") return false;
  const expectedKeys = [
    "version",
    "maxBatchSize",
    "maxConcurrent",
    "maxAttempts",
    "leaseMs",
    "receiptDeadlineMs",
    "baseBackoffMs",
    "maxBackoffMs",
    "jitterRatio",
  ];
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    return false;
  }
  const limits = value as Partial<NotificationOperationalLimits>;
  if (
    limits.version !== "g4-limits-v1" ||
    typeof limits.maxBatchSize !== "number" ||
    typeof limits.maxConcurrent !== "number" ||
    typeof limits.maxAttempts !== "number" ||
    typeof limits.leaseMs !== "number" ||
    typeof limits.receiptDeadlineMs !== "number" ||
    typeof limits.baseBackoffMs !== "number" ||
    typeof limits.maxBackoffMs !== "number" ||
    typeof limits.jitterRatio !== "number"
  ) {
    return false;
  }
  const positiveSafeIntegers = [
    limits.maxBatchSize,
    limits.maxConcurrent,
    limits.maxAttempts,
    limits.leaseMs,
    limits.receiptDeadlineMs,
    limits.baseBackoffMs,
    limits.maxBackoffMs,
  ];
  return (
    positiveSafeIntegers.every((part) => Number.isSafeInteger(part) && part > 0) &&
    limits.maxConcurrent <= limits.maxBatchSize &&
    limits.maxBackoffMs >= limits.baseBackoffMs &&
    Number.isFinite(limits.jitterRatio) &&
    limits.jitterRatio >= 0 &&
    limits.jitterRatio <= 1
  );
}

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && typeof value === "number" && value >= 0;

/**
 * Convex `v.number()` also accepts NaN and infinities. Check every delivery
 * timestamp and counter with this contract before inserting or patching a row.
 */
export function isValidNotificationDeliveryRecord(
  value: unknown,
): value is NotificationDeliveryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<NotificationDeliveryRecord>;
  const requiredTimestamps = [record.notBefore, record.createdAt, record.updatedAt];
  const optionalTimestamps = [
    record.expiresAt,
    record.nextAttemptAt,
    record.leaseUntil,
    record.dispatchStartedAt,
    record.nextReceiptCheckAt,
    record.reviewAt,
  ];
  if (
    !requiredTimestamps.every(isNonNegativeSafeInteger) ||
    optionalTimestamps.some(
      (timestamp) => timestamp !== undefined && !isNonNegativeSafeInteger(timestamp),
    ) ||
    !isNonNegativeSafeInteger(record.attemptCount) ||
    !isNonNegativeSafeInteger(record.claimGeneration) ||
    typeof record.eventId !== "string" ||
    record.eventId.length === 0 ||
    typeof record.recipientUserId !== "string" ||
    record.recipientUserId.length === 0 ||
    typeof record.stableDestinationId !== "string" ||
    record.stableDestinationId.length === 0 ||
    typeof record.logicalKey !== "string" ||
    record.logicalKey.length === 0 ||
    !record.renderIdentity ||
    typeof record.renderIdentity !== "object" ||
    !isValidFrozenRenderIdentity(record.renderIdentity)
  ) {
    return false;
  }
  return isValidDeliveryState({
    channel: record.channel as NotificationDeliveryChannel,
    status: record.state as DeliveryStatus,
    eligibility: record.eligibility as DeliveryEligibility,
    providerOutcome: record.providerOutcome as ProviderOutcome,
    providerMessageId: record.providerMessageId,
    errorCode: record.errorCode,
  });
}

/** Checked boundary for writes to `notificationDeliveries`. */
export function assertValidNotificationDeliveryRecord(
  record: NotificationDeliveryRecord,
): NotificationDeliveryRecord {
  if (!isValidNotificationDeliveryRecord(record)) {
    throw new Error("Notification delivery record has invalid fields or numeric bounds");
  }
  return record;
}

/** Checked numeric boundary before inserting a delivery-attempt row. */
export function assertValidNotificationDeliveryAttemptNumbers(
  attempt: NotificationDeliveryAttemptRecord,
): void {
  if (
    !Number.isSafeInteger(attempt.attemptOrdinal) ||
    attempt.attemptOrdinal <= 0 ||
    !Number.isSafeInteger(attempt.claimGeneration) ||
    attempt.claimGeneration <= 0 ||
    !isNonNegativeSafeInteger(attempt.startedAt) ||
    (attempt.completedAt !== undefined &&
      (!isNonNegativeSafeInteger(attempt.completedAt) ||
        attempt.completedAt < attempt.startedAt))
  ) {
    throw new Error("Notification delivery attempt has invalid numeric bounds");
  }
}

export type RetryDeadline =
  | { kind: "retry"; dueAt: number }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | { kind: "invalid" };

export function calculateRetryDeadline(args: {
  now: number;
  attemptCount: number;
  jitterFactor: number;
  retryAfterMs?: number;
  expiresAt?: number;
  limits: NotificationOperationalLimits;
}): RetryDeadline {
  const { now, attemptCount, jitterFactor, retryAfterMs, expiresAt, limits } = args;
  if (
    !isValidNotificationOperationalLimits(limits) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1 ||
    !Number.isFinite(jitterFactor) ||
    jitterFactor < 0 ||
    jitterFactor > 1 ||
    (retryAfterMs !== undefined &&
      (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 0)) ||
    (expiresAt !== undefined && (!Number.isSafeInteger(expiresAt) || expiresAt < 0))
  ) {
    return { kind: "invalid" };
  }
  if (expiresAt !== undefined && expiresAt <= now) return { kind: "expired" };
  if (attemptCount >= limits.maxAttempts) return { kind: "exhausted" };

  const exponential = Math.min(
    limits.maxBackoffMs,
    limits.baseBackoffMs * 2 ** Math.min(attemptCount - 1, 52),
  );
  const jitterMultiplier = 1 + (2 * jitterFactor - 1) * limits.jitterRatio;
  const jittered = Math.min(limits.maxBackoffMs, Math.floor(exponential * jitterMultiplier));
  const delay = Math.max(jittered, retryAfterMs ?? 0);
  const dueAt = now + delay;
  if (!Number.isSafeInteger(dueAt)) return { kind: "invalid" };
  if (expiresAt !== undefined && dueAt >= expiresAt) return { kind: "expired" };
  return { kind: "retry", dueAt };
}

export function normalizeNotificationAdapterResult(
  result: NotificationAdapterResult,
): NotificationAdapterResult {
  if (
    result.kind === "retryable_failure" &&
    result.retryAfterMs !== undefined &&
    (!Number.isSafeInteger(result.retryAfterMs) || result.retryAfterMs < 0)
  ) {
    return { kind: "unknown", errorCode: result.errorCode };
  }
  if (result.kind === "accepted" && result.providerMessageId === "") {
    return { kind: "unknown" };
  }
  return result;
}

export type FencedDeliveryTransition = DeliveryTransition & { applied: boolean };

export function transitionDeliveryStateFenced(
  current: DeliveryState,
  args: {
    expectedGeneration: number;
    currentGeneration: number;
    fact: DeliveryFact;
  },
): FencedDeliveryTransition {
  if (
    !Number.isSafeInteger(args.expectedGeneration) ||
    args.expectedGeneration < 0 ||
    !Number.isSafeInteger(args.currentGeneration) ||
    args.currentGeneration < 0 ||
    args.expectedGeneration !== args.currentGeneration
  ) {
    return { applied: false, state: current, anomaly: null };
  }
  const transition = transitionDeliveryState(current, args.fact);
  return {
    ...transition,
    applied: transition.state !== current || transition.anomaly !== null,
  };
}

export type ClaimInAppResult =
  | { kind: "claimed"; record: NotificationDeliveryRecord }
  | { kind: "stale_generation" }
  | { kind: "external_channel_denied" }
  | { kind: "invalid_limits" }
  | { kind: "invalid_time" }
  | { kind: "not_claimable" }
  | { kind: "not_due" }
  | { kind: "expired"; record: NotificationDeliveryRecord }
  | { kind: "attempts_exhausted"; record: NotificationDeliveryRecord };

export function claimInAppDelivery(
  record: NotificationDeliveryRecord,
  args: {
    expectedGeneration: number;
    now: number;
    limits: NotificationOperationalLimits;
  },
): ClaimInAppResult {
  if (record.channel !== "in_app") return { kind: "external_channel_denied" };
  if (!isValidNotificationOperationalLimits(args.limits)) return { kind: "invalid_limits" };
  if (
    !Number.isSafeInteger(args.now) ||
    args.now < 0 ||
    !Number.isSafeInteger(args.expectedGeneration) ||
    args.expectedGeneration < 0 ||
    !Number.isSafeInteger(record.claimGeneration) ||
    record.claimGeneration < 0 ||
    !Number.isSafeInteger(record.attemptCount) ||
    record.attemptCount < 0 ||
    !Number.isSafeInteger(record.notBefore) ||
    record.notBefore < 0 ||
    (record.expiresAt !== undefined &&
      (!Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0)) ||
    (record.nextAttemptAt !== undefined &&
      (!Number.isSafeInteger(record.nextAttemptAt) || record.nextAttemptAt < 0))
  ) {
    return { kind: "invalid_time" };
  }
  if (record.claimGeneration !== args.expectedGeneration) return { kind: "stale_generation" };
  if (
    record.eligibility !== "eligible" ||
    (record.state !== "pending" && record.state !== "retry_wait")
  ) {
    return { kind: "not_claimable" };
  }
  if (record.expiresAt !== undefined && record.expiresAt <= args.now) {
    return {
      kind: "expired",
      record: {
        ...record,
        state: "expired",
        eligibility: "expired",
        updatedAt: args.now,
        leaseUntil: undefined,
      },
    };
  }
  const dueAt = Math.max(record.notBefore, record.nextAttemptAt ?? record.notBefore);
  if (!Number.isSafeInteger(dueAt) || args.now < dueAt) return { kind: "not_due" };
  if (record.attemptCount >= args.limits.maxAttempts) {
    return {
      kind: "attempts_exhausted",
      record: {
        ...record,
        state: "failed_permanent",
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        leaseUntil: undefined,
        updatedAt: args.now,
      },
    };
  }
  if (record.claimGeneration >= Number.MAX_SAFE_INTEGER || args.now + args.limits.leaseMs > Number.MAX_SAFE_INTEGER) {
    return { kind: "invalid_time" };
  }
  const { nextAttemptAt: _nextAttemptAt, ...claimable } = record;
  return {
    kind: "claimed",
    record: {
      ...claimable,
      state: "processing",
      providerOutcome: record.providerOutcome,
      attemptCount: record.attemptCount + 1,
      claimGeneration: record.claimGeneration + 1,
      leaseUntil: args.now + args.limits.leaseMs,
      dispatchStartedAt: undefined,
      updatedAt: args.now,
    },
  };
}

export type DispatchMarkerResult =
  | { kind: "marked"; record: NotificationDeliveryRecord }
  | { kind: "stale_generation" }
  | { kind: "not_dispatchable" }
  | { kind: "already_marked" }
  | { kind: "invalid_time" };

/**
 * Future-adapter contract only: persist this marker before any external side effect.
 * Gate 4 currently has no external adapter or caller for this pure transition.
 */
export function markDeliveryDispatchStarted(
  record: NotificationDeliveryRecord,
  args: { expectedGeneration: number; now: number },
): DispatchMarkerResult {
  if (
    !Number.isSafeInteger(args.expectedGeneration) ||
    args.expectedGeneration < 0 ||
    !Number.isSafeInteger(args.now) ||
    args.now < 0 ||
    !Number.isSafeInteger(record.claimGeneration) ||
    record.claimGeneration < 0 ||
    (record.dispatchStartedAt !== undefined &&
      (!Number.isSafeInteger(record.dispatchStartedAt) ||
        record.dispatchStartedAt < 0 ||
        record.dispatchStartedAt > args.now)) ||
    (record.expiresAt !== undefined &&
      (!Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0))
  ) {
    return { kind: "invalid_time" };
  }
  if (record.claimGeneration !== args.expectedGeneration) return { kind: "stale_generation" };
  if (record.dispatchStartedAt !== undefined) return { kind: "already_marked" };
  if (
    record.channel === "in_app" ||
    record.state !== "processing" ||
    record.eligibility !== "eligible" ||
    record.leaseUntil === undefined ||
    !Number.isSafeInteger(record.leaseUntil) ||
    record.leaseUntil <= args.now ||
    (record.expiresAt !== undefined && record.expiresAt <= args.now)
  ) {
    return { kind: "not_dispatchable" };
  }
  return {
    kind: "marked",
    record: { ...record, dispatchStartedAt: args.now, updatedAt: args.now },
  };
}

export type ExpiredClaimRecovery =
  | { kind: "retry"; record: NotificationDeliveryRecord }
  | { kind: "unknown"; record: NotificationDeliveryRecord }
  | { kind: "expired"; record: NotificationDeliveryRecord }
  | { kind: "exhausted"; record: NotificationDeliveryRecord }
  | { kind: "stale_generation" }
  | { kind: "not_expired" }
  | { kind: "invalid_limits" }
  | { kind: "invalid_time" };

export function recoverExpiredDeliveryClaim(
  record: NotificationDeliveryRecord,
  args: {
    expectedGeneration: number;
    now: number;
    jitterFactor: number;
    limits: NotificationOperationalLimits;
  },
): ExpiredClaimRecovery {
  if (!isValidNotificationOperationalLimits(args.limits)) return { kind: "invalid_limits" };
  if (
    !Number.isSafeInteger(args.expectedGeneration) ||
    args.expectedGeneration < 0 ||
    !Number.isSafeInteger(args.now) ||
    args.now < 0 ||
    !Number.isFinite(args.jitterFactor) ||
    args.jitterFactor < 0 ||
    args.jitterFactor > 1 ||
    !Number.isSafeInteger(record.claimGeneration) ||
    record.claimGeneration < 0 ||
    !Number.isSafeInteger(record.attemptCount) ||
    record.attemptCount < 0 ||
    (record.expiresAt !== undefined &&
      (!Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0)) ||
    (record.dispatchStartedAt !== undefined &&
      (!Number.isSafeInteger(record.dispatchStartedAt) || record.dispatchStartedAt < 0))
  ) {
    return { kind: "invalid_time" };
  }
  if (record.claimGeneration !== args.expectedGeneration) return { kind: "stale_generation" };
  if (
    record.state !== "processing" ||
    record.eligibility !== "eligible" ||
    record.leaseUntil === undefined ||
    record.leaseUntil > args.now
  ) {
    return { kind: "not_expired" };
  }
  if (!Number.isSafeInteger(record.leaseUntil) || record.leaseUntil < 0) {
    return { kind: "invalid_time" };
  }
  if (record.dispatchStartedAt !== undefined) {
    if (args.now + args.limits.receiptDeadlineMs > Number.MAX_SAFE_INTEGER) {
      return { kind: "invalid_time" };
    }
    const pastValidity = record.expiresAt !== undefined && record.expiresAt <= args.now;
    return {
      kind: pastValidity ? "expired" : "unknown",
      record: {
        ...record,
        state: pastValidity ? "expired" : "unknown",
        eligibility: pastValidity ? "expired" : record.eligibility,
        providerOutcome: "unknown",
        nextAttemptAt: undefined,
        leaseUntil: undefined,
        reviewAt: args.now + args.limits.receiptDeadlineMs,
        updatedAt: args.now,
      },
    };
  }
  if (record.expiresAt !== undefined && record.expiresAt <= args.now) {
    return {
      kind: "expired",
      record: {
        ...record,
        state: "expired",
        eligibility: "expired",
        leaseUntil: undefined,
        updatedAt: args.now,
      },
    };
  }
  const deadline = calculateRetryDeadline({
    now: args.now,
    attemptCount: record.attemptCount,
    jitterFactor: args.jitterFactor,
    expiresAt: record.expiresAt,
    limits: args.limits,
  });
  if (deadline.kind === "invalid") return { kind: "invalid_time" };
  if (deadline.kind === "expired") {
    return {
      kind: "expired",
      record: {
        ...record,
        state: "expired",
        eligibility: "expired",
        leaseUntil: undefined,
        updatedAt: args.now,
      },
    };
  }
  if (deadline.kind === "exhausted") {
    return {
      kind: "exhausted",
      record: {
        ...record,
        state: "failed_permanent",
        errorCode: "attempts_exhausted",
        nextAttemptAt: undefined,
        leaseUntil: undefined,
        updatedAt: args.now,
      },
    };
  }
  return {
    kind: "retry",
    record: {
      ...record,
      state: "retry_wait",
      nextAttemptAt: deadline.dueAt,
      dispatchStartedAt: undefined,
      leaseUntil: undefined,
      updatedAt: args.now,
    },
  };
}

/** Applies one durable work or provider fact without allowing outcome regression or resurrection. */
export function transitionDeliveryState(
  current: DeliveryState,
  fact: DeliveryFact,
): DeliveryTransition {
  if (fact.kind === "claim") {
    return current.eligibility === "eligible" &&
      (current.status === "pending" || current.status === "retry_wait")
      ? { state: { ...current, status: "processing" }, anomaly: null }
      : unchanged(current);
  }
  if (fact.kind === "in_app_persisted") {
    return current.channel === "in_app" &&
      current.status === "processing" &&
      current.eligibility === "eligible"
      ? { state: { ...current, status: "delivered" }, anomaly: null }
      : unchanged(current);
  }
  if (fact.kind === "expired" || fact.kind === "suppressed" || fact.kind === "cancelled") {
    return transitionEligibility(current, fact);
  }
  if (fact.kind === "provider_receipt") return transitionProviderReceipt(current, fact);
  if (current.channel === "in_app" || current.status !== "processing") return unchanged(current);
  return transitionProcessingFact(current, fact);
}
