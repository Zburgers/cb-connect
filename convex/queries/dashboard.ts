import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import {
  calculateCycleInfo,
  getPainSeverityBucket,
} from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import { buildCycleReadModel } from "../_helpers/cycleReadModel";
import { isHistoryVisible } from "../_helpers/cycleFactEligibility";
import { isCycleStateV1ExposedToUser } from "../_helpers/cycleStateExposure";
import { projectCycleState } from "../_helpers/partnerCycleProjection";

const MAX_CYCLE_FACT_ROWS = 100;

export const getDashboardData = query({
  args: {
    todayDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return {
        hasData: false,
        isPartnerView: false,
        message: "Please sign in to view your dashboard.",
        cycleInfo: null,
        cycleStateV1: null,
        cycleStateV1Exposed: false,
        painData: null,
        painTip: null,
        nutritionTips: [],
      };
    }

    let targetUserId = user._id;
    let targetUser = user;
    let isPartnerView = false;
    let primaryMembership: Doc<"coupleMembers"> | null = null;
    let partnerCoupleStatus: "pending" | "active" | "revoked" = "active";

    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return {
          hasData: false,
          isPartnerView: true,
          message: "Not linked to a partner yet.",
          cycleStateV1: null,
          cycleStateV1Exposed: false,
        };
      }

      partnerCoupleStatus = coupleData.couple.status;

      primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership) {
        return {
          hasData: false,
          isPartnerView: true,
          message: "Couple has no primary user.",
          cycleStateV1: null,
          cycleStateV1Exposed: false,
        };
      }

      targetUserId = primaryMembership.userId;
      const primaryUser = await ctx.db.get(targetUserId);
      if (!primaryUser) {
        return {
          hasData: false,
          isPartnerView: true,
          message: "Couple has no primary user.",
          cycleStateV1: null,
          cycleStateV1Exposed: false,
        };
      }
      targetUser = primaryUser;
      isPartnerView = true;
    }

    const canViewPhase = !isPartnerView || primaryMembership?.sharingPhase === true;
    const cycleStateV1Exposed = isCycleStateV1ExposedToUser(user, targetUser);

    // Get cycle settings
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    // Keep the semantic input bounded while retaining the newest Gate 1 facts.
    const periodEvents = await ctx.db
      .query("periodEvents")
      .withIndex("by_user_and_start", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .take(MAX_CYCLE_FACT_ROWS);
    const visiblePeriodEvents = periodEvents.filter(isHistoryVisible);
    const recentPeriod = visiblePeriodEvents[0];

    const today =
      args.todayDate ?? toCalendarDateInTimeZone(new Date(), targetUser.timeZone);

    const readModel =
      cycleStateV1Exposed && canViewPhase
        ? buildCycleReadModel({
            targetDate: today,
            timeZone: targetUser.timeZone,
            cycleLength,
            periodLength,
            predictionPaused: cycleSettings?.predictionPaused ?? false,
            periods: visiblePeriodEvents.map((period) => ({
              id: period._id,
              startDate: period.startDate,
              endDate: period.endDate,
              startCertainty: period.startCertainty,
              endCertainty: period.endCertainty,
              legacyReason: period.legacyReason,
              tombstoneAt: period.tombstoneAt,
            })),
          })
        : null;

    // The server is the privacy boundary. A partner never receives the
    // primary CycleState, even transiently; only the enumerated projection
    // can cross this query boundary.
    const cycleStateV1 = readModel
      ? isPartnerView
          ? projectCycleState(readModel.cycleStateV1, {
              role: "partner",
              coupleStatus: partnerCoupleStatus,
              hasMembership: primaryMembership !== null,
              sharingEnabled: canViewPhase,
              consentGranted: canViewPhase,
            })
          : projectCycleState(readModel.cycleStateV1, {
              role: "primary",
              coupleStatus: "active",
              hasMembership: true,
              sharingEnabled: false,
              consentGranted: false,
            })
      : null;
    const partnerV1View = isPartnerView && cycleStateV1Exposed;

    if (!recentPeriod) {
      return {
        hasData: false,
        isPartnerView,
        message: "No period data yet. Log your last period to get started.",
        cycleInfo: null,
        cycleStateV1,
        cycleStateV1Exposed,
        painData: null,
        painTip: null,
        nutritionTips: [],
      };
    }

    // Calculate current cycle info
    const cycleInfo =
      readModel?.cycleInfo ??
      (cycleStateV1Exposed
        ? null
        : calculateCycleInfo(
            recentPeriod.startDate,
            cycleLength,
            periodLength,
            today
          ));

    // Get today's pain log
    const todayPainLog = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).eq("date", today)
      )
      .unique();

    // Check sharing permissions if partner view
    let painData = null;
    if (isPartnerView) {
      if (primaryMembership?.sharingPain && todayPainLog) {
        painData = {
          score: todayPainLog.painScore,
          severity: getPainSeverityBucket(todayPainLog.painScore),
        };
      }
      // Phase sharing check
      if (!canViewPhase) {
        return {
          hasData: true,
          isPartnerView,
          cycleInfo: null,
          cycleStateV1: null,
          cycleStateV1Exposed,
          painData,
          painTip: null,
          nutritionTips: [],
        };
      }
    } else {
      painData = todayPainLog
        ? {
            score: todayPainLog.painScore,
            severity: getPainSeverityBucket(todayPainLog.painScore),
            tags: todayPainLog.tags,
            note: todayPainLog.note,
          }
        : null;
    }

    if (!cycleInfo) {
      return {
        hasData: true,
        isPartnerView,
        cycleInfo: null,
        cycleStateV1,
        cycleStateV1Exposed,
        painData,
        painTip: null,
        nutritionTips: [],
      };
    }

    // Get relevant pain tip
    const painSeverity = painData ? getPainSeverityBucket(painData.score) : "none";
    const painTip = await ctx.db
      .query("painTips")
      .withIndex("by_phase_and_severity", (q) =>
        q.eq("phase", cycleInfo.phase).eq("painSeverity", painSeverity).eq("isActive", true)
      )
      .order("desc")
      .first();

    // Get nutrition tips (3 per day, deterministic shuffle)
    const allNutritionTips = await ctx.db
      .query("nutritionTips")
      .withIndex("by_phase", (q) =>
        q.eq("phase", cycleInfo.phase).eq("isActive", true)
      )
      .collect();

    // Filter out hidden tips
    const hiddenTips = await ctx.db
      .query("hiddenNutrition")
      .withIndex("by_user", (q) => q.eq("userId", isPartnerView ? targetUserId : user._id))
      .collect();

    const hiddenTipIds = new Set(
      hiddenTips
        .filter((h) => h.hiddenUntil > Date.now())
        .map((h) => h.nutritionTipId.toString())
    );

    const visibleTips = allNutritionTips.filter(
      (t) => !hiddenTipIds.has(t._id.toString())
    );

    const seed = parseInt(today.replace(/-/g, ""), 10);
    const shuffled = [...visibleTips].sort((a, b) => {
      const hashA = (seed + a._id.toString().charCodeAt(0)) % 1000;
      const hashB = (seed + b._id.toString().charCodeAt(0)) % 1000;
      return hashA - hashB;
    });

    const nutritionTips = shuffled.slice(0, 3);

    return {
      hasData: true,
      isPartnerView,
      cycleInfo: partnerV1View ? null : cycleInfo,
      cycleStateV1,
      cycleStateV1Exposed,
      painData,
      painTip: partnerV1View ? null : painTip,
      nutritionTips: partnerV1View ? [] : nutritionTips,
    };
  },
});
