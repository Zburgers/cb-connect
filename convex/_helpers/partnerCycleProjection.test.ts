import { expect, test } from "vitest";

import {
  projectCycleState,
  type CycleStateLike,
  type ProjectionContext,
} from "./partnerCycleProjection.ts";

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

const estimatedState: CycleStateLike = {
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

const recordedState: CycleStateLike = {
  version: 1,
  status: "recorded_period",
  phase: "menstruation",
  evidence: "RECORDED_EXACT",
  cycleDay: 2,
  reason: "CONFIRMED_EVENT_COVERS_TODAY",
};

const deniedContexts: Array<[string, ProjectionContext]> = [
  ["sharing disabled", { ...partnerContext, sharingEnabled: false }],
  ["revoked couple", { ...partnerContext, coupleStatus: "revoked" }],
  ["missing membership", { ...partnerContext, hasMembership: false }],
  ["absent consent", { ...partnerContext, consentGranted: false }],
];

test("primary receives the complete safe state projection without private fields", () => {
  const projection = projectCycleState(estimatedState, primaryContext);

  expect(projection).toEqual(estimatedState);
});

test.each([
  ["recorded", recordedState],
  ["estimated", estimatedState],
] as const)("active partner receives the approved %s fields", (_label, state) => {
  const projection = projectCycleState(state, partnerContext);

  expect(projection).toEqual(state);
  expect(Object.keys(projection ?? {}).sort()).toEqual(
    Object.keys(state).sort()
  );
});

test.each(deniedContexts)(
  "partner receives no cycle payload when %s",
  (_label, context) => {
    expect(projectCycleState(estimatedState, context)).toBeNull();
  }
);

test.each([
  {
    status: "late_or_uncertain",
    evidence: "TIMING_UNCERTAINTY",
    reason: "AFTER_LATEST_BOUND",
  },
  {
    status: "insufficient_data",
    evidence: "UNAVAILABLE",
    reason: "NO_ELIGIBLE_FACT",
  },
  {
    status: "prediction_paused",
    evidence: "USER_PAUSED",
    reason: "USER_PAUSED",
  },
] as const)("partner projection preserves %s without a phase", (expected) => {
  const state = {
    version: 1,
    ...expected,
    phase: null,
    cycleDay: null,
    ...(expected.status === "late_or_uncertain"
      ? {
          bounds: estimatedState.bounds,
        }
      : {}),
  } as CycleStateLike;

  const projection = projectCycleState(state, partnerContext);

  expect(projection?.status).toBe(expected.status);
  expect(projection?.phase).toBeNull();
  expect(projection?.cycleDay).toBeNull();
  expect(projection?.evidence).toBe(expected.evidence);
  expect(projection?.reason).toBe(expected.reason);
});

test("projection recursively excludes forbidden health and identity fields", () => {
  const state = {
    ...estimatedState,
    coveringEventId: "periodEvents:private-id",
    eventIdentifier: "private-event-id",
    notes: "private note",
    painTags: ["severe"],
    certainty: "high",
    provenance: { source: "private-fact" },
    privateContext: { timezone: "America/Los_Angeles" },
    timezone: "America/Los_Angeles",
    rawFacts: [{ startDate: "2026-09-04" }],
    bounds: {
      ...estimatedState.bounds,
      privateContext: { internal: true },
    },
  } as CycleStateLike;

  const projection = projectCycleState(state, partnerContext);
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

  assertNoForbiddenKeys(projection);
  expect(projection).toEqual(estimatedState);
});

test("absent state returns no cycle payload", () => {
  expect(projectCycleState(null, partnerContext)).toBeNull();
});
