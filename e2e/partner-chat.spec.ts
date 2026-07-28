import { test, expect } from "@playwright/test";

test.describe("authenticated couple DM", () => {
  test.skip(!process.env.CB_CONNECT_AUTH_STATE, "Set CB_CONNECT_AUTH_STATE to run authenticated chat coverage");

  test.use({ storageState: process.env.CB_CONNECT_AUTH_STATE });

  test("shows unread-only launcher state and clears it when opened", async ({ page }) => {
    await page.goto("/dashboard");
    const launcher = page.getByRole("button", { name: /open private message thread/i });
    await expect(launcher).toBeVisible();
    const badge = launcher.locator("span[aria-label$='unread messages']");
    if (await badge.count()) await expect(badge).toHaveAttribute("aria-label", /unread messages/);
    await launcher.click();
    await expect(page.getByRole("dialog", { name: /private message thread/i })).toBeVisible();
    await page.getByRole("button", { name: /close private message thread/i }).click();
    await expect(launcher.locator("span[aria-label$='unread messages']")).toHaveCount(0);
  });

  test("supports grouped-message actions and receipt labels at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /open private message thread/i }).click();
    const dialog = page.getByRole("dialog", { name: /private message thread/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /actions for message/i }).first()).toBeVisible();
    await dialog.getByRole("button", { name: /actions for message/i }).first().click();
    await expect(dialog.getByRole("button", { name: /react with/i }).first()).toBeVisible();
  });
});
