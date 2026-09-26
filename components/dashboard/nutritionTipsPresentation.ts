import type { CyclePhase } from "@/convex/_helpers/cycleState";

export function resolveNutritionTipsPhase(
  predictionPhase: CyclePhase | null | undefined,
  legacyCyclePhase: CyclePhase | null | undefined,
): CyclePhase | null {
  return predictionPhase ?? legacyCyclePhase ?? null;
}
