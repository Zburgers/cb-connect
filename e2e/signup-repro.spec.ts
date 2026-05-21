import { test, expect } from "@playwright/test";

test("clerk signup with provided credentials reaches the app", async ({ page }) => {
  test.setTimeout(120000);

  const email = "male@cbconnect.com";
  const password = "123maleaccount";

  await page.goto("/sign-up");

  await expect(page.locator("body")).toContainText(/start gently|build a private space for care/i);

  const emailInput = page
    .locator('input[type="email"], input[name="emailAddress"], input[autocomplete="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"], input[autocomplete="new-password"]')
    .first();

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = page
    .getByRole("button", { name: /create account|sign up|continue/i })
    .first();

  await submitButton.click();
  await expect(page).toHaveURL(/\/dashboard|\/onboarding|\/sign-in/, {
    timeout: 30000,
  });

  console.log("URL after signup:", page.url());
  console.log("BODY after signup:", (await page.locator("body").innerText()).slice(0, 5000));
});
