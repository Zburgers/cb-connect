import { ConvexHttpClient } from "convex/browser";
import { type Page, expect } from "@playwright/test";

import { api } from "../convex/_generated/api";
import { getApprovedReleaseFixture, test } from "./fixtures";
import {
  collectReleaseDiagnostics,
  type ExpectedCycleStateMode,
  type ReleaseDiagnostics,
} from "./support/releaseDiagnostics";

type AuthenticatedClient = ConvexHttpClient;

function expectedFlagState(): "enabled" | "disabled" {
  const value = process.env.CB_CONNECT_CYCLE_STATE_EXPECTED?.trim();
  if (value !== "enabled" && value !== "disabled") {
    throw new Error(
      "CB_CONNECT_CYCLE_STATE_EXPECTED must be explicitly set to enabled or disabled",
    );
  }
  return value;
}

function assertReleaseDiagnostics(
  diagnostics: ReleaseDiagnostics,
  expectedMode: ExpectedCycleStateMode,
): void {
  expect(diagnostics.expectedMode).toBe(expectedMode);
  expect(diagnostics.backendIdentity.deployment).toBe("approved");
  expect(diagnostics.backendIdentity.compatibility).toBe("expected");
  if (expectedMode === "enabled") {
    expect(diagnostics.capabilities.cycleFactsV1).toBe(true);
  } else {
    expect(diagnostics.capabilities.cycleFactsV1).not.toBe("unavailable");
  }
  expect(diagnostics.capabilities.cycleStateV1).toBe(expectedMode === "enabled");
  expect(diagnostics.dashboard.hasData).toBe(true);
  expect(diagnostics.dashboard.cycleInfo).not.toBe("unavailable");
  if (expectedMode === "disabled") {
    expect(diagnostics.dashboard.cycleStateV1).toBeNull();
  } else {
    expect(diagnostics.dashboard.cycleStateV1).not.toBe("unavailable");
  }
  expect(diagnostics.dashboard.cycleStateV1Exposed).toBe(
    expectedMode === "enabled",
  );
  expect(diagnostics.dom.cycleStateV1).toBe(expectedMode);
  expect(diagnostics.dom.cycleStateMarkerCount).toBe(1);
}

async function getAuthenticatedClient(page: Page): Promise<AuthenticatedClient> {
  const convexUrl = process.env.NEXT_PUBLIC_TEST_CONVEX_URL?.trim();
  if (!convexUrl) throw new Error("authenticated_fixture_convex_url_missing");

  const getToken = () => page.evaluate(async () => {
    const clerk = (window as Window & {
      Clerk?: {
        session?: {
          getToken: (options: { template: string }) => Promise<string | null>;
        };
      };
    }).Clerk;
    return (await clerk?.session?.getToken({ template: "convex" })) ?? null;
  });
  await expect.poll(getToken, { timeout: 30000 }).not.toBeNull();
  const token = await getToken();
  if (!token) throw new Error("authenticated_fixture_convex_token_missing");

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

function assertNoRawCycleStatePayload(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(
    /coveringEventId|periodEvent|eventId|startDate|endDate|tombstone|userId|timeZone|note/
  );
}

async function assertPartnerPayloadIsSanitized(
  client: AuthenticatedClient,
  todayDate: string,
): Promise<void> {
  const payload = await client.query(api.queries.dashboard.getDashboardData, {
    todayDate,
  });
  expect(payload.isPartnerView).toBe(true);
  expect(payload.cycleInfo).toBeNull();
  assertNoRawCycleStatePayload(payload.cycleStateV1);
  if (payload.cycleStateV1 !== null) {
    expect(payload.cycleStateV1).not.toHaveProperty("coveringEventId");
  }
}

async function assertPartnerPayloadHasNoCycleState(
  client: AuthenticatedClient,
  todayDate: string,
): Promise<void> {
  const payload = await client.query(api.queries.dashboard.getDashboardData, {
    todayDate,
  });
  expect(payload.isPartnerView).toBe(true);
  expect(payload.cycleStateV1).toBeNull();
  assertNoRawCycleStatePayload(payload.cycleStateV1);
}

async function localDate(page: Page, offsetDays = 0): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }, offsetDays);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function localTimeZone(page: Page): Promise<string> {
  return page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
}

