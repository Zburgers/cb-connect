# Gate 2 Four-Phase State Semantics Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `shipyard:shipyard-executing-plans` to implement this plan task-by-task using only Luna high implementation agents.

**Goal:** Provide honest Recorded, Calendar estimate, Late, Unknown, and Paused cycle-state semantics without modulo rollover, fabricated biological certainty, or unauthorized partner disclosure.

**Architecture:** Introduce one deep `cycleState` module whose interface consumes eligible Gate 1 facts, a versioned `PredictionBounds`, tracking state, and a user-local date. Dashboard and history become adapters around the same read projection; UI modules render that projection without deriving biological meaning. A partner projection seam enumerates consented fields and checks revocation before any cycle payload is returned.

**Tech Stack:** TypeScript, Convex 1.43, convex-test, Vitest 4, Next.js 15, React 19, Playwright.

**Plan status:** Implementation-ready after Sol low planning and architecture audit. Gate 2 integration/release prerequisite: PR #35 must be reviewed, reconciled, green, and manually merged. Disjoint pure-module tasks may proceed provisionally from the current PR head; the coordinator must recreate or rebase the Gate 2 branch onto the resulting `origin/main` SHA before any dependent integration, qualification, push, or release claim, and record that SHA in the evidence report.

---

## Authority and operating contract

- Read `AGENTS.md`, `convex/_generated/ai/guidelines.md`, `docs/plans/2026-08-19-feature-first-delivery-design.md`, `docs/plans/2026-08-19-feature-first-delivery-implementation.md`, the Gate 2 gate-level plan, and `docs/decisions/major-release-decision-register.md` before execution.
- Gate 1 is the data authority. Only exact, eligible, non-tombstoned facts may feed the Gate 2 state reducer. Approximate and `legacy_unknown` facts remain visible with their labels but do not become exact evidence.
- D-011 blocks enabling or presenting unapproved health-adjacent copy to users. It does not block building the state module, default-off render adapters, policy tests, or isolated engineering qualification.
- D-015 blocks pilot cohort selection and rollout percentages only. It does not block implementation, default-off deployment, synthetic comparison, evidence, rollback testing, or staff/test qualification.
- D-012 forbids hard deletion, destructive migration, and final retention behavior. Gate 2 adds no destructive operation and performs no data backfill.
- Gate 1 and Gate 2 capabilities are Convex-only. No `NEXT_PUBLIC_*` mirror is permitted. Absent or non-literal `true` means disabled.
- Existing function arguments and legacy dashboard/history fields remain valid. New `cycleStateV1` data is additive and nullable/default-off.
- No logs, screenshots, test artifacts, or evidence may contain raw cycle dates, row IDs, notes, Clerk identities, auth responses, or secrets.

## Architectural audit and deletion test

`calculateCycleInfo` is the current shallow module: its interface exposes modulo rollover, inferred menstruation, deterministic copy, and prediction arithmetic. `timelinePhases` independently derives estimated ends, while dashboard/history/notifications consume different shapes. Deleting either helper would move complexity into callers rather than concentrate it.

The top recommendation is to deepen `cycleState` and `cycleReadModel` as the single semantic seam. This creates locality for state precedence and date bounds, leverage across dashboard/history/partner/future mobile consumers, and a complete test surface at the interface. The partner projection is a secondary deepening opportunity and must consume the authoritative read model rather than invent another phase source.

## Locked state contract

```ts
type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal";

type PredictionBounds = {
  version: 1;
  source: "legacy_configured";
  expectedDate: string;
  earliestDate: string;
  latestDate: string;
  reason: "LEGACY_UNCALIBRATED_GRACE";
  basisCount: 1;
};

type CycleState =
  | { version: 1; status: "recorded_period"; phase: "menstruation"; evidence: "RECORDED_EXACT"; cycleDay: number; coveringEventId: string; reason: "CONFIRMED_EVENT_COVERS_TODAY" }
  | { version: 1; status: "estimated"; phase: CyclePhase; evidence: "CALENDAR_ESTIMATE"; cycleDay: number; bounds: PredictionBounds; reason: "ELIGIBLE_FACT_WITHIN_LATEST_BOUND" }
  | { version: 1; status: "late_or_uncertain"; phase: null; evidence: "TIMING_UNCERTAINTY"; cycleDay: null; bounds: PredictionBounds; reason: "AFTER_LATEST_BOUND" }
  | { version: 1; status: "insufficient_data"; phase: null; evidence: "UNAVAILABLE"; cycleDay: null; reason: "NO_ELIGIBLE_FACT" | "FUTURE_START" | "INVALID_BOUNDS" | "MISSING_TIMEZONE" }
  | { version: 1; status: "prediction_paused"; phase: null; evidence: "USER_PAUSED"; cycleDay: null; reason: "USER_PAUSED" };
```

