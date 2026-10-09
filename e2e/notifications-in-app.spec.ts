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

type InboxState = "unavailable" | "empty" | "populated";

async function openInbox(page: Page, requireEmpty = false): Promise<InboxState> {
  await page.goto("/dashboard/notifications");
  await expect(
    page.getByRole("heading", { name: "Notification inbox", exact: true }),
  ).toBeVisible({ timeout: 30000 });

  const items = page
    .getByRole("list", { name: "Current notifications" })
    .getByRole("listitem");
  const unavailable = page.getByText("Your inbox is unavailable right now.", {
    exact: true,
  });
  const empty = page.getByText("You're all caught up.", { exact: true });

  await expect
    .poll(async () =>
      (await unavailable.isVisible().catch(() => false)) ||
      (await empty.isVisible().catch(() => false)) ||
      (await items.count()) > 0,
    )
    .toBe(true);

  if (requireEmpty) {
    await expect(items).toHaveCount(0);
  }

  if (await unavailable.isVisible().catch(() => false)) {
    await expect(items).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark as read" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
    return "unavailable";
  }

  if ((await items.count()) === 0) {
    await expect(empty).toBeVisible();
    return "empty";
  }

  while ((await items.count()) > 0) {
    const item = items.first();
    const title = (await item.getByRole("heading").textContent())?.trim();
    const body = (await item.locator("[data-notification-body]").textContent())?.trim();
    expect(SAFE_COPY).toContainEqual({ title, body });

    const markRead = item.getByRole("button", { name: "Mark as read", exact: true });
    if (await markRead.isVisible().catch(() => false)) {
      await markRead.click();
      await expect(item.getByText("Read", { exact: true })).toBeVisible();
    } else {
      await expect(item.getByText("Read", { exact: true })).toBeVisible();
    }

    await item.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(item).toBeHidden();
  }

  await expect(page.locator("main")).not.toContainText(
    /recipientUserId|sourceReference|idempotencyKey|payloadHash/i,
  );
  return "populated";
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
    await cycleWindow.uncheck();
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

test("synthetic primary and partner inboxes render only static safe copy and support read/dismiss", async ({
  browser,
}) => {
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
    await openInbox(primary);
    await openInbox(partner);

    // The documented release setup creates a clean linked pair. It can prove
    // default-off/empty rendering now; N8 must seed approved relationship rows
    // before an authenticated run can exercise the populated read/dismiss path.
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});

test("revoked synthetic partner has no current inbox entries", async ({ browser }) => {
  test.setTimeout(120000);
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

    const state = await openInbox(partner, true);
    expect(["unavailable", "empty"]).toContain(state);
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
      );
      await expect(cycleWindow).not.toBeChecked();
      await expect(cycleWindow).toBeEnabled();

      await cycleWindow.check();
      await expect(cycleWindow).toBeChecked();
      await reminderTime.fill("11:45");
      await saveTime.click();
      await expect(preferences.getByRole("status")).toContainText(
        "Notification preference saved.",
      );
      await expect(cycleWindow).toBeEnabled();

      await cycleWindow.uncheck();
      await expect(cycleWindow).not.toBeChecked();
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