async function clearVisiblePeriods(
  client: AuthenticatedClient,
  preserveLegacyUnknown = false,
): Promise<void> {
  const periods = await client.query(api.queries.history.getPeriodHistory, {});
  for (const period of periods) {
    if (preserveLegacyUnknown && period.certainty === "legacy_unknown") {
      continue;
    }
    if (!period._id || period.authorityVersion === undefined) {
      throw new Error("cycle_state_delete_metadata_missing");
    }
    await client.mutation(api.mutations.periods.deletePeriodEvent, {
      periodEventId: period._id,
      expectedAuthorityVersion: period.authorityVersion,
    });
  }
}

async function resetCycleData(
  client: AuthenticatedClient,
  page: Page,
): Promise<{ today: string; timeZone: string }> {
  await clearVisiblePeriods(client, true);
  await client.mutation(api.mutations.periods.updateCycleSettings, {
    cycleLength: 28,
    periodLength: 5,
    predictionPaused: false,
  });
  return {
    today: await localDate(page),
    timeZone: await localTimeZone(page),
  };
}

async function createPeriod(
  client: AuthenticatedClient,
  timeZone: string,
  startDate: string,
  endDate: string | undefined,
  certainty: "exact" | "approximate" = "exact",
): Promise<void> {
  const startResult = await client.mutation(
    api.mutations.periods.logPeriodStart,
    {
      startDate,
      timeZone,
      startCertainty: certainty,
    },
  );
  if (endDate !== undefined) {
    const createdPeriod = (
      await client.query(api.queries.history.getPeriodHistory, {})
    ).find((period) => period._id === startResult.eventId);
    if (!createdPeriod) {
      throw new Error("cycle_state_created_period_readback_missing");
    }
    if (typeof createdPeriod.authorityVersion !== "number") {
      throw new Error("cycle_state_created_period_authority_missing");
    }

    await client.mutation(api.mutations.periods.logPeriodEnd, {
      periodEventId: startResult.eventId,
      endDate,
      timeZone,
      endCertainty: certainty,
      expectedAuthorityVersion: createdPeriod.authorityVersion,
    });
  }
}

async function updateSharing(
  client: AuthenticatedClient,
  sharingPhase: boolean,
): Promise<void> {
  await client.mutation(api.mutations.couples.updateSharingSettings, {
    sharingPhase,
    sharingPeriodWrite: sharingPhase,
  });
}

async function assertPrimaryState(
  page: Page,
  status: "recorded_period" | "estimated" | "late_or_uncertain" | "insufficient_data" | "prediction_paused",
  label: "Recorded exact" | "Calendar estimate" | "Late" | "Unknown" | "Prediction paused",
): Promise<void> {
  const state = page.locator(`[data-cycle-state="${status}"]`);
  await expect(state).toHaveCount(1);
  await expect(page.getByText(label, { exact: true })).toBeVisible();
}

async function assertNoBiologicalProjection(page: Page): Promise<void> {
  await expect(page.getByText("Phase", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Cycle day/i)).toHaveCount(0);
}

async function assertPrivacySafePartnerEmptyState(page: Page): Promise<void> {
  const emptyState = page.getByRole("status", {
    name: "Partner cycle sharing",
  });
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(
    "Cycle details are not shared right now.",
  );
  await expect(emptyState).not.toContainText(
    /coveringEventId|periodEvent|eventId|startDate|endDate|timezone|cycleDay|note|pain/i,
  );
  await expect(page.getByText(/Recorded exact|Calendar estimate|Prediction paused|Late|Unknown/, { exact: false })).toHaveCount(0);
}

