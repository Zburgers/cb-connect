"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { DashboardSkeleton } from "@/components/common/LoadingSkeleton";
import CurrentPhase from "@/components/dashboard/CurrentPhase";
import PartnerStatusCard from "@/components/dashboard/PartnerStatusCard";
import PainLogger from "@/components/dashboard/PainLogger";
import TipsCard from "@/components/dashboard/TipsCard";
import NutritionSuggestions from "@/components/dashboard/NutritionSuggestions";
import OnboardingFlow from "@/components/dashboard/OnboardingFlow";
import PartnerDashboard from "@/components/partner/PartnerDashboard";

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const data = useQuery(
    api.queries.dashboard.getDashboardData,
    isAuthenticated ? {} : "skip"
  );
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");

  if (isLoading || data === undefined || me === undefined) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    if (clerkLoaded && isSignedIn) {
      return (
        <div className="glass-card rounded-3xl p-6 animate-slide-up space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Authentication setup issue</h2>
          <p className="text-sm text-muted-foreground">
            You are signed in to Clerk, but Convex could not obtain a session token.
          </p>
          <p className="text-sm text-muted-foreground">
            In Clerk Dashboard, create a JWT template named <code>convex</code>, then refresh.
          </p>
        </div>
      );
    }
    return <DashboardSkeleton />;
  }

  // me === null means user record doesn't exist yet — layout's ensureUser + onboarding redirect handles this
  if (!me || !me.role) {
    return <DashboardSkeleton />;
  }

  if (me.role === "partner" && data?.isPartnerView) {
    return <PartnerDashboard data={data} />;
  }

  // Primary user who skipped period setup during onboarding
  if (!data?.hasData) {
    return <OnboardingFlow />;
  }

  return (
    <div
      data-phase={data.cycleInfo?.phase ?? "follicular"}
      className="space-y-6 animate-fade-in"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Private observatory
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Today’s rhythm, translated into support.
        </p>
      </div>

      {data.cycleInfo && (
        <CurrentPhase
          phase={data.cycleInfo.phase}
          cycleDay={data.cycleInfo.cycleDay}
          description={data.cycleInfo.phaseDescription}
          daysUntilNextPeriod={data.cycleInfo.daysUntilNextPeriod}
          nextPeriodStart={data.cycleInfo.predictedNextPeriodStart}
          painScore={data.painData?.score ?? null}
        />
      )}

      {/* Partner Status Card - Always shown */}
      <PartnerStatusCard />

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
