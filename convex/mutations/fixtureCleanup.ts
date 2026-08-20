import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const APPROVED_DEV_DEPLOYMENT = "dev:hallowed-hummingbird-284";
const MAX_RECORDS_PER_SCOPE = 500;
const SAFE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const fixtureArgs = {
  runId: v.string(),
  primaryClerkId: v.string(),
  partnerClerkId: v.string(),
};

const cleanupResult = v.object({
  ok: v.boolean(),
  deleted: v.record(v.string(), v.number()),
  remaining: v.boolean(),
});

const statusResult = v.object({
  remaining: v.boolean(),
  counts: v.record(v.string(), v.number()),
});

type ReadCtx = QueryCtx | MutationCtx;
type UserId = Id<"users">;
type CoupleId = Id<"couples">;

type FixtureRecords = {
  users: Doc<"users">[];
  couples: Doc<"couples">[];
  coupleMembers: Doc<"coupleMembers">[];
  pairingCodes: Doc<"pairingCodes">[];
  pairingCodeAttempts: Doc<"pairingCodeAttempts">[];
  periodEvents: Doc<"periodEvents">[];
  painLogs: Doc<"painLogs">[];
  cycleSettings: Doc<"cycleSettings">[];
  hiddenNutrition: Doc<"hiddenNutrition">[];
  notificationLog: Doc<"notificationLog">[];
  presence: Doc<"presence">[];
  nudges: Doc<"nudges">[];
  coupleMessages: Doc<"coupleMessages">[];
  coupleMessageReactions: Doc<"coupleMessageReactions">[];
  coupleChatStates: Doc<"coupleChatStates">[];
};

function assertFixtureScopeAllowed(): void {
  const deployment = process.env.CB_CONNECT_BACKEND_DEPLOYMENT;
  const cleanupEnabled = process.env.CB_CONNECT_FIXTURE_CLEANUP_ENABLED;

  if (
    cleanupEnabled !== "true" ||
    deployment !== APPROVED_DEV_DEPLOYMENT ||
    deployment.startsWith("prod:")
  ) {
    throw new Error("fixture_cleanup_not_allowed");
  }
}

function assertFixtureArgs(args: {
  runId: string;
  primaryClerkId: string;
  partnerClerkId: string;
}): void {
  if (
    !SAFE_RUN_ID_PATTERN.test(args.runId) ||
    !args.primaryClerkId ||
    !args.partnerClerkId ||
    args.primaryClerkId === args.partnerClerkId
  ) {
    throw new Error("fixture_cleanup_invalid_scope");
  }
}

async function getFixtureRun(
  ctx: ReadCtx,
  args: {
    runId: string;
    primaryClerkId: string;
    partnerClerkId: string;
  },
) {
  const fixtureRun = await ctx.db
    .query("fixtureRuns")
    .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
    .unique();

  if (
    !fixtureRun ||
    fixtureRun.primaryClerkId !== args.primaryClerkId ||
    fixtureRun.partnerClerkId !== args.partnerClerkId
  ) {
    throw new Error("fixture_cleanup_identity_mismatch");
  }
  return fixtureRun;
}

async function assertAuthenticatedFixturePrimary(
  ctx: ReadCtx,
  args: {
    runId: string;
    primaryClerkId: string;
    partnerClerkId: string;
  },
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.subject !== args.primaryClerkId) {
    throw new Error("fixture_cleanup_unauthenticated");
  }
  await getFixtureRun(ctx, args);
}

function bounded<T>(rows: T[], table: string): T[] {
  if (rows.length > MAX_RECORDS_PER_SCOPE) {
    throw new Error(`fixture_cleanup_scope_too_large:${table}`);
  }
  return rows;
}

