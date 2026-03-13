"use client";

import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { DashboardSkeleton } from "@/components/common/LoadingSkeleton";
import CurrentPhase from "@/components/dashboard/CurrentPhase";
import PainLogger from "@/components/dashboard/PainLogger";
import TipsCard from "@/components/dashboard/TipsCard";
import NutritionSuggestions from "@/components/dashboard/NutritionSuggestions";
import OnboardingFlow from "@/components/dashboard/OnboardingFlow";
import PartnerDashboard from "@/components/partner/PartnerDashboard";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const data = useQuery(
    api.queries.dashboard.getDashboardData,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const me = useQuery(api.queries.users.getMe, isLoaded ? {} : "skip");

  if (!isLoaded || data === undefined || me === undefined) {
    return <DashboardSkeleton />;
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Here's your cycle overview for today</p>
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
