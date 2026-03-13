import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import { calculateCycleInfo, getPainSeverityBucket } from "../_helpers/cycleCalculations";

export const getDashboardData = query({
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return {
        hasData: false,
        isPartnerView: false,
        message: "Please sign in to view your dashboard.",
        cycleInfo: null,
        painData: null,
        painTip: null,
        nutritionTips: [],
      };
    }

    let targetUserId = user._id;
    let isPartnerView = false;

    if (user.role === "partner") {
      const coupleData = await getCoupleForUser(ctx, user._id);
      if (!coupleData) {
        return { hasData: false, isPartnerView: true, message: "Not linked to a partner yet." };
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (!primaryMembership) {
        return { hasData: false, isPartnerView: true, message: "Couple has no primary user." };
      }

      targetUserId = primaryMembership.userId;
      isPartnerView = true;
    }

    // Get cycle settings
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    // Get most recent period event
    const recentPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .first();

    if (!recentPeriod) {
      return {
        hasData: false,
        isPartnerView,
        message: "No period data yet. Log your last period to get started.",
      };
    }

    // Calculate current cycle info
    const cycleInfo = calculateCycleInfo(
      recentPeriod.startDate,
      cycleLength,
      periodLength
    );

    // Get today's pain log
    const today = new Date().toISOString().split("T")[0];
    const todayPainLog = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).eq("date", today)
      )
      .unique();

    // Check sharing permissions if partner view
    let painData = null;
    if (isPartnerView) {
      const coupleData = await getCoupleForUser(ctx, user._id);
      // Check primary's membership for sharing settings
      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", coupleData!.membership.coupleId).eq("role", "primary")
        )
        .first();

      if (primaryMembership?.sharingPain && todayPainLog) {
        painData = {
          score: todayPainLog.painScore,
          severity: getPainSeverityBucket(todayPainLog.painScore),
        };
      }
      // Phase sharing check
      if (!primaryMembership?.sharingPhase) {
        return {
          hasData: true,
          isPartnerView,
          cycleInfo: null,
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
      cycleInfo,
      painData,
      painTip,
      nutritionTips,
    };
  },
});
