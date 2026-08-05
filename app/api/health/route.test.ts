import { expect, test } from "vitest";

import { GET } from "./route";

test("health is an exact process-liveness response", async () => {
  const response = await GET();
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(Object.keys(body)).toEqual(["status", "service", "timestamp"]);
  expect(body).toEqual({
    status: "ok",
    service: "cb-connect",
    timestamp: expect.stringMatching(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    ),
  });
  expect(body).not.toHaveProperty("frontend");
  expect(body).not.toHaveProperty("backend");
  expect(body).not.toHaveProperty("compatibilityVersion");
});

test("health remains live when the backend is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("backend unavailable");
  };

  try {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "cb-connect",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
