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
  beginConvexFixtureRun,
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

async function signIn(
  page: Page,
  environment: AuthEnvironment,
  user: { email?: string; password?: string },
  failureReason: string,
) {
  try {
    if (!user.email) {
      throw new Error(failureReason);
    }

    process.env.CLERK_SECRET_KEY = environment.clerkSecretKey;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      environment.clerkPublishableKey;
    await page.goto(`${environment.baseUrl}/`);
    await clerk.signIn({
      page,
      emailAddress: user.email,
      setupClerkTestingTokenOptions: {
        frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
      },
    });
  } catch {
    throw new Error(failureReason);
  }
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
  failureReason: string,
  reportStage: (stage: string) => void = () => undefined,
) {
  try {
    reportStage(`${role}-onboarding-load`);
    await page.goto("/onboarding");
    if (role === "primary") {
      reportStage("primary-onboarding-role");
      await page.getByRole("button", { name: /I track my cycle/i }).click();
      reportStage("primary-onboarding-date");
      const periodDateInput = page.locator('input[type="date"]');
      await expect(periodDateInput).toBeVisible({ timeout: 60000 });
      await periodDateInput.fill(syntheticPastDate());
      reportStage("primary-onboarding-submit");
      await page.getByRole("button", { name: /start tracking/i }).click();
      reportStage("primary-onboarding-redirect");
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
      return;
    }

    reportStage("partner-onboarding-role");
    await page.getByRole("button", { name: /I support my partner/i }).click();
    reportStage("partner-onboarding-redirect");
    await page.waitForURL(/\/dashboard\/partner/, { timeout: 30000 });
  } catch {
    throw new Error(failureReason);
  }
}

async function linkCouple(primaryPage: Page, partnerPage: Page): Promise<void> {
  await primaryPage.goto("/dashboard/partner");
  const generateCodeButton = primaryPage.getByRole("button", {
    name: /generate pairing code/i,
  });
  await expect(generateCodeButton).toBeVisible({ timeout: 30000 });
  await generateCodeButton.click();
  const codeLocator = primaryPage.getByText(/^\d{6}$/).last();
  await expect(codeLocator).toBeVisible({ timeout: 30000 });
  const code = (await codeLocator.textContent())?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    throw new Error("pairing_code_creation_failed");
  }

  try {
    await partnerPage.goto("/dashboard/partner");
    const partnerCodeInput = partnerPage.locator("#partner-code");
    await expect(partnerCodeInput).toBeVisible({ timeout: 30000 });
    await partnerCodeInput.fill(code);
    const linkButton = partnerPage.getByRole("button", { name: /link account/i });
    await expect(linkButton).toBeVisible({ timeout: 30000 });
    await linkButton.click();
    await expect(partnerPage.getByText("Successfully linked!")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      primaryPage.getByRole("heading", { name: "Your locket is connected" }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      partnerPage.getByRole("heading", { name: "Your locket is connected" }),
    ).toBeVisible({ timeout: 30000 });
  } catch {
    throw new Error("pairing_code_consumption_failed");
  }
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
  let setupReason = "unknown";

  const services: FixtureServices = { ...clerkServices };
  let primaryConvexAuthToken: string | null = null;
  const safeSetupReasons = new Set([
    "authenticated_fixture_setup_failed",
    "authenticated_fixture_convex_token_missing",
    "fixture_provisioning_failed",
    "clerk_testing_token_failed",
    "browser_launch_failed",
    "primary_sign_in_failed",
    "primary_onboarding_failed",
    "partner_sign_in_failed",
    "partner_onboarding_failed",
    "pairing_code_creation_failed",
    "pairing_code_consumption_failed",
    "fixture_registration_failed",
    "fixture_storage_state_failed",
    "fixture_run_begin_failed",
  ]);

  try {
    setupReason = "fixture_provisioning_failed";
    pair = await provisionFixturePair(environment, services, {
      passwordFactory: () => randomBytes(24).toString("base64url"),
    });

    process.env.CLERK_SECRET_KEY = environment.clerkSecretKey;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = environment.clerkPublishableKey;
    setupStage = "clerk-testing";
    setupReason = "clerk_testing_token_failed";
    await clerkSetup({
      frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
    });

    setupStage = "browser";
    setupReason = "browser_launch_failed";
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
    setupReason = "primary_sign_in_failed";
    await signIn(primaryPage, environment, pair.primary, setupReason);

    setupStage = "fixture-run-begin";
    setupReason = "fixture_run_begin_failed";
    const token = await convexAuthToken(primaryPage);
    primaryConvexAuthToken = token;
    await beginConvexFixtureRun(environment, pair!, token);
    // The durable run exists before the dashboard can call ensureUser.
    // From this point every failure can clean partially-created app data.
    services.cleanupApplicationData = (fixturePair) =>
      cleanupConvexFixturePair(environment, fixturePair, token);

    setupStage = "primary-onboarding";
    setupReason = "primary_onboarding_failed";
    await completeOnboarding(
      primaryPage,
      "primary",
      setupReason,
      (stage) => {
        setupStage = stage;
      },
    );

    setupStage = "partner-sign-in";
    setupReason = "partner_sign_in_failed";
    await signIn(partnerPage, environment, pair.partner, setupReason);

    setupStage = "partner-onboarding";
    setupReason = "partner_onboarding_failed";
    await completeOnboarding(
      partnerPage,
      "partner",
      setupReason,
      (stage) => {
        setupStage = stage;
      },
    );

    setupStage = "link";
    setupReason = "pairing_code_creation_failed";
    try {
      await linkCouple(primaryPage, partnerPage);
    } catch (error) {
      if (error instanceof Error && safeSetupReasons.has(error.message)) {
        setupReason = error.message;
      }
      throw error;
    }

    setupStage = "primary-register";
    if (!primaryConvexAuthToken) {
      throw new Error("authenticated_fixture_convex_token_missing");
    }
    setupReason = "fixture_registration_failed";
    await registerConvexFixtureUser(
      environment,
      pair,
      pair.primary,
      primaryConvexAuthToken,
    );

    setupStage = "partner-register";
    setupReason = "fixture_registration_failed";
    await registerConvexFixtureUser(
      environment,
      pair,
      pair.partner,
      await convexAuthToken(partnerPage),
    );

    setupStage = "storage-state";
    setupReason = "fixture_storage_state_failed";
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
  } catch (error) {
    if (error instanceof Error && safeSetupReasons.has(error.message)) {
      setupReason = error.message;
    }
    console.error(`authenticated_fixture_setup_stage:${setupStage}`);
    console.error(`authenticated_fixture_setup_reason:${setupReason}`);
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
