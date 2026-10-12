import { describe, expect, test } from "vitest";

import { notificationEventDefinitions, notificationEventTypes } from "./notificationTypes";
import {
  isValidFrozenNotificationPayload,
  notificationInboxRoutes,
  notificationTemplateBodyKeys,
  notificationTemplateTitleKeys,
  sameFrozenRenderIdentity,
} from "./notificationDelivery";
import {
  notificationTemplateCatalog,
  renderFrozen,
  type NotificationTemplateVersion,
} from "./notificationTemplates";

const baseArgs = {
  eventType: "partner_message.v1",
  templateVersion: "g4-static-v1",
  locale: "en",
  variableSchemaVersion: "g4-no-variables-v1",
} as const;

const templateVersions: readonly NotificationTemplateVersion[] = ["g4-static-v1", "g4-static-v2"];

describe("G4 frozen notification templates", () => {
  test("has exactly one render or D-011 gate for every catalog event in each immutable version", () => {
    for (const version of templateVersions) {
      const templates = notificationTemplateCatalog[version];
      expect(Object.keys(templates)).toEqual([...notificationEventTypes]);

      for (const eventType of notificationEventTypes) {
        const template = templates[eventType];
        const privacyClass = notificationEventDefinitions[eventType].privacyClass;

        if (privacyClass.startsWith("primary_private_")) {
          expect(template).toEqual({ status: "blocked_d011" });
          expect(template).not.toHaveProperty("titleKey");
          expect(template).not.toHaveProperty("bodyKey");
          expect(template).not.toHaveProperty("route");
          continue;
        }

        expect(template.status).toBe("renderable");
        if (template.status !== "renderable") continue;
        expect(notificationTemplateTitleKeys).toContain(template.titleKey);
        expect(notificationTemplateBodyKeys).toContain(template.bodyKey);
        expect(notificationInboxRoutes).toContain(template.route);
      }
    }
  });

  test("retries the original frozen version unchanged after a newer version is available", async () => {
    const original = await renderFrozen(baseArgs);
    const newer = await renderFrozen({ ...baseArgs, templateVersion: "g4-static-v2" });
    const retry = await renderFrozen(baseArgs);

    expect(retry).toEqual(original);
    expect(newer.identity.templateVersion).toBe("g4-static-v2");
    expect(newer.payload).toEqual(original.payload);
    expect(sameFrozenRenderIdentity(original.identity, newer.identity)).toBe(false);
  });

  test("accepts only the reviewed English locale and freezes schema in render identity", async () => {
    const original = await renderFrozen(baseArgs);
    const changedSchema = await renderFrozen({
      ...baseArgs,
      variableSchemaVersion: "g4-no-variables-v2",
    });
    const changedPayload = await renderFrozen({ ...baseArgs, eventType: "partner_nudge.v1" });

    expect(original.identity.locale).toBe("en");
    for (const locale of ["en-GB", "fr", "zz-ZZ"]) {
      await expect(renderFrozen({ ...baseArgs, locale })).rejects.toThrow(
        /unsupported notification locale/i,
      );
    }

    expect(changedSchema.identity.variableSchemaVersion).toBe("g4-no-variables-v2");
    expect(sameFrozenRenderIdentity(original.identity, changedSchema.identity)).toBe(false);
    expect(changedSchema.identity.payloadHash).toBe(original.identity.payloadHash);

    expect(changedPayload.payload).not.toEqual(original.payload);
    expect(changedPayload.identity.payloadHash).not.toBe(original.identity.payloadHash);
    expect(isValidFrozenNotificationPayload(changedPayload.payload)).toBe(true);
    expect(Object.keys(changedPayload.payload).sort()).toEqual(["bodyKey", "route", "titleKey"]);
  });

  test("rejects caller variables and never returns sensitive-token fixtures", async () => {
    const tokens = [
      "SYNTHETIC_MESSAGE_BODY_TOKEN_41",
      "SYNTHETIC_PAIN_SCORE_TOKEN_73",
      "SYNTHETIC_CYCLE_DATE_TOKEN_2026_10_04",
      "SYNTHETIC_CLERK_ID_TOKEN_USER_9",
      "SYNTHETIC_AUTH_TOKEN_DO_NOT_USE_82",
    ];
    const injectedArgs = {
      ...baseArgs,
      messageBody: tokens[0],
      painScore: tokens[1],
      cycleDate: tokens[2],
      clerkUserId: tokens[3],
      authToken: tokens[4],
    };

    await expect(renderFrozen(injectedArgs as never)).rejects.toThrow(/unexpected render argument/i);

    const result = await renderFrozen(baseArgs);
    const serialized = JSON.stringify(result);
    for (const token of tokens) expect(serialized).not.toContain(token);
  });

  test("keeps every health-adjacent and Late render blocked until D-011 approval", async () => {
    const gatedTypes = notificationEventTypes.filter((eventType) =>
      notificationEventDefinitions[eventType].privacyClass.startsWith("primary_private_"),
    );

    for (const eventType of gatedTypes) {
      await expect(renderFrozen({ ...baseArgs, eventType })).rejects.toThrow(/D-011/);
    }
  });
});
