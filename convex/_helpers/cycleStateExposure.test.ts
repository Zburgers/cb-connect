import { describe, expect, test } from "vitest";

import { isCycleStateV1ExposedToUser } from "./cycleStateExposure";

const fixtureUser = { fixtureRunId: "run-1" };

describe("cycle state exposure boundary", () => {
  test("allows only the isolated fixture audience when both gates are enabled", () => {
    expect(
      isCycleStateV1ExposedToUser(fixtureUser, fixtureUser, {
        CB_CONNECT_CYCLE_FACTS_V1: "true",
        CB_CONNECT_CYCLE_STATE_V1: "true",
      })
    ).toBe(true);
  });

  test.each([
    ["ordinary user", {}, fixtureUser, {}],
    ["Gate 1 disabled", { CB_CONNECT_CYCLE_FACTS_V1: "false", CB_CONNECT_CYCLE_STATE_V1: "true" }, fixtureUser, fixtureUser],
    ["Gate 2 disabled", { CB_CONNECT_CYCLE_FACTS_V1: "true", CB_CONNECT_CYCLE_STATE_V1: "false" }, fixtureUser, fixtureUser],
    ["different fixture run", { CB_CONNECT_CYCLE_FACTS_V1: "true", CB_CONNECT_CYCLE_STATE_V1: "true" }, fixtureUser, { fixtureRunId: "run-2" }],
  ] as const)("fails closed for %s", (_label, environment, viewer, target) => {
    expect(isCycleStateV1ExposedToUser(viewer, target, environment)).toBe(false);
  });
});
