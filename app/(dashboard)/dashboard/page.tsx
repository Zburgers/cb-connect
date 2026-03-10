"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import CurrentPhase from "@/components/dashboard/CurrentPhase";
import PainLogger from "@/components/dashboard/PainLogger";
import TipsCard from "@/components/dashboard/TipsCard";
import NutritionSuggestions from "@/components/dashboard/NutritionSuggestions";
import OnboardingFlow from "@/components/dashboard/OnboardingFlow";
import PartnerDashboard from "@/components/partner/PartnerDashboard";

export default function DashboardPage() {
  const data = useQuery(api.queries.dashboard.getDashboardData);
  const me = useQuery(api.queries.users.getMe);

  if (data === undefined || me === undefined) {
    return <LoadingSpinner />;
  }

  if (!me) {
    return <OnboardingFlow />;
  }

  if (me.role === "partner" && data?.isPartnerView) {
    return <PartnerDashboard data={data} />;
  }

  if (!data?.hasData) {
    return <OnboardingFlow />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-gray-500 text-sm">Here's your cycle overview for today</p>
      </div>

      {data.cycleInfo && (
        <CurrentPhase
          phase={data.cycleInfo.phase}
          cycleDay={data.cycleInfo.cycleDay}
          description={data.cycleInfo.phaseDescription}
          daysUntilNextPeriod={data.cycleInfo.daysUntilNextPeriod}
          nextPeriodStart={data.cycleInfo.predictedNextPeriodStart}
        />
      )}

      <PainLogger currentPain={data.painData ?? null} />

      {data.painTip && data.painData && data.painData.score >= 4 && (
        <TipsCard tip={data.painTip} />
      )}

      {data.nutritionTips && data.nutritionTips.length > 0 && data.cycleInfo && (
        <NutritionSuggestions
          tips={data.nutritionTips}
          phase={data.cycleInfo.phase}
        />
      )}
    </div>
  );
}
