import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getCurrentUserOrNull, getCoupleForUser } from "../_helpers/auth";
import {
  calculateCycleInfo,
  getPainSeverityBucket,
  type CycleInfo,
} from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import { buildCycleReadModel } from "../_helpers/cycleReadModel";
import { readCyclePredictionData } from "../_helpers/cyclePredictionData";
import { isHistoryVisible } from "../_helpers/cycleFactEligibility";
import { isCycleStateV1ExposedToUser } from "../_helpers/cycleStateExposure";
import {
  isPartnerPredictionV2Enabled,
  isPeriodPredictionV2Enabled,
} from "../_helpers/periodPredictionFlag";
import {
  projectCycleState,
  projectPartnerPrediction,
  type PartnerPredictionV2Projection,
} from "../_helpers/partnerCycleProjection";
import type { PredictionBounds } from "../_helpers/predictionBounds";
import type { CycleState } from "../_helpers/cycleState";
import type { PartnerCycleProjection } from "../_helpers/partnerCycleProjection";
import {
  buildPeriodPrediction,
  type PeriodPredictionV2,
} from "../_helpers/periodPrediction";
import {
  currentPredictionSnapshotInput,
  readServedPeriodPrediction,
} from "../_helpers/predictionSnapshotContract";

const MAX_CYCLE_FACT_ROWS = 100;

type DashboardData = {
  hasData: boolean;
  isPartnerView: boolean;
  message?: string;
  cycleInfo?: CycleInfo | null;
  nutritionTipsPhase: CycleInfo["phase"] | null;
  cycleStateV1: CycleState | PartnerCycleProjection | null;
  cycleStateV1Exposed: boolean;
  periodPredictionV2?: PeriodPredictionV2;
  partnerPredictionV2?: PartnerPredictionV2Projection;
  partnerPredictionV2Exposed: boolean;
  painData?: {
    score: number;
    severity: ReturnType<typeof getPainSeverityBucket>;
    tags?: Doc<"painLogs">["tags"];
    note?: string;
  } | null;
  painTip?: Doc<"painTips"> | null;
  nutritionTips?: Doc<"nutritionTips">[];
};

function getV2Bounds(
  prediction: PeriodPredictionV2 | null,
): PredictionBounds | null {
  switch (prediction?.status) {
    case "configured":
    case "personalized":
    case "limited_evidence":
      return prediction;
    default:
      return null;
  }
}