Reducer precedence is: Paused; exact recorded event covering the target date; insufficient data for missing/ineligible/future/invalid context; estimated state from the latest eligible exact start through the latest bound; Late on the next local calendar day after the latest bound. Late has no phase and is never pregnancy, diagnosis, or a fifth biological phase. Configured `periodLength` never silently turns an open event into a recorded end.

## Dependency and concurrency map

```text
G2.1 ─┬─> G2.4 ─┬─> G2.6 ─┐
      │         └─> G2.7 ─┼─> G2.11 ─> G2.12
      └─> G2.5 ────────────┤
G2.2 ────> G2.4            │
G2.3 ────> G2.7            │
G2.8 ──────────────────────┘
G2.10 ─────────────────────┘
```

Same-wave tasks have disjoint write sets. Integrate every completed task into the coordinator worktree and run its verification before starting dependent work. Do not parallelize tasks that share a file.

| Wave | Luna task | Write set |
|---|---|---|
| A | G2.1 state contract | `predictionBounds*`, `cycleState*` |
| A | G2.3 partner projection | `partnerCycleProjection*` |
| B | G2.2 pause compatibility | `schema.ts`, `periods.ts`, settings/history tests/page |
| B | G2.4 dashboard read model | `cycleReadModel*`, `dashboard.ts`, dashboard tests |
| B | G2.5 history adapter | `timelinePhases*`, `history.ts`, history tests |
| C | G2.6 primary UI | primary page and phase components, presentation helper/tests |
| C | G2.7 partner UI | partner page/components, presentation helper/tests |
| C | G2.8 copy contract | tips/nutrition/seed, copy helper/tests/policy script |
| C | G2.10 capability/rollback | capability helper/tests, existing capabilities/layout, policy/runbook |
| D | G2.9 invariants | property/timezone test files |
| D | G2.11 authenticated qualification | `e2e/cycle-state.spec.ts` |
| D | G2.12 evidence | `docs/evidence/four-phase-gate-2/*` |

## Shipyard tasks

### Task G2.1: Define prediction bounds and non-wrapping cycle state

**Files:**

- Create: `convex/_helpers/predictionBounds.ts`
- Create: `convex/_helpers/predictionBounds.test.ts`
- Create: `convex/_helpers/cycleState.ts`
- Create: `convex/_helpers/cycleState.test.ts`

**Steps:**

1. Write table-driven RED tests for no history, ineligible history, future start, confirmed event coverage, all four estimated phases, final-bound day, following-day Late, paused state, and invalid bounds.
2. Run `npx vitest run convex/_helpers/predictionBounds.test.ts convex/_helpers/cycleState.test.ts`; expect RED because the modules do not exist.
3. Implement the discriminated union, a version-1 legacy configured-bounds adapter, explicit reason/evidence codes, and the precedence table.
4. Assert cycle day is null after `latestDate`; do not use modulo. Keep all date arithmetic in the pure module.
5. Run the focused tests and commit `feat: define non-wrapping cycle state`.

**Verification:** `npx vitest run convex/_helpers/predictionBounds.test.ts convex/_helpers/cycleState.test.ts` exits 0; `latestDate + 1` is Late, never cycle day 1.

### Task G2.2: Extend cycle settings with prediction pause

**Files:**

- Modify: `convex/schema.ts:191`
- Modify: `convex/mutations/periods.ts:444`
- Modify: `convex/mutations/periods.test.ts`
- Modify: `convex/queries/history.ts:105`
- Modify: `convex/queries/history.test.ts`
- Modify: `app/(dashboard)/dashboard/settings/page.tsx:26`

**Steps:**

1. Add RED tests proving `updateCycleSettings({ predictionPaused: true })` is primary-only, preserves existing lengths, and initializes default lengths when no settings row exists. Add query tests for legacy rows normalizing missing pause to false.
2. Run the focused mutation/query tests; expect RED.
3. Add optional `predictionPaused` and `predictionPausedAt` fields. Extend the existing `updateCycleSettings` args; do not create a competing pause mutation.
4. Patch pause fields only when supplied, write a timestamp on pause, and clear or omit it on resume using the existing optional-field convention.
5. Normalize `getCycleSettings` to return `{ cycleLength, periodLength, predictionPaused }`. Add the primary-only settings control through the existing mutation. Verify onboarding callers with only cycle/period lengths remain valid.
6. Run focused tests and typecheck; commit `feat: add primary prediction pause setting`.

