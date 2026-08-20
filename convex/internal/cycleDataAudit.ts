import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const MAX_PAGE_SIZE = 100;
const MAX_USER_CONTEXT = 100;
const SUPPRESSED_COUNT = v.union(v.number(), v.literal("<5"));

const auditProgressValidator = v.object({
  suppressedCounts: v.object({
    missing_provenance: SUPPRESSED_COUNT,
    inferred_end: SUPPRESSED_COUNT,
    duplicate: SUPPRESSED_COUNT,
    overlap: SUPPRESSED_COUNT,
    unprovable: SUPPRESSED_COUNT,
  }),
  cursor: v.union(v.string(), v.null()),
  isComplete: v.boolean(),
});

type AuditReason =
  | "missing_provenance"
  | "inferred_end"
  | "duplicate"
  | "overlap"
  | "unprovable";

type AuditCounts = Record<AuditReason, number>;

function emptyCounts(): AuditCounts {
  return {
    missing_provenance: 0,
    inferred_end: 0,
    duplicate: 0,
    overlap: 0,
    unprovable: 0,
  };
}

function suppressCount(count: number): number | "<5" {
  if (count === 0) return 0;
  return count < 5 ? "<5" : count;
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
): AuditReason | null {
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

function addCounts(left: AuditCounts, right: AuditCounts): AuditCounts {
  return {
    missing_provenance: left.missing_provenance + right.missing_provenance,
    inferred_end: left.inferred_end + right.inferred_end,
    duplicate: left.duplicate + right.duplicate,
    overlap: left.overlap + right.overlap,
    unprovable: left.unprovable + right.unprovable,
  };
}

function toProgress(
  counts: AuditCounts,
  cursor: string | null,
  isComplete: boolean
) {
  return {
    suppressedCounts: {
      missing_provenance: suppressCount(counts.missing_provenance),
      inferred_end: suppressCount(counts.inferred_end),
      duplicate: suppressCount(counts.duplicate),
      overlap: suppressCount(counts.overlap),
      unprovable: suppressCount(counts.unprovable),
    },
    cursor,
    isComplete,
  };
}

async function getRun(ctx: Pick<QueryCtx, "db">, runId: string) {
  const run = await ctx.db
    .query("cycleDataAuditRuns")
    .withIndex("by_run_id", (q) => q.eq("runId", runId))
    .unique();
  if (!run) {
    throw new Error("CYCLE_DATA_AUDIT_NOT_FOUND");
  }
  return run;
}

function runCounts(run: Doc<"cycleDataAuditRuns">): AuditCounts {
  return {
    missing_provenance: run.missingProvenance,
    inferred_end: run.inferredEnd,
    duplicate: run.duplicate,
    overlap: run.overlap,
    unprovable: run.unprovable,
  };
}

export const start = internalMutation({
  args: { runId: v.string() },
  returns: v.object({ started: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cycleDataAuditRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) return { started: false };

    const now = Date.now();
    await ctx.db.insert("cycleDataAuditRuns", {
      runId: args.runId,
      isComplete: false,
      pageSize: MAX_PAGE_SIZE,
      processedCount: 0,
      missingProvenance: 0,
      inferredEnd: 0,
      duplicate: 0,
      overlap: 0,
      unprovable: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { started: true };
  },
});

export const getProgress = internalQuery({
  args: { runId: v.string() },
  returns: auditProgressValidator,
  handler: async (ctx, args) => {
    const run = await getRun(ctx, args.runId);
    return toProgress(runCounts(run), run.cursor ?? null, run.isComplete);
  },
});

export const scanPage = internalMutation({
  args: {
    runId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: auditProgressValidator,
  handler: async (ctx, args) => {
    const run = await getRun(ctx, args.runId);
    const requestedCursor = args.paginationOpts.cursor ?? null;
    const storedCursor = run.cursor ?? null;
    if (requestedCursor !== storedCursor) {
      throw new Error("CYCLE_DATA_AUDIT_CURSOR_MISMATCH");
    }
    if (run.isComplete) {
      return toProgress(runCounts(run), storedCursor, true);
    }

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
    const pageCounts = emptyCounts();
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
      if (reason) pageCounts[reason] += 1;
    }

    const counts = addCounts(runCounts(run), pageCounts);
    const updatedAt = Date.now();
    await ctx.db.patch(run._id, {
      cursor: page.continueCursor,
      isComplete: page.isDone,
      processedCount: run.processedCount + page.page.length,
      missingProvenance: counts.missing_provenance,
      inferredEnd: counts.inferred_end,
      duplicate: counts.duplicate,
      overlap: counts.overlap,
      unprovable: counts.unprovable,
      updatedAt,
    });

    return toProgress(counts, page.continueCursor, page.isDone);
  },
});
