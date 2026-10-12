import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedUser } from "../test.fixtures";

const legacyIssuer = "https://clerk.cb.nakshatraneuratech.dev";

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
