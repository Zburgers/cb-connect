import { describe, expect, test } from "vitest";

import {
  validateCycleFactSemantics,
  type CycleFactSemanticsInput,
} from "./cycleFactSemantics";

describe("cycle fact semantics", () => {
  const validBase: CycleFactSemanticsInput = {
    startCertainty: "exact",
    authorityVersion: 1,
  };

  test.each([
    ["exact start", { startCertainty: "exact" }],
    ["approximate start", { startCertainty: "approximate" }],
    [
      "legacy unknown start",
      { startCertainty: "legacy_unknown", legacyReason: "missing_provenance" },
    ],
    [
      "legacy unknown end",
      {
        startCertainty: "exact",
        endCertainty: "legacy_unknown",
        legacyReason: "inferred_end",
      },
    ],
  ])("accepts %s certainty with explicit metadata", (_name, metadata) => {
    expect(
      validateCycleFactSemantics({ ...validBase, ...metadata })
    ).toEqual({ valid: true });
  });

  test.each([
    ["missing start certainty", { authorityVersion: 1 }, "MISSING_START_CERTAINTY"],
    [
      "unknown start without a reason",
      { startCertainty: "legacy_unknown", authorityVersion: 1 },
      "LEGACY_REASON_REQUIRED",
    ],
    [
      "reason without unknown certainty",
      {
        startCertainty: "exact",
        authorityVersion: 1,
        legacyReason: "duplicate",
      },
      "LEGACY_REASON_UNEXPECTED",
    ],
    [
      "invalid authority version",
      { startCertainty: "exact", authorityVersion: -1 },
      "INVALID_AUTHORITY_VERSION",
    ],
  ])("rejects %s with a stable code", (_name, metadata, code) => {
    expect(validateCycleFactSemantics(metadata)).toMatchObject({
      valid: false,
      code,
    });
  });

  test("rejects hidden date ranges instead of inventing precision", () => {
    const metadata = {
      ...validBase,
      startDateMin: "2026-08-01",
      startDateMax: "2026-08-03",
    } as CycleFactSemanticsInput & Record<string, unknown>;

    expect(validateCycleFactSemantics(metadata)).toMatchObject({
      valid: false,
      code: "HIDDEN_DATE_RANGE",
    });
  });

  test.each([
    ["missing actor", { tombstoneAt: 100, tombstoneAuthorityVersion: 2 }],
    ["missing time", { tombstoneByUserId: "user_1", tombstoneAuthorityVersion: 2 }],
    ["missing version", { tombstoneByUserId: "user_1", tombstoneAt: 100 }],
  ])("requires complete tombstone metadata: %s", (_name, tombstone) => {
    expect(
      validateCycleFactSemantics({ ...validBase, ...tombstone })
    ).toMatchObject({ valid: false, code: "INCOMPLETE_TOMBSTONE" });
  });

  test("accepts a complete tombstone tuple", () => {
    expect(
      validateCycleFactSemantics({
        ...validBase,
        tombstoneByUserId: "user_1",
        tombstoneAt: 100,
        tombstoneAuthorityVersion: 2,
      })
    ).toEqual({ valid: true });
  });
});
