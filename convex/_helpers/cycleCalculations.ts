export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal";

export interface CycleInfo {
  phase: CyclePhase;
  cycleDay: number;
  daysUntilNextPeriod: number;
  predictedNextPeriodStart: string;
  predictedNextPeriodEnd: string;
  phaseDescription: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toCalendarDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(dateString: string, days: number): string {
  const date = parseCalendarDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

function daysBetweenCalendarDates(startDate: string, endDate: string): number {
  return Math.floor(
    (parseCalendarDate(endDate).getTime() - parseCalendarDate(startDate).getTime()) /
      MS_PER_DAY
  );
}

function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateCycleInfo(
  lastPeriodStart: string,
  cycleLength: number,
  periodLength: number,
  today: string = toCalendarDateString()
): CycleInfo {
  const daysSinceLastPeriod = daysBetweenCalendarDates(lastPeriodStart, today);
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
  const predictedNextPeriodStart = addCalendarDays(today, daysUntilNextPeriod);

  return {
    phase,
    cycleDay,
    daysUntilNextPeriod,
    predictedNextPeriodStart,
    predictedNextPeriodEnd: addCalendarDays(
      predictedNextPeriodStart,
      periodLength - 1
    ),
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
