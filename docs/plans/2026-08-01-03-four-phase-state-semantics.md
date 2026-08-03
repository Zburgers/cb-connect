# Four-Phase State Semantics Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires a dated, approved execution plan after Gate 1 evidence exists.

**Goal:** Preserve CB Connect's four-phase theme while making every current-state label honest about whether it is recorded, calendar-estimated, late or unavailable.

**Architecture:** A pure cycle-state reducer consumes eligible observations, derived prediction bounds, tracking context and a user-local date. It never wraps. Convex exposes role-specific projections; all web surfaces render the same projection and never infer biological certainty client-side.

**Tech Stack:** TypeScript, Convex, Vitest, convex-test, Next.js, Playwright.

---

**Depends on:** [Trustworthy cycle facts](2026-08-01-02-trustworthy-cycle-facts.md)

**Research boundary:** [Calendar phase is not observed biology](../research/2026-08-01-major-release-cycle-trust-research.md#41-a-calendar-phase-is-not-an-observed-biological-phase)

**Next gate:** [Personalized prediction](2026-08-01-04-personalized-prediction-and-evaluation.md)

**Planning status:** Gate-level work packages only. The detailed plan requires approved Gate 1 evidence plus D-011 and applicable D-015 input.

## Required contract boundary

Gate 2 defines a versioned `PredictionBounds` input consumed by the state reducer. Before Gate 3 exists, it carries a configured expected date and the explicitly labeled `LEGACY_UNCALIBRATED_GRACE`; after Gate 3 approval, it may carry calibrated earliest/latest bounds. This substitution must not change Recorded/Estimated/Late/Unknown/Paused meanings or create a reverse dependency on Gate 3.

Detailed task order is S1 contract/reducer -> S2 fallback Late boundary -> S3 authoritative read model -> S4 partner projection -> S5/S6 reviewed UI/content -> S7 property coverage and pilot evidence.

## Approved terminology

- **Menstruation · Recorded:** backed by a confirmed open/closed period event covering today.
- **Menstruation/Follicular/Ovulation/Luteal · Calendar estimate:** thematic calendar partition only.
- **Late:** a timing/uncertainty status, not a fifth biological phase and not evidence of pregnancy or a condition.
- **Unknown:** insufficient or ineligible data.
- **Paused:** user intentionally paused prediction.

Every estimated Ovulation label must include: “Calendar estimate; this does not confirm ovulation or identify fertile days.”

## Entry criteria

- Gate 1 observation eligibility and migration are approved.
- Open/confirmed facts can be distinguished from predicted endings.
- User-local date and timezone behavior is available to queries and scheduled work.
- Clinical/privacy reviewers are identified for phase and partner copy before pilot exposure.

## Implementation tasks

<task id="S1" name="Define a non-wrapping cycle state contract">
  <description>Create a discriminated union that makes impossible states unrepresentable and carries status, phase, evidence type, date bounds and reason codes.</description>
  <files>
    <create>convex/_helpers/cycleState.ts</create>
    <create>convex/_helpers/cycleState.test.ts</create>
    <modify>convex/_helpers/cycleCalculations.ts</modify>
  </files>
  <steps>
    <step>Write failing cases for no history, confirmed open period, confirmed early/late end, before/in/after estimate, pause and future last start.</step>
    <step>Define `recorded_period`, `estimated`, `late_or_uncertain`, `insufficient_data` and `prediction_paused` variants.</step>
    <step>Permit cycle day only from the latest confirmed start through the latest expected bound; never apply modulo.</step>
    <step>Require each estimated state to carry `CALENDAR_ESTIMATE`; require late to omit a biological phase.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleState.test.ts</command>
    <expected>State table passes and no date after the latest bound becomes cycle day 1.</expected>
  </verification>
</task>

<task id="S2" name="Implement automatic Late transition">
  <description>Enter Late automatically after the latest prediction-window date, without user confirmation, and clear only on confirmed new start, pause or corrected inputs.</description>
  <files>
    <modify>convex/_helpers/cycleState.ts</modify>
    <modify>convex/_helpers/cycleState.test.ts</modify>
  </files>
  <steps>
    <step>Write boundary tests for the latest expected day and the following day.</step>
    <step>Use Gate 3's calibrated latest bound when available.</step>
    <step>During the legacy transition only, use the configured expected date plus a clearly coded three-day safety grace (`LEGACY_UNCALIBRATED_GRACE`); never call it a likely window.</step>
    <step>Prove that no confirmation mutation is needed to enter Late.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleState.test.ts -t "Late"</command>
    <expected>Latest-bound day remains estimated; next local day is Late; a confirmed start resets state.</expected>
  </verification>
</task>

<task id="S3" name="Create one authoritative cycle read model">
  <description>Compose eligible facts, actual open/end status, prediction input and user-local date once for dashboard and history.</description>
  <files>
    <create>convex/_helpers/cycleReadModel.ts</create>
    <create>convex/_helpers/cycleReadModel.test.ts</create>
    <modify>convex/queries/dashboard.ts</modify>
    <modify>convex/queries/history.ts</modify>
    <modify>convex/_helpers/timelinePhases.ts</modify>
  </files>
  <steps>
    <step>Write failing parity tests for a three-day confirmed period versus five-day configured duration and a still-open day-six event.</step>
    <step>Give confirmed event coverage/open state precedence over estimates.</step>
    <step>Make timeline and dashboard consume the same reducer and evidence labels.</step>
    <step>Return stable version/reason codes for later web/mobile clients.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleReadModel.test.ts convex/queries/history.test.ts convex/_helpers/timelinePhases.test.ts</command>
    <expected>Dashboard/history semantics agree for all open, closed, estimated, late and unknown fixtures.</expected>
  </verification>
</task>

<task id="S4" name="Project phase sharing explicitly for partners">
  <description>Implement the approved broad phase-sharing consent with enumerated fields, immediate revocation and reduced partner detail.</description>
  <files>
    <create>convex/_helpers/partnerCycleProjection.ts</create>
    <create>convex/_helpers/partnerCycleProjection.test.ts</create>
    <modify>convex/queries/dashboard.ts</modify>
    <modify>convex/queries/history.ts</modify>
    <modify>app/(dashboard)/dashboard/partner/page.tsx</modify>
  </files>
  <steps>
    <step>Write failing primary/partner/revoked/no-share tests for each projected field.</step>
    <step>Enumerate phase term, Recorded/Calendar estimate/Late status, cycle day when valid, point/window/confidence and basis count.</step>
    <step>Exclude private context, notes, approximate/pending flags and health-pattern notices.</step>
    <step>Make revocation take effect on the next query and remove cached partner content.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/partnerCycleProjection.test.ts</command>
    <expected>Only consented fields are present; no-share and revoked results contain no cycle payload.</expected>
  </verification>
</task>

<task id="S5" name="Update four-phase dashboard and timeline UI">
  <description>Render the retained theme with evidence badges, automatic Late/Unknown/Paused states and no exact biological claims.</description>
  <files>
    <modify>components/dashboard/CurrentPhase.tsx</modify>
    <modify>components/dashboard/PhaseAura.tsx</modify>
    <modify>components/partner/PartnerDashboard.tsx</modify>
    <modify>app/(dashboard)/dashboard/page.tsx</modify>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <create>e2e/cycle-state.spec.ts</create>
  </files>
  <steps>
    <step>Write failing screenshots/assertions for Recorded, every Calendar estimate, Late, Unknown and Paused.</step>
    <step>Add visible evidence badges and the ovulation/fertility disclaimer adjacent to the label.</step>
    <step>Remove “your period is here” from estimated menstruation and remove deterministic days-until wording after the bound passes.</step>
    <step>Use project theme variables and meet WCAG 2.2 AA at mobile/desktop widths and reduced motion.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/cycle-state.spec.ts --project=chromium</command>
    <expected>All state/copy/accessibility assertions pass with zero skips.</expected>
  </verification>
</task>

<task id="S6" name="Make relationship guidance non-deterministic">
  <description>Retain themed suggestions as “Ideas, not assumptions,” default to a generic check-in and give explicit user reports precedence.</description>
  <files>
    <modify>components/dashboard/TipsCard.tsx</modify>
    <modify>components/dashboard/NutritionSuggestions.tsx</modify>
    <modify>components/partner/PartnerDashboard.tsx</modify>
    <modify>convex/queries/dashboard.ts</modify>
    <modify>convex/seed.ts</modify>
  </files>
  <steps>
    <step>Inventory and test for deterministic mood, libido, hormone, energy and behavior statements.</step>
    <step>Rewrite guidance as optional ideas with a visible “check in rather than assume” default.</step>
    <step>Prioritize recorded pain and explicit check-ins over estimated phase content.</step>
    <step>Require clinical/content approval before enabling revised seeded guidance.</step>
  </steps>
  <verification>
    <command>rg -ni "will feel|hormones are|more social|libido|should be" components convex/seed.ts</command>
    <expected>No unreviewed deterministic phase-to-behavior claim; approved copy tests pass.</expected>
  </verification>
</task>

<task id="S7" name="Add calendar and state-machine property coverage">
  <description>Cover month/year/leap/timezone boundaries and prove state invariants over generated histories.</description>
  <files>
    <create>convex/_helpers/cycleState.property.test.ts</create>
    <modify>convex/_helpers/cycleState.test.ts</modify>
    <modify>convex/_helpers/timelinePhases.test.ts</modify>
  </files>
  <steps>
    <step>Generate valid ordered histories, corrections and local dates.</step>
    <step>Assert prediction never becomes observation, cycle day never wraps and recorded facts always win.</step>
    <step>Cover leap day, DST zones, Asia/Kolkata, positive/negative UTC offsets and browser/cron date parity.</step>
    <step>Persist regression seeds for every discovered failure.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleState.property.test.ts</command>
    <expected>All invariant runs pass with stable regression seeds.</expected>
  </verification>
</task>

## Hard success criteria

- Cycle-day wrap without a new confirmed start: 0 across unit/property/E2E/pilot evidence.
- Estimated state displayed without `Calendar estimate`: 0.
- Calendar-estimated Ovulation displayed without fertility/confirmation disclaimer: 0.
- Confirmed event state overridden by configured duration: 0.
- Dashboard/history disagreement for the same versioned inputs: 0.
- Late activates automatically on the local day after the latest bound: 100% of boundary fixtures.
- Late displayed as pregnancy, PCOS, diagnosis or a fifth biological phase: 0.
- Partner cycle fields disclosed after share-off/revocation or outside the enumerated projection: 0.
- Revised guidance has clinical/content approval and no deterministic mood/hormone behavior statement.

## Rollout and rollback

Ship the reducer/read model dark, compare v1/v2 results on synthetic and consented aggregate state counts, then enable only for staff/test couples, then a bounded pilot. Stop on any fabricated-recorded state, privacy mismatch, phase parity mismatch or elevated Unknown/Late rate unexplained by eligibility. Roll back the read-model feature flag; never restore modulo rollover or inferred end writes.

## Exit evidence

Store state-transition matrix, property report, timezone report, dashboard/history parity, clinical copy approval, privacy projection tests, screenshots and pilot aggregate state distribution under `docs/evidence/four-phase-gate-2/`.
