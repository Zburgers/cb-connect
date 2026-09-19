import { afterEach, describe, expect, test, vi } from "vitest";

import {
  isPartnerPredictionV2Enabled,
  isPeriodPredictionV2Enabled,
} from "./periodPredictionFlag.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Gate 3 prediction capability flags", () => {
  test.each([
    [{}, false, false],
    [{ CB_CONNECT_PERIOD_PREDICTION_V2: "false" }, false, false],
    [{ CB_CONNECT_PERIOD_PREDICTION_V2: "true" }, true, false],
    [{ CB_CONNECT_PARTNER_PREDICTION_V2: "true" }, false, true],
    [
      {
        CB_CONNECT_PERIOD_PREDICTION_V2: "true",
        CB_CONNECT_PARTNER_PREDICTION_V2: "true",
      },
      true,
      true,
    ],
    [{ CB_CONNECT_PERIOD_PREDICTION_V2: "TRUE" }, false, false],
    [{ CB_CONNECT_PARTNER_PREDICTION_V2: "1" }, false, false],
  ])("reads exact, independent flags from Convex env: %j", (environment, period, partner) => {
    expect(isPeriodPredictionV2Enabled(environment)).toBe(period);
    expect(isPartnerPredictionV2Enabled(environment)).toBe(partner);
  });

  test("does not define public environment mirrors", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./periodPredictionFlag.ts", import.meta.url),
      "utf8"
    );

    for (const name of [
      "CB_CONNECT_PERIOD_PREDICTION_V2",
      "CB_CONNECT_PARTNER_PREDICTION_V2",
    ]) {
      expect(source).not.toContain(["NEXT_PUBLIC", name].join("_"));
    }
  });
});
