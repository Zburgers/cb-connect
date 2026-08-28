import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("safe cycle-state seed updates", () => {
  test("reconciles every matching pain row idempotently", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 51; i += 1) {
        await ctx.db.insert("painTips", {
          phase: "ovulation",
          painSeverity: "none",
          title: `Unsafe phase tip ${i}`,
          suggestions: ["Energy and mood may peak during this phase"],
          safetyNote: "Normal phase - no concerns.",
          isActive: true,
          priority: 1,
        });
      }
    });

    await t.mutation(api.seed.seedPainTips, {});
    const countAfterFirstRun = await t.run(async (ctx) =>
      (await ctx.db.query("painTips").collect()).length
    );
    await t.mutation(api.seed.seedPainTips, {});
    const countAfterSecondRun = await t.run(async (ctx) =>
      (await ctx.db.query("painTips").collect()).length
    );

    const matching = await t.run(async (ctx) =>
      await ctx.db
        .query("painTips")
        .withIndex("by_phase_and_severity", (q) =>
          q.eq("phase", "ovulation")
            .eq("painSeverity", "none")
            .eq("isActive", true)
        )
        .collect()
    );

    expect(countAfterSecondRun).toBe(countAfterFirstRun);
    expect(matching).toHaveLength(51);
    expect(matching.every((tip) =>
      tip.title === "Mid-Cycle Support" &&
      tip.safetyNote === "Calendar timing is an estimate and does not confirm ovulation."
    )).toBe(true);
  });

  test("reconciles every matching nutrition row idempotently", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 51; i += 1) {
        await ctx.db.insert("nutritionTips", {
          phase: "ovulation",
          foodItem: "Berries",
          reasoning: `Unsafe nutrition tip ${i}`,
          isActive: true,
          priority: 1,
        });
      }
    });

    await t.mutation(api.seed.seedNutritionTips, {});
    const countAfterFirstRun = await t.run(async (ctx) =>
      (await ctx.db.query("nutritionTips").collect()).length
    );
    await t.mutation(api.seed.seedNutritionTips, {});
    const countAfterSecondRun = await t.run(async (ctx) =>
      (await ctx.db.query("nutritionTips").collect()).length
    );

    const matching = await t.run(async (ctx) =>
      await ctx.db
        .query("nutritionTips")
        .withIndex("by_phase", (q) =>
          q.eq("phase", "ovulation").eq("isActive", true)
        )
        .filter((q) => q.eq(q.field("foodItem"), "Berries"))
        .collect()
    );

    expect(countAfterSecondRun).toBe(countAfterFirstRun);
    expect(matching).toHaveLength(51);
    expect(matching.every((tip) =>
      tip.reasoning === "A colorful addition to a varied diet"
    )).toBe(true);
  });
});
