import { expect, test } from "vitest";

import type { CycleState } from "./cycleState";
import {
  projectCycleState,
  type PartnerCycleProjection,
  type ProjectionContext,
} from "./partnerCycleProjection";
import type { PredictionBounds } from "./predictionBounds";

const bounds: PredictionBounds = {
  version: 1,
  source: "legacy_configured",
  expectedDate: "2026-09-28",
  earliestDate: "2026-09-25",
  latestDate: "2026-10-01",
  reason: "LEGACY_UNCALIBRATED_GRACE",
  basisCount: 1,
};

const recordedState: CycleState = {
  version: 1,
  status: "recorded_period",
  phase: "menstruation",
  evidence: "RECORDED_EXACT",
  cycleDay: 2,
  coveringEventId: "periodEvents:private-id",
  reason: "CONFIRMED_EVENT_COVERS_TODAY",
};

const estimatedState: CycleState = {
  version: 1,
  status: "estimated",
  phase: "luteal",
  evidence: "CALENDAR_ESTIMATE",
  cycleDay: 25,
  bounds,
  reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
};

const lateState: CycleState = {
  version: 1,
  status: "late_or_uncertain",
  phase: null,
  evidence: "TIMING_UNCERTAINTY",
  cycleDay: null,
  bounds,
  reason: "AFTER_LATEST_BOUND",
};

const unknownState: CycleState = {
  version: 1,
  status: "insufficient_data",
  phase: null,
  evidence: "UNAVAILABLE",
  cycleDay: null,
  reason: "NO_ELIGIBLE_FACT",
};

const pausedState: CycleState = {
  version: 1,
  status: "prediction_paused",
  phase: null,
  evidence: "USER_PAUSED",
  cycleDay: null,
  reason: "USER_PAUSED",
};

const primaryContext: ProjectionContext = {
  role: "primary",
  coupleStatus: "active",
  hasMembership: true,
  sharingEnabled: false,
  consentGranted: false,
};

const partnerContext: ProjectionContext = {
  role: "partner",
  coupleStatus: "active",
  hasMembership: true,
  sharingEnabled: true,
  consentGranted: true,
};

const partnerAllowlistByStatus: Record<
  PartnerCycleProjection["status"],
  readonly string[]
> = {
  recorded_period: [
    "version",
    "status",
    "phase",
    "evidence",
    "cycleDay",
    "reason",
  ],
  estimated: [
    "version",
    "status",
    "phase",
    "evidence",
    "cycleDay",
    "bounds",
    "reason",
  ],
  late_or_uncertain: [
    "version",
    "status",
    "phase",
    "evidence",
    "cycleDay",
    "bounds",
    "reason",
  ],
  insufficient_data: [
    "version",
    "status",
    "phase",
    "evidence",
    "cycleDay",
    "reason",
  ],
  prediction_paused: [
    "version",
    "status",
    "phase",
    "evidence",
    "cycleDay",
    "reason",
  ],
};

test("primary receives canonical state fields including recorded event identity", () => {
  expect(projectCycleState(recordedState, primaryContext)).toEqual({
    version: 1,
    status: "recorded_period",
    phase: "menstruation",
    evidence: "RECORDED_EXACT",
    cycleDay: 2,
    coveringEventId: "periodEvents:private-id",
    reason: "CONFIRMED_EVENT_COVERS_TODAY",
  });
});

test.each([
  ["recorded", recordedState],
  ["estimated", estimatedState],
  ["late", lateState],
  ["unknown", unknownState],
  ["paused", pausedState],
] as const)("partner receives the normative %s allowlist", (_label, state) => {
  const projection = projectCycleState(state, partnerContext);

  expect(projection).not.toBeNull();
  expect(Object.keys(projection ?? {}).sort()).toEqual(
    [...partnerAllowlistByStatus[state.status]].sort()
  );
});

test("partner projection redacts recorded coveringEventId", () => {
  const projection = projectCycleState(recordedState, partnerContext);

  expect(projection).toEqual({
    version: 1,
    status: "recorded_period",
    phase: "menstruation",
    evidence: "RECORDED_EXACT",
    cycleDay: 2,
    reason: "CONFIRMED_EVENT_COVERS_TODAY",
  });
  expect(projection).not.toHaveProperty("coveringEventId");
});

test.each([
  ["pending", "pending"],
  ["revoked", "revoked"],
] as const)("returns null unless couple status is active (%s)", (_label, status) => {
  const context: ProjectionContext = {
    role: "partner",
    coupleStatus: status,
    hasMembership: true,
    sharingEnabled: true,
    consentGranted: true,
  };

  expect(projectCycleState(estimatedState, context)).toBeNull();
});

test.each([
  ["sharing disabled", false, true, true],
  ["missing membership", true, false, true],
  ["absent consent", true, true, false],
] as const)(
  "partner receives null for %s",
  (_label, sharingEnabled, hasMembership, consentGranted) => {
    const context: ProjectionContext = {
      role: "partner",
      coupleStatus: "active",
      hasMembership,
      sharingEnabled,
      consentGranted,
    };

    expect(projectCycleState(estimatedState, context)).toBeNull();
  }
);

