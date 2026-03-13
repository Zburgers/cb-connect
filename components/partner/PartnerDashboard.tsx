"use client";

import { getPhaseGradient } from "@/lib/utils";
import { Heart, Shield, Info } from "lucide-react";

interface PartnerDashboardProps {
  data: any;
}

export default function PartnerDashboard({ data }: PartnerDashboardProps) {
  if (!data.hasData) {
    return (
      <div className="text-center py-12 space-y-6 animate-slide-up">
        <div className="w-20 h-20 mx-auto rounded-full bg-secondary/10 dark:bg-secondary/20 flex items-center 
          justify-center">
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
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 
        dark:from-purple-900/30 dark:to-pink-900/30 border-0 shadow-lg animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="w-6 h-6 text-secondary" />
          <h1 className="text-2xl font-bold text-foreground">Partner Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Here's how you can support today</p>
      </div>

      {data.cycleInfo && (
        <div className={`glass-card rounded-3xl p-6 bg-gradient-to-br ${getPhaseGradient(data.cycleInfo.phase)} 
          border-0 shadow-lg animate-slide-up`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/60 dark:bg-black/40 backdrop-blur-md flex 
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

      {data.painData && (
        <div className="glass-card rounded-3xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center
              ${data.painData.score <= 3 
                ? "bg-accent/10 dark:bg-accent/20" 
                : data.painData.score <= 6 
                ? "bg-orange-500/10 dark:bg-orange-500/20" 
                : "bg-red-500/10 dark:bg-red-500/20"
              }`}>
              <Heart className={`w-6 h-6 
                ${data.painData.score <= 3 
                  ? "text-accent" 
                  : data.painData.score <= 6 
                  ? "text-orange-600 dark:text-orange-400" 
                  : "text-red-600 dark:text-red-400"
                }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Pain Status</h3>
              <p className="text-xs text-muted-foreground">Current pain level</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold 
              ${data.painData.score <= 3 
                ? "text-accent" 
                : data.painData.score <= 6 
                ? "text-orange-600 dark:text-orange-400" 
                : "text-red-600 dark:text-red-400"
              }`}>
              {data.painData.score}/10
            </div>
            <div>
              <p className="font-medium text-foreground capitalize">{data.painData.severity}</p>
              <p className="text-sm text-muted-foreground">Severity level</p>
            </div>
          </div>
        </div>
      )}

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

      {data.painTip && (
        <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-blue-50 to-indigo-100/50 
          dark:from-blue-950/30 dark:to-indigo-900/20 border-0 shadow-lg animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center 
              justify-center">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">How to Help</h3>
          </div>
          <ul className="space-y-3">
            {data.painTip.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 dark:bg-blue-400/20 
                  flex items-center justify-center mt-0.5">
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">{i + 1}</span>
                </span>
                <span className="text-sm text-blue-800 dark:text-blue-200">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
