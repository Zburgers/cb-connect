import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple, seedUser } from "../test.fixtures";

test("guard query reflects current backend role and relationship revocation", async () => {
  const t = convexTest(schema, modules);
  const { asPrimary, asPartner } = await seedActiveCouple(t);

  await expect(asPrimary.query(api.queries.mobileAccess.getGuardState, {})).resolves.toEqual({
    user: { role: "primary" },
    couple: { isLinked: true, role: "primary" },
  });
  await expect(asPartner.query(api.queries.mobileAccess.getGuardState, {})).resolves.toEqual({
    user: { role: "partner" },
    couple: { isLinked: true, role: "partner" },
  });

  await asPrimary.mutation(api.mutations.couples.revokePartnerAccess, {});

  await expect(asPartner.query(api.queries.mobileAccess.getGuardState, {})).resolves.toEqual({
    user: { role: "partner" },
    couple: { isLinked: false, role: null },
  });
});

test("pending invitation does not unlock linked-only mobile routes", async () => {
  const testBackend = convexTest(schema, modules);
  const primaryId = await seedUser(testBackend, {
    clerkId: "unpaired-primary",
    name: "Unpaired Primary",
    role: "primary",
  });
  const asPrimary = testBackend.withIdentity({ subject: "unpaired-primary" });
  const unlinked = {
    user: { role: "primary" },
    couple: { isLinked: false, role: null },
  };

  await expect(asPrimary.query(api.queries.mobileAccess.getGuardState, {})).resolves.toEqual(unlinked);

  await testBackend.run(async (ctx) => {
    const coupleId = await ctx.db.insert("couples", {
      createdAt: Date.now(),
      status: "pending",
    });
    await ctx.db.insert("coupleMembers", {
      coupleId,
      userId: primaryId,
      role: "primary",
      sharingPain: false,
      sharingPhase: false,
      sharingPeriodWrite: false,
      joinedAt: Date.now(),
    });
  });

  await expect(asPrimary.query(api.queries.mobileAccess.getGuardState, {})).resolves.toEqual(unlinked);
});
