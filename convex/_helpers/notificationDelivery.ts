import { v } from "convex/values";

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

export const notificationDeliveryStateValidator = v.object({
  channel: channelValidator,
  status: deliveryStatusValidator,
  eligibility: eligibilityValidator,
  providerOutcome: providerOutcomeValidator,
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(errorCodeValidator),
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
    definitelyNotAccepted: v.boolean(),
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
  errorCode?: DeliveryErrorCode;
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
  eventId: string;
  expectedGeneration: number;
};

export type CancelSourceArgs = {
  sourceRef: string;
  reason: "source_changed" | "authority_revoked" | "preference_off" | "expired";
};

export type ReconcileUserScheduleArgs = {
  userId: string;
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
  errorCode?: DeliveryErrorCode;
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
  errorCode: v.optional(errorCodeValidator),
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
      definitelyNotAccepted: boolean;
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
    "delivered",
    "expired",
    "suppressed",
    "cancelled",
  ];
  if (state.channel === "in_app") {
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
    failed_permanent: "permanent_failure",
    unknown: "unknown",
  };
  const requiredOutcome = requiredOutcomeByStatus[state.status];
  if (requiredOutcome && state.providerOutcome !== requiredOutcome) return false;
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
        status: fact.definitelyNotAccepted ? "retry_wait" : "unknown",
        providerOutcome: fact.definitelyNotAccepted ? "retryable_failure" : "unknown",
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
