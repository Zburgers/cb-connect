import { describe, expect, test } from "vitest";

import {
  type CycleFactsCapability,
  readCycleFactsCapability,
} from "./cycleFactsCapability";

describe("cycle facts client capability compatibility", () => {
  test("treats a missing capability query as unavailable", () => {
    expect(
      readCycleFactsCapability({
        status: "error",
        error: new Error("Function not found"),
      }),
    ).toBeUndefined();
  });

  test("treats pending capability data as unavailable", () => {
    expect(readCycleFactsCapability({ status: "pending" })).toBeUndefined();
  });

  test("preserves an explicit disabled capability response", () => {
    expect(
      readCycleFactsCapability({
        status: "success",
        data: { cycleFactsV1: false },
      }),
    ).toEqual({ cycleFactsV1: false });
  });

  test("preserves an explicit enabled capability response", () => {
    expect(
      readCycleFactsCapability({
        status: "success",
        data: { cycleFactsV1: true },
      }),
    ).toEqual({ cycleFactsV1: true });
  });

  test("preserves the optional cycle state capability from an extended response", () => {
    const response: CycleFactsCapability = {
      cycleFactsV1: true,
      cycleStateV1: false,
    };

    expect(
      readCycleFactsCapability({ status: "success", data: response }),
    ).toEqual(response);
  });
});