**Verification:** `npx vitest run convex/mutations/periods.test.ts convex/queries/history.test.ts && npm run typecheck` exits 0; legacy rows read active and partner writes remain rejected.

### Task G2.3: Define the partner cycle projection

**Files:**

- Create: `convex/_helpers/partnerCycleProjection.ts`
- Create: `convex/_helpers/partnerCycleProjection.test.ts`

**Steps:**

1. Write RED pure tests for primary, active partner with sharing enabled, share-off, revoked couple, missing membership, Late, Unknown, and Paused.
2. Enumerate only version, status, phase, evidence label, cycle day when valid, bounds, reason, and basis count.
3. Exclude event identifiers, notes, pain tags, certainty/provenance metadata, private context, timezone, and raw facts.
4. Return no cycle payload after revocation or share-off. Run the focused tests and commit `feat: define partner cycle projection`.

**Verification:** `npx vitest run convex/_helpers/partnerCycleProjection.test.ts` exits 0; forbidden keys are absent and null is returned for no-share/revoked.

### Task G2.4: Create the authoritative dashboard read model

**Files:**

- Create: `convex/_helpers/cycleReadModel.ts`
- Create: `convex/_helpers/cycleReadModel.test.ts`
- Modify: `convex/queries/dashboard.ts:1`
- Create: `convex/queries/dashboard.test.ts`

**Steps:**

1. Write RED tests for exact versus approximate facts, tombstones, a closed three-day period, a still-open event, pause, local-date Late boundary, and partner share-off.
2. Build one bounded input from Gate 1 eligibility, cycle settings, local date, pause state, and the version-1 bounds adapter.
3. Call only the `cycleState` interface for semantic output. Read `predictionPaused ?? false` directly; do not call a public query from another Convex function.
4. Return existing dashboard keys plus nullable `cycleStateV1`. Flag-off preserves current `cycleInfo`; flag-on consumes the new projection and suppresses phase guidance for Late/Unknown/Paused.
5. Run focused tests and commit `feat: expose authoritative cycle read model`.

**Verification:** `npx vitest run convex/_helpers/cycleReadModel.test.ts convex/queries/dashboard.test.ts` exits 0; recorded facts win and dashboard never wraps.

### Task G2.5: Adapt history to the shared state interface

**Files:**

- Modify: `convex/_helpers/timelinePhases.ts:1`
- Modify: `convex/_helpers/timelinePhases.test.ts`
- Modify: `convex/queries/history.ts:159`
- Modify: `convex/queries/history.test.ts`

**Steps:**

1. Add RED parity fixtures for exact coverage, estimated dates, post-bound dates, ineligible facts, and private partner views.
2. Convert timeline phase calculation to a date-specific adapter over `cycleState`, passing `predictionPaused: false`; today’s pause must not relabel historical entries.
3. Add optional status/evidence/reason fields while retaining `phase`, `type`, `date`, `period`, and `pain` fields.
4. Keep existing `private` behavior when sharing is disabled. Run focused tests and commit `refactor: align history with cycle state`.

**Verification:** `npx vitest run convex/_helpers/timelinePhases.test.ts convex/queries/history.test.ts` exits 0; equivalent dashboard/history inputs agree.

### Task G2.6: Build primary cycle-state rendering behind the capability

**Files:**

- Create: `components/dashboard/cycleStatePresentation.ts`
- Create: `components/dashboard/cycleStatePresentation.test.ts`
- Modify: `app/(dashboard)/dashboard/page.tsx:18`
- Modify: `components/dashboard/CurrentPhase.tsx`
- Modify: `components/dashboard/PhaseAura.tsx`

**Steps:**

1. Write RED pure tests mapping every state variant to label, evidence badge, visible fields, and disclaimer slot. Do not assume a React Testing Library harness.
2. Implement render-only mapping; no date arithmetic or phase inference in the browser.
3. Render v1 only when the capability is enabled and `cycleStateV1` is present. Keep the existing path when disabled.
4. Use conservative non-clinical placeholders until D-011-approved wording exists. Add policy assertions that unapproved copy blocks exposure.
5. Run the presentation tests and typecheck; commit `feat: render honest cycle states`.

**Verification:** `npx vitest run components/dashboard/cycleStatePresentation.test.ts && npm run typecheck` exits 0; every estimate is labeled and estimated Ovulation has the required disclaimer slot.

