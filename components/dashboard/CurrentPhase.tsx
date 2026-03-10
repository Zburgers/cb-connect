"use client";

import { getPhaseEmoji, getPhaseColor, formatDate } from "@/lib/utils";

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
  return (
    <div className={`rounded-2xl p-6 border ${getPhaseColor(phase)}`}>
      <div className="flex items-center gap-4">
        <span className="text-5xl">{getPhaseEmoji(phase)}</span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold capitalize">{phase} Phase</h2>
          <p className="text-sm opacity-80">{description}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{cycleDay}</p>
          <p className="text-xs opacity-70">Cycle Day</p>
        </div>
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <p className="text-3xl font-bold">{daysUntilNextPeriod}</p>
          <p className="text-xs opacity-70">Days Until Period</p>
        </div>
      </div>
      <p className="mt-3 text-xs opacity-60 text-center">
        Next period predicted: {formatDate(nextPeriodStart)}
      </p>
    </div>
  );
}
