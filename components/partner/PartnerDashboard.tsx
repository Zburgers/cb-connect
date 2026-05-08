"use client";

import { getPhaseGradient } from "@/lib/utils";
import { Heart, Shield, Info } from "lucide-react";

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
      <div className="text-center py-12 space-y-6 animate-slide-up">
        <div className="w-20 h-20 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
          <Heart className="w-10 h-10 text-secondary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Partner Dashboard</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            {data.message || "Waiting for your partner to set up their account."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card — semantic primary/secondary gradient */}
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-r from-primary/10 to-secondary/10
        border-0 shadow-lg animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="w-6 h-6 text-secondary" />
          <h1 className="text-2xl font-bold text-foreground">Partner Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Here's how you can support today</p>
      </div>

      {/* Cycle phase card */}
      {data.cycleInfo && (
        <div className={`glass-card rounded-3xl p-6 bg-gradient-to-br ${getPhaseGradient(data.cycleInfo.phase)}
          border-0 shadow-lg animate-slide-up`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-background/60 backdrop-blur-md flex
              items-center justify-center shadow-lg">
              <span className="text-3xl filter drop-shadow-lg">
                {data.cycleInfo.phase === "menstruation" && "🌙"}
                {data.cycleInfo.phase === "follicular" && "🌱"}
                {data.cycleInfo.phase === "ovulation" && "🌸"}
                {data.cycleInfo.phase === "luteal" && "🍂"}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground capitalize">
                {data.cycleInfo.phase} Phase
              </h2>
              <p className="text-sm text-muted-foreground">{data.cycleInfo.phaseDescription}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Day {data.cycleInfo.cycleDay} of cycle
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pain status card */}
      {data.painData && (() => {
        const painClasses = getPainClasses(data.painData.score);
        return (
          <div className="glass-card rounded-3xl p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${painClasses.container}`}>
                <Heart className={`w-6 h-6 ${painClasses.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Pain Status</h3>
                <p className="text-xs text-muted-foreground">Current pain level</p>
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
          </div>
        );
      })()}

      {/* No pain data */}
      {!data.painData && (
        <div className="glass-card rounded-3xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Pain Status</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No pain data shared today. Pain sharing may be disabled by your partner.
          </p>
        </div>
      )}

      {/* How to help tip — mirrors TipsCard semantics */}
      {data.painTip && (
        <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-primary/5 to-secondary/5
          border-0 shadow-lg animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">How to Help</h3>
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
        </div>
      )}
    </div>
  );
}
