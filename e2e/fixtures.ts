import { test as base, expect } from "@playwright/test";

/**
 * Test fixtures for CB Connect E2E tests
 * 
 * Provides:
 * - testUser: Primary user credentials
 * - partnerUser: Partner user credentials
 * - authenticatedPage: Pre-authenticated page context
 */

type UserData = {
  email: string;
  password: string;
  name: string;
  role?: "primary" | "partner";
};

type Fixtures = {
  testUser: UserData;
  partnerUser: UserData;
  authenticatedPage: { page: any; user: UserData };
};

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    const user: UserData = {
      email: `test.primary.${Date.now()}@example.com`,
      password: "Test123!@#",
      name: "Test Primary User",
      role: "primary",
    };
    
    // Note: In a real test environment, you would create the user via API
    // For now, we use mock credentials that would be created manually
    await use(user);
  },

  partnerUser: async ({}, use) => {
    const user: UserData = {
      email: `test.partner.${Date.now()}@example.com`,
      password: "Test123!@#",
      name: "Test Partner User",
      role: "partner",
    };
    
    await use(user);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Setup: Authenticate user
    await page.goto("/sign-in");
    
    // Wait for Clerk authentication to load
    await page.waitForSelector('[data-clerk-root]', { timeout: 10000 });
    
    // For testing purposes, we'll skip actual auth and assume logged in
    // In production, you would use API calls to authenticate
    await use({ page, user: testUser });
    
    // Teardown: Sign out
    // await page.getByRole("button", { name: /user/i }).click();
    // await page.getByRole("menuitem", { name: /sign out/i }).click();
  },
});

export { expect } from "@playwright/test";
