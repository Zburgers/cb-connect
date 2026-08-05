import { test as base, type Page } from "@playwright/test";

type UserData = {
  name: string;
  storageStatePath: string;
  role: "primary" | "partner";
};

type ReleaseFixtureRole = "primary" | "partner";

const storageStateEnvironmentNames: Record<
  ReleaseFixtureRole,
  string
> = {
  primary: "CB_CONNECT_RELEASE_PRIMARY_STORAGE_STATE",
  partner: "CB_CONNECT_RELEASE_PARTNER_STORAGE_STATE",
};

export function getApprovedReleaseFixture(role: ReleaseFixtureRole): string {
  const environmentName = storageStateEnvironmentNames[role];
  const storageStatePath = process.env[environmentName]?.trim();

  if (!storageStatePath) {
    throw new Error(
      `Missing approved release fixture storage state: ${environmentName}`,
    );
  }

  return storageStatePath;
}

type Fixtures = {
  testUser: UserData;
  partnerUser: UserData;
  authenticatedPage: { page: Page; user: UserData };
};

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    await use({
      name: "Approved primary release fixture",
      storageStatePath: getApprovedReleaseFixture("primary"),
      role: "primary",
    });
  },

  partnerUser: async ({}, use) => {
    await use({
      name: "Approved partner release fixture",
      storageStatePath: getApprovedReleaseFixture("partner"),
      role: "partner",
    });
  },

  authenticatedPage: async ({ browser, testUser }, use) => {
    const context = await browser.newContext({
      storageState: testUser.storageStatePath,
    });
    const page = await context.newPage();

    try {
      await use({ page, user: testUser });
    } finally {
      await context.close();
    }
  },
});

export { expect } from "@playwright/test";
