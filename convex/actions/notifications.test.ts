import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import { addCalendarDays } from "../_helpers/cycleCalculations";
import { toCalendarDateInTimeZone } from "../_helpers/calendarDates";
import type { PeriodPredictionV2 } from "../_helpers/periodPrediction";
import {
  getDailyPredictionNotificationMessage,
  projectPeriodPredictionForNotification,
} from "../_helpers/notificationPrediction";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedUser } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

test("daily prediction cron cannot POST or write a legacy log with a stale webhook", async () => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example.test/webhook");
  vi.stubEnv("CB_CONNECT_PERIOD_PREDICTION_V2", "false");
  vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", "false");
  const fetchStub = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchStub);

  const t = convexTest(schema, modules);
  const userId = await seedUser(t, {
    clerkId: "legacy-discord-cron-primary",
    name: "Primary",
    role: "primary",
  });
  const today = toCalendarDateInTimeZone(new Date(), "UTC");
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { externalNotificationConsent: true });
    await ctx.db.insert("periodEvents", {
      userId,
      startDate: addCalendarDays(today, -25),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await t.action(internal.actions.notifications.sendDailyPredictions, {});

  expect(fetchStub).not.toHaveBeenCalled();
  await expect(
    t.run(async (ctx) => ctx.db.query("notificationLog").collect()),
  ).resolves.toEqual([]);
});

test("a previously scheduled Discord action is inert when its webhook secret remains", async () => {
  vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.example.test/webhook");
  const fetchStub = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchStub);

  const t = convexTest(schema, modules);
  const userId = await seedUser(t, {
    clerkId: "legacy-discord-stale-action-primary",
    name: "Primary",
    role: "primary",
  });

  await t.action(internal.actions.discord.sendDiscordNotification, {
    userId,
    type: "high_pain_logged",
    message: "Sensitive legacy payload",
  });

  expect(fetchStub).not.toHaveBeenCalled();
  await expect(
    t.run(async (ctx) => ctx.db.query("notificationLog").collect()),
  ).resolves.toEqual([]);
});
