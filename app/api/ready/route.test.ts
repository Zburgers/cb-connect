import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = queryMock;
  },
}));

import { GET } from "./route";

const frontendEnvironment = {
  CB_CONNECT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
  CB_CONNECT_BUILD_ID: "build-2026-08-05-001",
  CB_CONNECT_COMPATIBILITY_VERSION: "v1",
  CB_CONNECT_BUILT_AT: "2026-08-05T15:00:00.000Z",
  NEXT_PUBLIC_CONVEX_URL: "https://happy-animal-123.convex.cloud",
};

const backendIdentity = {
  deployment: "dev:hallowed-hummingbird-284",
  compatibilityVersion: "v1",
  deployedAt: "2026-08-05T16:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("CB_CONNECT_COMMIT_SHA", frontendEnvironment.CB_CONNECT_COMMIT_SHA);
  vi.stubEnv("CB_CONNECT_BUILD_ID", frontendEnvironment.CB_CONNECT_BUILD_ID);
  vi.stubEnv(
    "CB_CONNECT_COMPATIBILITY_VERSION",
    frontendEnvironment.CB_CONNECT_COMPATIBILITY_VERSION,
  );
  vi.stubEnv("CB_CONNECT_BUILT_AT", frontendEnvironment.CB_CONNECT_BUILT_AT);
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", frontendEnvironment.NEXT_PUBLIC_CONVEX_URL);
  queryMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("compatibility readiness", () => {
  test("returns ready only for matching valid v1 identities", async () => {
    queryMock.mockResolvedValue(backendIdentity);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      service: "cb-connect",
      frontend: {
        commitSha: frontendEnvironment.CB_CONNECT_COMMIT_SHA,
        buildId: frontendEnvironment.CB_CONNECT_BUILD_ID,
        compatibilityVersion: "v1",
        builtAt: frontendEnvironment.CB_CONNECT_BUILT_AT,
      },
      backend: backendIdentity,
      checks: {
        metadata: "pass",
        backend: "pass",
        compatibility: "pass",
      },
    });
  });

  test("returns bounded 503 when frontend metadata is missing", async () => {
    vi.stubEnv("CB_CONNECT_BUILD_ID", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "not_ready",
      service: "cb-connect",
      frontend: null,
      backend: null,
      checks: {
        metadata: "fail",
        backend: "unavailable",
        compatibility: "unknown",
      },
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  test("returns bounded 503 when the backend query times out", async () => {
    vi.useFakeTimers();
    queryMock.mockReturnValue(new Promise(() => {}));

    const responsePromise = GET();
    await vi.advanceTimersByTimeAsync(1001);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      service: "cb-connect",
      frontend: {
        commitSha: frontendEnvironment.CB_CONNECT_COMMIT_SHA,
        buildId: frontendEnvironment.CB_CONNECT_BUILD_ID,
        compatibilityVersion: "v1",
        builtAt: frontendEnvironment.CB_CONNECT_BUILT_AT,
      },
      backend: null,
      checks: {
        metadata: "pass",
        backend: "timeout",
        compatibility: "unknown",
      },
    });
  });

  test("returns bounded 503 when the backend is unavailable", async () => {
    queryMock.mockRejectedValue(new Error("upstream secret and raw error"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "not_ready",
      service: "cb-connect",
      frontend: {
        commitSha: frontendEnvironment.CB_CONNECT_COMMIT_SHA,
        buildId: frontendEnvironment.CB_CONNECT_BUILD_ID,
        compatibilityVersion: "v1",
        builtAt: frontendEnvironment.CB_CONNECT_BUILT_AT,
      },
      backend: null,
      checks: {
        metadata: "pass",
        backend: "unavailable",
        compatibility: "unknown",
      },
    });
    expect(JSON.stringify(body)).not.toContain("upstream secret");
  });

  test("returns bounded 503 for a compatibility mismatch", async () => {
    queryMock.mockResolvedValue({
      ...backendIdentity,
      compatibilityVersion: "v2",
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      service: "cb-connect",
      frontend: {
        commitSha: frontendEnvironment.CB_CONNECT_COMMIT_SHA,
        buildId: frontendEnvironment.CB_CONNECT_BUILD_ID,
        compatibilityVersion: "v1",
        builtAt: frontendEnvironment.CB_CONNECT_BUILT_AT,
      },
      backend: {
        ...backendIdentity,
        compatibilityVersion: "v2",
      },
      checks: {
        metadata: "pass",
        backend: "pass",
        compatibility: "mismatch",
      },
    });
  });
});
