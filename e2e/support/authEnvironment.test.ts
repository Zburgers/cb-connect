import { afterEach, describe, expect, test, vi } from "vitest";

import {
  APPROVED_CLERK_ENVIRONMENT,
  APPROVED_CONVEX_DEPLOYMENT,
  cleanupFixturePair,
  loadAuthEnvironment,
  provisionFixturePair,
  withTransientRetry,
} from "./authEnvironment";

const validEnvironment = {
  CLERK_TEST_ENVIRONMENT_NAME: APPROVED_CLERK_ENVIRONMENT,
  CLERK_TEST_SECRET_KEY: ["sk", "test", "unit"].join("_"),
  NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY: ["pk", "test", "unit"].join("_"),
  CLERK_TEST_FRONTEND_API_URL: "https://holy-clark.clerk.accounts.dev",
  CONVEX_TEST_DEPLOYMENT: APPROVED_CONVEX_DEPLOYMENT,
  NEXT_PUBLIC_TEST_CONVEX_URL:
    "https://hallowed-hummingbird-284.convex.cloud",
  CB_CONNECT_RELEASE_RUN_ID: "run-123",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("approved authenticated fixture environment", () => {
  test("accepts only the approved Clerk and Convex environment identity", () => {
    expect(loadAuthEnvironment(validEnvironment)).toMatchObject({
      clerkEnvironmentName: APPROVED_CLERK_ENVIRONMENT,
      convexDeployment: APPROVED_CONVEX_DEPLOYMENT,
      runId: "run-123",
    });
  });

  test.each([
    "CLERK_TEST_ENVIRONMENT_NAME",
    "CLERK_TEST_SECRET_KEY",
    "NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY",
    "CLERK_TEST_FRONTEND_API_URL",
    "CONVEX_TEST_DEPLOYMENT",
    "NEXT_PUBLIC_TEST_CONVEX_URL",
    "CB_CONNECT_RELEASE_RUN_ID",
  ])("fails closed when %s is missing", (key) => {
    const environment = { ...validEnvironment };
    delete environment[key as keyof typeof environment];

    expect(() => loadAuthEnvironment(environment)).toThrow(
      "Missing approved authenticated fixture environment",
    );
  });

  test("retries transient operations with bounded attempts", async () => {
    let attempts = 0;

    const result = await withTransientRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error("transient"), { status: 429 });
        }
        return "created";
      },
      { maxAttempts: 3, sleep: async () => undefined },
    );

    expect(result).toBe("created");
    expect(attempts).toBe(3);
  });

  test("cleans the primary when partner provisioning partially fails", async () => {
    const deleted: string[] = [];
    const config = loadAuthEnvironment(validEnvironment);

    await expect(
      provisionFixturePair(
        config,
        {
          createUser: async (spec) =>
            spec.role === "primary"
              ? { clerkId: "primary-id" }
              : Promise.reject(new Error("raw email and secret")),
          deleteUser: async (clerkId) => {
            deleted.push(clerkId);
          },
        },
        {
          passwordFactory: () => ["generated", "at", "runtime"].join("-"),
          maxAttempts: 1,
          sleep: async () => undefined,
        },
      ),
    ).rejects.toThrow("fixture_provisioning_failed");

    expect(deleted).toEqual(["primary-id"]);
  });

  test("treats already-deleted users as an idempotent cleanup success", async () => {
    const config = loadAuthEnvironment(validEnvironment);
    const result = await cleanupFixturePair(
      {
        runId: config.runId,
        primary: {
          role: "primary",
          clerkId: "primary-id",
        },
        partner: {
          role: "partner",
          clerkId: "partner-id",
        },
      },
      {
        deleteUser: async () => {
          throw Object.assign(new Error("already gone"), { status: 404 });
        },
      },
      { maxAttempts: 1, sleep: async () => undefined },
    );

    expect(result).toEqual({ ok: true, errors: [] });
  });
});
