"use client";

import { HeartHandshake, MessageCircleHeart, ShoppingBag, Sofa, Sparkles } from "lucide-react";
import PhaseAura from "@/components/dashboard/PhaseAura";
import GlassPanel from "@/components/common/GlassPanel";

interface PartnerPulseProps {
  cycleInfo: {
    phase: string;
    cycleDay: number;
    phaseDescription: string;
    daysUntilNextPeriod: number;
    predictedNextPeriodStart: string;
  } | null;
  painData: {
    score: number;
    severity: string;
  } | null;
}

function supportCopy(score?: number) {
  if (score === undefined) {
    return {
      headline: "Be present without hovering.",
      body: "Some data may be private or not logged yet. The useful move is a gentle check-in, not interrogation.",
    };
  }
  if (score >= 7) {
    return {
      headline: "Today needs practical care.",
      body: "Skip the big speech. Reduce decisions, offer warmth, and take one chore off the table.",
    };
  }
  if (score >= 4) {
    return {
      headline: "Make the day softer.",
      body: "A thoughtful check-in and a low-friction plan will do more than asking for a full explanation.",
    };
  }
  return {
    headline: "Keep connection easy.",
    body: "Energy looks manageable. This is a good day for light plans and steady attention.",
  };
}

export default function PartnerPulse({ cycleInfo, painData }: PartnerPulseProps) {
  const care = supportCopy(painData?.score);

  if (!cycleInfo) {
    return (
      <GlassPanel variant="warm" className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl bg-secondary/[0.12] p-4 text-secondary">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Shared with consent
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-foreground">
              Waiting for a clear signal
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your partner has not shared phase details right now. Respect that boundary and keep support human.
            </p>
          </div>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-5">
      <PhaseAura
        phase={cycleInfo.phase}
        cycleDay={cycleInfo.cycleDay}
        description={cycleInfo.phaseDescription}
        daysUntilNextPeriod={cycleInfo.daysUntilNextPeriod}
        nextPeriodStart={cycleInfo.predictedNextPeriodStart}
        painScore={painData?.score ?? null}
        perspective="partner"
      />

      <GlassPanel variant="quiet" className="p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <Sparkles className="h-3.5 w-3.5" />
              Partner mode
            </div>
            <h3 className="mt-4 font-display text-3xl font-semibold text-foreground">
              {care.headline}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{care.body}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: MessageCircleHeart, label: "Send a gentle check-in" },
              { icon: ShoppingBag, label: "Handle dinner or snacks" },
              { icon: Sofa, label: "Plan a quiet evening" },
              { icon: HeartHandshake, label: "Ask what support means today" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.label}
                  className="rounded-2xl bg-muted/70 px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  {action.label}
                </div>
              );
            })}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
