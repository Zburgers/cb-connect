import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Playwright E2E configuration for CB Connect
 * 
 * Run tests:
 * - npx playwright test                    # Run all tests
 * - npx playwright test --headed           # Run in headed mode
 * - npx playwright test --debug            # Debug mode
 * - npx playwright test --project=chromium # Run on specific browser
 * - npx playwright test --grep "partner"   # Run specific test
 */

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/auth.global.setup.ts",
  globalTeardown: "./e2e/auth.global.teardown.ts",
  timeout: 45000, // 45s timeout for Convex operations
  expect: {
    timeout: 8000, // 8s for assertions
  },
  fullyParallel: false, // Run tests sequentially for auth flows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Retry on CI
  workers: 1, // Single worker for auth tests
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
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
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
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
