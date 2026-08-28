import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "../_generated/api";
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

type MigrationReason = LegacyClassificationReason;

type Certainty = "exact" | "approximate" | "legacy_unknown";

type AttestedEnvironment = "dev" | "preview" | "staging";

type ServerAttestedMigrationIdentity = {
  deployment: string;
  environment: AttestedEnvironment;
};

function readServerAttestedMigrationIdentity(
  environment: NodeJS.ProcessEnv = process.env
): ServerAttestedMigrationIdentity | null {
  const attestedEnvironment = environment.CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT;
  const attestedDeployment = environment.CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT;
  const backendDeployment = environment.CB_CONNECT_BACKEND_DEPLOYMENT;
  if (
    environment.CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY !== "true" ||
    (attestedEnvironment !== "dev" &&
      attestedEnvironment !== "preview" &&
      attestedEnvironment !== "staging") ||
    attestedDeployment === undefined ||
    backendDeployment !== attestedDeployment ||
    !new RegExp(
      `^${attestedEnvironment}:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`
    ).test(attestedDeployment)
  ) {
    return null;
  }
  return { deployment: attestedDeployment, environment: attestedEnvironment };
}

function isSameAttestedIdentity(
  run: Doc<"cycleFactsMigrationRuns">,
  identity: ServerAttestedMigrationIdentity | null
): boolean {
  return (
    identity !== null &&
    run.attestedDeployment === identity.deployment &&
    run.attestedEnvironment === identity.environment
  );
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
    const existing = await ctx.db
      .query("cycleFactsMigrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    const identity = readServerAttestedMigrationIdentity();
    if (existing) {
      if (existing.mode === "annotate" && !isSameAttestedIdentity(existing, identity)) {
        throw new Error("CYCLE_FACTS_MIGRATION_IDENTITY_DRIFT");
      }
      if (
        existing.mode !== mode ||
        existing.targetDeployment !== args.targetDeployment
      ) {
        throw new Error("CYCLE_FACTS_MIGRATION_RUN_EXISTS");
      }
      return { started: false, mode: existing.mode };
    }

    if (
      mode === "annotate" &&
      (identity === null || args.targetDeployment !== identity.deployment)
    ) {
      throw new Error("CYCLE_FACTS_MIGRATION_TARGET_REQUIRED");
    }

    const now = Date.now();
    await ctx.db.insert("cycleFactsMigrationRuns", {
      runId: args.runId,
      mode,
      targetDeployment: args.targetDeployment,
      ...(mode === "annotate" && identity !== null
        ? {
            attestedDeployment: identity.deployment,
            attestedEnvironment: identity.environment,
          }
        : {}),
      isComplete: false,
      pageSize: MAX_PAGE_SIZE,
      processedCount: 0,
      annotatedCount: 0,
      globalComplete: false,
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
          q.eq("runType", "migration").eq("runId", args.runId).eq("status", "pending")
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
              q.eq("runType", "migration").eq("runId", args.runId).eq("userId", userId)
            )
            .unique();
          if (!existingUser) {
            await ctx.db.insert("cycleFactScanUsers", {
              runType: "migration",
              runId: args.runId,
              userId,
              status: "pending",
            });
          }
        }
        pendingUser = await ctx.db
          .query("cycleFactScanUsers")
          .withIndex("by_run_and_status", (q) =>
            q.eq("runType", "migration").eq("runId", args.runId).eq("status", "pending")
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
        return toProgress({
          ...run,
          cursor: globalCursor ?? undefined,
          globalComplete: true,
          isComplete: true,
        });
      }
    }
    if (!currentUserId) {
      throw new Error("CYCLE_FACTS_MIGRATION_SCAN_STATE_INVALID");
    }
    const activeUserId = currentUserId;
    const page = await ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", activeUserId))
      .order("asc")
      .paginate({ numItems: pageSize, cursor: userCursor });

    let batchAnnotatedCount = 0;
    for (const period of page.page) {
      const existingWork = await ctx.db
        .query("cycleFactScanRows")
        .withIndex("by_run_and_event", (q) =>
          q.eq("runType", "migration").eq("runId", args.runId).eq("periodEventId", period._id)
        )
        .unique();
      if (existingWork) continue;
      const duplicatePeer = period.tombstoneAt === undefined
        ? await ctx.db
            .query("cycleFactScanRows")
            .withIndex("by_run_user_start", (q) =>
              q.eq("runType", "migration")
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
              q.eq("runType", "migration")
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
      const patch = reason ? annotationPatch(period, reason) : {};
      if (Object.keys(patch).length > 0) {
        batchAnnotatedCount += 1;
        if (run.mode === "annotate") await ctx.db.patch(period._id, patch);
      }
      await ctx.db.insert("cycleFactScanRows", {
        runType: "migration",
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

    const userDone = page.isDone;
    if (userDone) {
      const userState = await ctx.db
        .query("cycleFactScanUsers")
        .withIndex("by_run_and_user", (q) =>
          q.eq("runType", "migration").eq("runId", args.runId).eq("userId", activeUserId)
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
            q.eq("runType", "migration").eq("runId", args.runId).eq("userId", userId)
          )
          .unique();
        if (!existingUser) {
          await ctx.db.insert("cycleFactScanUsers", {
            runType: "migration",
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
        q.eq("runType", "migration").eq("runId", args.runId).eq("status", "pending")
      )
      .first();
    const isComplete =
      userDone && globalComplete && pendingAfterPage === null;
    const updatedRun = {
      cursor: globalCursor ?? undefined,
      currentUserId,
      userCursor: userCursor ?? undefined,
      globalComplete,
      isComplete,
      processedCount: run.processedCount + page.page.length,
      annotatedCount: run.annotatedCount + batchAnnotatedCount,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(run._id, updatedRun);

    if (args.scheduleNext && !updatedRun.isComplete) {
      await ctx.scheduler.runAfter(
        0,
        internal.internal.cycleFactsMigration.processBatch,
        {
          runId: args.runId,
          paginationOpts: {
            numItems: MAX_PAGE_SIZE,
            cursor: globalCursor,
          },
          scheduleNext: true,
        }
      );
    }

    return {
      mode: run.mode,
      cursor: globalCursor,
      isComplete: updatedRun.isComplete,
      processedCount: updatedRun.processedCount,
      annotatedCount: updatedRun.annotatedCount,
    };
  },
});
