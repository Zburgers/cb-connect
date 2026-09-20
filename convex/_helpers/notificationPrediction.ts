import { addCalendarDays, type CycleInfo } from "./cycleCalculations";
import type { PeriodPredictionV2 } from "./periodPrediction";

export type PeriodPredictionNotificationProjection = {
  version: 2;
  status: "available" | "paused" | "unavailable";
  dueInThreeDays: boolean;
};

export type PredictionNotificationInput =
  | { periodPredictionV2: PeriodPredictionNotificationProjection }
  | {
      cycleInfo: Pick<
        CycleInfo,
        "daysUntilNextPeriod" | "predictedNextPeriodStart"
      >;
    };

export function projectPeriodPredictionForNotification(
  prediction: PeriodPredictionV2,
  today: string,
): PeriodPredictionNotificationProjection {
  if (prediction.status === "paused") {
    return {
      version: 2,
      status: "paused",
      dueInThreeDays: false,
    };
  }

  if (prediction.status === "unavailable") {
    return {
      version: 2,
      status: "unavailable",
      dueInThreeDays: false,
    };
  }

  return {
    version: 2,
    status: "available",
    dueInThreeDays:
      prediction.pointDate === addCalendarDays(today, 3),
  };
}

export function getDailyPredictionNotificationMessage(
  input: PredictionNotificationInput,
): string | null {
  if ("periodPredictionV2" in input) {
    const prediction = input.periodPredictionV2;
    return prediction.status === "available" &&
      prediction.dueInThreeDays
      ? "A care reminder is coming up soon."
      : null;
  }

  return input.cycleInfo.daysUntilNextPeriod === 3
    ? `Your period is predicted to start in 3 days (${input.cycleInfo.predictedNextPeriodStart}).`
    : null;
}
