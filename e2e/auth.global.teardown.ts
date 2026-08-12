import { chromium, type Page } from "@playwright/test";
import {
  clerk,
  clerkSetup,
} from "@clerk/testing/playwright";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import {
  cleanupConvexFixturePair,
  cleanupFixturePair,
  createClerkFixtureServices,
  getConvexFixtureCleanupStatus,
  loadAuthEnvironment,
  type ProvisionedFixturePair,
} from "./support/authEnvironment";

type FixtureManifest = {
  runId: string;
  primary: { role: "primary"; clerkId: string };
  partner: { role: "partner"; clerkId: string };
};

function isFixtureManifest(value: unknown): value is FixtureManifest {
  if (typeof value !== "object" || value === null) return false;
  const manifest = value as Partial<FixtureManifest>;
  return (
    typeof manifest.runId === "string" &&
    typeof manifest.primary?.clerkId === "string" &&
    typeof manifest.partner?.clerkId === "string"
  );
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
  if (!token) throw new Error("authenticated_fixture_convex_token_missing");
  return token;
}

export default async function globalTeardown() {
  const environment = loadAuthEnvironment();
  let teardownStage = "manifest-read";
  let manifestText: string;
  try {
    manifestText = await readFile(
      `${environment.storageDir}/fixture-manifest.json`,
      "utf8",
    );
  } catch {
    return;
  }

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(manifestText);
  } catch {
    throw new Error("authenticated_fixture_cleanup_failed");
  }
  if (!isFixtureManifest(parsedManifest)) {
    throw new Error("authenticated_fixture_cleanup_failed");
  }

  const pair: ProvisionedFixturePair = {
    runId: parsedManifest.runId,
    primary: {
      role: "primary",
      clerkId: parsedManifest.primary.clerkId,
    },
    partner: {
      role: "partner",
      clerkId: parsedManifest.partner.clerkId,
    },
  };
  const clerkServices = createClerkFixtureServices(environment);
  process.env.CLERK_SECRET_KEY = environment.clerkSecretKey;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = environment.clerkPublishableKey;
  teardownStage = "clerk-testing";
  await clerkSetup({
    frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
  });
  teardownStage = "browser-launch";
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    baseURL: environment.baseUrl,
  });
  const page = await context.newPage();
  try {
    teardownStage = "primary-sign-in";
    await page.goto(`${environment.baseUrl}/`);
    await clerk.signIn({
      page,
      emailAddress: `cb-connect-e2e+${pair.runId}-primary@example.com`,
      setupClerkTestingTokenOptions: {
        frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
      },
    });
    teardownStage = "primary-token";
    const authToken = await convexAuthToken(page);
    // Stop the app before deleting rows so its reactive ensureUser call cannot
    // recreate the authenticated primary during the cleanup/status interval.
    await context.close();
    await browser.close();
    teardownStage = "fixture-cleanup";
    const result = await cleanupFixturePair(
      pair,
      {
        ...clerkServices,
        cleanupApplicationData: (fixturePair) =>
          cleanupConvexFixturePair(environment, fixturePair, authToken),
      },
      { maxAttempts: 3 },
    );
    if (!result.ok) {
      console.error(
        `authenticated_fixture_cleanup_errors:${result.errors.join(",") || "unknown"}`,
      );
      throw new Error("authenticated_fixture_cleanup_failed");
    }
    teardownStage = "zero-status";
    const status = await getConvexFixtureCleanupStatus(
      environment,
      pair,
      authToken,
    );
    if (status.remaining) {
      throw new Error("authenticated_fixture_cleanup_failed");
    }
    teardownStage = "evidence-write";
    const evidenceDirectory = "docs/evidence/reliability-gate-0";
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      `${evidenceDirectory}/e2-live-proof.md`,
      [
        "# E2 live teardown proof",
        "",
        `- Recorded: ${new Date().toISOString()}`,
        "- Clerk target: approved holy clerk development instance",
        "- Convex target: dev:hallowed-hummingbird-284",
        "- Cleanup result: application cascade completed",
        "- Post-cleanup status: remaining=false",
        `- Post-cleanup counts: ${JSON.stringify(status.counts)}`,
        "- Secrets and fixture identifiers: omitted",
        "",
      ].join("\n"),
      { encoding: "utf8", mode: 0o600 },
    );
    teardownStage = "auth-artifact-remove";
    await rm(environment.storageDir, { recursive: true, force: true });
  } catch {
    console.error(`authenticated_fixture_teardown_stage:${teardownStage}`);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new Error("authenticated_fixture_cleanup_failed");
  }
}
