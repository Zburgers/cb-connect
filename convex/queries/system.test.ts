import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const backendEnvironmentKeys = [
  "CB_CONNECT_BACKEND_DEPLOYMENT",
  "CB_CONNECT_BACKEND_COMPATIBILITY_VERSION",
  "CB_CONNECT_BACKEND_DEPLOYED_AT",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of backendEnvironmentKeys) {
    delete process.env[key];
  }
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.CONVEX_DEPLOY_KEY;
});

describe("backend compatibility identity", () => {
  test("returns the approved identity without authentication or database access", async () => {
    vi.stubEnv(
      "CB_CONNECT_BACKEND_DEPLOYMENT",
      "dev:hallowed-hummingbird-284",
    );
    vi.stubEnv("CB_CONNECT_BACKEND_COMPATIBILITY_VERSION", "v1");
    vi.stubEnv(
      "CB_CONNECT_BACKEND_DEPLOYED_AT",
      "2026-08-05T16:00:00.000Z",
    );

    const t = convexTest(schema, modules);

    const identity = await t.query(api.queries.system.getBackendIdentity, {});

    expect(identity).toEqual({
      deployment: "dev:hallowed-hummingbird-284",
      compatibilityVersion: "v1",
      deployedAt: "2026-08-05T16:00:00.000Z",
    });
  });

  test("fails closed when backend metadata is incomplete", async () => {
    vi.stubEnv("CB_CONNECT_BACKEND_COMPATIBILITY_VERSION", "v1");
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYED_AT", "2026-08-05T16:00:00.000Z");

    const t = convexTest(schema, modules);

    const identity = await t.query(api.queries.system.getBackendIdentity, {});

    expect(identity).toBeNull();
  });

  test("fails closed for a malformed deployment timestamp", async () => {
    vi.stubEnv(
      "CB_CONNECT_BACKEND_DEPLOYMENT",
      "dev:hallowed-hummingbird-284",
    );
    vi.stubEnv("CB_CONNECT_BACKEND_COMPATIBILITY_VERSION", "v1");
    vi.stubEnv("CB_CONNECT_BACKEND_DEPLOYED_AT", "not-a-timestamp");

    const t = convexTest(schema, modules);

    const identity = await t.query(api.queries.system.getBackendIdentity, {});

    expect(identity).toBeNull();
  });

  test("does not serialize unrelated sensitive environment values", async () => {
    vi.stubEnv(
      "CB_CONNECT_BACKEND_DEPLOYMENT",
      "dev:hallowed-hummingbird-284",
    );
    vi.stubEnv("CB_CONNECT_BACKEND_COMPATIBILITY_VERSION", "v1");
    vi.stubEnv(
      "CB_CONNECT_BACKEND_DEPLOYED_AT",
      "2026-08-05T16:00:00.000Z",
    );
    vi.stubEnv("CLERK_SECRET_KEY", "sensitive-marker");
    vi.stubEnv("CONVEX_DEPLOY_KEY", "sensitive-marker");

    const t = convexTest(schema, modules);

    const identity = await t.query(api.queries.system.getBackendIdentity, {});

    expect(identity).toEqual({
      deployment: "dev:hallowed-hummingbird-284",
      compatibilityVersion: "v1",
      deployedAt: "2026-08-05T16:00:00.000Z",
    });
    expect(JSON.stringify(identity)).not.toContain("sensitive-marker");
  });
});
