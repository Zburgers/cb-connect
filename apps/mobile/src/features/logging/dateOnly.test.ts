import { describe, expect, it } from "vitest";
import { formatLocalDateOnly, parseDateOnly } from "./dateOnly";

describe("date-only picker values", () => {
  it("round-trips valid calendar dates without UTC day shifts", () => {
    const date = parseDateOnly("2024-02-29");
    expect(date).not.toBeNull();
    expect(formatLocalDateOnly(date!)).toBe("2024-02-29");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026/02/28")).toBeNull();
  });
});
