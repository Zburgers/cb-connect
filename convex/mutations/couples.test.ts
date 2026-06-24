import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedActiveCouple } from "../test.fixtures";

describe("assisted period sharing settings", () => {
  test("turning off phase visibility also disables assisted logging", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary, coupleId } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    await asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
      sharingPhase: false,
    });

    const primaryMembership = await t.run(async (ctx) => {
      return await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleId).eq("role", "primary")
        )
        .unique();
    });

    expect(primaryMembership).toMatchObject({
      sharingPhase: false,
      sharingPeriodWrite: false,
    });
  });

  test("assisted logging cannot be enabled while phase visibility is off", async () => {
    const t = convexTest(schema, modules);
    const { asPrimary } = await seedActiveCouple(t, {
      sharingPhase: false,
    });

    await expect(
      asPrimary.mutation(api.mutations.couples.updateSharingSettings, {
        sharingPeriodWrite: true,
      })
    ).rejects.toThrow("Turn on period visibility first");
  });

  test("partner sees the primary member's assisted logging permission", async () => {
    const t = convexTest(schema, modules);
    const { asPartner } = await seedActiveCouple(t, {
      sharingPhase: true,
      sharingPeriodWrite: true,
    });

    const status = await asPartner.query(api.queries.couples.getCoupleStatus, {});

    expect(status.sharingSettings).toEqual({
      pain: false,
      phase: true,
      periodWrite: true,
    });
  });
});
