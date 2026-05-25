"use client";

import PhaseAura from "./PhaseAura";

interface CurrentPhaseProps {
  phase: string;
  cycleDay: number;
  description: string;
  daysUntilNextPeriod: number;
  nextPeriodStart: string;
  painScore?: number | null;
  partnerPresent?: boolean;
}

export default function CurrentPhase({
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
  partnerPresent = false,
}: CurrentPhaseProps) {
  return (
    <PhaseAura
      phase={phase}
      cycleDay={cycleDay}
      description={description}
      daysUntilNextPeriod={daysUntilNextPeriod}
      nextPeriodStart={nextPeriodStart}
      painScore={painScore}
      partnerPresent={partnerPresent}
    />
  );
}
