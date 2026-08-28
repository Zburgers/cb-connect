import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedUser } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cycle facts capability query", () => {
  test("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.queries.capabilities.getCapabilities, {})
    ).rejects.toThrow("Authentication required");
  });

  test.each([
    [undefined, false],
    ["false", false],
    ["true", true],
  ])("returns only the authenticated boolean capability", async (value, enabled) => {
    const t = convexTest(schema, modules);
    await seedUser(t, {
      clerkId: "capability-clerk",
      name: "Capability User",
      role: "primary",
    });
    if (value === undefined) {
      delete process.env.CB_CONNECT_CYCLE_FACTS_V1;
    } else {
      vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", value);
    }

    const result = await t.withIdentity({ subject: "capability-clerk" }).query(
      api.queries.capabilities.getCapabilities,
      {}
    );

    expect(result).toEqual({ cycleFactsV1: enabled });
    expect(Object.keys(result)).toEqual(["cycleFactsV1"]);
  });
});