**Exposure stop:** unresolved D-011 keeps the path disabled for ordinary users.

### Task G2.7: Build reduced partner rendering behind the capability

**Files:**

- Create: `components/partner/partnerCyclePresentation.ts`
- Create: `components/partner/partnerCyclePresentation.test.ts`
- Modify: `components/partner/PartnerDashboard.tsx`
- Modify: `app/(dashboard)/dashboard/partner/page.tsx`

**Steps:**

1. Write RED pure tests for visible, no-share, revoked, Late, Unknown, and Paused projections.
2. Map only enumerated projection fields. Render a privacy-safe empty state immediately for null.
3. Keep the path default-off until copy approval and authenticated qualification. Run focused tests and typecheck.
4. Commit `feat: render reduced partner cycle state`.

**Verification:** `npx vitest run components/partner/partnerCyclePresentation.test.ts && npm run typecheck` exits 0; forbidden values have no mapping.

**Exposure stop:** unresolved D-011 keeps health-adjacent partner copy disabled.

### Task G2.8: Create and enforce the Gate 2 copy contract

**Files:**

- Create: `components/dashboard/cycleStateCopy.ts`
- Create: `components/dashboard/cycleStateCopy.test.ts`
- Modify: `components/dashboard/TipsCard.tsx`
- Modify: `components/dashboard/NutritionSuggestions.tsx`
- Modify: `convex/seed.ts`
- Create: `scripts/tests/cycle-state-copy.test.sh`

**Steps:**

1. Add RED scans for deterministic mood, hormone, libido, fertility, diagnosis, and behavior claims.
2. Create copy keys for Recorded, Calendar estimate, Late, Unknown, Paused, estimated-Ovulation disclaimer, and generic check-in guidance.
3. Use conservative placeholders until D-011-approved copy arrives; carry an explicit unapproved status.
4. Make exposure fail closed while copy status is unapproved. Run the pure and shell policy tests; commit `feat: enforce cycle state copy contract`.

**Verification:** `npx vitest run components/dashboard/cycleStateCopy.test.ts && bash scripts/tests/cycle-state-copy.test.sh` exits 0 with `Gate 2 copy policy: PASS`.

**Exposure stop:** unresolved D-011 keeps ordinary-user exposure disabled.

### Task G2.9: Add property and timezone invariants

**Files:**

- Create: `convex/_helpers/cycleState.property.test.ts`
- Create: `convex/_helpers/cycleState.timezone.test.ts`

**Steps:**

1. Generate valid ordered histories, corrections, tombstones, pauses, and local dates with deterministic seeds.
2. Assert facts outrank estimates, prediction never becomes observation, and cycle day never wraps.
3. Cover leap day, year rollover, Asia/Kolkata, Los Angeles DST, and positive/negative UTC offsets. Persist every discovered seed.
4. Run tests and commit `test: prove cycle state invariants`.

**Verification:** `npx vitest run convex/_helpers/cycleState.property.test.ts convex/_helpers/cycleState.timezone.test.ts` exits 0 with no counterexample.

### Task G2.10: Extend the authenticated capability and rollback contract

**Files:**

- Create: `convex/_helpers/cycleStateFlag.ts`
- Create: `convex/_helpers/cycleStateFlag.test.ts`
- Modify: `convex/queries/capabilities.ts:7`
- Modify: `convex/queries/capabilities.test.ts:13`
- Modify: `app/(dashboard)/layout.tsx:120`
- Modify: `scripts/tests/deploy-workflow.test.sh`
- Create: `docs/runbooks/cycle-state-rollout.md`

**Steps:**

1. Add RED helper cases for absent, false, true, and non-literal values.
2. Extend the existing authenticated capability object to exactly `{ cycleFactsV1: boolean; cycleStateV1: boolean }`; do not create another public query.
3. Preserve independent Gate 1/Gate 2 combinations and add a layout data attribute for Gate 2.
4. Prohibit any `NEXT_PUBLIC_CB_CONNECT_CYCLE_STATE_V1` mirror. Document flag-off rollback, compatibility reads, stop conditions, and no data reversal.
5. Run focused tests, policy tests, and typecheck; commit `feat: add cycle state capability boundary`.

**Verification:** `npx vitest run convex/_helpers/cycleStateFlag.test.ts convex/queries/capabilities.test.ts && bash scripts/tests/deploy-workflow.test.sh && npm run typecheck` exits 0; capability is default-off and exactly two booleans.

### Task G2.11: Qualify authenticated desktop and mobile behavior

