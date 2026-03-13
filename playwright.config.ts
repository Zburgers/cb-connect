import { defineConfig, devices } from "@playwright/test";

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
  timeout: 45000, // 45s timeout for Convex operations
  expect: {
    timeout: 8000, // 8s for assertions
  },
  fullyParallel: false, // Run tests sequentially for auth flows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Retry on CI
  workers: 1, // Single worker for auth tests
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add more browsers as needed
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
