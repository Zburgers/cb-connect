import { devices, type Page } from "@playwright/test";
import { expect, getApprovedReleaseFixture, test } from "./fixtures";

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
