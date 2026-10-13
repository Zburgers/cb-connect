import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedUser } from "../test.fixtures";

const legacyIssuer = "https://clerk.cb.builtbynaki.tech";

test("legacy user subjects resolve only under the approved Clerk issuer", async () => {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t, {
    clerkId: "shared-clerk-subject",
    name: "Legacy Clerk User",
    role: "primary",
  });

  const legacyIdentity = await t
    .withIdentity({ subject: "shared-clerk-subject", issuer: legacyIssuer })
    .query(api.queries.users.getMe, {});
  const foreignIdentity = t.withIdentity({
    subject: "shared-clerk-subject",
    issuer: "https://other.clerk.example",
  });
  const collidingForeignIdentity = await foreignIdentity.query(
    api.queries.users.getMe,
    {},
  );

  expect(legacyIdentity?._id).toBe(userId);
  expect(collidingForeignIdentity).toBeNull();
  await expect(
    foreignIdentity.mutation(api.mutations.notifications.setMyPreference, {
      purpose: "period_window_approaching",
      inAppEnabled: true,
    }),
  ).rejects.toThrow("User not found in database");

  const preferences = await t.run((ctx) =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_purpose", (q) =>
        q.eq("userId", userId).eq("purpose", "period_window_approaching"),
      )
      .take(2),
  );
  expect(preferences).toHaveLength(0);
});

test("synthetic Clerk identities are trusted only on the approved fixture deployment", async () => {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t, {
    clerkId: "synthetic-clerk-subject",
    name: "Synthetic Clerk User",
    role: "primary",
  });
  const previousDeployment = process.env.CB_CONNECT_BACKEND_DEPLOYMENT;
  const previousCleanup = process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED;

  try {
    process.env.CB_CONNECT_BACKEND_DEPLOYMENT = "dev:hallowed-hummingbird-284";
    process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED = "true";
    const approved = await t
      .withIdentity({
        subject: "synthetic-clerk-subject",
        issuer: "https://holy-clam-29.clerk.accounts.dev",
      })
      .query(api.queries.users.getMe, {});
    expect(approved?._id).toBe(userId);

    process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED = "false";
    const cleanupDisabled = await t
      .withIdentity({
        subject: "synthetic-clerk-subject",
        issuer: "https://holy-clam-29.clerk.accounts.dev",
      })
      .query(api.queries.users.getMe, {});
    expect(cleanupDisabled).toBeNull();

    process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED = "true";
    const foreignIssuer = await t
      .withIdentity({
        subject: "synthetic-clerk-subject",
        issuer: "https://other.clerk.example",
      })
      .query(api.queries.users.getMe, {});
    expect(foreignIssuer).toBeNull();

    process.env.CB_CONNECT_BACKEND_DEPLOYMENT = "dev:another-deployment";
    const unapproved = await t
      .withIdentity({
        subject: "synthetic-clerk-subject",
        issuer: "https://holy-clam-29.clerk.accounts.dev",
      })
      .query(api.queries.users.getMe, {});
    expect(unapproved).toBeNull();
  } finally {
    if (previousDeployment === undefined) delete process.env.CB_CONNECT_BACKEND_DEPLOYMENT;
    else process.env.CB_CONNECT_BACKEND_DEPLOYMENT = previousDeployment;
    if (previousCleanup === undefined) delete process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED;
    else process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED = previousCleanup;
  }
});
