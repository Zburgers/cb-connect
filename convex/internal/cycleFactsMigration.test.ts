import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const migration = internal.internal.cycleFactsMigration;

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
