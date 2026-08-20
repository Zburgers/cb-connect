import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const runId = "cycle-audit-test";

async function seedAuditRows(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: "audit-primary",
      email: "audit-primary@example.test",
      name: "Audit Primary",
      role: "primary",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    })
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-01",
      startCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-02",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-03",
      endDate: "2026-01-07",
      startCertainty: "exact",
      source: "system",
      authorityVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    for (const [startDate, legacyReason] of [
      ["2026-01-04", "duplicate"],
      ["2026-01-05", "overlap"],
      ["2026-01-06", "unprovable"],
    ] as const) {
      await ctx.db.insert("periodEvents", {
        userId,
        startDate,
        startCertainty: "legacy_unknown",
        legacyReason,
        authorityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  });
}

describe("bounded cycle data audit", () => {
  test("returns only suppressed reason counts, cursor, and completion", async () => {
    const t = convexTest(schema, modules);
    await seedAuditRows(t);

    await t.mutation(internal.internal.cycleDataAudit.start, { runId });
    const result = await t.mutation(internal.internal.cycleDataAudit.scanPage, {
      runId,
      paginationOpts: { numItems: 100, cursor: null },
    });

    expect(result).toMatchObject({
      suppressedCounts: {
        missing_provenance: "<5",
        inferred_end: "<5",
        duplicate: "<5",
        overlap: "<5",
        unprovable: "<5",
      },
      isComplete: true,
    });
    expect(Object.keys(result).sort()).toEqual([
      "cursor",
      "isComplete",
      "suppressedCounts",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /audit-primary|2026-01|example\.test|Audit Primary/
    );
  });

  test("caps each scan page at 100 rows", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        clerkId: "audit-bounded",
        email: "audit-bounded@example.test",
        name: "Audit Bounded",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })
    );
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index++) {
        await ctx.db.insert("periodEvents", {
          userId,
          startDate: `2026-02-${String(index + 1).padStart(2, "0")}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    await t.mutation(internal.internal.cycleDataAudit.start, {
      runId: "cycle-audit-bounded",
    });
    const result = await t.mutation(
      internal.internal.cycleDataAudit.scanPage,
      {
        runId: "cycle-audit-bounded",
        paginationOpts: { numItems: 500, cursor: null },
      }
    );

    expect(result.isComplete).toBe(false);
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("cycleDataAuditRuns")
          .withIndex("by_run_id", (q) =>
            q.eq("runId", "cycle-audit-bounded")
          )
          .unique()
      )
    ).toMatchObject({ processedCount: 100 });
  });
});
