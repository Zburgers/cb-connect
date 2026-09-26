import { expect, test } from "vitest";

import type { PeriodPredictionV2 } from "../_helpers/periodPrediction";
import {
  getDailyPredictionNotificationMessage,
  projectPeriodPredictionForNotification,
} from "../_helpers/notificationPrediction";

const activePrediction: PeriodPredictionV2 = {
  version: 2,
  source: "period_prediction_v2",
  status: "limited_evidence",
  pointDate: "2026-09-21",
  earliestDate: "2026-09-18",
  latestDate: "2026-09-24",
  probabilityLabel: null,
  quality: "limited_evidence",
  basisCount: 1,
  estimatorId: "configured_v1",
  estimatorVersion: 1,
  calibrationVersion: null,
  reasonCodes: ["USER_CONFIGURED_BASELINE"],
  snapshotId: "predictionSnapshots:private-id",
};

const pausedPrediction: PeriodPredictionV2 = {
  version: 2,
  source: "period_prediction_v2",
  status: "paused",
  pointDate: null,
  earliestDate: null,
  latestDate: null,
  probabilityLabel: null,
  quality: "limited_evidence",
  basisCount: 0,
  estimatorId: "configured_v1",
  estimatorVersion: 1,
  calibrationVersion: null,
  reasonCodes: ["USER_PAUSED"],
};

const unavailablePrediction: PeriodPredictionV2 = {
  ...pausedPrediction,
  status: "unavailable",
  reasonCodes: ["NO_ELIGIBLE_FACT"],
};

test("projects the V2 point date without model or history metadata", () => {
  const prediction = projectPeriodPredictionForNotification(
    activePrediction,
    "2026-09-18",
  );

  expect(prediction).toEqual({
    version: 2,
    status: "available",
    dueInThreeDays: true,
  });
  expect(Object.keys(prediction).sort()).toEqual(
    ["version", "status", "dueInThreeDays"].sort(),
  );
  expect(JSON.stringify(prediction)).not.toMatch(
    /2026-09-21|pointDate|snapshotId|estimator|calibration|reasonCodes|basisCount|private-id/,
  );
});

test("does not schedule an estimate outside the three-day window", () => {
  const prediction = projectPeriodPredictionForNotification(
    activePrediction,
    "2026-09-17",
  );

  expect(prediction.dueInThreeDays).toBe(false);
  expect(
    getDailyPredictionNotificationMessage({ periodPredictionV2: prediction }),
  ).toBeNull();
});

test.each([
  ["paused", pausedPrediction],
  ["unavailable", unavailablePrediction],
] as const)("suppresses %s V2 notifications", (_status, source) => {
  const prediction = projectPeriodPredictionForNotification(
    source,
    "2026-09-18",
  );

  expect(prediction.dueInThreeDays).toBe(false);
  expect(
    getDailyPredictionNotificationMessage({ periodPredictionV2: prediction }),
  ).toBeNull();
});

test("keeps V2 alerts generic and preserves legacy wording when disabled", () => {
  const prediction = projectPeriodPredictionForNotification(
    activePrediction,
    "2026-09-18",
  );

  expect(
    getDailyPredictionNotificationMessage({ periodPredictionV2: prediction }),
  ).toBe("A care reminder is coming up soon.");
  expect(
    getDailyPredictionNotificationMessage({
      cycleInfo: {
        daysUntilNextPeriod: 3,
        predictedNextPeriodStart: "2026-09-21",
      },
    }),
  ).toBe("Your period is predicted to start in 3 days (2026-09-21).");
});
