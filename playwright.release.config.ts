import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const basePort = new URL(baseURL).port || "3000";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: path.resolve(
    process.env.CB_CONNECT_RELEASE_AUTH_DIR ?? "e2e/.auth",
    "test-results",
  ),
  globalSetup: "./e2e/auth.global.setup.ts",
  globalTeardown: "./e2e/auth.global.teardown.ts",
  timeout: 45000,
  expect: {
    timeout: 8000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    [
      "html",
      {
        outputFolder: path.resolve(
          process.env.CB_CONNECT_RELEASE_AUTH_DIR ?? "e2e/.auth",
          "playwright-report",
        ),
        open: "never",
      },
    ],
    ["list"],
  ],
  use: {
    baseURL,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "release-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "release-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${basePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY ?? "",
      CLERK_SECRET_KEY: process.env.CLERK_TEST_SECRET_KEY ?? "",
      CLERK_FRONTEND_API_URL: process.env.CLERK_TEST_FRONTEND_API_URL ?? "",
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_TEST_CONVEX_URL ?? "",
      CONVEX_DEPLOYMENT: process.env.CONVEX_TEST_DEPLOYMENT ?? "",
    },
  },
});
