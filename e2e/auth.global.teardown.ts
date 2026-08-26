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
  let teardownReason = "manifest-read";
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
    teardownReason = "manifest-parse";
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
  teardownReason = "clerk_testing_token_failed";
  await clerkSetup({
    frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
  });
  teardownStage = "browser-launch";
  teardownReason = "browser_launch_failed";
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
    teardownReason = "primary_sign_in_failed";
    await page.goto(`${environment.baseUrl}/`);
    await clerk.signIn({
      page,
      emailAddress: `cb-connect-e2e+${pair.runId}-primary@example.com`,
      setupClerkTestingTokenOptions: {
        frontendApiUrl: new URL(environment.clerkFrontendApiUrl).hostname,
      },
    });
    teardownStage = "primary-token";
    teardownReason = "primary_token_failed";
    const authToken = await convexAuthToken(page);
    // Stop the app before deleting rows so its reactive ensureUser call cannot
    // recreate the authenticated primary during the cleanup/status interval.
    await context.close();
    await browser.close();
    teardownStage = "fixture-cleanup";
    teardownReason = "fixture_cleanup_failed";
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
    teardownReason = "cleanup_status_failed";
    const status = await getConvexFixtureCleanupStatus(
      environment,
      pair,
      authToken,
    );
    if (status.remaining) {
      throw new Error("authenticated_fixture_cleanup_failed");
    }
    teardownStage = "evidence-write";
    teardownReason = "evidence_write_failed";
    const evidenceRoot =
      process.env.CB_CONNECT_RELEASE_EVIDENCE_DIR?.trim() || "e2e/.evidence";
    const evidenceDirectory = `${evidenceRoot}/${environment.runId}`;
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
    teardownReason = "auth_artifact_remove_failed";
    await rm(environment.storageDir, { recursive: true, force: true });
  } catch {
    console.error(`authenticated_fixture_teardown_stage:${teardownStage}`);
    console.error(`authenticated_fixture_teardown_reason:${teardownReason}`);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new Error("authenticated_fixture_cleanup_failed");
  }
}
