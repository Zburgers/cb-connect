import { afterEach, describe, expect, test, vi } from "vitest";

import { isCycleStateV1Enabled } from "./cycleStateFlag.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cycle state capability flag", () => {
  test.each([undefined, "", "false", "TRUE", "1"])(
    "is disabled for %s",
    (value) => {
      if (value === undefined) {
        delete process.env.CB_CONNECT_CYCLE_STATE_V1;
      } else {
        vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", value);
      }

      expect(isCycleStateV1Enabled()).toBe(false);
    }
  );

  test("is enabled only for the exact true string", () => {
    vi.stubEnv("CB_CONNECT_CYCLE_STATE_V1", "true");

    expect(isCycleStateV1Enabled()).toBe(true);
  });

  test("does not read a public environment mirror", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./cycleStateFlag.ts", import.meta.url),
      "utf8"
    );

    const publicMirrorName = ["NEXT_PUBLIC", "CB_CONNECT_CYCLE_STATE_V1"].join(
      "_"
    );
    expect(source).not.toContain(publicMirrorName);
  });
});
