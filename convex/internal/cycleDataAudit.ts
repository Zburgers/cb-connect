import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  classifyLegacyCycleFact,
  type LegacyClassificationReason,
} from "../_helpers/legacyCycleFactClassification";

const MAX_PAGE_SIZE = 100;
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

type AuditReason = LegacyClassificationReason;

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
      globalComplete: false,
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

    const pageSize = Math.min(
      Math.max(args.paginationOpts.numItems, 1),
      MAX_PAGE_SIZE
    );
    let globalCursor = run.cursor ?? null;
    let globalComplete = run.globalComplete ?? false;
    let currentUserId = run.currentUserId;
    let userCursor = run.userCursor ?? null;

    if (!currentUserId) {
      let pendingUser = await ctx.db
        .query("cycleFactScanUsers")
        .withIndex("by_run_and_status", (q) =>
          q.eq("runType", "audit").eq("runId", args.runId).eq("status", "pending")
        )
        .first();
      if (!pendingUser && !globalComplete) {
        const discoveryPage = await ctx.db
          .query("periodEvents")
          .order("asc")
          .paginate({ numItems: pageSize, cursor: globalCursor });
        globalCursor = discoveryPage.continueCursor;
        globalComplete = discoveryPage.isDone;
        const discoveredUsers = new Set(discoveryPage.page.map((row) => row.userId));
        for (const userId of discoveredUsers) {
          const existingUser = await ctx.db
            .query("cycleFactScanUsers")
            .withIndex("by_run_and_user", (q) =>
              q.eq("runType", "audit").eq("runId", args.runId).eq("userId", userId)
            )
            .unique();
          if (!existingUser) {
            await ctx.db.insert("cycleFactScanUsers", {
              runType: "audit",
              runId: args.runId,
              userId,
              status: "pending",
            });
          }
        }
        pendingUser = await ctx.db
          .query("cycleFactScanUsers")
          .withIndex("by_run_and_status", (q) =>
            q.eq("runType", "audit").eq("runId", args.runId).eq("status", "pending")
          )
          .first();
      }
      if (pendingUser) {
        currentUserId = pendingUser.userId;
        userCursor = null;
      } else if (globalComplete) {
        await ctx.db.patch(run._id, {
          cursor: globalCursor ?? undefined,
          globalComplete: true,
          isComplete: true,
          updatedAt: Date.now(),
        });
        return toProgress(runCounts(run), globalCursor, true);
      }
    }

    if (!currentUserId) {
      throw new Error("CYCLE_DATA_AUDIT_SCAN_STATE_INVALID");
    }
    const activeUserId = currentUserId;

    const page = await ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", activeUserId))
      .order("asc")
      .paginate({ numItems: pageSize, cursor: userCursor });
    const pageCounts = emptyCounts();
    for (const period of page.page) {
      const existingWork = await ctx.db
        .query("cycleFactScanRows")
        .withIndex("by_run_and_event", (q) =>
          q.eq("runType", "audit").eq("runId", args.runId).eq("periodEventId", period._id)
        )
        .unique();
      if (existingWork) continue;
      const duplicatePeer = period.tombstoneAt === undefined
        ? await ctx.db
            .query("cycleFactScanRows")
            .withIndex("by_run_user_start", (q) =>
              q.eq("runType", "audit")
                .eq("runId", args.runId)
                .eq("userId", activeUserId)
                .eq("startDate", period.startDate)
                .eq("active", true)
            )
            .first()
        : null;
      const overlapPeer = period.tombstoneAt === undefined
        ? await ctx.db
            .query("cycleFactScanRows")
            .withIndex("by_run_user_end", (q) =>
              q.eq("runType", "audit")
                .eq("runId", args.runId)
                .eq("userId", activeUserId)
                .eq("active", true)
                .gte("scanEndDate", period.startDate)
            )
            .first()
        : null;
      const reason = classifyLegacyCycleFact(period, {
        duplicate: duplicatePeer !== null,
        overlap: overlapPeer !== null,
      });
      if (reason) pageCounts[reason] += 1;
      await ctx.db.insert("cycleFactScanRows", {
        runType: "audit",
        runId: args.runId,
        periodEventId: period._id,
        userId: activeUserId,
        startDate: period.startDate,
        scanEndDate: period.endDate ?? "9999-12-31",
        active: period.tombstoneAt === undefined,
        endDate: period.endDate,
        startCertainty: period.startCertainty,
        endCertainty: period.endCertainty,
        legacyReason: period.legacyReason,
        source: period.source,
        classificationReason: reason ?? undefined,
      });
    }

    const counts = addCounts(runCounts(run), pageCounts);
    const userDone = page.isDone;
    if (userDone) {
      const userState = await ctx.db
        .query("cycleFactScanUsers")
        .withIndex("by_run_and_user", (q) =>
          q.eq("runType", "audit").eq("runId", args.runId).eq("userId", activeUserId)
        )
        .unique();
      if (userState) await ctx.db.patch(userState._id, { status: "done" });
      currentUserId = undefined;
      userCursor = null;
    } else {
      userCursor = page.continueCursor;
    }
    if (userDone && !globalComplete) {
      const discoveryPage = await ctx.db
        .query("periodEvents")
        .order("asc")
        .paginate({ numItems: pageSize, cursor: globalCursor });
      globalCursor = discoveryPage.continueCursor;
      globalComplete = discoveryPage.isDone;
      const discoveredUsers = new Set(discoveryPage.page.map((row) => row.userId));
      for (const userId of discoveredUsers) {
        const existingUser = await ctx.db
          .query("cycleFactScanUsers")
          .withIndex("by_run_and_user", (q) =>
            q.eq("runType", "audit").eq("runId", args.runId).eq("userId", userId)
          )
          .unique();
        if (!existingUser) {
          await ctx.db.insert("cycleFactScanUsers", {
            runType: "audit",
            runId: args.runId,
            userId,
            status: "pending",
          });
        }
      }
    }
    const pendingAfterPage = await ctx.db
      .query("cycleFactScanUsers")
      .withIndex("by_run_and_status", (q) =>
        q.eq("runType", "audit").eq("runId", args.runId).eq("status", "pending")
      )
      .first();
    const isComplete =
      userDone && globalComplete && pendingAfterPage === null;
    const updatedAt = Date.now();
    await ctx.db.patch(run._id, {
      cursor: globalCursor ?? undefined,
      currentUserId,
      userCursor: userCursor ?? undefined,
      globalComplete,
      isComplete,
      processedCount: run.processedCount + page.page.length,
      missingProvenance: counts.missing_provenance,
      inferredEnd: counts.inferred_end,
      duplicate: counts.duplicate,
      overlap: counts.overlap,
      unprovable: counts.unprovable,
      updatedAt,
    });

    const persistedCounts: Doc<"cycleDataAuditRuns"> = {
      ...run,
      cursor: globalCursor ?? undefined,
      currentUserId,
      userCursor: userCursor ?? undefined,
      globalComplete,
      isComplete,
      processedCount: run.processedCount + page.page.length,
      missingProvenance: counts.missing_provenance,
      inferredEnd: counts.inferred_end,
      duplicate: counts.duplicate,
      overlap: counts.overlap,
      unprovable: counts.unprovable,
      updatedAt,
    };
    return toProgress(runCounts(persistedCounts), globalCursor, isComplete);
  },
});
