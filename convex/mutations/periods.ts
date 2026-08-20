import { v } from "convex/values";
import {
  mutation,
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";
import { addCalendarDays, toCalendarDateString } from "../_helpers/cycleCalculations";
import {
  requirePastOrTodayCalendarDate,
  resolveCalendarTimeZone,
} from "../_helpers/calendarDates";
import {
  evaluatePeriodEventInvariants,
  type PeriodEventCandidate,
} from "../_helpers/periodEventInvariants";
import type { CycleFactCertainty } from "../_helpers/cycleFactSemantics";

const cycleFactCertaintyValidator = v.union(
  v.literal("exact"),
  v.literal("approximate")
);

function currentAuthorityVersion(period: Doc<"periodEvents">): number {
  return period.authorityVersion ?? 0;
}

function storedStartCertainty(
  period: Doc<"periodEvents">
): CycleFactCertainty {
  return period.startCertainty ?? "legacy_unknown";
}

function storedEndCertainty(
  period: Doc<"periodEvents">
): CycleFactCertainty | undefined {
  if (period.endDate === undefined) return undefined;
  return period.endCertainty ?? "legacy_unknown";
}

function storedLegacyReason(period: Doc<"periodEvents">) {
  const startUnknown = storedStartCertainty(period) === "legacy_unknown";
  const endUnknown = storedEndCertainty(period) === "legacy_unknown";
  return startUnknown || endUnknown
    ? period.legacyReason ?? "missing_provenance"
    : undefined;
}

function toPeriodEventProjection(period: Doc<"periodEvents">) {
  const lastWriterIsPrimary =
    period.updatedByUserId === period.userId ||
    (period.updatedByUserId === undefined && period.source !== "partner_assist");
  return {
    id: period._id,
    startDate: period.startDate,
    endDate: period.endDate,
    startCertainty: period.startCertainty,
    endCertainty: period.endCertainty,
    authorityVersion: period.authorityVersion,
    lastWriterRole: lastWriterIsPrimary ? ("primary" as const) : ("partner" as const),
  };
}

async function requireAllowedPeriodEventWrite(
  ctx: MutationCtx,
  userId: Id<"users">,
  candidate: PeriodEventCandidate
) {
  const existingEvents = await ctx.db
    .query("periodEvents")
    .withIndex("by_user_and_start", (q) => q.eq("userId", userId))
    .order("desc")
    .take(100);
  const result = evaluatePeriodEventInvariants(
    candidate,
    existingEvents
      .filter((period) => period.tombstoneAt === undefined)
      .map(toPeriodEventProjection)
  );
  if (!result.allowed) {
    throw new Error(`${result.code}: ${result.message}`);
  }
}

function requirePrimaryUser(user: Doc<"users">) {
  if (user.role !== "primary") {
    throw new Error("Only the primary user can update cycle data");
  }
}

async function findOpenPeriod(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<Doc<"periodEvents"> | null> {
  const recentPeriods = await ctx.db
    .query("periodEvents")
    .withIndex("by_user_and_start", (q) => q.eq("userId", userId))
    .order("desc")
    .take(100);

  return recentPeriods.find(
    (period) => !period.endDate && period.tombstoneAt === undefined
  ) ?? null;
}

async function getAssistedLoggingContext(ctx: MutationCtx) {
  const partner = await getCurrentUser(ctx);
  if (partner.role !== "partner") {
    throw new Error("Only a partner can use assisted period logging");
  }

  const coupleData = await getCoupleForUser(ctx, partner._id);
  if (!coupleData || coupleData.couple.status !== "active") {
    throw new Error("You are not part of an active couple");
  }

  const primaryMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role", (q) =>
      q.eq("coupleId", coupleData.couple._id).eq("role", "primary")
    )
    .unique();
  if (!primaryMembership) {
    throw new Error("Primary cycle member could not be found");
  }
  if (!primaryMembership.sharingPhase) {
    throw new Error("Period history is not shared");
  }
  if (!(primaryMembership.sharingPeriodWrite ?? false)) {
    throw new Error("Assisted period logging is not enabled");
  }

  const primaryUser = await ctx.db.get("users", primaryMembership.userId);
  if (!primaryUser) {
    throw new Error("Primary cycle member could not be found");
  }

  return { partner, primaryMembership, primaryUser };
}

export const logPeriodStart = mutation({
  args: {
    startDate: v.string(),
    timeZone: v.optional(v.string()),
    startCertainty: v.optional(cycleFactCertaintyValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePrimaryUser(user);
    const timeZone = resolveCalendarTimeZone(args.timeZone ?? user.timeZone);
    if (args.timeZone !== undefined && args.timeZone !== user.timeZone) {
      await ctx.db.patch(user._id, { timeZone });
    }
    requirePastOrTodayCalendarDate(args.startDate, "Start date", timeZone);

    await requireAllowedPeriodEventWrite(ctx, user._id, {
      startDate: args.startDate,
      startCertainty: args.startCertainty ?? "exact",
      authorityVersion: 1,
      actorRole: "primary",
    });

    const eventId = await ctx.db.insert("periodEvents", {
      userId: user._id,
      startDate: args.startDate,
      createdByUserId: user._id,
      updatedByUserId: user._id,
      source: "self",
      confirmationStatus: "confirmed",
      startCertainty: args.startCertainty ?? "exact",
      authorityVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { eventId };
  },
});

export const logPeriodEnd = mutation({
  args: {
    endDate: v.string(),
    timeZone: v.optional(v.string()),
    endCertainty: v.optional(cycleFactCertaintyValidator),
    expectedAuthorityVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePrimaryUser(user);
    const timeZone = resolveCalendarTimeZone(args.timeZone ?? user.timeZone);
    if (args.timeZone !== undefined && args.timeZone !== user.timeZone) {
      await ctx.db.patch(user._id, { timeZone });
    }
    requirePastOrTodayCalendarDate(args.endDate, "End date", timeZone);

    const ongoingPeriod = await findOpenPeriod(ctx, user._id);

    if (!ongoingPeriod) {
      throw new Error("No ongoing period to end");
    }

    if (args.endDate < ongoingPeriod.startDate) {
      throw new Error("End date cannot be before start date");
    }

    const authorityVersion = currentAuthorityVersion(ongoingPeriod);
    await requireAllowedPeriodEventWrite(ctx, user._id, {
      startDate: ongoingPeriod.startDate,
      endDate: args.endDate,
      startCertainty: storedStartCertainty(ongoingPeriod),
      endCertainty: args.endCertainty ?? "exact",
      legacyReason: storedLegacyReason(ongoingPeriod),
      authorityVersion: authorityVersion + 1,
      actorRole: "primary",
      targetEventId: ongoingPeriod._id,
      expectedAuthorityVersion:
        args.expectedAuthorityVersion ?? authorityVersion,
    });

    await ctx.db.patch(ongoingPeriod._id, {
      endDate: args.endDate,
      endCertainty: args.endCertainty ?? "exact",
      updatedByUserId: user._id,
      authorityVersion: authorityVersion + 1,
      updatedAt: Date.now(),
    });

    return { eventId: ongoingPeriod._id };
  },
});

export const assistLogPeriodStart = mutation({
  args: {
    startDate: v.string(),
    startCertainty: v.optional(cycleFactCertaintyValidator),
  },
  handler: async (ctx, args) => {
    const { partner, primaryMembership, primaryUser } =
      await getAssistedLoggingContext(ctx);
    requirePastOrTodayCalendarDate(
      args.startDate,
      "Start date",
      resolveCalendarTimeZone(primaryUser.timeZone)
    );
    await requireAllowedPeriodEventWrite(ctx, primaryMembership.userId, {
      startDate: args.startDate,
      startCertainty: args.startCertainty ?? "exact",
      authorityVersion: 1,
      actorRole: "partner",
      partnerAccess: "active",
    });

    const now = Date.now();

    const eventId = await ctx.db.insert("periodEvents", {
      userId: primaryMembership.userId,
      startDate: args.startDate,
      createdByUserId: partner._id,
      updatedByUserId: partner._id,
      source: "partner_assist",
      confirmationStatus: "confirmed",
      startCertainty: args.startCertainty ?? "exact",
      authorityVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("notificationLog", {
      userId: primaryMembership.userId,
      type: "partner_assisted_period_start",
      payload: {
        startDate: args.startDate,
        partnerName: partner.preferredName || partner.name,
      },
      sentAt: now,
      status: "sent",
    });

    return { eventId };
  },
});

export const assistLogPeriodEnd = mutation({
  args: {
    endDate: v.string(),
    endCertainty: v.optional(cycleFactCertaintyValidator),
    expectedAuthorityVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { partner, primaryMembership, primaryUser } =
      await getAssistedLoggingContext(ctx);
    requirePastOrTodayCalendarDate(
      args.endDate,
      "End date",
      resolveCalendarTimeZone(primaryUser.timeZone)
    );
    const ongoingPeriod = await findOpenPeriod(ctx, primaryMembership.userId);
    if (!ongoingPeriod) {
      throw new Error("There is no ongoing period to end");
    }
    if (args.endDate < ongoingPeriod.startDate) {
      throw new Error("End date cannot be before start date");
    }

    const authorityVersion = currentAuthorityVersion(ongoingPeriod);
    await requireAllowedPeriodEventWrite(ctx, primaryMembership.userId, {
      startDate: ongoingPeriod.startDate,
      endDate: args.endDate,
      startCertainty: storedStartCertainty(ongoingPeriod),
      endCertainty: args.endCertainty ?? "exact",
      legacyReason: storedLegacyReason(ongoingPeriod),
      authorityVersion: authorityVersion + 1,
      actorRole: "partner",
      partnerAccess: "active",
      targetEventId: ongoingPeriod._id,
      expectedAuthorityVersion:
        args.expectedAuthorityVersion ?? authorityVersion,
    });

    const now = Date.now();
    await ctx.db.patch(ongoingPeriod._id, {
      endDate: args.endDate,
      endCertainty: args.endCertainty ?? "exact",
      updatedByUserId: partner._id,
      authorityVersion: authorityVersion + 1,
      updatedAt: now,
    });
    await ctx.db.insert("notificationLog", {
      userId: primaryMembership.userId,
      type: "partner_assisted_period_end",
      payload: {
        endDate: args.endDate,
        partnerName: partner.preferredName || partner.name,
      },
      sentAt: now,
      status: "sent",
    });

    return { eventId: ongoingPeriod._id };
  },
});

export const updatePeriodEvent = mutation({
  args: {
    periodEventId: v.id("periodEvents"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    startCertainty: v.optional(cycleFactCertaintyValidator),
    endCertainty: v.optional(cycleFactCertaintyValidator),
    expectedAuthorityVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePrimaryUser(user);
    const period = await ctx.db.get("periodEvents", args.periodEventId);
    if (!period || period.userId !== user._id) {
      throw new Error("You can only correct your own period entries");
    }

    const timeZone = resolveCalendarTimeZone(args.timeZone ?? user.timeZone);
    if (args.timeZone !== undefined && args.timeZone !== user.timeZone) {
      await ctx.db.patch(user._id, { timeZone });
    }
    requirePastOrTodayCalendarDate(args.startDate, "Start date", timeZone);
    if (args.endDate !== undefined) {
      requirePastOrTodayCalendarDate(args.endDate, "End date", timeZone);
      if (args.endDate < args.startDate) {
        throw new Error("End date cannot be before start date");
      }
    }

    const authorityVersion = currentAuthorityVersion(period);
    const endCertainty =
      args.endDate === undefined
        ? undefined
        : args.endCertainty ?? "exact";
    await requireAllowedPeriodEventWrite(ctx, user._id, {
      startDate: args.startDate,
      endDate: args.endDate,
      startCertainty: args.startCertainty ?? "exact",
      endCertainty,
      authorityVersion: authorityVersion + 1,
      actorRole: "primary",
      targetEventId: period._id,
      expectedAuthorityVersion:
        args.expectedAuthorityVersion ?? authorityVersion,
    });

    await ctx.db.patch(args.periodEventId, {
      startDate: args.startDate,
      endDate: args.endDate,
      startCertainty: args.startCertainty ?? "exact",
      endCertainty,
      legacyReason: undefined,
      updatedByUserId: user._id,
      confirmationStatus: "confirmed",
      authorityVersion: authorityVersion + 1,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const deletePeriodEvent = mutation({
  args: {
    periodEventId: v.id("periodEvents"),
    expectedAuthorityVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePrimaryUser(user);
    const period = await ctx.db.get("periodEvents", args.periodEventId);
    if (!period || period.userId !== user._id) {
      throw new Error("You can only delete your own period entries");
    }

    const authorityVersion = currentAuthorityVersion(period);
    await requireAllowedPeriodEventWrite(ctx, user._id, {
      startDate: period.startDate,
      endDate: period.endDate,
      startCertainty: storedStartCertainty(period),
      endCertainty: storedEndCertainty(period),
      legacyReason: storedLegacyReason(period),
      authorityVersion: authorityVersion + 1,
      actorRole: "primary",
      targetEventId: period._id,
      expectedAuthorityVersion:
        args.expectedAuthorityVersion ?? authorityVersion,
    });

    const tombstoneAt = Date.now();
    await ctx.db.patch(args.periodEventId, {
      authorityVersion: authorityVersion + 1,
      tombstoneByUserId: user._id,
      tombstoneAt,
      tombstoneAuthorityVersion: authorityVersion + 1,
      updatedByUserId: user._id,
      updatedAt: tombstoneAt,
    });
    return { success: true };
  },
});

export const autoEndPeriods = internalMutation({
  handler: async (ctx) => {
    // Find all ongoing (open) periods
    const openPeriods = await ctx.db
      .query("periodEvents")
      .filter((q) => q.eq(q.field("endDate"), undefined))
      .collect();

    let endedCount = 0;

    for (const period of openPeriods) {
      // Get the user's cycle settings
      const settings = await ctx.db
        .query("cycleSettings")
        .withIndex("by_user", (q) => q.eq("userId", period.userId))
        .unique();

      const periodLength = settings?.periodLength ?? 5;

      // Calculate expected end date
      const expectedEndDate = addCalendarDays(period.startDate, periodLength - 1);
      const today = toCalendarDateString();

      // If past the expected end date, auto-close it
      if (expectedEndDate < today) {
        await ctx.db.patch(period._id, {
          endDate: expectedEndDate,
          ...(period.source === undefined && { source: "system" as const }),
          updatedAt: Date.now(),
        });
        endedCount++;
      }
    }

    console.log(`autoEndPeriods: closed ${endedCount} open period(s)`);
    return { endedCount };
  },
});

export const updateCycleSettings = mutation({
  args: {
    cycleLength: v.optional(v.number()),
    periodLength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    requirePrimaryUser(user);

    if (args.cycleLength !== undefined) {
      if (args.cycleLength < 21 || args.cycleLength > 40) {
        throw new Error("Cycle length must be between 21 and 40 days");
      }
    }

    if (args.periodLength !== undefined) {
      if (args.periodLength < 2 || args.periodLength > 8) {
        throw new Error("Period length must be between 2 and 8 days");
      }
    }

    const existing = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.cycleLength !== undefined && {
          cycleLength: args.cycleLength,
        }),
        ...(args.periodLength !== undefined && {
          periodLength: args.periodLength,
        }),
        lastUpdatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("cycleSettings", {
        userId: user._id,
        cycleLength: args.cycleLength ?? 28,
        periodLength: args.periodLength ?? 5,
        lastUpdatedAt: Date.now(),
      });
    }
  },
});
