import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

test("legacy external consent cannot authorize external notifications", async () => {
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
  ).toBe(false);
  expect(
    await t.query(internal.queries.users.hasExternalNotificationConsent, {
      userId: partnerId,
    }),
  ).toBe(false);

  expect(
    (await t.query(internal.queries.users.getAllPrimaryUsers, {})).map(
      (user) => user.externalNotificationConsent,
    ),
  ).toEqual([false]);
});

test("mobile guard state exposes only the caller role and relationship link", async () => {
  const t = convexTest(schema, modules);
  const { asPrimary, asPartner } = await seedActiveCouple(t);

  const primary = await asPrimary.query(api.queries.mobileAccess.getGuardState, {});
  const partner = await asPartner.query(api.queries.mobileAccess.getGuardState, {});

  expect(primary).toEqual({
    user: { role: "primary" },
    couple: { isLinked: true, role: "primary" },
  });
  expect(partner).toEqual({
    user: { role: "partner" },
    couple: { isLinked: true, role: "partner" },
  });
  expect(JSON.stringify(primary)).not.toMatch(/email|name|sharing|pairing|clerk|private/i);
});

test("mobile guard state fails closed for missing identity, revoked links, and role mismatch", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.queries.mobileAccess.getGuardState, {})).toEqual({
    user: null,
    couple: null,
  });

  const { asPrimary, primaryId } = await seedActiveCouple(t);
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user_and_revoked_at", (q) =>
        q.eq("userId", primaryId).eq("revokedAt", undefined),
      )
      .unique();
    if (!membership) throw new Error("test membership missing");
    await ctx.db.patch(membership._id, { revokedAt: Date.now() });
  });
  expect(await asPrimary.query(api.queries.mobileAccess.getGuardState, {})).toEqual({
    user: { role: "primary" },
    couple: { isLinked: false, role: null },
  });

  const other = convexTest(schema, modules);
  const { asPrimary: mismatchedPrimary, primaryId: mismatchedId } = await seedActiveCouple(other);
  await other.run(async (ctx) => {
    await ctx.db.patch(mismatchedId, { role: "partner" });
  });
  expect(
    await mismatchedPrimary.query(api.queries.mobileAccess.getGuardState, {}),
  ).toEqual({
    user: { role: "partner" },
    couple: { isLinked: false, role: null },
  });
});

test("legacy notification history exposes only type, time, and status", async () => {
  const t = convexTest(schema, modules);
  const { asPrimary, primaryId } = await seedActiveCouple(t);
  const sentAt = Date.parse("2026-09-21T09:00:00.000Z");
  let notificationLogId!: import("../_generated/dataModel").Id<"notificationLog">;
  await t.run(async (ctx) => {
    notificationLogId = await ctx.db.insert("notificationLog", {
      userId: primaryId,
      type: "period_prediction",
      payload: {
        message: "private notification body marker",
        nested: { userName: "private name marker", date: "private date marker" },
      },
      sentAt,
      status: "sent",
      errorMessage: "private provider error marker",
    });
  });

  const [entry] = await asPrimary.query(api.queries.users.getMyNotificationLog, {
    limit: 5,
  });

  expect(entry).toEqual({ type: "period_prediction", sentAt, status: "sent" });
  expect(Object.keys(entry ?? {}).sort()).toEqual(["sentAt", "status", "type"]);
  expect(JSON.stringify(entry)).not.toContain("private");

  const stored = await t.run((ctx) => ctx.db.get("notificationLog", notificationLogId));
  expect(stored).toMatchObject({
    payload: {
      message: "private notification body marker",
      nested: { userName: "private name marker", date: "private date marker" },
    },
    errorMessage: "private provider error marker",
  });
});

test("legacy notification writes are disabled without changing existing rows", async () => {
  const t = convexTest(schema, modules);
  const { primaryId } = await seedActiveCouple(t);
  const sentAt = Date.parse("2026-09-20T09:00:00.000Z");
  await t.run(async (ctx) => {
    await ctx.db.insert("notificationLog", {
      userId: primaryId,
      type: "legacy_history",
      payload: { message: "existing row marker" },
      sentAt,
      status: "sent",
      errorMessage: "existing error marker",
    });
  });

  await expect(
    t.mutation(internal.mutations.misc.logNotification, {
      userId: primaryId,
      type: "new_legacy_write",
      payload: { message: "must never be written" },
      status: "failed",
      errorMessage: "must never be stored",
    }),
  ).rejects.toThrow("LEGACY_NOTIFICATION_LOG_DISABLED");

  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("notificationLog")
      .withIndex("by_user_and_sent_at", (q) => q.eq("userId", primaryId))
      .take(5),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    type: "legacy_history",
    payload: { message: "existing row marker" },
    sentAt,
    status: "sent",
    errorMessage: "existing error marker",
  });
});
