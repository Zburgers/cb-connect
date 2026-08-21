import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const migration = internal.internal.cycleFactsMigration;

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "dev:hallowed-hummingbird-284");
  vi.stubEnv("CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT", "dev");
  vi.stubEnv(
    "CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT",
    "dev:hallowed-hummingbird-284"
  );
  vi.stubEnv("CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY", "true");
});

async function seedUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId,
      email: `${clerkId}@example.test`,
      name: "Migration User",
      role: "primary",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    })
  );
}

async function insertLegacyPeriod(
  t: ReturnType<typeof convexTest>,
  userId: Awaited<ReturnType<typeof seedUser>>,
  startDate: string,
  endDate?: string
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("periodEvents", {
      userId,
      startDate,
      ...(endDate && { endDate }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
}

describe("cycle facts migration runner", () => {
  test("does not annotate a closed non-overlap but annotates an open overlap", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-end-index");
    const ids = await t.run(async (ctx) => {
      const first = await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        startCertainty: "exact",
        endCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const second = await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-01-01",
        endDate: "2026-01-01",
        startCertainty: "exact",
        endCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const closedLater = await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-01-10",
        endDate: "2026-01-11",
        startCertainty: "exact",
        endCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const openLater = await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-01",
        startCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const openOverlap = await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-02",
        startCertainty: "exact",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { first, second, closedLater, openLater, openOverlap };
    });

    await t.mutation(migration.start, {
      runId: "migration-end-index",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    });
    let cursor: string | null = null;
    let result;
    do {
      result = await t.mutation(migration.processBatch, {
        runId: "migration-end-index",
        paginationOpts: { numItems: 100, cursor },
      });
      cursor = result.cursor;
    } while (!result.isComplete);

    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", ids.closedLater))
    ).not.toHaveProperty("legacyReason");
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", ids.openOverlap))
    ).toMatchObject({ legacyReason: "overlap" });
  });

  test("annotates raw conflicts after the first page", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-late-conflicts");
    const lateIds: Id<"periodEvents">[] = [];
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
      lateIds.push(await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-001",
        endDate: "2026-02-002",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      lateIds.push(await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-02-001",
        endDate: "2026-02-003",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      lateIds.push(await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-03-001",
        endDate: "2026-03-005",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      lateIds.push(await ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-03-004",
        endDate: "2026-03-006",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    });

    await t.mutation(migration.start, {
      runId: "migration-late-conflicts",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    });
    let cursor: string | null = null;
    let result;
    do {
      result = await t.mutation(migration.processBatch, {
        runId: "migration-late-conflicts",
        paginationOpts: { numItems: 100, cursor },
      });
      cursor = result.cursor;
    } while (!result.isComplete);

    expect(result).toMatchObject({
      processedCount: 104,
      annotatedCount: 104,
      isComplete: true,
    });
    const lateRows = await t.run(async (ctx) =>
      Promise.all(lateIds.map((id) => ctx.db.get("periodEvents", id)))
    );
    expect(lateRows[0]).toMatchObject({ legacyReason: "missing_provenance" });
    expect(lateRows[1]).toMatchObject({ legacyReason: "duplicate" });
    expect(lateRows[2]).toMatchObject({ legacyReason: "missing_provenance" });
    expect(lateRows[3]).toMatchObject({ legacyReason: "overlap" });

    const scanRows = await t.run(async (ctx) =>
      ctx.db
        .query("cycleFactScanRows")
        .withIndex("by_run_user_scan_end", (q) =>
          q.eq("runType", "migration")
            .eq("runId", "migration-late-conflicts")
            .eq("userId", userId)
            .gte("scanEndDate", "2026-03-001")
        )
        .filter((q) => q.eq(q.field("active"), true))
        .collect()
    );
    expect(scanRows.map((row) => row.startDate)).toEqual([
      "2026-03-001",
      "2026-03-004",
    ]);
  });

  test("defaults to a dry run and leaves legacy rows unchanged", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-dry-run");
    const rowId = await insertLegacyPeriod(t, userId, "2026-03-01", "2026-03-05");

    const started = await t.mutation(migration.start, {
      runId: "migration-dry-run",
    });
    const result = await t.mutation(migration.processBatch, {
      runId: "migration-dry-run",
      paginationOpts: { numItems: 100, cursor: null },
    });

    expect(started).toEqual({ started: true, mode: "dry_run" });
    expect(result).toMatchObject({
      mode: "dry_run",
      processedCount: 1,
      annotatedCount: 1,
      isComplete: true,
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", rowId))
    ).toMatchObject({
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", rowId))
    ).not.toHaveProperty("legacyReason");
  });

  test("requires an explicit non-production target for annotation mode", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(migration.start, {
        runId: "migration-missing-target",
        mode: "annotate",
      })
    ).rejects.toThrow("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
    await expect(
      t.mutation(migration.start, {
        runId: "migration-production-target",
        mode: "annotate",
        targetDeployment: "prod:example",
      })
    ).rejects.toThrow("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
  });

  test("rejects a caller label that does not match the server deployment identity", async () => {
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "dev:actual-server-deployment");
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(migration.start, {
        runId: "migration-mismatched-server",
        mode: "annotate",
        targetDeployment: "dev:caller-supplied-label",
      })
    ).rejects.toThrow("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
  });

  test("attests a non-production identity and rejects resume after identity drift", async () => {
    vi.stubEnv("CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT", "dev");
    vi.stubEnv(
      "CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT",
      "dev:hallowed-hummingbird-284"
    );
    vi.stubEnv("CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY", "true");
    const t = convexTest(schema, modules);

    await expect(t.mutation(migration.start, {
      runId: "migration-identity-drift",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    })).resolves.toEqual({ started: true, mode: "annotate" });

    vi.stubEnv(
      "CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT",
      "dev:replacement-deployment"
    );
    await expect(t.mutation(migration.start, {
      runId: "migration-identity-drift",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    })).rejects.toThrow("CYCLE_FACTS_MIGRATION_IDENTITY_DRIFT");
  });

  test("rejects annotation even when the actual server identity is production", async () => {
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYMENT", "prod:festive-malamute-715");
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(migration.start, {
        runId: "migration-production-server",
        mode: "annotate",
        targetDeployment: "prod:festive-malamute-715",
      })
    ).rejects.toThrow("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
  });

  test("annotates an ambiguous row without rewriting its dates", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-annotate");
    const rowId = await insertLegacyPeriod(t, userId, "2026-04-01", "2026-04-05");

    await t.mutation(migration.start, {
      runId: "migration-annotate",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    });
    const result = await t.mutation(migration.processBatch, {
      runId: "migration-annotate",
      paginationOpts: { numItems: 100, cursor: null },
    });

    expect(result).toMatchObject({ mode: "annotate", annotatedCount: 1 });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", rowId))
    ).toMatchObject({
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      startCertainty: "legacy_unknown",
      endCertainty: "legacy_unknown",
      legacyReason: "missing_provenance",
    });
  });

  test("is resumable in bounded pages and rejects duplicate run creation", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-bounded");
    for (let index = 0; index < 101; index++) {
      await insertLegacyPeriod(
        t,
        userId,
        `2026-05-${String(index + 1).padStart(2, "0")}`
      );
    }

    const startArgs = {
      runId: "migration-bounded",
      mode: "annotate" as const,
      targetDeployment: "dev:hallowed-hummingbird-284",
    };
    await expect(t.mutation(migration.start, startArgs)).resolves.toEqual({
      started: true,
      mode: "annotate",
    });
    await expect(t.mutation(migration.start, startArgs)).resolves.toEqual({
      started: false,
      mode: "annotate",
    });

    const first = await t.mutation(migration.processBatch, {
      runId: "migration-bounded",
      paginationOpts: { numItems: 500, cursor: null },
    });
    expect(first).toMatchObject({
      processedCount: 100,
      annotatedCount: 100,
      isComplete: false,
    });
    expect(first.cursor).toEqual(expect.any(String));

    const second = await t.mutation(migration.processBatch, {
      runId: "migration-bounded",
      paginationOpts: { numItems: 100, cursor: first.cursor },
    });
    expect(second).toMatchObject({
      processedCount: 101,
      annotatedCount: 101,
      isComplete: true,
    });
    await expect(t.mutation(migration.processBatch, {
      runId: "migration-bounded",
      paginationOpts: { numItems: 100, cursor: second.cursor },
    })).resolves.toEqual(second);
  });

  test("does not rewrite already annotated rows", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "migration-idempotent");
    const rowId = await t.run(async (ctx) =>
      ctx.db.insert("periodEvents", {
        userId,
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        startCertainty: "legacy_unknown",
        endCertainty: "legacy_unknown",
        legacyReason: "inferred_end",
        authorityVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );

    await t.mutation(migration.start, {
      runId: "migration-idempotent",
      mode: "annotate",
      targetDeployment: "dev:hallowed-hummingbird-284",
    });
    const result = await t.mutation(migration.processBatch, {
      runId: "migration-idempotent",
      paginationOpts: { numItems: 100, cursor: null },
    });

    expect(result).toMatchObject({ processedCount: 1, annotatedCount: 0 });
    expect(
      await t.run(async (ctx) => ctx.db.get("periodEvents", rowId))
    ).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      legacyReason: "inferred_end",
    });
  });
});
