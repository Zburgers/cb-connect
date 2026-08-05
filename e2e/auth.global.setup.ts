import {
  chromium,
  expect,
  type BrowserContext,
  type FullConfig,
  type Page,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";

import {
  createClerkFixtureServices,
  loadAuthEnvironment,
  provisionFixturePair,
  type AuthEnvironment,
  type FixtureServices,
  type ProvisionedFixturePair,
} from "./support/authEnvironment";

type FixtureManifest = {
  runId: string;
  primary: { role: "primary"; clerkId: string };
  partner: { role: "partner"; clerkId: string };
};

function syntheticPastDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function signIn(page: Page, environment: AuthEnvironment, user: { email?: string; password?: string }) {
  if (!user.email || !user.password) {
    throw new Error("authenticated_fixture_setup_failed");
  }

  await page.goto(`${environment.baseUrl}/sign-in`);
  const identifier = page.locator('input[name="identifier"], input[type="email"]').first();
  await expect(identifier).toBeVisible();
  await identifier.fill(user.email);

  const password = page.locator('input[name="password"], input[type="password"]').first();
  if (!(await password.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /continue/i }).click();
  }
  await expect(password).toBeVisible();
  await password.fill(user.password);
  await page.getByRole("button", { name: /continue|sign in/i }).last().click();
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30000 });
}

async function completeOnboarding(
  page: Page,
  role: "primary" | "partner",
) {
  await page.goto("/onboarding");
  if (role === "primary") {
    await page.getByRole("button", { name: /I track my cycle/i }).click();
    await page.locator('input[type="date"]').fill(syntheticPastDate());
    await page.getByRole("button", { name: /start tracking/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    return;
  }

  await page.getByRole("button", { name: /I support my partner/i }).click();
  await page.waitForURL(/\/dashboard\/partner/, { timeout: 30000 });
}

async function linkCouple(primaryPage: Page, partnerPage: Page): Promise<void> {
  await primaryPage.goto("/dashboard/partner");
  await primaryPage
    .getByRole("button", { name: /generate pairing code/i })
    .click();
  const code = (await primaryPage.getByText(/^\d{6}$/).last().textContent())?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    throw new Error("authenticated_fixture_setup_failed");
  }

  await partnerPage.goto("/dashboard/partner");
  await partnerPage.locator("#partner-code").fill(code);
  await partnerPage.getByRole("button", { name: /link account/i }).click();
  await expect(partnerPage.getByText("Successfully linked!")).toBeVisible({
    timeout: 30000,
  });
}

async function saveStorageState(
  context: BrowserContext,
  path: string,
) {
  await context.storageState({ path });
  await chmod(path, 0o600);
}

function manifestFor(pair: ProvisionedFixturePair): FixtureManifest {
  return {
    runId: pair.runId,
    primary: { role: "primary", clerkId: pair.primary.clerkId },
    partner: { role: "partner", clerkId: pair.partner.clerkId },
  };
}

async function writeRestrictedManifest(
  environment: AuthEnvironment,
  pair: ProvisionedFixturePair,
) {
  await writeFile(
    `${environment.storageDir}/fixture-manifest.json`,
    JSON.stringify(manifestFor(pair)),
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(`${environment.storageDir}/fixture-manifest.json`, 0o600);
}

export default async function globalSetup(_config: FullConfig) {
  const environment = loadAuthEnvironment();
  await mkdir(environment.storageDir, { recursive: true, mode: 0o700 });
  await chmod(environment.storageDir, 0o700);

  const clerkServices = createClerkFixtureServices(environment);
  let primaryPage: Page | null = null;
  let pair: ProvisionedFixturePair | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  const services: FixtureServices = {
    ...clerkServices,
    cleanupApplicationData: async () => {
      if (!primaryPage) {
        return;
      }

      await primaryPage.goto("/dashboard/partner");
      const revokeButton = primaryPage.getByRole("button", {
        name: /close partner access/i,
      });
      if (await revokeButton.count()) {
        primaryPage.once("dialog", (dialog) => dialog.accept());
        await revokeButton.click();
        await expect(
          primaryPage.getByText("Partner access revoked."),
        ).toBeVisible({ timeout: 30000 });
      }
    },
  };

  try {
    pair = await provisionFixturePair(environment, services, {
      passwordFactory: () => randomBytes(24).toString("base64url"),
    });

    browser = await chromium.launch();
    const primaryContext = await browser.newContext({
      baseURL: environment.baseUrl,
    });
    const partnerContext = await browser.newContext({
      baseURL: environment.baseUrl,
    });
    primaryPage = await primaryContext.newPage();
    const partnerPage = await partnerContext.newPage();

    await signIn(primaryPage, environment, pair.primary);
    await completeOnboarding(primaryPage, "primary");
    await signIn(partnerPage, environment, pair.partner);
    await completeOnboarding(partnerPage, "partner");
    await linkCouple(primaryPage, partnerPage);

    await saveStorageState(primaryContext, environment.primaryStorageStatePath);
    await saveStorageState(partnerContext, environment.partnerStorageStatePath);
    await writeRestrictedManifest(environment, pair);

    process.env.CB_CONNECT_RELEASE_PRIMARY_STORAGE_STATE =
      environment.primaryStorageStatePath;
    process.env.CB_CONNECT_RELEASE_PARTNER_STORAGE_STATE =
      environment.partnerStorageStatePath;

    await partnerContext.close();
    await primaryContext.close();
    await browser.close();
  } catch {
    if (pair) {
      await services.cleanupApplicationData?.(pair).catch(() => undefined);
      await clerkServices.deleteUser(pair.partner.clerkId).catch(() => undefined);
      await clerkServices.deleteUser(pair.primary.clerkId).catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    throw new Error("authenticated_fixture_setup_failed");
  }
}
