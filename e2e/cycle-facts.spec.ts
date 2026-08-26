import { ConvexHttpClient } from "convex/browser";
import { type Page, expect } from "@playwright/test";

import { api } from "../convex/_generated/api";
import { getApprovedReleaseFixture, test } from "./fixtures";

function localDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function expectedFlagState(): "enabled" | "disabled" {
  const value = process.env.CB_CONNECT_CYCLE_FACTS_EXPECTED?.trim();
  if (value !== "enabled" && value !== "disabled") {
    throw new Error(
      "CB_CONNECT_CYCLE_FACTS_EXPECTED must be explicitly set to enabled or disabled",
    );
  }
  return value;
}

async function configureSharing(primary: Page): Promise<void> {
  await primary.goto("/dashboard/partner");
  const phase = primary.getByRole("checkbox", {
    name: /Share period \/ cycle phase/i,
  });
  const periodWrite = primary.getByRole("checkbox", {
    name: /Allow partner to help log period dates/i,
  });
  await expect(phase).toBeVisible({ timeout: 30000 });
  await expect(periodWrite).toBeVisible({ timeout: 30000 });
  if (!(await phase.isChecked())) {
    await phase.evaluate((element) => (element as HTMLInputElement).click());
  }
  if (!(await periodWrite.isChecked())) {
    await periodWrite.evaluate((element) =>
      (element as HTMLInputElement).click(),
    );
  }
  await expect(phase).toBeChecked();
  await expect(periodWrite).toBeChecked();
}

async function removeExistingPrimaryPeriod(primary: Page): Promise<void> {
  await primary.goto("/dashboard/log");
  await expect(
    primary.getByRole("heading", { name: "Cycle history" }),
  ).toBeVisible({ timeout: 30000 });
  const ongoing = primary.getByRole("heading", {
    name: /Period in progress since/i,
  });
  if (await ongoing.isVisible().catch(() => false)) {
    await primary.getByRole("button", { name: "Today", exact: true }).click();
    await primary
      .getByRole("button", { name: "Mark as ended", exact: true })
      .click();
    await expect(primary.getByText("Period marked as ended.")).toBeVisible();
  }
  const edit = primary.getByRole("button", { name: "Edit", exact: true }).first();
  await expect(edit).toBeVisible();
  await edit.click();
  await primary
    .getByRole("button", { name: "Delete entry", exact: true })
    .click();
  await expect(primary.getByText("Period entry removed.")).toBeVisible();
}

