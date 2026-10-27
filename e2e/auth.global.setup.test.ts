import { afterEach, describe, expect, test, vi } from "vitest";
import { pairingCodePatternForLength } from "./support/pairingCode";

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
const cleanupFixturePair = vi.fn();
const beginConvexFixtureRun = vi.fn();
const deleteUser = vi.fn();
const registerConvexFixtureUser = vi.fn();
const signIn = vi.fn();
const clerkSetup = vi.fn();
const close = vi.fn();
const navigationEvents: string[] = [];
let pageGotoFailure: ((name: string, url: string) => boolean) | undefined;

function locator() {
  return {
    click: vi.fn(),
    fill: vi.fn(),
    first: () => locator(),
    last: () => ({ textContent: vi.fn().mockResolvedValue("123456") }),
  };
}

function page(token: string, name: string) {
  return {
    goto: vi.fn(async (url: string) => {
      navigationEvents.push(`${name}:${url}`);
      if (pageGotoFailure?.(name, url)) throw new Error("synthetic_navigation_failure");
    }),
    waitForURL: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(token),
    getByText: vi.fn(() => locator()),
    getByRole: vi.fn(() => locator()),
    locator: vi.fn(() => locator()),
  };
}

vi.mock("@playwright/test", () => {
  const context = (name: string, token: string) => ({
    newPage: vi.fn().mockResolvedValue(page(token, name)),
    storageState: vi.fn(),
    close,
  });
  return {
    chromium: {
      launch: vi.fn().mockImplementation(async () => {
        let contextIndex = 0;
        return {
          newContext: vi.fn().mockImplementation(async () =>
            contextIndex++ === 0
              ? context("primary", "primary-convex-token")
              : context("partner", "partner-convex-token"),
          ),
          close,
        };
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
  cleanupFixturePair,
  beginConvexFixtureRun,
  createClerkFixtureServices: () => ({ deleteUser }),
  loadAuthEnvironment: () => environment,
  provisionFixturePair: vi.fn().mockResolvedValue(fixturePair),
  registerConvexFixtureUser,
}));

describe("authenticated fixture global setup", () => {
  afterEach(() => {
    vi.clearAllMocks();
    signIn.mockReset();
    cleanupFixturePair.mockReset();
    navigationEvents.length = 0;
    pageGotoFailure = undefined;
  });

  test("accepts the generated 12-character Crockford pairing code", () => {
    const pattern = pairingCodePatternForLength("12");
    expect(pattern.test("01ABCDEFGHJK")).toBe(true);
    expect(pattern.test("123456789012")).toBe(true);
    expect(pattern.test("01ABCDEFGHIL")).toBe(false);
    expect(pattern.test("01ABCDEFGHJU")).toBe(false);
    expect(pattern.test("12345")).toBe(false);
    expect(pairingCodePatternForLength("6").test("123456")).toBe(true);
    expect(pairingCodePatternForLength().test("123456")).toBe(true);
    expect(pairingCodePatternForLength().test("01ABCDEFGHJK")).toBe(true);
  });

  test("creates the durable run before dashboard work and cleans it when partner sign-in fails", async () => {
    cleanupConvexFixturePair.mockResolvedValue(undefined);
    cleanupFixturePair.mockImplementation(async (pair, services) => {
      await services.cleanupApplicationData?.(pair);
      await services.deleteUser(pair.partner.clerkId);
      await services.deleteUser(pair.primary.clerkId);
      return { ok: true, errors: [] };
    });
    beginConvexFixtureRun.mockImplementation(async () => {
      navigationEvents.push("begin");
    });
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
    expect(navigationEvents.indexOf("primary:/onboarding")).toBeGreaterThan(
      navigationEvents.indexOf("begin"),
    );
    expect(navigationEvents).not.toContain("primary:/dashboard");

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

  test("does not begin the durable run again after partner onboarding when pairing fails", async () => {
    beginConvexFixtureRun.mockResolvedValue(undefined);
    cleanupConvexFixturePair.mockResolvedValue(undefined);
    cleanupFixturePair.mockImplementation(async (pair, services) => {
      await services.cleanupApplicationData?.(pair);
      await services.deleteUser(pair.partner.clerkId);
      await services.deleteUser(pair.primary.clerkId);
      return { ok: true, errors: [] };
    });
    signIn.mockResolvedValue(undefined);
    clerkSetup.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);
    pageGotoFailure = (name, url) => name === "primary" && url === "/dashboard/partner";

    const setup = (await import("./auth.global.setup")).default;
    await expect(setup({} as never)).rejects.toThrow("authenticated_fixture_setup_failed");
    expect(navigationEvents).toContain("partner:/onboarding");
    expect(navigationEvents).toContain("primary:/dashboard/partner");
    expect(registerConvexFixtureUser).not.toHaveBeenCalled();
    expect(beginConvexFixtureRun).toHaveBeenCalledTimes(1);
    expect(cleanupConvexFixturePair).toHaveBeenCalledTimes(1);
    expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      cleanupConvexFixturePair.mock.invocationCallOrder[0],
    );
  });

  test("retries an ambiguous initial durable-run begin during scoped cleanup", async () => {
    beginConvexFixtureRun
      .mockRejectedValueOnce(new Error("ambiguous transport failure"))
      .mockResolvedValueOnce(undefined);
    cleanupConvexFixturePair.mockResolvedValue(undefined);
    cleanupFixturePair.mockImplementation(async (pair, services) => {
      await services.cleanupApplicationData?.(pair);
      await services.deleteUser(pair.partner.clerkId);
      await services.deleteUser(pair.primary.clerkId);
      return { ok: true, errors: [] };
    });
    signIn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("partner_sign_in_failed"));
    clerkSetup.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);

    const setup = (await import("./auth.global.setup")).default;
    await expect(setup({} as never)).rejects.toThrow("authenticated_fixture_setup_failed");

    expect(beginConvexFixtureRun).toHaveBeenCalledTimes(2);
    expect(beginConvexFixtureRun).toHaveBeenNthCalledWith(
      1,
      environment,
      fixturePair,
      "primary-convex-token",
    );
    expect(beginConvexFixtureRun).toHaveBeenNthCalledWith(
      2,
      environment,
      fixturePair,
      "primary-convex-token",
    );
    expect(cleanupConvexFixturePair).toHaveBeenCalledOnce();
  });

  test("preserves fixture accounts and reports cleanup/readback failure", async () => {
    cleanupConvexFixturePair.mockRejectedValue(
      Object.assign(new Error("fixture_application_cleanup_incomplete"), {
        status: 503,
      }),
    );
    const authEnvironment = await vi.importActual<
      typeof import("./support/authEnvironment")
    >("./support/authEnvironment");
    cleanupFixturePair.mockImplementation((pair, services, options) =>
      authEnvironment.cleanupFixturePair(pair, services, options),
    );
    beginConvexFixtureRun.mockResolvedValue(undefined);
    signIn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("partner_sign_in_failed"));
    clerkSetup.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const setup = (await import("./auth.global.setup")).default;

    await expect(setup({} as never)).rejects.toThrow(
      "authenticated_fixture_setup_failed",
    );

    expect(cleanupFixturePair).toHaveBeenCalledTimes(1);
    expect(cleanupFixturePair.mock.calls[0]?.[2]).toEqual({ maxAttempts: 3 });
    expect(cleanupConvexFixturePair).toHaveBeenCalledTimes(3);
    expect(cleanupConvexFixturePair.mock.calls).toEqual(
      Array.from({ length: 3 }, () => [
        environment,
        fixturePair,
        "primary-convex-token",
      ]),
    );
    expect(beginConvexFixtureRun).toHaveBeenCalledTimes(1);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      "authenticated_fixture_cleanup_errors:application_cleanup_failed",
    );
    errorLog.mockRestore();
  });

});