**Files:**

- Create: `e2e/cycle-state.spec.ts`

**Steps:**

1. Write fail-closed tests requiring explicit enabled/disabled expectations.
2. Cover Recorded, estimates, Late, Unknown, Paused/resume, share-off, revocation, correction, and next-start reset.
3. Run each mode against the approved isolated non-production environment, independently for desktop and mobile. Zero skips are required.
4. Commit `test: qualify cycle state journeys`.

**Verification:**

```bash
CB_CONNECT_CYCLE_STATE_EXPECTED=disabled npm run test:e2e:release -- e2e/cycle-state.spec.ts --project=release-desktop --project=release-mobile
CB_CONNECT_CYCLE_STATE_EXPECTED=enabled npm run test:e2e:release -- e2e/cycle-state.spec.ts --project=release-desktop --project=release-mobile
```

Both commands must pass with zero skips. Enabled qualification is isolated/non-production and does not authorize ordinary-user exposure.

### Task G2.12: Retain engineering, exposure, and pilot evidence separately

**Files:**

- Create: `docs/evidence/four-phase-gate-2/REPORT.md`
- Create: `docs/evidence/four-phase-gate-2/state-transition-matrix.md`
- Create: `docs/evidence/four-phase-gate-2/timezone-report.md`

**Steps:**

1. Record base/final SHA, exact flags, commands, state matrix, privacy results, timezone results, dashboard/history parity, and redacted artifacts.
2. Record engineering qualification independently of D-011 and D-015.
3. Record D-011 unresolved as an ordinary-user exposure stop and D-015 unresolved as a pilot stop; never report those as failed engineering work.
4. Keep production Gate 2 disabled until all exposure conditions pass. Commit `docs: record Gate 2 evidence boundary`.

**Verification:** `npm run build && npm run typecheck && npm run test:unit -- --run && bash scripts/tests/deploy-workflow.test.sh && git diff --check` exits 0; the report has separate engineering, exposure, and pilot verdicts.

## Migration, rollout, and rollback

- Optional pause fields require no backfill. Existing `periodEvents` remain untouched. No inferred ending, certainty conversion, hard deletion, or destructive migration occurs.
- Old clients continue receiving legacy fields while `cycleStateV1` is additive. Generated Convex files are refreshed only after integration in a configured environment.
- Deploy additive code with Gate 2 absent, compare v1/legacy aggregate status counts synthetically, qualify disabled and isolated enabled modes, then keep the capability off unless D-011 exposure approval exists. D-015 is required for any pilot percentages/cohort.
- Stop on fabricated Recorded state, modulo rollover, privacy mismatch, dashboard/history mismatch, missing disclaimer, or unexplained Late/Unknown spike.
- Roll back by setting `CB_CONNECT_CYCLE_STATE_V1=false`, verifying the capability is false, and verifying legacy adapters. Do not remove optional fields or reverse data. Never restore modulo semantics as the long-term authority.

## Explicit non-goals

- No Gate 3 personalized/calibrated prediction, model training, ML, fertility estimation, pregnancy/PCOS inference, diagnosis, or medical recommendation.
- No confirmed ovulation/fertile-day claim, notification work, mobile/store work, or destructive Gate 1 migration.
- No deterministic phase-to-mood, libido, hormone, or partner-behavior assertions.
- No production enablement without separate exposure authorization.

## Final audit checklist

- [ ] PR #35 reviewed, reconciled, green, and manually merged before Gate 2 integration/release.
- [ ] Gate 2 base SHA is the merged `origin/main` SHA.
- [ ] One deep cycle-state module owns semantics; dashboard/history use it.
- [ ] No modulo rollover after latest bound; Late has no biological phase.
- [ ] Recorded requires eligible confirmed evidence; estimates are labeled.
- [ ] Estimated Ovulation has the required disclaimer.
- [ ] Pause extends `updateCycleSettings`; legacy settings normalize false.
- [ ] Current pause does not relabel history.
- [ ] Partner projection is enumerated and revocation-reactive.
- [ ] Capability query is Convex-only, default-off, and returns exactly two independent booleans.
- [ ] Pure presentation tests and Playwright cover the UI; no unsupported React harness is assumed.
- [ ] D-011 and D-015 are exposure/pilot blockers only.
- [ ] Enabled/disabled desktop/mobile runs pass with zero skips.
- [ ] Full build, typecheck, unit, policy, and diff checks pass.
- [ ] Evidence separates engineering qualification, ordinary-user exposure, and pilot authorization.