test("uses the canonical CycleState input type", () => {
  const state: CycleState = estimatedState;

  expect(projectCycleState(state, primaryContext)).toEqual({
    version: 1,
    status: "estimated",
    phase: "luteal",
    evidence: "CALENDAR_ESTIMATE",
    cycleDay: 25,
    bounds: {
      version: 1,
      source: "legacy_configured",
      expectedDate: "2026-09-28",
      earliestDate: "2026-09-25",
      latestDate: "2026-10-01",
      reason: "LEGACY_UNCALIBRATED_GRACE",
      basisCount: 1,
    },
    reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
  });
});

test.each([
  ["unknown role", "viewer"],
  ["missing role", undefined],
] as const)("returns null for malformed runtime %s", (_label, role) => {
  const context = {
    role,
    coupleStatus: "active",
    hasMembership: true,
    sharingEnabled: true,
    consentGranted: true,
  } as unknown as ProjectionContext;

  expect(projectCycleState(estimatedState, context)).toBeNull();
});

test("returns null for an unknown runtime state status", () => {
  const malformedState = {
    version: 1,
    status: "future_status",
    phase: null,
    evidence: "UNAVAILABLE",
    cycleDay: null,
    reason: "NO_ELIGIBLE_FACT",
  } as unknown as CycleState;

  expect(projectCycleState(malformedState, partnerContext)).toBeNull();
});

test.each(["estimated", "late_or_uncertain"] as const)(
  "returns null for %s with invalid bounds",
  (status) => {
    const invalidBounds = {
      version: 1,
      source: "legacy_configured",
      expectedDate: "2026-09-28",
      earliestDate: "2026-10-02",
      latestDate: "2026-10-01",
      reason: "LEGACY_UNCALIBRATED_GRACE",
      basisCount: 2,
    };
    const malformedState =
      status === "estimated"
        ? {
            version: 1,
            status,
            phase: "luteal",
            evidence: "CALENDAR_ESTIMATE",
            cycleDay: 25,
            bounds: invalidBounds,
            reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
          }
        : {
            version: 1,
            status,
            phase: null,
            evidence: "TIMING_UNCERTAINTY",
            cycleDay: null,
            bounds: invalidBounds,
            reason: "AFTER_LATEST_BOUND",
          };

    expect(
      projectCycleState(malformedState as unknown as CycleState, partnerContext)
    ).toBeNull();
  }
);

test("does not mutate the state or its nested bounds", () => {
  const state: CycleState = {
    version: 1,
    status: "estimated",
    phase: "luteal",
    evidence: "CALENDAR_ESTIMATE",
    cycleDay: 25,
    bounds: {
      version: 1,
      source: "legacy_configured",
      expectedDate: "2026-09-28",
      earliestDate: "2026-09-25",
      latestDate: "2026-10-01",
      reason: "LEGACY_UNCALIBRATED_GRACE",
      basisCount: 1,
    },
    reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
  };
  const stateBefore = structuredClone(state);
  const boundsBefore = structuredClone(state.bounds);

  const projection = projectCycleState(state, partnerContext);

  expect(state).toEqual(stateBefore);
  expect(state.bounds).toEqual(boundsBefore);
  expect(projection).not.toBe(state);
  expect(projection && "bounds" in projection ? projection.bounds : null).not.toBe(
    state.bounds
  );
});

test("returns null for absent state", () => {
  expect(projectCycleState(null, partnerContext)).toBeNull();
});

test("recursively excludes forbidden fields from partner output", () => {
  const pollutedState = {
    version: 1,
    status: "estimated",
    phase: "luteal",
    evidence: "CALENDAR_ESTIMATE",
    cycleDay: 25,
    coveringEventId: "periodEvents:private-id",
    notes: "private note",
    painTags: ["severe"],
    certainty: "high",
    provenance: { source: "private-fact" },
    privateContext: { timezone: "America/Los_Angeles" },
    timezone: "America/Los_Angeles",
    rawFacts: [{ startDate: "2026-09-04" }],
    bounds: {
      version: 1,
      source: "legacy_configured",
      expectedDate: "2026-09-28",
      earliestDate: "2026-09-25",
      latestDate: "2026-10-01",
      reason: "LEGACY_UNCALIBRATED_GRACE",
      basisCount: 1,
      privateContext: { internal: true },
    },
    reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND",
  } as unknown as CycleState;
  const forbiddenKeys = new Set([
    "coveringEventId",
    "eventIdentifier",
    "eventId",
    "notes",
    "painTags",
    "certainty",
    "provenance",
    "privateContext",
    "timezone",
    "rawFacts",
  ]);

  function assertNoForbiddenKeys(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) assertNoForbiddenKeys(item);
      return;
    }
    if (!value || typeof value !== "object") return;

    for (const [key, nestedValue] of Object.entries(value)) {
      expect(forbiddenKeys.has(key), `forbidden key: ${key}`).toBe(false);
      assertNoForbiddenKeys(nestedValue);
    }
  }

  assertNoForbiddenKeys(projectCycleState(pollutedState, partnerContext));
});
