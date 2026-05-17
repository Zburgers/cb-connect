"use client";

import PhaseAura from "./PhaseAura";

interface CurrentPhaseProps {
  phase: string;
  cycleDay: number;
  description: string;
  daysUntilNextPeriod: number;
  nextPeriodStart: string;
  painScore?: number | null;
}

export default function CurrentPhase({
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
}: CurrentPhaseProps) {
  return (
    <PhaseAura
      phase={phase}
      cycleDay={cycleDay}
      description={description}
      daysUntilNextPeriod={daysUntilNextPeriod}
      nextPeriodStart={nextPeriodStart}
      painScore={painScore}
    />
  );
}
