import {
  isValidFrozenNotificationPayload,
  notificationInboxRoutes,
  notificationTemplateBodyKeys,
  notificationTemplateTitleKeys,
  type FrozenNotificationPayload,
  type RenderFrozenArgs,
  type RenderFrozenResult,
} from "./notificationDelivery";
import { notificationEventTypes, type NotificationEventType } from "./notificationTypes";

export const notificationTemplateVersions = ["g4-static-v1", "g4-static-v2"] as const;
export type NotificationTemplateVersion = (typeof notificationTemplateVersions)[number];

export const notificationVariableSchemaVersions = [
  "g4-no-variables-v1",
  "g4-no-variables-v2",
] as const;

export type NotificationTemplateDefinition =
  | { readonly status: "blocked_d011" }
  | ({ readonly status: "renderable" } & FrozenNotificationPayload);

type NotificationTemplateMap = Readonly<
  Record<NotificationEventType, NotificationTemplateDefinition>
>;

const blockedByD011: NotificationTemplateDefinition = Object.freeze({
  status: "blocked_d011",
});

const versionOneCatalog = Object.freeze({
  "assisted_period_start.v1": blockedByD011,
  "assisted_period_end.v1": blockedByD011,
  "period_window_approaching.v1": blockedByD011,
  "late_status.v1": blockedByD011,
  "pain_check_in.v1": blockedByD011,
  "partner_linked.v1": Object.freeze({
    status: "renderable",
    titleKey: "g4.partner_linked.title",
    bodyKey: "g4.partner_linked.body",
    route: "settings",
  }),
  "partner_message.v1": Object.freeze({
    status: "renderable",
    titleKey: "g4.partner_message.title",
    bodyKey: "g4.partner_message.body",
    route: "messages",
  }),
  "partner_nudge.v1": Object.freeze({
    status: "renderable",
    titleKey: "g4.partner_nudge.title",
    bodyKey: "g4.partner_nudge.body",
    route: "messages",
  }),
  "partner_chat_cleared.v1": Object.freeze({
    status: "renderable",
    titleKey: "g4.partner_chat_cleared.title",
    bodyKey: "g4.partner_chat_cleared.body",
    route: "messages",
  }),
  "connected_since_updated.v1": Object.freeze({
    status: "renderable",
    titleKey: "g4.connected_since_updated.title",
    bodyKey: "g4.connected_since_updated.body",
    route: "settings",
  }),
} satisfies NotificationTemplateMap);

// Version two is an independently frozen revision with unchanged safe keys. A
// caller retrying v1 therefore never picks up a later default/version change.
const versionTwoCatalog: NotificationTemplateMap = Object.freeze({ ...versionOneCatalog });

export const notificationTemplateCatalog = Object.freeze({
  "g4-static-v1": versionOneCatalog,
  "g4-static-v2": versionTwoCatalog,
} satisfies Readonly<Record<NotificationTemplateVersion, NotificationTemplateMap>>);

const allowedArgumentKeys = [
  "eventType",
  "templateVersion",
  "locale",
  "variableSchemaVersion",
] as const;

const supportedLocale = /^[a-z]{2}(?:-[A-Z]{2})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactRenderArguments(value: unknown): value is RenderFrozenArgs {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === allowedArgumentKeys.length &&
    keys.every((key) => (allowedArgumentKeys as readonly string[]).includes(key)) &&
    allowedArgumentKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isNotificationEventType(value: unknown): value is NotificationEventType {
  return (
    typeof value === "string" &&
    (notificationEventTypes as readonly string[]).includes(value)
  );
}

function isTemplateVersion(value: unknown): value is NotificationTemplateVersion {
  return (
    typeof value === "string" &&
    (notificationTemplateVersions as readonly string[]).includes(value)
  );
}

function isVariableSchemaVersion(value: unknown): value is (typeof notificationVariableSchemaVersions)[number] {
  return (
    typeof value === "string" &&
    (notificationVariableSchemaVersions as readonly string[]).includes(value)
  );
}

function canonicalPayload(payload: FrozenNotificationPayload): string {
  return JSON.stringify({
    bodyKey: payload.bodyKey,
    route: payload.route,
    titleKey: payload.titleKey,
  });
}

async function hashPayload(payload: FrozenNotificationPayload): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is required to render frozen templates");
  }

  const bytes = new TextEncoder().encode(canonicalPayload(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

/**
 * Resolves only code-owned static keys. No event/source values or caller
 * variables cross this boundary; health-adjacent copy is suppressed pending
 * D-011 review.
 */
export async function renderFrozen(args: RenderFrozenArgs): Promise<RenderFrozenResult> {
  if (!hasExactRenderArguments(args)) {
    throw new Error("Unexpected render argument fields; caller variables are not accepted");
  }
  if (!isNotificationEventType(args.eventType)) {
    throw new Error("Unsupported notification event type");
  }
  if (!isTemplateVersion(args.templateVersion)) {
    throw new Error("Unsupported notification template version");
  }
  if (typeof args.locale !== "string" || !supportedLocale.test(args.locale)) {
    throw new Error("Unsupported notification locale");
  }
  if (!isVariableSchemaVersion(args.variableSchemaVersion)) {
    throw new Error("Unsupported notification variable schema version");
  }

  const template = notificationTemplateCatalog[args.templateVersion][args.eventType];
  if (template.status === "blocked_d011") {
    throw new Error("Notification template is gated pending D-011 approval");
  }

  const payload: FrozenNotificationPayload = Object.freeze({
    titleKey: template.titleKey,
    bodyKey: template.bodyKey,
    route: template.route,
  });
  if (
    !notificationTemplateTitleKeys.includes(payload.titleKey) ||
    !notificationTemplateBodyKeys.includes(payload.bodyKey) ||
    !notificationInboxRoutes.includes(payload.route) ||
    !isValidFrozenNotificationPayload(payload)
  ) {
    throw new Error("Notification template payload is not in the frozen allowlist");
  }

  const identity = Object.freeze({
    templateVersion: args.templateVersion,
    locale: args.locale,
    variableSchemaVersion: args.variableSchemaVersion,
    payloadHash: await hashPayload(payload),
  });
  return Object.freeze({ identity, payload });
}
