import { describe, expect, test } from "vitest";

import {
  evaluatePeriodEventInvariants,
  type PeriodEventCandidate,
  type PeriodEventProjection,
} from "./periodEventInvariants";

const exactCandidate: PeriodEventCandidate = {
  startDate: "2026-08-01",
  endDate: "2026-08-05",
  startCertainty: "exact",
  endCertainty: "exact",
  authorityVersion: 1,
  actorRole: "primary",
};

const exactExisting: PeriodEventProjection = {
  id: "event-1",
  startDate: "2026-08-01",
  endDate: "2026-08-05",
  startCertainty: "exact",
  endCertainty: "exact",
  authorityVersion: 1,
  lastWriterRole: "primary",
};

describe("period event invariants", () => {
  test.each([
    ["invalid start format", { startDate: "08/01/2026" }, "INVALID_START_DATE"],
    ["invalid start calendar date", { startDate: "2026-02-30" }, "INVALID_START_DATE"],
    ["invalid end format", { endDate: "2026-08-05T00:00:00Z" }, "INVALID_END_DATE"],
    ["end before start", { endDate: "2026-07-31" }, "END_BEFORE_START"],
  ])("rejects %s with a stable code", (_name, overrides, code) => {
    expect(
      evaluatePeriodEventInvariants(
        { ...exactCandidate, endDate: undefined, ...overrides },
        []
      )
    ).toMatchObject({ allowed: false, code });
  });

  test("rejects an exact duplicate start", () => {
    expect(
      evaluatePeriodEventInvariants(exactCandidate, [exactExisting])
    ).toMatchObject({ allowed: false, code: "DUPLICATE_EXACT_START" });
  });

  test("rejects overlapping exact intervals", () => {
    expect(
      evaluatePeriodEventInvariants(
        { ...exactCandidate, startDate: "2026-08-04", endDate: "2026-08-08" },
        [exactExisting]
      )
    ).toMatchObject({ allowed: false, code: "EXACT_INTERVAL_OVERLAP" });
  });

  test.each([
    ["approximate candidate", { startCertainty: "approximate", endCertainty: undefined }],
    [
      "legacy-unknown candidate",
      { startCertainty: "legacy_unknown", endCertainty: undefined, legacyReason: "overlap" },
    ],
  ])("rejects %s when it would create a second open event", (_name, overrides) => {
    expect(
      evaluatePeriodEventInvariants(
        { ...exactCandidate, endDate: undefined, ...overrides },
        [{ ...exactExisting, endDate: undefined }]
      )
    ).toMatchObject({ allowed: false, code: "OPEN_EVENT_EXISTS" });
  });

  test("allows a closed approximate fact to coexist with exact evidence", () => {
    expect(
      evaluatePeriodEventInvariants(
        {
          ...exactCandidate,
          startDate: "2026-08-10",
          endDate: "2026-08-12",
          startCertainty: "approximate",
          endCertainty: "approximate",
        },
        [exactExisting]
      )
    ).toEqual({ allowed: true });
  });

  test("rejects a stale authority version", () => {
    expect(
      evaluatePeriodEventInvariants(
        {
          ...exactCandidate,
          targetEventId: exactExisting.id,
          expectedAuthorityVersion: 0,
        },
        [exactExisting]
      )
    ).toMatchObject({ allowed: false, code: "STALE_AUTHORITY_VERSION" });
  });

  test("rejects a revoked partner write", () => {
    expect(
      evaluatePeriodEventInvariants(
        { ...exactCandidate, actorRole: "partner", partnerAccess: "revoked" },
        []
      )
    ).toMatchObject({ allowed: false, code: "PARTNER_ACCESS_REVOKED" });
  });

  test("does not let a partner overwrite a primary correction", () => {
    expect(
      evaluatePeriodEventInvariants(
        {
          ...exactCandidate,
          actorRole: "partner",
          targetEventId: exactExisting.id,
          expectedAuthorityVersion: exactExisting.authorityVersion,
        },
        [{ ...exactExisting, primaryCorrectionVersion: 2 }]
      )
    ).toMatchObject({ allowed: false, code: "PRIMARY_AUTHORITY_REQUIRED" });
  });

  test("allows a partner to end a primary-started open event", () => {
    expect(
      evaluatePeriodEventInvariants(
        {
          ...exactCandidate,
          endDate: "2026-08-04",
          actorRole: "partner",
          targetEventId: "primary-start",
          expectedAuthorityVersion: 1,
          partnerAccess: "active",
        },
        [{
          ...exactExisting,
          id: "primary-start",
          endDate: undefined,
          authorityVersion: 1,
          lastWriterRole: "primary",
        }]
      )
    ).toEqual({ allowed: true });
  });

  test("allows a primary correction after partner assistance", () => {
    expect(
      evaluatePeriodEventInvariants(
        {
          ...exactCandidate,
          actorRole: "primary",
          targetEventId: "partner-event",
          expectedAuthorityVersion: 1,
        },
        [{ ...exactExisting, id: "partner-event", lastWriterRole: "partner" }]
      )
    ).toEqual({ allowed: true });
  });
});
