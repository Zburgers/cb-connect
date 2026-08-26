import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { seedUser } from "../test.fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authenticated capability query", () => {
  test("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.queries.capabilities.getCapabilities, {})
    ).rejects.toThrow("Authentication required");
  });

  test.each([
    [undefined, undefined, false, false],
    ["false", "false", false, false],
    ["true", "false", true, false],
    ["false", "true", false, true],
    ["true", "true", true, true],
  ])(
    "returns independent authenticated capabilities for %s/%s",
    async (factsValue, stateValue, factsEnabled, stateEnabled) => {
      const t = convexTest(schema, modules);
      await seedUser(t, {
        clerkId: "capability-clerk",
        name: "Capability User",
        role: "primary",
      });
      if (factsValue === undefined) {
        delete process.env.CB_CONNECT_CYCLE_FACTS_V1;
      } else {
        vi.stubEnv("CB_CONNECT_CYCLE_FACTS_V1", factsValue);
      }
      if (stateValue === undefined) {
        delete process.env.CB_CONNECT_CYCLE_STATE_V1;
      } else {
        vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", stateValue);
      }

      const result = await t
        .withIdentity({ subject: "capability-clerk" })
        .query(api.queries.capabilities.getCapabilities, {});

      expect(result).toEqual({
        cycleFactsV1: factsEnabled,
        cycleStateV1: stateEnabled,
      });
      expect(Object.keys(result)).toEqual(["cycleFactsV1", "cycleStateV1"]);
    }
  );
});
