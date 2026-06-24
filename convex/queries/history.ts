import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { calculateCycleInfo } from "../_helpers/cycleCalculations";
import {
  getTimelinePhaseForDate,
  type TimelinePhase,
} from "../_helpers/timelinePhases";

export const getPainHistory = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    let targetUserId = user._id;
    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return [];
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership?.sharingPain) {
        return [];
      }

      targetUserId = primaryMembership.userId;
    }

    const logs = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).gte("date", args.startDate)
      )
      .filter((q) => q.lte(q.field("date"), args.endDate))
      .collect();

    return logs;
  },
});

export const getPeriodHistory = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    let targetUserId = user._id;
    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return [];
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership?.sharingPhase) {
        return [];
      }

      targetUserId = primaryMembership.userId;
    }

    const periods = await ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .collect();

    return await enrichPeriodEvents(ctx, periods, user._id);
  },
});

export const getCycleSettings = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return { cycleLength: 28, periodLength: 5 };
    }

    const settings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return settings ?? { cycleLength: 28, periodLength: 5 };
  },
});

export const getPredictionInputsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const recentPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    if (!recentPeriod) {
      return null;
    }

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    return {
      cycleLength,
      periodLength,
      recentPeriodStart: recentPeriod.startDate,
      cycleInfo: calculateCycleInfo(
        recentPeriod.startDate,
        cycleLength,
        periodLength
      ),
    };
  },
});

export const getTimelineHistory = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return [];
    }

    let targetUserId = user._id;
    let canViewPain = true;
    let canViewPhase = true;

    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return [];
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership) {
        return [];
      }

      targetUserId = primaryMembership.userId;
      canViewPain = primaryMembership.sharingPain;
      canViewPhase = primaryMembership.sharingPhase;
    }

    if (!canViewPain && !canViewPhase) {
      return [];
    }

    const periods = canViewPhase
      ? await ctx.db
          .query("periodEvents")
          .withIndex("by_user_and_start", (q) => q.eq("userId", targetUserId))
          .order("desc")
          .collect()
      : [];

    const painLogs = canViewPain
      ? await ctx.db
          .query("painLogs")
          .withIndex("by_user_and_date", (q) =>
            q.eq("userId", targetUserId).gte("date", args.startDate)
          )
          .filter((q) => q.lte(q.field("date"), args.endDate))
          .collect()
      : [];

    const cycleSettings = canViewPhase
      ? await ctx.db
          .query("cycleSettings")
          .withIndex("by_user", (q) => q.eq("userId", targetUserId))
          .unique()
      : null;

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    const timelineEntries: Array<{
      date: string;
      phase: TimelinePhase;
      type: "period" | "pain";
      isOngoing?: boolean;
      pain?: { score: number; tags?: string[]; note?: string };
      period?: {
        id: Id<"periodEvents">;
        startDate: string;
        endDate?: string;
        source: "self" | "partner_assist" | "system";
        confirmationStatus: "confirmed" | "unreviewed";
        createdByUserId: Id<"users">;
        updatedByUserId: Id<"users">;
        createdByName: string;
        updatedByName: string;
        canCorrect: boolean;
      };
    }> = [];

    const enrichedPeriods = await enrichPeriodEvents(ctx, periods, user._id);
    for (const period of enrichedPeriods) {
      timelineEntries.push({
        date: period.startDate,
        phase: "menstruation",
        type: "period",
        isOngoing: !period.endDate,
        period: {
          id: period._id,
          startDate: period.startDate,
          endDate: period.endDate,
          source: period.source,
          confirmationStatus: period.confirmationStatus,
          createdByUserId: period.createdByUserId,
          updatedByUserId: period.updatedByUserId,
          createdByName: period.createdByName,
          updatedByName: period.updatedByName,
          canCorrect: period.canCorrect,
        },
      });
    }

    for (const pain of painLogs) {
      timelineEntries.push({
        date: pain.date,
        phase: canViewPhase
          ? getTimelinePhaseForDate(
              pain.date,
              periods,
              cycleLength,
              periodLength
            )
          : "private",
        type: "pain",
        pain: { score: pain.painScore, tags: pain.tags, note: pain.note },
      });
    }

    timelineEntries.sort((a, b) => b.date.localeCompare(a.date));
    return timelineEntries;
  },
});

async function enrichPeriodEvents(
  ctx: QueryCtx,
  periods: Doc<"periodEvents">[],
  viewerId: Id<"users">
) {
  const userIds = new Set<Id<"users">>();
  for (const period of periods) {
    userIds.add(period.userId);
    if (period.createdByUserId) userIds.add(period.createdByUserId);
    if (period.updatedByUserId) userIds.add(period.updatedByUserId);
  }

  const users = await Promise.all(
    Array.from(userIds, async (userId) => {
      return [userId, await ctx.db.get("users", userId)] as const;
    })
  );
  const names = new Map(
    users.map(([userId, user]) => [
      userId,
      user?.preferredName || user?.name || "Partner",
    ])
  );

  return periods.map((period) => {
    const createdByUserId = period.createdByUserId ?? period.userId;
    const updatedByUserId = period.updatedByUserId ?? period.userId;
    return {
      ...period,
      source: period.source ?? ("self" as const),
      confirmationStatus:
        period.confirmationStatus ?? ("confirmed" as const),
      createdByUserId,
      updatedByUserId,
      createdByName: names.get(createdByUserId) ?? "Partner",
      updatedByName: names.get(updatedByUserId) ?? "Partner",
      canCorrect: period.userId === viewerId,
    };
  });
}
