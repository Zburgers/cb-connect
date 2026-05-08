"use client";

import { getPhaseGradient } from "@/lib/utils";

interface CurrentPhaseProps {
  phase: string;
  cycleDay: number;
  description: string;
  daysUntilNextPeriod: number;
  nextPeriodStart: string;
}

export default function CurrentPhase({
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
}: CurrentPhaseProps) {
  const getPhaseTitle = (phase: string) => {
    return phase.charAt(0).toUpperCase() + phase.slice(1);
  };

  return (
    <div className={`glass-card rounded-3xl p-6 bg-gradient-to-br ${getPhaseGradient(phase)} 
      animate-slide-up border-0 shadow-xl`}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-background/60 backdrop-blur-md flex items-center 
            justify-center shadow-lg">
            <span className="text-3xl filter drop-shadow-lg">
              {phase === "menstruation" && "🌙"}
              {phase === "follicular" && "🌱"}
              {phase === "ovulation" && "🌸"}
              {phase === "luteal" && "🍂"}
            </span>
          </div>
          <div className="absolute inset-0 animate-pulse-slow opacity-20">
            <div className="w-16 h-16 rounded-2xl bg-current" />
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 
            bg-clip-text text-transparent capitalize">
            {getPhaseTitle(phase)} Phase
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="glass-elevated rounded-2xl p-4 text-center backdrop-blur-md">
          <p className="text-4xl font-bold text-primary">{cycleDay}</p>
          <p className="text-xs text-muted-foreground mt-1">Cycle Day</p>
        </div>
        <div className="glass-elevated rounded-2xl p-4 text-center backdrop-blur-md">
          <p className="text-4xl font-bold text-secondary">{daysUntilNextPeriod}</p>
          <p className="text-xs text-muted-foreground mt-1">Days Until Period</p>
        </div>
      </div>
      
      <p className="mt-4 text-xs text-muted-foreground text-center">
        Next period predicted: <span className="font-medium text-foreground">{nextPeriodStart}</span>
      </p>
    </div>
  );
}
