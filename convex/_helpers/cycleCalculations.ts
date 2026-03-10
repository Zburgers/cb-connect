export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal";

export interface CycleInfo {
  phase: CyclePhase;
  cycleDay: number;
  daysUntilNextPeriod: number;
  predictedNextPeriodStart: string;
  predictedNextPeriodEnd: string;
  phaseDescription: string;
}

export function calculateCycleInfo(
  lastPeriodStart: string,
  cycleLength: number,
  periodLength: number,
  today: string = new Date().toISOString().split("T")[0]
): CycleInfo {
  const lastPeriodDate = new Date(lastPeriodStart + "T00:00:00");
  const currentDate = new Date(today + "T00:00:00");

  const daysSinceLastPeriod = Math.floor(
    (currentDate.getTime() - lastPeriodDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const cycleDay = (daysSinceLastPeriod % cycleLength) + 1;

  let phase: CyclePhase;
  let phaseDescription: string;

  if (cycleDay <= periodLength) {
    phase = "menstruation";
    phaseDescription = "Your period is here";
  } else if (cycleDay <= Math.floor(cycleLength / 2) - 1) {
    phase = "follicular";
    phaseDescription = "Post-period recovery phase";
  } else if (cycleDay <= Math.floor(cycleLength / 2) + 2) {
    phase = "ovulation";
    phaseDescription = "Ovulation window";
  } else {
    phase = "luteal";
    phaseDescription = "Pre-period phase";
  }

  const daysUntilNextPeriod = cycleLength - cycleDay + 1;
  const nextPeriodDate = new Date(currentDate);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + daysUntilNextPeriod);

  const nextPeriodEndDate = new Date(nextPeriodDate);
  nextPeriodEndDate.setDate(nextPeriodEndDate.getDate() + periodLength - 1);

  return {
    phase,
    cycleDay,
    daysUntilNextPeriod,
    predictedNextPeriodStart: nextPeriodDate.toISOString().split("T")[0],
    predictedNextPeriodEnd: nextPeriodEndDate.toISOString().split("T")[0],
    phaseDescription,
  };
}

export function getPainSeverityBucket(
  score: number
): "none" | "mild" | "moderate" | "severe" {
  if (score === 0) return "none";
  if (score <= 3) return "mild";
  if (score <= 6) return "moderate";
  return "severe";
}