test("cycle state release qualification is explicit and non-skipping", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const expected = expectedFlagState();
  const primaryContext = await browser.newContext({
    storageState: getApprovedReleaseFixture("primary"),
  });
  const partnerContext = await browser.newContext({
    storageState: getApprovedReleaseFixture("partner"),
  });
  const primary = await primaryContext.newPage();
  const partner = await partnerContext.newPage();

  try {
    await primary.goto("/dashboard");
    await partner.goto("/dashboard");
    const primaryClient = await getAuthenticatedClient(primary);
    const partnerClient = await getAuthenticatedClient(partner);

    await test.step("verify cycle-state capability on desktop or mobile", async () => {
      const primaryDiagnostics = await collectReleaseDiagnostics(
        primary,
        primaryClient,
        expected,
      );
      assertReleaseDiagnostics(primaryDiagnostics, expected);
      await expect(
        primary.locator(
          'main[data-cycle-state-v1="enabled"], main[data-cycle-state-v1="disabled"]',
        ),
      ).toHaveAttribute("data-cycle-state-v1", expected);
      const partnerDiagnostics = await collectReleaseDiagnostics(
        partner,
        partnerClient,
        expected,
      );
      assertReleaseDiagnostics(partnerDiagnostics, expected);
      await expect(
        partner.locator(
          'main[data-cycle-state-v1="enabled"], main[data-cycle-state-v1="disabled"]',
        ),
      ).toHaveAttribute("data-cycle-state-v1", expected);
    });

    if (expected === "disabled") {
      await test.step("flag-off keeps the legacy UI without a v1 marker", async () => {
        await expect(primary.locator('[data-cycle-state]')).toHaveCount(0);
        await expect(partner.locator('[data-cycle-state]')).toHaveCount(0);
        const primaryDiagnostics = await collectReleaseDiagnostics(
          primary,
          primaryClient,
          expected,
        );
        expect(primaryDiagnostics.dashboard.hasData).toBe(true);
        expect(primaryDiagnostics.dashboard.cycleInfo).not.toBe("unavailable");
        expect(primaryDiagnostics.dashboard.cycleStateV1).toBeNull();
        expect(primaryDiagnostics.dashboard.cycleStateV1Exposed).toBe(false);
        await expect(primary.locator(".phase-aura-card")).toBeVisible();
        await expect(partner.getByRole("heading", { name: "What today asks from you" })).toBeVisible();
        await expect(
          primary.getByText(/Recorded exact|Calendar estimate|Prediction paused|Cycle details are not shared right now\./, { exact: false }),
        ).toHaveCount(0);
      });
      return;
    }

    const dates = await resetCycleData(primaryClient, primary);

    await test.step("exact coverage is Recorded exact and exposes no event id", async () => {
      await createPeriod(
        primaryClient,
        dates.timeZone,
        addDays(dates.today, -2),
        dates.today,
      );
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "recorded_period", "Recorded exact");
      await assertPartnerPayloadIsSanitized(partnerClient, dates.today);
      const stateText = await primary.locator('[data-cycle-state="recorded_period"]').innerText();
      expect(stateText).not.toMatch(/coveringEventId|periodEvent|eventId|startDate|endDate|timezone/i);
    });

    await test.step("an open exact start remains a calendar estimate", async () => {
      await clearVisiblePeriods(primaryClient, true);
      await createPeriod(primaryClient, dates.timeZone, addDays(dates.today, -2), undefined);
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "estimated", "Calendar estimate");
      await expect(primary.getByText("Recorded exact", { exact: true })).toHaveCount(0);
    });

    await test.step("the configured bound is estimated and the next day is Late", async () => {
      await clearVisiblePeriods(primaryClient, true);
      const finalBoundStart = addDays(dates.today, -31);
      await createPeriod(primaryClient, dates.timeZone, finalBoundStart, undefined);
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "estimated", "Calendar estimate");

      const periods = await primaryClient.query(api.queries.history.getPeriodHistory, {});
      const period = periods.find((candidate) => candidate.startDate === finalBoundStart);
      if (!period || !period._id || period.authorityVersion === undefined) {
        throw new Error("cycle_state_bound_fixture_metadata_missing");
      }
      await primaryClient.mutation(api.mutations.periods.updatePeriodEvent, {
        periodEventId: period._id,
        startDate: addDays(dates.today, -32),
        expectedAuthorityVersion: period.authorityVersion,
        timeZone: dates.timeZone,
      });
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "late_or_uncertain", "Late");
      await assertNoBiologicalProjection(primary);
    });

    await test.step("pause suppresses phase and preserves historical reads", async () => {
      await clearVisiblePeriods(primaryClient, true);
      await createPeriod(
        primaryClient,
        dates.timeZone,
        addDays(dates.today, -2),
        dates.today,
      );
      await primary.goto("/dashboard/log");
      const historyBeforePause = await primary.locator("main").innerText();
      await primaryClient.mutation(api.mutations.periods.updateCycleSettings, {
        predictionPaused: true,
      });
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "prediction_paused", "Prediction paused");
      await assertNoBiologicalProjection(primary);
      await primary.goto("/dashboard/log");
      await expect(primary.locator("main")).toHaveText(historyBeforePause);
      await primaryClient.mutation(api.mutations.periods.updateCycleSettings, {
        predictionPaused: false,
      });
    });

    await test.step("approximate and tombstoned facts never become exact", async () => {
      await clearVisiblePeriods(primaryClient, true);
      await createPeriod(
        primaryClient,
        dates.timeZone,
        addDays(dates.today, -2),
        dates.today,
        "approximate",
      );
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "insufficient_data", "Unknown");
      await assertNoBiologicalProjection(primary);
      await expect(primary.getByText("Recorded exact", { exact: true })).toHaveCount(0);

      await clearVisiblePeriods(primaryClient, true);
      await createPeriod(
        primaryClient,
        dates.timeZone,
        addDays(dates.today, -2),
        dates.today,
      );
      const visiblePeriods = await primaryClient.query(api.queries.history.getPeriodHistory, {});
      const tombstonedCandidate = visiblePeriods[0];
      if (
        !tombstonedCandidate ||
        !tombstonedCandidate._id ||
        tombstonedCandidate.authorityVersion === undefined
      ) {
        throw new Error("cycle_state_tombstone_fixture_metadata_missing");
      }
      await primaryClient.mutation(api.mutations.periods.deletePeriodEvent, {
        periodEventId: tombstonedCandidate._id,
        expectedAuthorityVersion: tombstonedCandidate.authorityVersion,
      });
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "insufficient_data", "Unknown");
      await assertNoBiologicalProjection(primary);
      await expect(primary.getByText("Recorded exact", { exact: true })).toHaveCount(0);

      const legacyFacts = await primaryClient.query(
        api.queries.history.getPeriodHistory,
        {},
      );
      if (!legacyFacts.some((fact) => fact.certainty === "legacy_unknown")) {
        throw new Error("cycle_state_legacy_unknown_fixture_missing");
      }
      await primary.goto("/dashboard");
      await assertPrimaryState(primary, "insufficient_data", "Unknown");
      await assertNoBiologicalProjection(primary);
      await expect(primary.locator('[data-cycle-state="recorded_period"]')).toHaveCount(0);
    });

    await test.step("share-off and revocation render a privacy-safe empty state", async () => {
      await clearVisiblePeriods(primaryClient, true);
      await createPeriod(
        primaryClient,
        dates.timeZone,
        addDays(dates.today, -2),
        dates.today,
      );
      await updateSharing(primaryClient, true);
      await partner.goto("/dashboard");
      await expect(partner.getByText("Recorded exact", { exact: true })).toBeVisible();

      await updateSharing(primaryClient, false);
      await partner.reload();
      await assertPrivacySafePartnerEmptyState(partner);
      await assertPartnerPayloadHasNoCycleState(partnerClient, dates.today);

      await updateSharing(primaryClient, true);
      await primary.goto("/dashboard/partner");
      await primary.once("dialog", (dialog) => dialog.accept());
      await primary.getByRole("button", { name: "Close partner access", exact: true }).click();
      await expect(primary.getByText("Partner access revoked.")).toBeVisible();
      await partner.goto("/dashboard");
      await assertPrivacySafePartnerEmptyState(partner);
      await assertPartnerPayloadHasNoCycleState(partnerClient, dates.today);
    });
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});
