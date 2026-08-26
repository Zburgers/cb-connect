"use client";

import type { CycleState } from "@/convex/_helpers/cycleState";
import {
  getCycleStatePresentation,
  type DashboardCycleInfo,
} from "./cycleStatePresentation";
import PhaseAura from "./PhaseAura";

interface CurrentPhaseProps {
  cycleStateV1?: CycleState | null;
  cycleInfo?: DashboardCycleInfo | null;
  phase?: string;
  cycleDay?: number;
  description?: string;
  daysUntilNextPeriod?: number;
  nextPeriodStart?: string;
  painScore?: number | null;
  partnerPresent?: boolean;
}

export default function CurrentPhase({
  cycleStateV1,
  cycleInfo,
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
  partnerPresent = false,
}: CurrentPhaseProps) {
  if (cycleStateV1) {
    return (
      <PhaseAura
        presentation={getCycleStatePresentation(cycleStateV1, cycleInfo ?? null)}
        painScore={painScore}
        partnerPresent={partnerPresent}
      />
    );
  }

  if (
    phase === undefined ||
    cycleDay === undefined ||
    description === undefined ||
    daysUntilNextPeriod === undefined ||
    nextPeriodStart === undefined
  ) {
    return null;
  }

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