async function rowsByUser<T extends keyof FixtureRecords>(
  ctx: ReadCtx,
  table: T,
  userId: UserId,
): Promise<FixtureRecords[T]> {
  switch (table) {
    case "coupleMembers":
      return bounded(
        await ctx.db
          .query("coupleMembers")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "pairingCodeAttempts":
      return bounded(
        await ctx.db
          .query("pairingCodeAttempts")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "periodEvents":
      return bounded(
        await ctx.db
          .query("periodEvents")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "painLogs":
      return bounded(
        await ctx.db
          .query("painLogs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "cycleSettings":
      return bounded(
        await ctx.db
          .query("cycleSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "hiddenNutrition":
      return bounded(
        await ctx.db
          .query("hiddenNutrition")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "notificationLog":
      return bounded(
        await ctx.db
          .query("notificationLog")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    default:
      throw new Error(`fixture_cleanup_unknown_user_table:${String(table)}`);
  }
}

async function rowsByCouple<T extends keyof FixtureRecords>(
  ctx: ReadCtx,
  table: T,
  coupleId: CoupleId,
): Promise<FixtureRecords[T]> {
  switch (table) {
    case "coupleMembers":
      return bounded(
        await ctx.db
          .query("coupleMembers")
          .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "pairingCodes":
      return bounded(
        await ctx.db
          .query("pairingCodes")
          .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "presence":
      return bounded(
        await ctx.db
          .query("presence")
          .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "nudges":
      return bounded(
        await ctx.db
          .query("nudges")
          .withIndex("by_couple_created", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "coupleMessages":
      return bounded(
        await ctx.db
          .query("coupleMessages")
          .withIndex("by_couple_created", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "coupleMessageReactions":
      return bounded(
        await ctx.db
          .query("coupleMessageReactions")
          .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    case "coupleChatStates":
      return bounded(
        await ctx.db
          .query("coupleChatStates")
          .withIndex("by_couple_and_user", (q) => q.eq("coupleId", coupleId))
          .take(MAX_RECORDS_PER_SCOPE + 1),
        table,
      ) as FixtureRecords[T];
    default:
      throw new Error(`fixture_cleanup_unknown_couple_table:${String(table)}`);
  }
}

async function loadFixtureRecords(
  ctx: ReadCtx,
  args: {
    runId: string;
    primaryClerkId: string;
    partnerClerkId: string;
  },
): Promise<FixtureRecords> {
  assertFixtureScopeAllowed();
  assertFixtureArgs(args);
  const fixtureRun = await getFixtureRun(ctx, args);
  const requestedUsers = [
    { clerkId: args.primaryClerkId, role: "primary" as const },
    { clerkId: args.partnerClerkId, role: "partner" as const },
  ];
  const users: Doc<"users">[] = [];

  for (const requested of requestedUsers) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", requested.clerkId))
      .unique();
    if (!user) continue;

    const expectedEmail = `cb-connect-e2e+${args.runId}-${requested.role}@example.com`;
    // A durable run is claimed before either account visits the dashboard.
    // During a failed onboarding/linking interval the application user may not
    // yet carry fixtureRunId or a role, but the exact run-owned Clerk ID and
    // deterministic email still make it safe to recover.
    if (
      (user.fixtureRunId !== undefined && user.fixtureRunId !== args.runId) ||
      (user.email !== "" && user.email !== expectedEmail)
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
    users.push(user);
  }

  const targetUsersByRole = new Map(requestedUsers.map((requested) => [
    requested.role,
    users.find((user) => user.clerkId === requested.clerkId),
  ]));
  const allFixtureUserIds = new Set<UserId>(users.map((user) => user._id));
  const coupleIds = new Set<CoupleId>();
  if (fixtureRun.coupleId !== undefined) {
    coupleIds.add(fixtureRun.coupleId);
  }
  for (const user of users) {
    for (const membership of await rowsByUser(ctx, "coupleMembers", user._id)) {
      coupleIds.add(membership.coupleId);
    }
  }

  const coupleMemberById = new Map<Id<"coupleMembers">, Doc<"coupleMembers">>();
  const couples: Doc<"couples">[] = [];
  for (const coupleId of coupleIds) {
    const couple = await ctx.db.get("couples", coupleId);
    if (couple) couples.push(couple);
    const members = await rowsByCouple(ctx, "coupleMembers", coupleId);
    if (members.length > 2) {
      throw new Error("fixture_cleanup_scope_too_large:couple_members");
    }
    const memberRoles = new Set<string>();
    for (const member of members) {
      if (memberRoles.has(member.role)) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      memberRoles.add(member.role);
      const expectedUser = targetUsersByRole.get(member.role);
      if (
        (expectedUser !== undefined && expectedUser._id !== member.userId) ||
        (expectedUser === undefined && fixtureRun.coupleId !== coupleId)
      ) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      // A previously finalized run can be retried after Clerk/user deletion;
      // its exact couple marker authorizes cleanup of dangling memberships.
      allFixtureUserIds.add(member.userId);
      coupleMemberById.set(member._id, member);
    }
    // Before a partner consumes the code, a synthetic primary-only pending
    // couple is valid and must be recoverable. Any other partial relationship
    // fails closed rather than risking deletion outside this run.
    if (
      members.length > 0 &&
      !(
        (members.length === 1 && members[0].role === "primary") ||
        (members.length === 2 && memberRoles.size === 2)
      )
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  const coupleMembers = [...coupleMemberById.values()];

  const pairingCodes: Doc<"pairingCodes">[] = [];
  const presence: Doc<"presence">[] = [];
  const nudges: Doc<"nudges">[] = [];
  const coupleMessages: Doc<"coupleMessages">[] = [];
  const coupleMessageReactions: Doc<"coupleMessageReactions">[] = [];
  const coupleChatStates: Doc<"coupleChatStates">[] = [];

  for (const coupleId of coupleIds) {
    pairingCodes.push(...(await rowsByCouple(ctx, "pairingCodes", coupleId)));
    presence.push(...(await rowsByCouple(ctx, "presence", coupleId)));
    nudges.push(...(await rowsByCouple(ctx, "nudges", coupleId)));
    coupleMessages.push(...(await rowsByCouple(ctx, "coupleMessages", coupleId)));
    coupleMessageReactions.push(
      ...(await rowsByCouple(ctx, "coupleMessageReactions", coupleId)),
    );
    coupleChatStates.push(
      ...(await rowsByCouple(ctx, "coupleChatStates", coupleId)),
    );
  }

  const pairingCodeAttempts: Doc<"pairingCodeAttempts">[] = [];
  const periodEvents: Doc<"periodEvents">[] = [];
  const painLogs: Doc<"painLogs">[] = [];
  const cycleSettings: Doc<"cycleSettings">[] = [];
  const hiddenNutrition: Doc<"hiddenNutrition">[] = [];
  const notificationLog: Doc<"notificationLog">[] = [];

  for (const userId of allFixtureUserIds) {
    pairingCodeAttempts.push(
      ...(await rowsByUser(ctx, "pairingCodeAttempts", userId)),
    );
    periodEvents.push(...(await rowsByUser(ctx, "periodEvents", userId)));
    painLogs.push(...(await rowsByUser(ctx, "painLogs", userId)));
    cycleSettings.push(...(await rowsByUser(ctx, "cycleSettings", userId)));
    hiddenNutrition.push(...(await rowsByUser(ctx, "hiddenNutrition", userId)));
    notificationLog.push(
      ...(await rowsByUser(ctx, "notificationLog", userId)),
    );
  }

  for (const code of pairingCodes) {
    if (
      !allFixtureUserIds.has(code.createdBy) ||
      (code.usedBy !== undefined && !allFixtureUserIds.has(code.usedBy))
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const presenceRow of presence) {
    if (!allFixtureUserIds.has(presenceRow.userId)) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const nudge of nudges) {
    if (
      !allFixtureUserIds.has(nudge.senderId) ||
      !allFixtureUserIds.has(nudge.receiverId)
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const message of coupleMessages) {
    if (!allFixtureUserIds.has(message.senderId)) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const reaction of coupleMessageReactions) {
    if (!allFixtureUserIds.has(reaction.userId)) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const state of coupleChatStates) {
    if (!allFixtureUserIds.has(state.userId)) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }
  for (const period of periodEvents) {
    if (
      (period.createdByUserId !== undefined &&
        !allFixtureUserIds.has(period.createdByUserId)) ||
      (period.updatedByUserId !== undefined &&
        !allFixtureUserIds.has(period.updatedByUserId))
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
  }

  return {
    users,
    couples,
    coupleMembers,
    pairingCodes,
    pairingCodeAttempts,
    periodEvents,
    painLogs,
    cycleSettings,
    hiddenNutrition,
    notificationLog,
    presence,
    nudges,
    coupleMessages,
    coupleMessageReactions,
    coupleChatStates,
  };
}

function countRecords(records: FixtureRecords): Record<string, number> {
  return Object.fromEntries(
    Object.entries(records).map(([table, rows]) => [table, rows.length]),
  );
}

function hasRemaining(records: FixtureRecords): boolean {
  return Object.values(records).some((rows) => rows.length > 0);
}

export const beginFixtureRun = mutation({
  args: fixtureArgs,
  returns: v.object({ begun: v.boolean() }),
  handler: async (ctx, args) => {
    assertFixtureScopeAllowed();
    assertFixtureArgs(args);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.primaryClerkId) {
      throw new Error("fixture_cleanup_unauthenticated");
    }

    const existing = await ctx.db
      .query("fixtureRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) {
      if (
        existing.primaryClerkId !== args.primaryClerkId ||
        existing.partnerClerkId !== args.partnerClerkId
      ) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      return { begun: false };
    }

    await ctx.db.insert("fixtureRuns", {
      runId: args.runId,
      primaryClerkId: args.primaryClerkId,
      partnerClerkId: args.partnerClerkId,
      createdAt: Date.now(),
    });
    return { begun: true };
  },
});

export const registerFixtureUser = mutation({
  args: {
    runId: v.string(),
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("primary"), v.literal("partner")),
    primaryClerkId: v.string(),
    partnerClerkId: v.string(),
  },
  returns: v.object({ registered: v.boolean() }),
  handler: async (ctx, args) => {
    assertFixtureScopeAllowed();
    if (
      !SAFE_RUN_ID_PATTERN.test(args.runId) ||
      !args.clerkId ||
      !args.primaryClerkId ||
      !args.partnerClerkId ||
      args.primaryClerkId === args.partnerClerkId
    ) {
      throw new Error("fixture_cleanup_invalid_scope");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) {
      throw new Error(
        user
          ? "fixture_cleanup_authenticated_subject_mismatch_target_present"
          : "fixture_cleanup_authenticated_subject_mismatch_target_absent",
      );
    }
    if (!user) throw new Error("fixture_user_not_found");

    const expectedEmail = `cb-connect-e2e+${args.runId}-${args.role}@example.com`;
    if (
      args.email !== expectedEmail
    ) {
      throw new Error("fixture_cleanup_email_mismatch");
    }
    if (user.email !== "" && user.email !== expectedEmail) {
      throw new Error("fixture_cleanup_stored_email_mismatch");
    }
    if (user.role !== args.role) {
      throw new Error("fixture_cleanup_role_mismatch");
    }
    if (user.fixtureRunId !== undefined && user.fixtureRunId !== args.runId) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }

    const fixtureRun = await ctx.db
      .query("fixtureRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (
      !fixtureRun ||
      fixtureRun.primaryClerkId !== args.primaryClerkId ||
      fixtureRun.partnerClerkId !== args.partnerClerkId
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
    if (user.fixtureRunId !== args.runId || user.email !== expectedEmail) {
      await ctx.db.patch(user._id, {
        email: expectedEmail,
        fixtureRunId: args.runId,
      });
    }

    if (args.role === "primary") {
      const existingPeriods = await ctx.db
        .query("periodEvents")
        .withIndex("by_user_and_start", (q) => q.eq("userId", user._id))
        .take(100);
      if (!existingPeriods.some((period) => period.startCertainty === undefined)) {
        const legacyStart = new Date();
        legacyStart.setUTCDate(legacyStart.getUTCDate() - 14);
        const legacyEnd = new Date(legacyStart);
        legacyEnd.setUTCDate(legacyEnd.getUTCDate() + 1);
        const startDate = legacyStart.toISOString().slice(0, 10);
        const endDate = legacyEnd.toISOString().slice(0, 10);
        const now = Date.now();
        await ctx.db.insert("periodEvents", {
          userId: user._id,
          startDate,
          endDate,
          createdByUserId: user._id,
          updatedByUserId: user._id,
          source: "self",
          confirmationStatus: "confirmed",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (args.role === "primary") {
      if (args.clerkId !== args.primaryClerkId) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      const memberships = await rowsByUser(ctx, "coupleMembers", user._id);
      if (memberships.length !== 1) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      const members = await rowsByCouple(
        ctx,
        "coupleMembers",
        memberships[0].coupleId,
      );
      if (members.length !== 2) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      const expectedByRole = new Map([
        ["primary", args.primaryClerkId],
        ["partner", args.partnerClerkId],
      ]);
      for (const member of members) {
        const memberUser = await ctx.db.get("users", member.userId);
        const expectedMemberEmail =
          `cb-connect-e2e+${args.runId}-${member.role}@example.com`;
        const hasExpectedMemberEmail =
          memberUser?.email === expectedMemberEmail ||
          // Primary registration runs first so it can bind the couple to the
          // durable fixture run. The partner may still have the empty email
          // written by ensureUser when Clerk omits email from the Convex JWT;
          // partner registration authenticates that exact Clerk subject and
          // fills the deterministic email immediately afterwards.
          (member.role === "partner" && memberUser?.email === "");
        if (
          !memberUser ||
          memberUser.clerkId !== expectedByRole.get(member.role) ||
          memberUser.role !== member.role ||
          !hasExpectedMemberEmail
        ) {
          throw new Error("fixture_cleanup_identity_mismatch");
        }
      }
      if (
        fixtureRun.coupleId !== undefined &&
        fixtureRun.coupleId !== memberships[0].coupleId
      ) {
        throw new Error("fixture_cleanup_identity_mismatch");
      }
      await ctx.db.patch(fixtureRun._id, {
        coupleId: memberships[0].coupleId,
      });
    } else if (
      args.clerkId !== args.partnerClerkId ||
      fixtureRun.coupleId === undefined
    ) {
      throw new Error("fixture_cleanup_identity_mismatch");
    }
    return { registered: true };
  },
});

export const getFixtureCleanupStatus = query({
  args: fixtureArgs,
  returns: statusResult,
  handler: async (ctx, args) => {
    assertFixtureScopeAllowed();
    assertFixtureArgs(args);
    await assertAuthenticatedFixturePrimary(ctx, args);
    const records = await loadFixtureRecords(ctx, args);
    return { remaining: hasRemaining(records), counts: countRecords(records) };
  },
});

export const cleanupFixture = mutation({
  args: fixtureArgs,
  returns: cleanupResult,
  handler: async (ctx, args) => {
    assertFixtureScopeAllowed();
    assertFixtureArgs(args);
    await assertAuthenticatedFixturePrimary(ctx, args);
    const records = await loadFixtureRecords(ctx, args);
    const deleted = countRecords(records);

    for (const row of records.coupleMessageReactions) await ctx.db.delete(row._id);
    for (const row of records.coupleMessages) await ctx.db.delete(row._id);
    for (const row of records.coupleChatStates) await ctx.db.delete(row._id);
    for (const row of records.nudges) await ctx.db.delete(row._id);
    for (const row of records.presence) await ctx.db.delete(row._id);
    for (const row of records.pairingCodeAttempts) await ctx.db.delete(row._id);
    for (const row of records.pairingCodes) await ctx.db.delete(row._id);
    for (const row of records.periodEvents) await ctx.db.delete(row._id);
    for (const row of records.painLogs) await ctx.db.delete(row._id);
    for (const row of records.cycleSettings) await ctx.db.delete(row._id);
    for (const row of records.hiddenNutrition) await ctx.db.delete(row._id);
    for (const row of records.notificationLog) await ctx.db.delete(row._id);
    for (const row of records.coupleMembers) await ctx.db.delete(row._id);
    for (const row of records.couples) await ctx.db.delete(row._id);
    for (const row of records.users) await ctx.db.delete(row._id);

    const fixtureRun = await getFixtureRun(ctx, args);
    await ctx.db.patch(fixtureRun._id, { cleanedAt: Date.now() });

    return { ok: true, deleted, remaining: false };
  },
});
