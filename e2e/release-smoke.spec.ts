import { type Locator, type Page } from "@playwright/test";
import { expect, getApprovedReleaseFixture, test } from "./fixtures";

const RELEASE_MESSAGE = "E3 release smoke: private chat works.";

async function isVisible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function ensureLinked(primary: Page, partner: Page) {
  await primary.goto("/dashboard/partner");
  await expect(
    primary.getByRole("heading", { name: "Partner connection" }),
  ).toBeVisible();

  const connected = primary.getByRole("heading", {
    name: "Your locket is connected",
  });
  if (!(await isVisible(connected))) {
    await primary
      .getByRole("button", { name: /generate pairing code/i })
      .click();
    const code = (
      await primary.getByText(/^\d{6}$/).last().textContent()
    )?.trim();
    expect(code).toMatch(/^\d{6}$/);

    await partner.goto("/dashboard/partner");
    await expect(partner.locator("#partner-code")).toBeVisible();
    await partner.locator("#partner-code").fill(code!);
    await partner
      .getByRole("button", { name: /link account/i })
      .click();
    await expect(partner.getByText("Successfully linked!"))
      .toBeVisible();
  }

  await expect(connected).toBeVisible({ timeout: 30000 });
  await partner.goto("/dashboard/partner");
  await expect(
    partner.getByRole("heading", { name: "Your locket is connected" }),
  ).toBeVisible({ timeout: 30000 });
}

async function closeExistingPeriod(primary: Page) {
  await primary.goto("/dashboard/log");
  await expect(
    primary.getByRole("heading", { name: "Cycle history" }),
  ).toBeVisible({ timeout: 30000 });
  const ongoingHeading = primary.getByRole("heading", {
    name: /Period in progress since/i,
  });
  if (await isVisible(ongoingHeading)) {
    await primary.getByRole("button", { name: "Today", exact: true }).click();
    await primary
      .getByRole("button", { name: "Mark as ended", exact: true })
      .click();
    await expect(primary.getByText("Period marked as ended.")).toBeVisible();
  }
}

async function configureSharing(primary: Page) {
  await primary.goto("/dashboard/partner");

  const phase = primary.getByRole("checkbox", {
    name: /Share period \/ cycle phase/i,
  });
  const periodWrite = primary.getByRole("checkbox", {
    name: /Allow partner to help log period dates/i,
  });
  const pain = primary.getByRole("checkbox", { name: /Share pain data/i });

  await expect(phase).toBeVisible({ timeout: 30000 });
  await expect(periodWrite).toBeVisible({ timeout: 30000 });
  await expect(pain).toBeVisible({ timeout: 30000 });

  if (!(await phase.isChecked())) {
    await phase.evaluate((element) => (element as HTMLInputElement).click());
    await expect(phase).toBeChecked({ timeout: 30000 });
    await expect(primary.getByText("Period visibility is on.")).toBeVisible();
  }
  if (!(await periodWrite.isChecked())) {
    await periodWrite.evaluate((element) =>
      (element as HTMLInputElement).click(),
    );
    await expect(periodWrite).toBeChecked({ timeout: 30000 });
    await expect(
      primary.getByText("Your partner can now help update period dates."),
    ).toBeVisible();
  }
  if (!(await pain.isChecked())) {
    await pain.evaluate((element) => (element as HTMLInputElement).click());
    await expect(pain).toBeChecked({ timeout: 30000 });
  }

  await expect(phase).toBeChecked();
  await expect(periodWrite).toBeChecked();
  await expect(pain).toBeChecked();
}

