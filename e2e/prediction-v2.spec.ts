import { devices, expect, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import type { PeriodPredictionV2 } from "../convex/_helpers/periodPrediction";
import { getApprovedReleaseFixture, test } from "./fixtures";
import { getAuthenticatedConvexClient } from "./support/authenticatedClient";

test.use({ trace: "off", screenshot: "off", video: "off" });

type Client = ConvexHttpClient;
type ActivePrediction = Extract<
  PeriodPredictionV2,
  { status: "configured" | "personalized" | "limited_evidence" }
>;

function expectedFlag(name: string): "enabled" | "disabled" {
  const value = process.env[name]?.trim();
  if (value !== "enabled" && value !== "disabled") {
    throw new Error(name + " must be explicitly set to enabled or disabled");
  }
  return value;
}

function addDays(date: string, days: number): string {
  const result = new Date(date + "T00:00:00.000Z");
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string): number {
  return (
    (Date.parse(to + "T00:00:00.000Z") -
      Date.parse(from + "T00:00:00.000Z")) /
    86_400_000
  );
}

async function localDate(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return values.year + "-" + values.month + "-" + values.day;
  });
}

async function localTimeZone(page: Page): Promise<string> {
  return page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
}

async function clearVisiblePeriods(client: Client): Promise<void> {
  const periods = await client.query(
    api.queries.history.getPeriodHistory,
    {},
  );
  for (const period of periods) {
    if (period.certainty === "legacy_unknown") continue;
    if (!period._id || typeof period.authorityVersion !== "number") {
      throw new Error("prediction_fixture_delete_metadata_missing");
    }
    await client.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: period._id,
      expectedAuthorityVersion: period.authorityVersion,
    });
  }
}

async function writeHistory(
  client: Client,
  page: Page,
  intervalLengths: readonly number[],
): Promise<{ today: string; timeZone: string; starts: string[] }> {
  await clearVisiblePeriods(client);
  await client.mutation(api.mutations.periods.updateCycleSettings, {
    cycleLength: 28,
    periodLength: 5,
    predictionPaused: false,
  });

  const today = await localDate(page);
  const timeZone = await localTimeZone(page);
  const totalDays = intervalLengths.reduce((sum, length) => sum + length, 0);
  const starts = [addDays(today, -(totalDays + 120))];
  for (const length of intervalLengths) {
    starts.push(addDays(starts[starts.length - 1]!, length));
  }

  for (const startDate of starts) {
    const { eventId } = await client.mutation(
      api.mutations.periods.logPeriodStart,
      { startDate, timeZone, startCertainty: "exact" },
    );
    const created = (
      await client.query(api.queries.history.getPeriodHistory, {})
    ).find((period) => period._id === eventId);
    if (!created || typeof created.authorityVersion !== "number") {
      throw new Error("prediction_fixture_start_readback_missing");
    }
    await client.mutation(api.mutations.periods.logPeriodEnd, {
      periodEventId: eventId,
      endDate: addDays(startDate, 4),
      timeZone,
      endCertainty: "exact",
      expectedAuthorityVersion: created.authorityVersion,
    });
  }

  await client.mutation(api.mutations.cycleContext.createPredictionSegment, {
    startDate: starts[0]!,
  });
  return { today, timeZone, starts };
}

async function primaryPrediction(
  client: Client,
  today: string,
): Promise<
  | ActivePrediction
  | Extract<PeriodPredictionV2, { status: "paused" | "unavailable" }>
> {
  const dashboard = await client.query(
    api.queries.dashboard.getDashboardData,
    { todayDate: today },
  );
  if (!dashboard.periodPredictionV2) {
    throw new Error("prediction_v2_primary_projection_missing");
  }
  return dashboard.periodPredictionV2;
}

function requireActive(
  prediction: Awaited<ReturnType<typeof primaryPrediction>>,
): asserts prediction is ActivePrediction {
  if (prediction.status === "paused" || prediction.status === "unavailable") {
    throw new Error("prediction_v2_expected_active");
  }
}

function assertUncalibrated(prediction: ActivePrediction): void {
  expect(prediction.probabilityLabel).toBeNull();
  expect(prediction.calibrationVersion).toBeNull();
}

function predictionWidth(prediction: ActivePrediction): number {
  return dayDistance(prediction.earliestDate, prediction.latestDate);
}

async function showPrimaryPrediction(page: Page): Promise<void> {
  // Mutations can invalidate the snapshot while the dashboard is already
  // mounted. Reload so the assertion observes the newly served snapshot.
  await page.reload({ waitUntil: "domcontentloaded" });
  const card = page.getByRole("region", { name: "Period timing estimate" });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-prediction-status", "active");
  await expect(card).toContainText("Estimated range:");
  await expect(card).not.toContainText("80% likely range:");
}

