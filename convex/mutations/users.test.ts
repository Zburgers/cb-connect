import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

describe("user role onboarding", () => {
  test("allows the first role selection for an unlinked user", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, {
      clerkId: "first-role-user",
      name: "First Role User",
      role: "primary",
    });
    await t.run(async (ctx) => ctx.db.patch(userId, { role: undefined }));

    await expect(
      t.withIdentity({ subject: "first-role-user" }).mutation(
        api.mutations.users.updateUserRole,
        { role: "partner" },
      ),
    ).resolves.toBe(userId);
  });

  test("rejects changing a role after onboarding", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "onboarded-user",
      name: "Onboarded User",
      role: "primary",
    });

    await expect(
      t.withIdentity({ subject: "onboarded-user" }).mutation(
        api.mutations.users.updateUserRole,
        { role: "partner" },
      ),
    ).rejects.toThrow("Role can only be selected during onboarding");
  });

  test("does not permit a role change for a member missing legacy role state", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, primaryId } = await seedActiveCouple(t);
    await t.run(async (ctx) => ctx.db.patch(primaryId, { role: undefined }));

    await expect(
      asPrimary.mutation(api.mutations.users.updateUserRole, {
        role: "partner",
      }),
    ).rejects.toThrow("Role cannot be changed after joining a couple");
  });
});
