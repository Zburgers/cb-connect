"use client";

import type { CycleState } from "@/convex/_helpers/cycleState";
import type { PeriodPredictionV2 } from "@/convex/_helpers/periodPrediction";
import {
  getCycleStatePresentation,
  type DashboardCycleInfo,
} from "./cycleStatePresentation";
import PhaseAura, { PredictionSummary } from "./PhaseAura";
import { getPredictionPresentation } from "./predictionPresentation";

interface CurrentPhaseProps {
  cycleStateV1?: CycleState | null;
  cycleInfo?: DashboardCycleInfo | null;
  periodPredictionV2?: PeriodPredictionV2 | null;
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
  periodPredictionV2,
  phase,
  cycleDay,
  description,
  daysUntilNextPeriod,
  nextPeriodStart,
  painScore,
  partnerPresent = false,
}: CurrentPhaseProps) {
  const predictionPresentation = periodPredictionV2
    ? getPredictionPresentation(periodPredictionV2)
    : undefined;

  if (cycleStateV1) {
    return (
      <PhaseAura
        presentation={getCycleStatePresentation(cycleStateV1, cycleInfo ?? null)}
        prediction={predictionPresentation}
        painScore={painScore}
        partnerPresent={partnerPresent}
      />
    );
  }

  if (
    predictionPresentation &&
    (phase === undefined ||
      cycleDay === undefined ||
      description === undefined ||
      daysUntilNextPeriod === undefined ||
      nextPeriodStart === undefined)
  ) {
    return <PredictionSummary prediction={predictionPresentation} />;
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
      prediction={predictionPresentation}
      painScore={painScore}
      partnerPresent={partnerPresent}
    />
  );
}
