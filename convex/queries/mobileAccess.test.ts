import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

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
