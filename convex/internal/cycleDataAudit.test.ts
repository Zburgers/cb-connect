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
      endDate: "2026-01-02",
      startCertainty: "exact",
      endCertainty: "exact",
      authorityVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-10",
      endDate: "2026-01-11",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-01-20",
      endDate: "2026-01-24",
      startCertainty: "exact",
      source: "system",
      authorityVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    for (const [startDate, endDate, legacyReason] of [
      ["2026-01-01", "2026-01-02", undefined],
      ["2026-01-20", "2026-01-22", undefined],
      ["2026-03-01", "2026-03-05", "unprovable"],
    ] as const) {
      await ctx.db.insert("periodEvents", {
        userId,
        startDate,
        ...(endDate ? { endDate } : {}),
        startCertainty: "legacy_unknown",
        ...(legacyReason ? { legacyReason } : {}),
        authorityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-02-10",
      endDate: "2026-02-14",
      startCertainty: "exact",
      endCertainty: "exact",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-02-12",
      endDate: "2026-02-13",
      startCertainty: "legacy_unknown",
      legacyReason: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      startCertainty: "exact",
      endCertainty: "exact",
      source: "system",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

describe("bounded cycle data audit", () => {
  test("expires closed work by end date while retaining open work", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        clerkId: "audit-end-index",
        email: "audit-end-index@example.test",
        name: "Audit End Index",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })
    );
    await t.run(async (ctx) => {
      for (const [startDate, endDate] of [
        ["2026-01-01", "2026-01-02"],
        ["2026-01-10", "2026-01-11"],
        ["2026-02-01", undefined],
        ["2026-02-02", undefined],
      ] as const) {
        await ctx.db.insert("periodEvents", {
          userId,
          startDate,
          ...(endDate ? { endDate } : {}),
          startCertainty: "exact",
          ...(endDate ? { endCertainty: "exact" as const } : {}),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    await t.mutation(internal.internal.cycleDataAudit.start, {
      runId: "cycle-audit-end-index",
    });
    let cursor: string | null = null;
    let result;
    do {
      result = await t.mutation(internal.internal.cycleDataAudit.scanPage, {
        runId: "cycle-audit-end-index",
        paginationOpts: { numItems: 100, cursor },
      });
      cursor = result.cursor;
    } while (!result.isComplete);

    const workRows = await t.run(async (ctx) =>
      ctx.db
        .query("cycleFactScanRows")
        .withIndex("by_run_user_end", (q) =>
          q.eq("runType", "audit")
            .eq("runId", "cycle-audit-end-index")
            .eq("userId", userId)
            .eq("active", true)
        )
        .collect()
    );
    expect(
      workRows.find((row) => row.startDate === "2026-01-10")
    ).not.toHaveProperty("classificationReason");
    expect(
      workRows.find((row) => row.startDate === "2026-02-02")
    ).toMatchObject({ classificationReason: "overlap" });
    expect(
      await t.query(internal.internal.cycleDataAudit.getProgress, {
        runId: "cycle-audit-end-index",
      })
    ).toEqual(result);
  });

  test("derives conflicts from raw rows after the first page", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        clerkId: "audit-late-conflicts",
        email: "audit-late-conflicts@example.test",
        name: "Audit Late Conflicts",
        role: "primary",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })
    );
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index++) {
        await ctx.db.insert("periodEvents", {
          userId,
          startDate: `2026-01-${String(index + 1).padStart(3, "0")}`,
          endDate: `2026-01-${String(index + 1).padStart(3, "0")}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-001",
        endDate: "2026-02-002",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-001",
        endDate: "2026-02-003",
        legacyReason: "duplicate",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-010",
        endDate: "2026-02-012",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-011",
        endDate: "2026-02-013",
        legacyReason: "overlap",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.internal.cycleDataAudit.start, {
      runId: "cycle-audit-late-conflicts",
    });
    let cursor: string | null = null;
    let result;
    do {
      result = await t.mutation(internal.internal.cycleDataAudit.scanPage, {
        runId: "cycle-audit-late-conflicts",
        paginationOpts: { numItems: 100, cursor },
      });
      cursor = result.cursor;
    } while (!result.isComplete);

    expect(result.suppressedCounts.duplicate).toBe("<5");
    expect(result.suppressedCounts.overlap).toBe("<5");
  });

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