export const getDashboardData = query({
  args: {
    todayDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DashboardData> => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return {
        hasData: false,
        isPartnerView: false,
        message: "Please sign in to view your dashboard.",
        cycleInfo: null,
        nutritionTipsPhase: null,
        cycleStateV1: null,
        cycleStateV1Exposed: false,
        partnerPredictionV2Exposed: false,
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
          nutritionTipsPhase: null,
          cycleStateV1: null,
          cycleStateV1Exposed: false,
          partnerPredictionV2Exposed: false,
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
          nutritionTipsPhase: null,
          cycleStateV1: null,
          cycleStateV1Exposed: false,
          partnerPredictionV2Exposed: false,
        };
      }

      targetUserId = primaryMembership.userId;
      const primaryUser = await ctx.db.get(targetUserId);
      if (!primaryUser) {
        return {
          hasData: false,
          isPartnerView: true,
          message: "Couple has no primary user.",
          nutritionTipsPhase: null,
          cycleStateV1: null,
          cycleStateV1Exposed: false,
          partnerPredictionV2Exposed: false,
        };
      }
      targetUser = primaryUser;
      isPartnerView = true;
    }

    const canViewPhase =
      !isPartnerView ||
      (partnerCoupleStatus === "active" &&
        primaryMembership?.sharingPhase === true);
    const cycleStateV1Exposed = isCycleStateV1ExposedToUser(user, targetUser);

    // Get cycle settings
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;
    const periodPredictionV2Enabled =
      user.role === "primary" && isPeriodPredictionV2Enabled();
    const partnerPredictionV2Enabled =
      isPartnerView &&
      partnerCoupleStatus === "active" &&
      primaryMembership !== null &&
      canViewPhase &&
      isPeriodPredictionV2Enabled() &&
      isPartnerPredictionV2Enabled();
    const predictionV2EnabledForTarget =
      periodPredictionV2Enabled || partnerPredictionV2Enabled;

    // Keep Gate 2's default input bounded; V2 reuses the full history below.
    const periodEvents = predictionV2EnabledForTarget || !canViewPhase
      ? []
      : await ctx.db
          .query("periodEvents")
          .withIndex("by_user_and_start", (q) => q.eq("userId", targetUserId))
          .order("desc")
          .take(MAX_CYCLE_FACT_ROWS);
    const visiblePeriodEvents = periodEvents.filter(isHistoryVisible);

    const today =
      args.todayDate ?? toCalendarDateInTimeZone(new Date(), targetUser.timeZone);
    const predictionData = predictionV2EnabledForTarget
      ? await readCyclePredictionData(ctx, targetUserId, targetUser)
      : null;
    const recentPeriod = predictionData
      ? predictionData.periodEvents.find(isHistoryVisible)
      : visiblePeriodEvents[0];
    let periodPredictionV2: PeriodPredictionV2 | null = null;
    if (predictionData) {
      const currentPrediction = buildPeriodPrediction({
        cycleIntervals: predictionData.cycleIntervals,
        historyComplete: predictionData.historyComplete,
        configuredCycleLength: cycleLength,
        predictionPaused: cycleSettings?.predictionPaused ?? false,
      });
      periodPredictionV2 = await readServedPeriodPrediction(
        ctx,
        targetUserId,
        currentPredictionSnapshotInput({
          prediction: currentPrediction,
          inputCutoffAt: predictionData.cycleIntervals.basis.cutoffAt,
          inputCutoffDate: predictionData.cycleIntervals.basis.cutoffDate,
          periodEvents: predictionData.periodEvents,
          settings: cycleSettings,
          activeSegment: predictionData.activeSegment,
        }),
      );
    }
    const v2Bounds = getV2Bounds(periodPredictionV2);

    const readModel =
      (cycleStateV1Exposed || predictionV2EnabledForTarget) && canViewPhase
        ? buildCycleReadModel({
            targetDate: today,
            timeZone: targetUser.timeZone,
            cycleLength,
            periodLength,
            predictionPaused: cycleSettings?.predictionPaused ?? false,
            ...(predictionV2EnabledForTarget
              ? { predictionBounds: v2Bounds }
              : {}),
            periods: (predictionData?.periodEvents ?? visiblePeriodEvents).map(
              (period) => ({
                id: period._id,
                startDate: period.startDate,
                endDate: period.endDate,
                startCertainty: period.startCertainty,
                endCertainty: period.endCertainty,
                legacyReason: period.legacyReason,
                tombstoneAt: period.tombstoneAt,
              }),
            ),
          })
        : null;

    // The server is the privacy boundary. A partner never receives the
    // primary CycleState, even transiently; only the enumerated projection
    // can cross this query boundary.
    const cycleStateV1 = readModel && cycleStateV1Exposed
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
    const partnerPredictionV2 = partnerPredictionV2Enabled
      ? projectPartnerPrediction(
          periodPredictionV2,
          readModel?.cycleStateV1 ?? null,
          {
            role: "partner",
            coupleStatus: partnerCoupleStatus,
            hasMembership: primaryMembership !== null,
            sharingEnabled: canViewPhase,
            consentGranted: canViewPhase,
            partnerPredictionEnabled: true,
          },
        )
      : null;
    const partnerPredictionV2Exposed = partnerPredictionV2 !== null;
    const partnerPredictionView =
      isPartnerView && partnerPredictionV2Exposed;
    const predictionFields = {
      partnerPredictionV2Exposed,
      ...(partnerPredictionV2 ? { partnerPredictionV2 } : {}),
      ...(!isPartnerView && periodPredictionV2 ? { periodPredictionV2 } : {}),
    };

    let separatelySharedPainData: DashboardData["painData"] = null;
    if (isPartnerView && !canViewPhase && primaryMembership?.sharingPain) {
      const todayPainLog = await ctx.db
        .query("painLogs")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", targetUserId).eq("date", today)
        )
        .unique();
      separatelySharedPainData = todayPainLog
        ? {
            score: todayPainLog.painScore,
            severity: getPainSeverityBucket(todayPainLog.painScore),
          }
        : null;
    }

    if (!recentPeriod) {
      return {
        hasData: separatelySharedPainData !== null,
        isPartnerView,
        message:
          isPartnerView && !canViewPhase
            ? "Cycle timing is not shared right now."
            : partnerPredictionV2Enabled
              ? "A shared timing estimate is not available yet."
              : "No period data yet. Log your last period to get started.",
        cycleInfo: null,
        nutritionTipsPhase: null,
        cycleStateV1,
        cycleStateV1Exposed,
        ...predictionFields,
        painData: isPartnerView ? separatelySharedPainData : null,
        painTip: null,
        nutritionTips: [],
      };
    }

    // Calculate current cycle info
    const cycleInfo = predictionV2EnabledForTarget
      ? null
      : readModel?.cycleInfo ??
        (cycleStateV1Exposed
          ? null
          : calculateCycleInfo(
              recentPeriod.startDate,
              cycleLength,
              periodLength,
              today,
            ));
    const tipPhase =
      partnerV1View || partnerPredictionView
        ? null
        : readModel?.cycleStateV1.phase ?? cycleInfo?.phase ?? null;

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
          nutritionTipsPhase: null,
          cycleStateV1: null,
          cycleStateV1Exposed,
          ...predictionFields,
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

    if (!tipPhase) {
      return {
        hasData: true,
        isPartnerView,
        cycleInfo: null,
        nutritionTipsPhase: null,
        cycleStateV1,
        cycleStateV1Exposed,
        ...predictionFields,
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
        q.eq("phase", tipPhase).eq("painSeverity", painSeverity).eq("isActive", true)
      )
      .order("desc")
      .first();

    // Get nutrition tips (3 per day, deterministic shuffle)
    const allNutritionTips = await ctx.db
      .query("nutritionTips")
      .withIndex("by_phase", (q) =>
        q.eq("phase", tipPhase).eq("isActive", true)
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
      cycleInfo: partnerV1View || partnerPredictionView ? null : cycleInfo,
      nutritionTipsPhase:
        partnerV1View || partnerPredictionView ? null : tipPhase,
      cycleStateV1,
      cycleStateV1Exposed,
      ...predictionFields,
      painData,
      painTip: partnerV1View || partnerPredictionView ? null : painTip,
      nutritionTips:
        partnerV1View || partnerPredictionView ? [] : nutritionTips,
    };
  },
});
