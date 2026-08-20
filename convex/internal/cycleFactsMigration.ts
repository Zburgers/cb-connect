import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const MAX_PAGE_SIZE = 100;
const MAX_USER_CONTEXT = 100;
const migrationModeValidator = v.union(
  v.literal("dry_run"),
  v.literal("annotate")
);

const migrationProgressValidator = v.object({
  mode: migrationModeValidator,
  cursor: v.union(v.string(), v.null()),
  isComplete: v.boolean(),
  processedCount: v.number(),
  annotatedCount: v.number(),
});

type MigrationReason =
  | "missing_provenance"
  | "inferred_end"
  | "duplicate"
  | "overlap"
  | "unprovable";

type Certainty = "exact" | "approximate" | "legacy_unknown";

function isNonProductionTarget(targetDeployment: string | undefined): boolean {
  const actualDeployment = process.env.CB_CONNECT_BACKEND_DEPLOYMENT;
  return (
    targetDeployment !== undefined &&
    actualDeployment !== undefined &&
    targetDeployment === actualDeployment &&
    /^(dev|preview|staging):[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(
      actualDeployment
    )
  );
}

function intervalsOverlap(
  left: Doc<"periodEvents">,
  right: Doc<"periodEvents">
): boolean {
  const leftEnd = left.endDate ?? "9999-12-31";
  const rightEnd = right.endDate ?? "9999-12-31";
  return left.startDate <= rightEnd && right.startDate <= leftEnd;
}

function classifyLegacyReason(
  period: Doc<"periodEvents">,
  userContext: Doc<"periodEvents">[]
): MigrationReason | null {
  if (period.tombstoneAt !== undefined) return null;
  const peers = userContext.filter(
    (candidate) =>
      candidate._id !== period._id && candidate.tombstoneAt === undefined
  );
  if (peers.some((candidate) => candidate.startDate === period.startDate)) {
    return "duplicate";
  }
  if (peers.some((candidate) => intervalsOverlap(candidate, period))) {
    return "overlap";
  }
  if (
    period.legacyReason !== undefined &&
    period.legacyReason !== "duplicate" &&
    period.legacyReason !== "overlap"
  ) {
    return period.legacyReason;
  }
  if (period.source === "system") return "inferred_end";
  if (
    period.startCertainty === undefined ||
    (period.endDate !== undefined && period.endCertainty === undefined)
  ) {
    return "missing_provenance";
  }
  if (
    period.startCertainty === "legacy_unknown" ||
    period.endCertainty === "legacy_unknown"
  ) {
    return "unprovable";
  }
  return null;
}

type AnnotationPatch = {
  startCertainty?: Certainty;
  endCertainty?: Certainty;
  legacyReason?: MigrationReason;
  authorityVersion?: number;
};

function annotationPatch(
  period: Doc<"periodEvents">,
  reason: MigrationReason
): AnnotationPatch {
  const patch: AnnotationPatch = {};
  if (period.startCertainty === undefined) {
    patch.startCertainty = "legacy_unknown";
  }
  if (period.endDate !== undefined && period.endCertainty === undefined) {
    patch.endCertainty = "legacy_unknown";
  }
  if (period.legacyReason === undefined) {
    patch.legacyReason = reason;
  }
  if (period.authorityVersion === undefined) {
    patch.authorityVersion = 0;
  }
  return patch;
}

function toProgress(run: Doc<"cycleFactsMigrationRuns">) {
  return {
    mode: run.mode,
    cursor: run.cursor ?? null,
    isComplete: run.isComplete,
    processedCount: run.processedCount,
    annotatedCount: run.annotatedCount,
  };
}

async function getRun(ctx: Pick<QueryCtx, "db">, runId: string) {
  const run = await ctx.db
    .query("cycleFactsMigrationRuns")
    .withIndex("by_run_id", (q) => q.eq("runId", runId))
    .unique();
  if (!run) {
    throw new Error("CYCLE_FACTS_MIGRATION_NOT_FOUND");
  }
  return run;
}

export const start = internalMutation({
  args: {
    runId: v.string(),
    mode: v.optional(migrationModeValidator),
    targetDeployment: v.optional(v.string()),
  },
  returns: v.object({
    started: v.boolean(),
    mode: migrationModeValidator,
  }),
  handler: async (ctx, args) => {
    const mode = args.mode ?? "dry_run";
    if (mode === "annotate" && !isNonProductionTarget(args.targetDeployment)) {
      throw new Error("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
    }

    const existing = await ctx.db
      .query("cycleFactsMigrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) {
      if (
        existing.mode !== mode ||
        existing.targetDeployment !== args.targetDeployment
      ) {
        throw new Error("CYCLE_FACTS_MIGRATION_RUN_EXISTS");
      }
      return { started: false, mode: existing.mode };
    }

    const now = Date.now();
    await ctx.db.insert("cycleFactsMigrationRuns", {
      runId: args.runId,
      mode,
      targetDeployment: args.targetDeployment,
      isComplete: false,
      pageSize: MAX_PAGE_SIZE,
      processedCount: 0,
      annotatedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { started: true, mode };
  },
});

export const getProgress = internalQuery({
  args: { runId: v.string() },
  returns: migrationProgressValidator,
  handler: async (ctx, args) => toProgress(await getRun(ctx, args.runId)),
});

export const processBatch = internalMutation({
  args: {
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
    scheduleNext: v.optional(v.boolean()),
  },
  returns: migrationProgressValidator,
  handler: async (ctx, args) => {
    const run = await getRun(ctx, args.runId);
    const requestedCursor = args.paginationOpts.cursor ?? null;
    const storedCursor = run.cursor ?? null;
    if (requestedCursor !== storedCursor) {
      throw new Error("CYCLE_FACTS_MIGRATION_CURSOR_MISMATCH");
    }
    if (run.isComplete) return toProgress(run);

    const page = await ctx.db
      .query("periodEvents")
      .order("asc")
      .paginate({
        numItems: Math.min(
          Math.max(args.paginationOpts.numItems, 1),
          MAX_PAGE_SIZE
        ),
        cursor: args.paginationOpts.cursor,
      });

    let batchAnnotatedCount = 0;
    const userContexts = new Map<string, Doc<"periodEvents">[]>();
    for (const userId of new Set(page.page.map((period) => period.userId))) {
      const context = await ctx.db
        .query("periodEvents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("asc")
        .take(MAX_USER_CONTEXT);
      userContexts.set(userId, context);
    }
    for (const period of page.page) {
      const reason = classifyLegacyReason(
        period,
        userContexts.get(period.userId) ?? []
      );
      if (!reason) continue;
      const patch = annotationPatch(period, reason);
      if (Object.keys(patch).length === 0) continue;
      batchAnnotatedCount += 1;
      if (run.mode === "annotate") {
        await ctx.db.patch(period._id, patch);
      }
    }

    const updatedRun = {
      cursor: page.continueCursor,
      isComplete: page.isDone,
      processedCount: run.processedCount + page.page.length,
      annotatedCount: run.annotatedCount + batchAnnotatedCount,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(run._id, updatedRun);

    if (args.scheduleNext && !page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.internal.cycleFactsMigration.processBatch,
        {
          runId: args.runId,
          paginationOpts: {
            numItems: MAX_PAGE_SIZE,
            cursor: page.continueCursor,
          },
          scheduleNext: true,
        }
      );
    }

    return {
      mode: run.mode,
      cursor: page.continueCursor,
      isComplete: page.isDone,
      processedCount: updatedRun.processedCount,
      annotatedCount: updatedRun.annotatedCount,
    };
  },
});
