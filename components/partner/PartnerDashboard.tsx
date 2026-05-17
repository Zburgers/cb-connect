"use client";

import { Heart, Shield, Info } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PartnerPulse from "./PartnerPulse";

interface PartnerDashboardProps {
  data: any;
}

// Returns semantic Tailwind classes based on pain score (no hardcoded colors)
function getPainClasses(score: number): { container: string; icon: string; text: string } {
  if (score <= 3) {
    return {
      container: "bg-accent/10",
      icon: "text-accent",
      text: "text-accent",
    };
  }
  if (score <= 6) {
    return {
      container: "bg-secondary/10",
      icon: "text-secondary",
      text: "text-secondary",
    };
  }
  return {
    container: "bg-destructive/10",
    icon: "text-destructive",
    text: "text-destructive",
  };
}

export default function PartnerDashboard({ data }: PartnerDashboardProps) {
  if (!data.hasData) {
    return (
      <GlassPanel variant="warm" className="space-y-6 p-8 text-center animate-slide-up">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-secondary/10">
          <Heart className="w-10 h-10 text-secondary" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Partner mode
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-foreground">
            The shared space is not ready yet
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            {data.message || "Waiting for your partner to set up their account."}
          </p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Partner mode
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          What today asks from you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Support signals are shown only when your partner has shared them.
        </p>
      </div>

      <PartnerPulse cycleInfo={data.cycleInfo} painData={data.painData} />

      {/* Pain status card */}
      {data.painData && (() => {
        const painClasses = getPainClasses(data.painData.score);
        return (
          <GlassPanel variant="quiet" className="p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${painClasses.container}`}>
                <Heart className={`w-6 h-6 ${painClasses.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">How today feels</h3>
                <p className="text-xs text-muted-foreground">Shared pain signal</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${painClasses.text}`}>
                {data.painData.score}/10
              </div>
              <div>
                <p className="font-medium text-foreground capitalize">{data.painData.severity}</p>
                <p className="text-sm text-muted-foreground">Severity level</p>
              </div>
            </div>
          </GlassPanel>
        );
      })()}

      {/* No pain data */}
      {!data.painData && (
        <GlassPanel variant="quiet" className="p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Pain signal is private</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No pain data is shared today. That may mean nothing was logged, or that your partner chose not to share it.
          </p>
        </GlassPanel>
      )}

      {/* How to help tip — mirrors TipsCard semantics */}
      {data.painTip && (
        <GlassPanel variant="warm" className="p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">How to help without making it weird</h3>
          </div>
          <ul className="space-y-3">
            {data.painTip.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15
                  flex items-center justify-center mt-0.5">
                  <span className="text-primary text-xs font-bold">{i + 1}</span>
                </span>
                <span className="text-sm text-foreground">{s}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