async function logPrimaryPeriodAndPartnerEnd(primary: Page, partner: Page) {
  await closeExistingPeriod(primary);

  await primary.getByRole("button", { name: "Yesterday", exact: true }).click();
  await expect(
    primary.getByText(/Start period on/i),
  ).toBeVisible();
  await primary
    .getByRole("button", { name: "Start period", exact: true })
    .click();
  await expect(primary.getByText("Period started.")).toBeVisible();

  await partner.goto("/dashboard/log");
  await expect(
    partner.getByRole("heading", { name: "Help update period dates" }),
  ).toBeVisible({ timeout: 30000 });
  await partner.getByRole("button", { name: "Today", exact: true }).click();
  await partner
    .getByRole("button", { name: "Save update", exact: true })
    .click();
  await expect(
    partner.getByText(
      "Saved. This was added as partner-assisted and your partner can correct it anytime.",
    ),
  ).toBeVisible();
}

async function exerciseChat(primary: Page, partner: Page) {
  await partner.goto("/dashboard/partner");
  await partner.getByRole("button", { name: "Open DM", exact: true }).click();
  const partnerDialog = partner.getByRole("dialog", {
    name: /Private message thread/i,
  });
  await expect(partnerDialog).toBeVisible();
  await partner.locator("#partner-message").fill(RELEASE_MESSAGE);
  await partner.getByRole("button", { name: "Send message" }).click();
  await expect(
    partnerDialog.locator("p").filter({ hasText: RELEASE_MESSAGE }).last(),
  ).toBeVisible();

  await primary.goto("/dashboard/partner");
  await primary.getByRole("button", { name: "Open DM", exact: true }).click();
  const primaryDialog = primary.getByRole("dialog", {
    name: /Private message thread/i,
  });
  await expect(primaryDialog).toBeVisible();
  await expect(
    primaryDialog.locator("p").filter({ hasText: RELEASE_MESSAGE }).last(),
  ).toBeVisible({ timeout: 30000 });
}

async function revokeAndRelink(primary: Page, partner: Page) {
  await primary.goto("/dashboard/partner");
  let confirmationMessage = "";
  primary.once("dialog", async (dialog) => {
    confirmationMessage = dialog.message();
    await dialog.accept();
  });
  await primary
    .getByRole("button", { name: "Close partner access", exact: true })
    .click({ force: true });
  expect(confirmationMessage).toContain("revoke partner access");

  await expect(primary.getByText("Partner access revoked.")).toBeVisible();
  await expect(
    primary.getByText("Invite your partner into this space"),
  ).toBeVisible({ timeout: 30000 });

  await partner.goto("/dashboard/partner");
  await expect(partner.locator("#partner-code")).toBeVisible({
    timeout: 30000,
  });

  await primary
    .getByRole("button", { name: /generate pairing code/i })
    .click();
  const code = (
    await primary.getByText(/^\d{6}$/).last().textContent()
  )?.trim();
  expect(code).toMatch(/^\d{6}$/);

  await partner.locator("#partner-code").fill(code!);
  await partner.getByRole("button", { name: /link account/i }).click();
  await expect(partner.getByText("Successfully linked!")).toBeVisible({
    timeout: 30000,
  });
  await primary.goto("/dashboard/partner");
  await partner.goto("/dashboard/partner");
  await expect(
    primary.getByRole("heading", { name: "Your locket is connected" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    partner.getByRole("heading", { name: "Your locket is connected" }),
  ).toBeVisible({ timeout: 30000 });
}

test("release smoke: primary and partner complete the shared journey", async ({
  browser,
}) => {
  test.setTimeout(180000);

  const primaryContext = await browser.newContext({
    storageState: getApprovedReleaseFixture("primary"),
  });
  const partnerContext = await browser.newContext({
    storageState: getApprovedReleaseFixture("partner"),
  });
  const primary = await primaryContext.newPage();
  const partner = await partnerContext.newPage();

  try {
    await test.step("linking", async () => {
      await ensureLinked(primary, partner);
    });

    await test.step("sharing and period logging", async () => {
      await configureSharing(primary);
      await logPrimaryPeriodAndPartnerEnd(primary, partner);
    });

    await test.step("private chat", async () => {
      await exerciseChat(primary, partner);
    });

    await test.step("revocation and relinking", async () => {
      await revokeAndRelink(primary, partner);
    });
  } finally {
    await partnerContext.close();
    await primaryContext.close();
  }
});
