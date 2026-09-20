import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

test("external notification consent reads current primary preference", async () => {
  const t = convexTest(schema, modules);
  const { primaryId, partnerId } = await seedActiveCouple(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(primaryId, { externalNotificationConsent: true });
    await ctx.db.patch(partnerId, { externalNotificationConsent: true });
  });

  expect(
    await t.query(internal.queries.users.hasExternalNotificationConsent, {
      userId: primaryId,
    }),
  ).toBe(true);
  expect(
    await t.query(internal.queries.users.hasExternalNotificationConsent, {
      userId: partnerId,
    }),
  ).toBe(false);

  await t.run(async (ctx) => {
    await ctx.db.patch(primaryId, { externalNotificationConsent: false });
  });

  expect(
    await t.query(internal.queries.users.hasExternalNotificationConsent, {
      userId: primaryId,
    }),
  ).toBe(false);
});

test("notification log preview redacts stored message content", async () => {
  const t = convexTest(schema, modules);
  const { asPrimary, primaryId } = await seedActiveCouple(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("notificationLog", {
      userId: primaryId,
      type: "period_prediction",
      payload: {
        message: "Your period is predicted to start on 2026-09-21.",
      },
      sentAt: Date.now(),
      status: "sent",
    });
  });

  const [entry] = await asPrimary.query(api.queries.users.getMyNotificationLog, {
    limit: 5,
  });

  expect(entry?.payloadPreview).toEqual({
    kind: "object",
    keys: ["message"],
    message: "[redacted]",
  });
  expect(JSON.stringify(entry)).not.toContain("2026-09-21");
});
