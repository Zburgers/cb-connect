import {
  chromium,
  expect,
  type BrowserContext,
  type FullConfig,
  type Page,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

import {
  cleanupConvexFixturePair,
  createClerkFixtureServices,
  loadAuthEnvironment,
  provisionFixturePair,
  registerConvexFixtureUser,
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
  if (!user.email) {
    throw new Error("authenticated_fixture_setup_failed");
  }

  process.env.CLERK_SECRET_KEY = environment.clerkSecretKey;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = environment.clerkPublishableKey;
  await page.goto(`${environment.baseUrl}/`);
  await clerk.signIn({
    page,
    emailAddress: user.email,
    setupClerkTestingTokenOptions: {
      frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
    },
  });
  await page.goto(`${environment.baseUrl}/dashboard`);
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30000 });
  await expect(
    page.getByText(/Welcome|Private observatory/i).first(),
  ).toBeVisible({ timeout: 30000 });
}

async function convexAuthToken(page: Page): Promise<string> {
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
  if (!token) {
    throw new Error("authenticated_fixture_convex_token_missing");
  }
  return token;
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
  let pair: ProvisionedFixturePair | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let setupStage = "provision";

  const services: FixtureServices = { ...clerkServices };
  let primaryConvexAuthToken: string | null = null;

  try {
    pair = await provisionFixturePair(environment, services, {
      passwordFactory: () => randomBytes(24).toString("base64url"),
    });

    process.env.CLERK_SECRET_KEY = environment.clerkSecretKey;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = environment.clerkPublishableKey;
    setupStage = "clerk-testing";
    await clerkSetup({
      frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
    });

    setupStage = "browser";
    browser = await chromium.launch({
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
    });
    const primaryContext = await browser.newContext({
      baseURL: environment.baseUrl,
    });
    const partnerContext = await browser.newContext({
      baseURL: environment.baseUrl,
    });
    const primaryPage = await primaryContext.newPage();
    const partnerPage = await partnerContext.newPage();

    setupStage = "primary-sign-in";
    await signIn(primaryPage, environment, pair.primary);
    setupStage = "primary-onboarding";
    await completeOnboarding(primaryPage, "primary");
    primaryConvexAuthToken = await convexAuthToken(primaryPage);
    setupStage = "partner-sign-in";
    await signIn(partnerPage, environment, pair.partner);
    setupStage = "partner-onboarding";
    await completeOnboarding(partnerPage, "partner");
    setupStage = "link";
    await linkCouple(primaryPage, partnerPage);
    setupStage = "primary-register";
    await registerConvexFixtureUser(
      environment,
      pair,
      pair.primary,
      primaryConvexAuthToken,
    );
    // The primary registration creates the durable fixture run record. Install
    // its authenticated cleanup path before attempting partner registration so
    // a partial registration failure cannot orphan application data.
    services.cleanupApplicationData = (fixturePair) =>
      cleanupConvexFixturePair(
        environment,
        fixturePair,
        primaryConvexAuthToken!,
      );
    setupStage = "partner-register";
    await registerConvexFixtureUser(
      environment,
      pair,
      pair.partner,
      await convexAuthToken(partnerPage),
    );
    setupStage = "storage-state";
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
    console.error(`authenticated_fixture_setup_stage:${setupStage}`);
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
