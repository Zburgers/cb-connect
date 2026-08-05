import { expect, getApprovedReleaseFixture, test } from "./fixtures";

test.use({ storageState: getApprovedReleaseFixture("primary") });

test("approved primary fixture reaches the authenticated app", async ({ page }) => {
  test.setTimeout(120000);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/, {
    timeout: 30000,
  });
});
