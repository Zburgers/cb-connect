import { devices, type Page } from "@playwright/test";
import { expect, getApprovedReleaseFixture, test } from "./fixtures";

test.use({ trace: "off", screenshot: "off", video: "off" });

const SAFE_COPY = [
  {
    title: "Connection update",
    body: "Review your connection settings.",
  },
  {
    title: "Message activity",
    body: "Open messages to view current chat activity.",
  },
  {
    title: "A nudge is ready",
    body: "Open messages to see the nudge.",
  },
  {
    title: "Chat updated",
    body: "Open messages to see the current chat state.",
  },
  {
    title: "Connection setting updated",
    body: "Review settings for the current details.",
  },
] as const;

async function openInbox(page: Page) {
  await page.goto("/dashboard/notifications");
  await expect(
    page.getByRole("heading", { name: "Notification inbox", exact: true }),
  ).toBeVisible({ timeout: 30000 });

  return page
    .getByRole("list", { name: "Current notifications" })
    .getByRole("listitem");
}

async function setMessageActivity(page: Page, enabled: boolean) {
  await page.goto("/dashboard/settings");
  const preference = page
    .getByRole("region", { name: "In-app notification preferences" })
    .getByRole("checkbox", { name: "Message activity", exact: true });
  await expect(preference).toBeVisible({ timeout: 30000 });
  if ((await preference.isChecked()) !== enabled) {
    await preference.click({ timeout: 30000 });
  }
  await expect(preference).toBeChecked({ checked: enabled, timeout: 30000 });
}

async function sendSyntheticMessage(page: Page, body: string) {
  await page.goto("/dashboard/partner");
  await page.getByRole("button", { name: "Open DM", exact: true }).click();
  const thread = page.getByRole("dialog", { name: /Private message thread/i });
  await expect(thread).toBeVisible();
  await page.locator("#partner-message").fill(body);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(thread.locator("p").filter({ hasText: body }).last()).toBeVisible();
}

async function expectPopulatedSafeInbox(page: Page) {
  const items = await openInbox(page);
  await expect(items.first()).toBeVisible({ timeout: 120000 });
  const item = items.first();
  const title = (await item.getByRole("heading").textContent())?.trim();
  const body = (await item.locator("[data-notification-body]").textContent())?.trim();
  expect({ title, body }).toEqual(SAFE_COPY[1]);
  await expect(page.locator("main")).not.toContainText(
    /recipientUserId|sourceReference|idempotencyKey|payloadHash/i,
  );
  return { items, item };
}

function fixtureContextOptions(projectName: string) {
  const device =
    projectName === "release-mobile"
      ? devices["iPhone 13"]
      : devices["Desktop Chrome"];
  return device;
}

async function resetCycleWindowPreference(page: Page) {
  await page.goto("/dashboard/settings");
  const preferences = page.getByRole("region", {
    name: "In-app notification preferences",
  });
  const cycleWindow = preferences.getByRole("checkbox", {
    name: "Upcoming cycle window",
    exact: true,
  });
  const reminderTime = preferences.getByLabel(
    "Reminder time for upcoming cycle window",
  );

  if (await cycleWindow.isChecked()) {
    await cycleWindow.click({ timeout: 30000 });
  }
  await reminderTime.fill("");
  const saveTime = preferences.getByRole("button", {
    name: "Save upcoming cycle window time",
    exact: true,
  });
  if (await saveTime.isEnabled()) {
    await saveTime.click();
  }
  await expect(cycleWindow).not.toBeChecked();
  await expect(reminderTime).toHaveValue("");
}