async function getAuthenticatedClient(page: Page): Promise<ConvexHttpClient> {
  const convexUrl = process.env.NEXT_PUBLIC_TEST_CONVEX_URL?.trim();
  if (!convexUrl) throw new Error("authenticated_fixture_convex_url_missing");
  const token = await page.evaluate(async () => {
    const clerk = (window as Window & {
      Clerk?: {
        session?: {
          getToken: (options: { template: string }) => Promise<string | null>;
        };
      };
    }).Clerk;
    return (await clerk?.session?.getToken({ template: "convex" })) ?? null;
  });
  if (!token) throw new Error("authenticated_fixture_convex_token_missing");
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

test("cycle facts release qualification is explicit and non-skipping", async ({
  browser,
}) => {
  test.setTimeout(180000);
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
    await test.step("verify capability state without a public mirror", async () => {
      await primary.goto("/dashboard/log");
      await expect(
        primary.locator(
          'main[data-cycle-facts-v1="enabled"], main[data-cycle-facts-v1="disabled"]',
        ),
      ).toHaveAttribute("data-cycle-facts-v1", expected);
    });

    if (expected === "disabled") {
      await test.step("flag-off behavior preserves the legacy UI", async () => {
        await expect(
          primary.getByText("How certain is this date?", { exact: true }),
        ).toHaveCount(0);
        await expect(
          primary.getByText("Legacy fact needs review", { exact: true }),
        ).toHaveCount(0);
        await expect(
          primary.getByRole("heading", { name: "Cycle history" }),
        ).toBeVisible();
      });
      return;
    }

    await configureSharing(primary);
    await removeExistingPrimaryPeriod(primary);

    await test.step("primary and partner capture exact and approximate facts", async () => {
      await partner.goto("/dashboard/log");
      await expect(
        partner.getByRole("heading", { name: "Help update period dates" }),
      ).toBeVisible({ timeout: 30000 });
      await partner
        .getByRole("button", { name: "Choose date", exact: true })
        .click();
      await partner.locator('input[type="date"]').fill(localDateDaysAgo(3));
      await partner.getByText("approximate", { exact: true }).click();
      await partner
        .getByRole("button", { name: "Save update", exact: true })
        .click();
      await expect(
        partner.getByText(
          "Saved. This was added as partner-assisted and your partner can correct it anytime.",
        ),
      ).toBeVisible();

      await primary.goto("/dashboard/log");
      await expect(
        primary.getByText("Approximate observation", { exact: true }),
      ).toBeVisible();
      await expect(
        primary.getByText("Legacy fact needs review", { exact: true }),
      ).toBeVisible();
    });

    const partnerClient = await getAuthenticatedClient(partner);
    const staleFacts = await partnerClient.query(
      api.queries.history.getPeriodHistory,
      {},
    );
    const assistedFact = staleFacts.find(
      (fact) => fact.source === "partner_assist" && !fact.endDate,
    );
    if (!assistedFact) throw new Error("assisted_cycle_fact_missing");

    await test.step("primary correction preserves uncertainty by default", async () => {
      const factCard = primary
        .locator("div.contrast-glass")
        .filter({ hasText: "Approximate observation" })
        .last();
      await factCard.getByRole("button", { name: "Edit", exact: true }).click();
      const dates = factCard.locator('input[type="date"]');
      await dates.nth(0).fill(localDateDaysAgo(3));
      await factCard
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(primary.getByText("Correction saved.")).toBeVisible();
      await expect(
        primary.getByText("Approximate observation", { exact: true }),
      ).toBeVisible();
    });

    await test.step("primary explicitly confirms exactness before promotion", async () => {
      const factCard = primary
        .locator("div.contrast-glass")
        .filter({ hasText: "Approximate observation" })
        .last();
      await factCard.getByRole("button", { name: "Edit", exact: true }).click();
      await factCard
        .getByRole("checkbox", { name: "Confirm this start date is exact" })
        .check();
      await factCard
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(primary.getByText("Correction saved.")).toBeVisible();
      await expect(
        primary.getByText("Exact observation", { exact: true }),
      ).toBeVisible();
    });

    await test.step("stale and revoked partner writes are rejected", async () => {
      if (!assistedFact._id || assistedFact.authorityVersion === undefined) {
        throw new Error("assisted_fact_write_metadata_missing");
      }
      await expect(
        partnerClient.mutation(api.mutations.periods.assistLogPeriodEnd, {
          periodEventId: assistedFact._id,
          endDate: localDateDaysAgo(0),
          expectedAuthorityVersion: assistedFact.authorityVersion,
        }),
      ).rejects.toThrow("STALE_AUTHORITY_VERSION");

      await primary.goto("/dashboard/partner");
      await primary.once("dialog", (dialog) => dialog.accept());
      await primary
        .getByRole("button", { name: "Close partner access", exact: true })
        .click({ force: true });
      await expect(primary.getByText("Partner access revoked.")).toBeVisible();

      await expect(
        partnerClient.mutation(api.mutations.periods.assistLogPeriodEnd, {
          periodEventId: assistedFact._id,
          endDate: localDateDaysAgo(0),
          expectedAuthorityVersion: assistedFact.authorityVersion + 1,
        }),
      ).rejects.toThrow("Assisted period logging is not enabled");
    });

    await test.step("primary tombstone removes the fact from history", async () => {
      await primary.goto("/dashboard/log");
      const factCard = primary
        .locator("div.contrast-glass")
        .filter({ hasText: "Exact observation" })
        .last();
      await factCard.getByRole("button", { name: "Edit", exact: true }).click();
      await factCard
        .getByRole("button", { name: "Delete entry", exact: true })
        .click();
      await expect(primary.getByText("Period entry removed.")).toBeVisible();
      await expect(
        primary.getByText("Exact observation", { exact: true }),
      ).toHaveCount(0);
    });
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});
