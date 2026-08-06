import { afterEach, describe, expect, test, vi } from "vitest";

const fixturePair = {
  runId: "run-global-setup-partial-failure",
  primary: {
    role: "primary" as const,
    clerkId: "primary-clerk-id",
    email: "cb-connect-e2e+run-global-setup-partial-failure-primary@example.com",
  },
  partner: {
    role: "partner" as const,
    clerkId: "partner-clerk-id",
    email: "cb-connect-e2e+run-global-setup-partial-failure-partner@example.com",
  },
};

const environment = {
  clerkEnvironmentName: "holy clerk",
  clerkSecretKey: "sk_test_unit",
  clerkPublishableKey: "pk_test_unit",
  clerkFrontendApiUrl: "https://holy-clam-29.clerk.accounts.dev",
  convexDeployment: "dev:hallowed-hummingbird-284",
  convexUrl: "https://hallowed-hummingbird-284.convex.cloud",
  runId: fixturePair.runId,
  storageDir: "e2e/.auth/unit-global-setup",
  primaryStorageStatePath: "e2e/.auth/unit-global-setup/primary.json",
  partnerStorageStatePath: "e2e/.auth/unit-global-setup/partner.json",
  baseUrl: "http://127.0.0.1:3012",
};

const cleanupConvexFixturePair = vi.fn();
const beginConvexFixtureRun = vi.fn();
const deleteUser = vi.fn();
const registerConvexFixtureUser = vi.fn();
const signIn = vi.fn();
const clerkSetup = vi.fn();
const close = vi.fn();

function locator() {
  return {
    click: vi.fn(),
    fill: vi.fn(),
    first: () => locator(),
    last: () => ({ textContent: vi.fn().mockResolvedValue("123456") }),
  };
}

function page(token: string) {
  return {
    goto: vi.fn(),
    waitForURL: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(token),
    getByText: vi.fn(() => locator()),
    getByRole: vi.fn(() => locator()),
    locator: vi.fn(() => locator()),
  };
}

vi.mock("@playwright/test", () => {
  const primaryPage = page("primary-convex-token");
  const partnerPage = page("partner-convex-token");
  const primaryContext = {
    newPage: vi.fn().mockResolvedValue(primaryPage),
    storageState: vi.fn(),
    close,
  };
  const partnerContext = {
    newPage: vi.fn().mockResolvedValue(partnerPage),
    storageState: vi.fn(),
    close,
  };
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi
          .fn()
          .mockResolvedValueOnce(primaryContext)
          .mockResolvedValueOnce(partnerContext),
        close,
      }),
    },
    expect: () => ({ toBeVisible: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock("@clerk/testing/playwright", () => ({
  clerk: { signIn },
  clerkSetup,
}));

vi.mock("node:fs/promises", () => ({
  chmod: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("./support/authEnvironment", () => ({
  cleanupConvexFixturePair,
  beginConvexFixtureRun,
  createClerkFixtureServices: () => ({ deleteUser }),
  loadAuthEnvironment: () => environment,
  provisionFixturePair: vi.fn().mockResolvedValue(fixturePair),
  registerConvexFixtureUser,
}));

describe("authenticated fixture global setup", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("creates the durable run before dashboard work and cleans it when partner sign-in fails", async () => {
    cleanupConvexFixturePair.mockResolvedValue(undefined);
    beginConvexFixtureRun.mockResolvedValue(undefined);
    deleteUser.mockResolvedValue(undefined);
    signIn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("partner_sign_in_failed"));
    clerkSetup.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);

    const setup = (await import("./auth.global.setup")).default;

    await expect(setup({} as never)).rejects.toThrow(
      "authenticated_fixture_setup_failed",
    );

    expect(beginConvexFixtureRun).toHaveBeenCalledWith(
      environment,
      fixturePair,
      "primary-convex-token",
    );

    expect(cleanupConvexFixturePair).toHaveBeenCalledWith(
      environment,
      fixturePair,
      "primary-convex-token",
    );
    expect(registerConvexFixtureUser).not.toHaveBeenCalled();
    expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      cleanupConvexFixturePair.mock.invocationCallOrder[0],
    );
    expect(deleteUser).toHaveBeenCalledWith(fixturePair.partner.clerkId);
    expect(deleteUser).toHaveBeenCalledWith(fixturePair.primary.clerkId);
  });

});