test("synthetic relationship messages reach only the partner inbox and revocation hides pending notices", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const device = fixtureContextOptions(test.info().project.name);
  const primaryContext = await browser.newContext({
    ...device,
    storageState: getApprovedReleaseFixture("primary"),
  });
  const partnerContext = await browser.newContext({
    ...device,
    storageState: getApprovedReleaseFixture("partner"),
  });
  const primary = await primaryContext.newPage();
  const partner = await partnerContext.newPage();

  try {
    // The approved release fixtures are a clean, already-linked pair. Enable
    // both preferences so an empty sender inbox proves recipient scoping.
    await setMessageActivity(primary, true);
    await setMessageActivity(partner, true);
    await openInbox(primary);
    await expect(primary.getByText("You're all caught up.", { exact: true })).toBeVisible();
    await openInbox(partner);
    await expect(partner.getByText("You're all caught up.", { exact: true })).toBeVisible();
    await sendSyntheticMessage(primary, "Synthetic notification check one.");

    const { items, item } = await expectPopulatedSafeInbox(partner);
    await expect(items).toHaveCount(1);
    await expect(item.getByText("Unread", { exact: true })).toBeVisible();
    await openInbox(primary);
    await expect(primary.getByText("You're all caught up.", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    await item.getByRole("button", { name: "Mark as read", exact: true }).click();
    await expect(item.getByText("Read", { exact: true })).toBeVisible();
    await item.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(item).toBeHidden();

    await sendSyntheticMessage(primary, "Synthetic notification check two.");
    const second = await expectPopulatedSafeInbox(partner);
    await expect(second.items).toHaveCount(1);
    await setMessageActivity(primary, false);

    await primary.goto("/dashboard/partner");
    const closeAccess = primary.getByRole("button", {
      name: "Close partner access",
      exact: true,
    });
    await expect(closeAccess).toBeVisible({ timeout: 30000 });
    let confirmationMessage = "";
    primary.once("dialog", async (dialog) => {
      confirmationMessage = dialog.message();
      await dialog.accept();
    });
    await closeAccess.click();
    await expect(primary.getByText("Partner access revoked.")).toBeVisible({
      timeout: 30000,
    });
    expect(confirmationMessage).toContain("revoke partner access");

    await expect
      .poll(async () => second.items.count(), { timeout: 30000 })
      .toBe(0);
    await expect(
      partner.getByText("You're all caught up.", { exact: true }).or(
        partner.getByText("Your inbox is unavailable right now.", { exact: true }),
      ),
    ).toBeVisible();
    await setMessageActivity(partner, false);
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});

test.describe("in-app notification preferences", () => {
  test("primary preferences default off and scheduled changes take effect immediately", async ({
    browser,
  }) => {
    const device = fixtureContextOptions(test.info().project.name);
    const context = await browser.newContext({
      ...device,
      storageState: getApprovedReleaseFixture("primary"),
    });
    const page = await context.newPage();
    let preferenceTouched = false;

    try {
      await page.goto("/dashboard/settings");
      preferenceTouched = true;
      await expect(
        page.getByRole("heading", {
          name: "In-app notification preferences",
          exact: true,
        }),
      ).toBeVisible({ timeout: 30000 });

      const preferences = page.getByRole("region", {
        name: "In-app notification preferences",
      });
      const cycleWindow = preferences.getByRole("checkbox", {
        name: "Upcoming cycle window",
        exact: true,
      });
      const reminderTime = preferences.getByLabel(
        "Reminder time for upcoming cycle window",
      );
      const saveTime = preferences.getByRole("button", {
        name: "Save upcoming cycle window time",
        exact: true,
      });

      await expect(preferences.getByRole("checkbox")).toHaveCount(9);
      await expect(
        preferences.getByRole("checkbox", {
          name: "Daily cycle status",
          exact: true,
        }),
      ).toHaveCount(0);
      for (const option of await preferences.getByRole("checkbox").all()) {
        await expect(option).not.toBeChecked();
      }
      await expect(cycleWindow).toBeDisabled();

      await reminderTime.fill("10:30");
      await saveTime.click();
      await expect(preferences.getByRole("status")).toContainText(
        "Notification preference saved.",
        { timeout: 30000 },
      );
      await expect(cycleWindow).not.toBeChecked();
      await expect(cycleWindow).toBeEnabled();

      await cycleWindow.click({ timeout: 30000 });
      await expect(cycleWindow).toBeChecked({ timeout: 30000 });
      await reminderTime.fill("11:45");
      await saveTime.click();
      await expect(preferences.getByRole("status")).toContainText(
        "Notification preference saved.",
        { timeout: 30000 },
      );
      await expect(cycleWindow).toBeEnabled();

      await cycleWindow.click({ timeout: 30000 });
      await expect(cycleWindow).not.toBeChecked({ timeout: 30000 });
      await expect(preferences.getByRole("status")).toContainText(
        "Preference turned off.",
      );
    } finally {
      try {
        if (preferenceTouched) await resetCycleWindowPreference(page);
      } finally {
        await context.close();
      }
    }
  });

  test("partner preferences only show relationship purposes and default off", async ({
    browser,
  }) => {
    const device = fixtureContextOptions(test.info().project.name);
    const context = await browser.newContext({
      ...device,
      storageState: getApprovedReleaseFixture("partner"),
    });
    const page = await context.newPage();

    try {
      await page.goto("/dashboard/settings");
      await expect(
        page.getByRole("heading", {
          name: "In-app notification preferences",
          exact: true,
        }),
      ).toBeVisible({ timeout: 30000 });

      const preferences = page.getByRole("region", {
        name: "In-app notification preferences",
      });
      await expect(preferences.getByRole("checkbox")).toHaveCount(5);
      for (const option of await preferences.getByRole("checkbox").all()) {
        await expect(option).not.toBeChecked();
      }
    } finally {
      await context.close();
    }
  });
});