async function setSharing(
  client: Client,
  sharingPhase: boolean,
  sharingPeriodWrite = sharingPhase,
): Promise<void> {
  await client.mutation(api.mutations.couples.updateSharingSettings, {
    sharingPhase,
    sharingPeriodWrite,
  });
}

async function partnerPrediction(client: Client, today: string) {
  const dashboard = await client.query(
    api.queries.dashboard.getDashboardData,
    { todayDate: today },
  );
  if (!dashboard.partnerPredictionV2Exposed || !dashboard.partnerPredictionV2) {
    throw new Error("prediction_v2_partner_projection_missing");
  }
  expect(dashboard).not.toHaveProperty("periodPredictionV2");
  return dashboard.partnerPredictionV2;
}

test("authenticated prediction V2 qualification is explicit and isolated", async ({
  browser,
}) => {
  test.setTimeout(360000);
  const periodMode = expectedFlag("CB_CONNECT_PERIOD_PREDICTION_EXPECTED");
  const partnerMode = expectedFlag("CB_CONNECT_PARTNER_PREDICTION_EXPECTED");
  if (periodMode !== partnerMode) {
    throw new Error("Gate 3 desktop/mobile lanes must set both prediction flags together");
  }
  const device =
    test.info().project.name === "release-mobile"
      ? devices["iPhone 13"]
      : devices["Desktop Chrome"];
  const primaryContext = await browser.newContext({
    ...device,
    storageState: getApprovedReleaseFixture("primary"),
  });
  const partnerContext = await browser.newContext({
    ...device,
    storageState: getApprovedReleaseFixture("partner"),
  });
  const primary = await primaryContext.newPage();
  const partner = await partnerContext.newPage();

  try {
    await primary.goto("/dashboard");
    await partner.goto("/dashboard");
    const primaryClient = await getAuthenticatedConvexClient(primary);
    const partnerClient = await getAuthenticatedConvexClient(partner);
    const capabilities = await primaryClient.query(
      api.queries.capabilities.getCapabilities,
      {},
    );
    expect(capabilities.periodPredictionV2).toBe(periodMode === "enabled");
    expect(capabilities.partnerPredictionV2).toBe(partnerMode === "enabled");

    if (periodMode === "disabled") {
      await setSharing(primaryClient, true);
      const primaryDashboard = await primaryClient.query(
        api.queries.dashboard.getDashboardData,
        {},
      );
      const partnerDashboard = await partnerClient.query(
        api.queries.dashboard.getDashboardData,
        {},
      );
      expect(primaryDashboard.hasData).toBe(true);
      expect(primaryDashboard.periodPredictionV2).toBeUndefined();
      expect(partnerDashboard.partnerPredictionV2Exposed).toBe(false);
      expect(partnerDashboard).not.toHaveProperty("partnerPredictionV2");
      await expect(
        primary.getByRole("region", { name: "Period timing estimate" }),
      ).toHaveCount(0);
      await expect(partner.locator("#partner-prediction-title")).toHaveCount(0);
      return;
    }

    const baseline = await writeHistory(primaryClient, primary, []);
    const configured = await primaryPrediction(primaryClient, baseline.today);
    requireActive(configured);
    expect(configured.status).toBe("configured");
    expect(configured.basisCount).toBe(0);
    expect(dayDistance(baseline.starts[0]!, configured.pointDate)).toBe(28);
    assertUncalibrated(configured);
    await showPrimaryPrediction(primary);

    const stableHistory = await writeHistory(
      primaryClient,
      primary,
      [28, 28, 28, 28, 28],
    );
    const stable = await primaryPrediction(primaryClient, stableHistory.today);
    requireActive(stable);
    expect(stable.status).toBe("limited_evidence");
    expect(stable.basisCount).toBe(5);
    expect(stable.estimatorId).toBe("configured_v1");
    expect(stable.reasonCodes).toContain("PERSONALIZATION_NOT_APPROVED");
    expect(predictionWidth(stable)).toBeGreaterThanOrEqual(3);
    expect(stable.reasonCodes).not.toContain("RECENT_TIMING_VARIABLE");
    expect(stable.probabilityLabel).toBeNull();
    const stableWidth = predictionWidth(stable);

    const variableHistory = await writeHistory(
      primaryClient,
      primary,
      [24, 34, 26, 36, 23],
    );
    const variable = await primaryPrediction(
      primaryClient,
      variableHistory.today,
    );
    requireActive(variable);
    expect(variable.status).toBe("limited_evidence");
    expect(variable.estimatorId).toBe("configured_v1");
    expect(variable.reasonCodes).toContain("RECENT_TIMING_VARIABLE");
    expect(predictionWidth(variable)).toBeGreaterThan(stableWidth);
    expect(variable.status).not.toBe("personalized");
    expect(variable.reasonCodes).toContain("PERSONALIZATION_NOT_APPROVED");
    assertUncalibrated(variable);
    await showPrimaryPrediction(primary);
    await expect(
      primary.getByRole("region", { name: "Period timing estimate" }),
    ).toBeVisible();
    await expect(
      primary.getByText(
        "Recent cycle timing has varied, so the range is wider.",
        { exact: true },
      ),
    ).toBeVisible();

    // The leading interval supplies the detector's three-interval warm-up.
    const missingLogHistory = await writeHistory(
      primaryClient,
      primary,
      [28, 28, 29, 58, 28],
    );
    const missingLog = await primaryPrediction(
      primaryClient,
      missingLogHistory.today,
    );
    requireActive(missingLog);
    expect(missingLog.reasonCodes).toContain("POSSIBLE_MISSING_LOG");
    expect(missingLog.basisCount).toBe(5);

    const outlierHistory = await writeHistory(
      primaryClient,
      primary,
      [28, 28, 28, 56],
    );
    const outlier = await primaryPrediction(primaryClient, outlierHistory.today);
    requireActive(outlier);
    expect(outlier.reasonCodes).toContain("POSSIBLE_MISSING_LOG");
    expect(outlier.estimatorId).toBe("configured_v1");
    expect(dayDistance(outlierHistory.starts.at(-1)!, outlier.pointDate)).toBe(28);

    const shiftedHistory = await writeHistory(
      primaryClient,
      primary,
      [30, 30, 30, 30],
    );
    const shifted = await primaryPrediction(primaryClient, shiftedHistory.today);
    requireActive(shifted);
    expect(shifted.reasonCodes).toContain("USER_CONFIGURED_BASELINE");
    expect(dayDistance(shiftedHistory.starts.at(-1)!, shifted.pointDate)).toBe(28);
    expect(predictionWidth(shifted)).toBeGreaterThan(stableWidth);

    const segmentHistory = await writeHistory(
      primaryClient,
      primary,
      [28, 28, 28, 28, 28],
    );
    await primaryClient.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: segmentHistory.starts[3]! },
    );
    const resetSegment = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(resetSegment);
    expect(resetSegment.basisCount).toBe(2);
    expect(resetSegment.reasonCodes).toContain("CONTEXT_SEGMENT");
    await primaryClient.mutation(
      api.mutations.cycleContext.createPredictionSegment,
      { startDate: segmentHistory.starts[0]! },
    );
    const restoredSegment = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(restoredSegment);
    expect(restoredSegment.basisCount).toBe(5);

    await setSharing(primaryClient, true);
    const assistedStart = addDays(segmentHistory.starts.at(-1)!, 28);
    const assisted = await partnerClient.mutation(
      api.mutations.periods.assistLogPeriodStart,
      { startDate: assistedStart, startCertainty: "exact" },
    );
    const assistedPrediction = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(assistedPrediction);
    expect(assistedPrediction.reasonCodes).toContain("PARTNER_ASSISTED");
    expect(assistedPrediction.basisCount).toBe(6);
    expect(dayDistance(assistedStart, assistedPrediction.pointDate)).toBe(28);

    const assistedCorrection = addDays(assistedStart, 1);
    await partnerClient.mutation(
      api.mutations.periods.correctAssistedPeriodEvent,
      {
        periodEventId: assisted.eventId,
        expectedAuthorityVersion: 1,
        startDate: assistedCorrection,
      },
    );
    const partnerCorrected = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(partnerCorrected);
    expect(partnerCorrected.reasonCodes).toContain("PARTNER_ASSISTED");
    expect(partnerCorrected.reasonCodes).toContain("RECENT_CORRECTION");
    expect(dayDistance(assistedCorrection, partnerCorrected.pointDate)).toBe(28);

    const assistedAfterPartnerCorrection = (
      await primaryClient.query(api.queries.history.getPeriodHistory, {})
    ).find((period) => period._id === assisted.eventId);
    if (
      !assistedAfterPartnerCorrection ||
      typeof assistedAfterPartnerCorrection.authorityVersion !== "number"
    ) {
      throw new Error("prediction_fixture_assisted_correction_metadata_missing");
    }

    const correctedStart = addDays(assistedCorrection, 1);
    await primaryClient.mutation(api.mutations.periods.updatePeriodEvent, {
      periodEventId: assisted.eventId,
      startDate: correctedStart,
      timeZone: segmentHistory.timeZone,
      expectedAuthorityVersion: assistedAfterPartnerCorrection.authorityVersion,
    });
    const primaryCorrected = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(primaryCorrected);
    expect(primaryCorrected.reasonCodes).toContain("RECENT_CORRECTION");
    expect(dayDistance(correctedStart, primaryCorrected.pointDate)).toBe(28);

    const primaryCorrectedEvent = (
      await primaryClient.query(api.queries.history.getPeriodHistory, {})
    ).find((period) => period._id === assisted.eventId);
    if (!primaryCorrectedEvent?._id) {
      throw new Error("prediction_fixture_primary_correction_readback_missing");
    }
    expect(primaryCorrectedEvent.source).toBe("partner_assist");
    expect(primaryCorrectedEvent.startDate).toBe(correctedStart);
    expect(primaryCorrectedEvent.createdByViewer).toBe(false);
    expect(primaryCorrectedEvent.updatedByViewer).toBe(true);
    if (typeof primaryCorrectedEvent.authorityVersion !== "number") {
      throw new Error("prediction_fixture_primary_authority_version_missing");
    }
    expect(primaryCorrectedEvent.authorityVersion).toBe(3);
    await expect(
      partnerClient.mutation(
        api.mutations.periods.correctAssistedPeriodEvent,
        {
          periodEventId: assisted.eventId,
          expectedAuthorityVersion: primaryCorrectedEvent.authorityVersion,
          startDate: addDays(correctedStart, 1),
        },
      ),
    ).rejects.toThrow("PRIMARY_AUTHORITY_REQUIRED");

    await primaryClient.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: assisted.eventId,
      expectedAuthorityVersion: primaryCorrectedEvent.authorityVersion,
    });
    await expect(
      partnerClient.mutation(
        api.mutations.periods.correctAssistedPeriodEvent,
        {
          periodEventId: assisted.eventId,
          expectedAuthorityVersion: primaryCorrectedEvent.authorityVersion + 1,
          startDate: correctedStart,
        },
      ),
    ).rejects.toThrow("TARGET_EVENT_TOMBSTONED");
    const deletedHistory = await primaryClient.query(
      api.queries.history.getPeriodHistory,
      {},
    );
    expect(deletedHistory.some((period) => period._id === assisted.eventId)).toBe(
      false,
    );
    const afterTombstone = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(afterTombstone);
    expect(afterTombstone.basisCount).toBe(5);
    expect(
      dayDistance(segmentHistory.starts.at(-1)!, afterTombstone.pointDate),
    ).toBe(28);

    await primaryClient.mutation(api.mutations.periods.updateCycleSettings, {
      predictionPaused: true,
    });
    const paused = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    expect(paused.status).toBe("paused");
    await primary.goto("/dashboard");
    await expect(
      primary.locator('[aria-label="Period timing estimate"]'),
    ).toHaveAttribute("data-prediction-status", "paused");
    await expect(
      primary.getByText("Prediction paused", { exact: true }),
    ).toBeVisible();
    await primaryClient.mutation(api.mutations.periods.updateCycleSettings, {
      predictionPaused: false,
    });
    const resumed = await primaryPrediction(
      primaryClient,
      segmentHistory.today,
    );
    requireActive(resumed);
    expect(resumed.pointDate).toBe(afterTombstone.pointDate);
    expect(resumed.basisCount).toBe(afterTombstone.basisCount);

    await setSharing(primaryClient, true);
    const shared = await partnerPrediction(
      partnerClient,
      segmentHistory.today,
    );
    expect(shared.status).toBe("estimated");
    expect(shared).not.toHaveProperty("basisCount");
    expect(shared).not.toHaveProperty("reasonCodes");
    expect(shared).not.toHaveProperty("estimatorId");
    await partner.reload();
    await expect(
      partner.getByRole("heading", { name: "Estimated next period" }),
    ).toBeVisible();
    await expect(partner.getByText("80% likely range")).toHaveCount(0);

    await setSharing(primaryClient, false);
    const unshared = await partnerClient.query(
      api.queries.dashboard.getDashboardData,
      { todayDate: segmentHistory.today },
    );
    expect(unshared.partnerPredictionV2Exposed).toBe(false);
    expect(unshared).not.toHaveProperty("partnerPredictionV2");
    await partner.reload();
    await expect(partner.locator("#partner-prediction-title")).toHaveCount(0);

    await setSharing(primaryClient, true);
    await primary.goto("/dashboard/partner");
    const revokeDialog = primary.waitForEvent("dialog");
    await primary
      .getByRole("button", { name: "Close partner access", exact: true })
      .click();
    await (await revokeDialog).accept();
    await expect(primary.getByText("Partner access revoked.")).toBeVisible();
    await partner.goto("/dashboard");
    await expect(
      partner.getByText("Not linked to a partner yet.", { exact: true }),
    ).toBeVisible();
    const revoked = await partnerClient.query(
      api.queries.dashboard.getDashboardData,
      { todayDate: segmentHistory.today },
    );
    expect(revoked.partnerPredictionV2Exposed).toBe(false);
    expect(revoked).not.toHaveProperty("partnerPredictionV2");
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});
