import { chromium, expect, type Page } from "@playwright/test";
import { readFile, rm } from "node:fs/promises";

import {
  cleanupFixturePair,
  createClerkFixtureServices,
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

async function cleanupApplicationData(
  page: Page,
): Promise<void> {
  await page.goto("/dashboard/partner");
  const revokeButton = page.getByRole("button", {
    name: /close partner access/i,
  });
  if (!(await revokeButton.count())) {
    return;
  }

  page.once("dialog", (dialog) => dialog.accept());
  await revokeButton.click();
  await expect(page.getByText("Partner access revoked.")).toBeVisible({
    timeout: 30000,
  });
}

export default async function globalTeardown() {
  const environment = loadAuthEnvironment();
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
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: environment.baseUrl,
    storageState: environment.primaryStorageStatePath,
  });
  const page = await context.newPage();

  try {
    const result = await cleanupFixturePair(
      pair,
      {
        ...clerkServices,
        cleanupApplicationData: () => cleanupApplicationData(page),
      },
      { maxAttempts: 3 },
    );
    if (!result.ok) {
      throw new Error("authenticated_fixture_cleanup_failed");
    }
    await context.close();
    await browser.close();
    await rm(environment.storageDir, { recursive: true, force: true });
  } catch {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new Error("authenticated_fixture_cleanup_failed");
  }
}
