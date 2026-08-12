# Trustworthy Cycle Facts Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires an **approved
> Gate 0 report**, resolved Gate 1 decisions, and a dated approved execution
> plan. A dated draft now exists at
> [`2026-08-12-gate-1-trustworthy-cycle-facts-execution.md`](2026-08-12-gate-1-trustworthy-cycle-facts-execution.md),
> but the current Gate 0 report is blocked and D-012 retention authority is
> pending, so neither this document nor the dated draft is executable.

**Goal:** Ensure period history contains explicit user observations with valid provenance and never silently stores system estimates as facts.

**Architecture:** Period-event mutations enforce one invariant set inside Convex transactions. Observation certainty, actor provenance and primary authority are separate fields. Partner assistance is accepted immediately while later primary correction or deletion/tombstone wins. A privacy-preserving aggregate audit informs backward-compatible migration; predicted endings remain derived and open events remain open until explicitly ended.

**Tech Stack:** Convex schema/migrations, TypeScript, Vitest, convex-test, Next.js App Router.

---

**Depends on:** [Production reliability](2026-08-01-01-production-reliability-foundation.md)

**Program:** [Major-release roadmap](2026-08-01-cb-connect-major-release-program.md)

**Next gate:** [Four-phase state semantics](2026-08-01-03-four-phase-state-semantics.md)

**Planning status:** Gate-level work packages plus a dated non-executable draft. The
dated plan may be reviewed now, but execution starts only after the Gate 0
report is approved and D-012 is explicitly resolved before destructive
migration or deletion behavior. See the
[Gate 0-to-Gate 1 handoff](../handoffs/2026-08-06-gate-0-to-gate-1.md) for the
current code inventory and decision boundary; it is not an execution plan.

## Required detailed execution order

1. Establish timezone storage, default/change behavior and authoritative user-local `today` from F6/D-008.
2. Add backward-compatible observation/provenance/certainty/authority fields from F2/D-009. Partner assistance is accepted immediately; primary correction/deletion remains authoritative.
3. Implement F1 invariants using the established timezone contract; do not compare against backend-runtime “today.”
4. Run F3 aggregate audit and quantify D-010 reason counts without exposing raw rows; preserve all ambiguous rows as `legacy_unknown`.
5. Rehearse and run F4 additive migration.
6. Remove F5 inferred writes only after compatible reads/new writes are active.
7. Complete remaining private context/segment behavior and F7 UI behind feature flags.

F6 must be split in the detailed plan: its timezone foundation blocks F1, while pause/context segmentation may follow the additive schema work. This ordering supersedes the visual F1-F7 numbering below.

## Entry criteria

- Gate 0 deployment/rollback evidence is approved.
- Production aggregate audit authorization remains read-only and aggregate-only.
- The migration targets and backup/restore rehearsal are identified.
- No migration report may contain raw user IDs, dates, notes or event rows.

## Implementation tasks

<task id="F1" name="Centralize calendar and event invariants">
  <description>Create pure validators for real dates, user-local future dates, duplicate starts, overlaps and end-before-start.</description>
  <files>
    <create>convex/_helpers/periodEventInvariants.ts</create>
    <create>convex/_helpers/periodEventInvariants.test.ts</create>
    <modify>convex/mutations/periods.ts</modify>
  </files>
  <steps>
    <step>Write table-driven failing tests for invalid calendar dates, future local dates, duplicates, closed/open overlaps and corrections.</step>
    <step>Implement pure interval comparisons using `YYYY-MM-DD` calendar values.</step>
    <step>Query all potentially conflicting events through `by_user_and_start` and reject invariant violations transactionally.</step>
    <step>Return stable error codes suitable for both clients instead of parsing English messages.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/periodEventInvariants.test.ts convex/mutations/periods.test.ts</command>
    <expected>All duplicate, overlap, future-date and correction cases pass.</expected>
  </verification>
</task>

<task id="F2" name="Add explicit observation and confirmation semantics">
  <description>Separate source/actor from certainty and primary authority while preserving legacy compatibility.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/test.fixtures.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Add failing tests proving partner-assisted entries are accepted immediately, while later primary correction/deletion wins and approximate values remain approximate.</step>
    <step>Add `startCertainty`, optional `endCertainty`, actor/source, primary-authority metadata and explicit legacy provenance using optional/backward-compatible fields first.</step>
    <step>Keep `createdByUserId` and `updatedByUserId`; remove `system` from all new observation writes.</step>
    <step>Add primary correction/tombstone precedence with couple-membership, stale-write, revocation and ownership tests; do not add a partner confirm/reject workflow.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts</command>
    <expected>Self, approximate, immediately accepted partner-assist, primary correction/deletion, legacy-unknown and revoked-access cases pass.</expected>
  </verification>
</task>

<task id="F3" name="Measure legacy provenance without exposing histories">
  <description>Create an internal aggregate-only audit grouped by provenance/confirmation/integrity reason codes.</description>
  <files>
    <create>convex/internal/cycleDataAudit.ts</create>
    <create>convex/internal/cycleDataAudit.test.ts</create>
    <create>docs/runbooks/cycle-data-audit.md</create>
  </files>
  <steps>
    <step>Write a synthetic fixture containing duplicates, overlaps, system ends, missing actors and pending assistance.</step>
    <step>Return counts and bounded distributions only; apply minimum-group suppression where needed.</step>
    <step>Prohibit raw IDs, dates, notes and rows in the return validator and report serializer.</step>
    <step>Run only through approved internal tooling and save the redacted aggregate report as restricted evidence.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/cycleDataAudit.test.ts</command>
    <expected>Counts match fixtures and serialized output contains no fixture IDs, dates, notes or event objects.</expected>
  </verification>
</task>

<task id="F4" name="Migrate legacy observations conservatively">
  <description>Backfill known actor/source semantics and mark ambiguous/system-inferred data as legacy unknown instead of fabricating certainty.</description>
  <files>
    <create>convex/migrations/cycleFacts.ts</create>
    <create>convex/migrations/cycleFacts.test.ts</create>
    <create>docs/runbooks/cycle-facts-migration.md</create>
    <modify>convex/schema.ts</modify>
  </files>
  <steps>
    <step>Write idempotency and interrupted-resume tests against synthetic legacy rows.</step>
    <step>Backfill only values derivable from existing actor/source fields.</step>
    <step>Mark suspected auto-ended rows, missing provenance and unresolved duplicate/overlap rows as `legacy_unknown`; never label them confirmed.</step>
    <step>Run dry-run counts, migration rehearsal and rollback/forward-fix procedure on a non-production clone before protected production execution.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/migrations/cycleFacts.test.ts</command>
    <expected>Two consecutive runs produce identical migrated state and ambiguous rows remain explicitly unknown.</expected>
  </verification>
</task>

<task id="F5" name="Remove inferred end writes and implausible auto-closure">
  <description>Stop cron and new-start mutations from converting predicted or day-before-next-start dates into observed ends.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/crons.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
    <modify>convex/_helpers/timelinePhases.ts</modify>
    <modify>convex/_helpers/timelinePhases.test.ts</modify>
  </files>
  <steps>
    <step>Write failing invariants that expected duration and a later start never patch an observed `endDate`.</step>
    <step>Delete/disable `autoEndPeriods` and remove its cron registration.</step>
    <step>When a new start conflicts with an old open event, return a correction-required state rather than creating a 41-day observation.</step>
    <step>Keep predicted end dates in a derived projection only and label them estimates.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts convex/_helpers/timelinePhases.test.ts</command>
    <expected>No test path writes an end date without an explicit primary observation/confirmation.</expected>
  </verification>
</task>

<task id="F6" name="Add timezone and tracking-context records">
  <description>Store user-controlled timezone, prediction pause and private history segments without inferring contraception, pregnancy, postpartum, PCOS or life stage.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/mutations/cycleContext.ts</create>
    <create>convex/mutations/cycleContext.test.ts</create>
    <modify>app/(dashboard)/dashboard/settings/page.tsx</modify>
  </files>
  <steps>
    <step>Write failing tests for invalid IANA zones, pause/resume, segment creation and partner privacy.</step>
    <step>Persist IANA timezone and user-selected tracking mode/paused state.</step>
    <step>Create a new private segment on meaningful user-declared context change; exclude prior segments by default without deleting them.</step>
    <step>Allow explicit restoration and ensure no private context label is partner-visible.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/cycleContext.test.ts</command>
    <expected>Timezone/context/segment tests pass across primary, partner and revoked roles.</expected>
  </verification>
</task>

<task id="F7" name="Update logging, correction and confirmation UI">
  <description>Expose exact/approximate starts and ends, unresolved open events and accepted partner assistance without presenting estimates as history.</description>
  <files>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <modify>app/(dashboard)/dashboard/partner/page.tsx</modify>
    <modify>app/onboarding/page.tsx</modify>
    <modify>components/dashboard/OnboardingFlow.tsx</modify>
    <create>e2e/cycle-facts.spec.ts</create>
  </files>
  <steps>
    <step>Write failing browser cases for approximate input, accepted partner assistance, primary correction/tombstone, overlap and unresolved old open period.</step>
    <step>Use one shared cycle-setup form/validation contract across onboarding and dashboard recovery.</step>
    <step>Show actor, certainty and accepted assistance honestly; provide “Is your period still ongoing?” as a private prompt, never an automatic answer.</step>
    <step>Recompute/invalidate dependent derived views after correction/deletion without mutating history.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile</command>
    <expected>All factual logging/correction/authority journeys pass on desktop and mobile with zero skips.</expected>
  </verification>
</task>

## Hard success criteria

- New observed rows have actor, source, start certainty and confirmation provenance: 100%.
- Legacy rows have known provenance or explicit `legacy_unknown`: 100% after migration.
- Backend accepts duplicate starts, overlaps, end-before-start or future-local dates: 0 in tests and pilot telemetry.
- Predicted/configured period endings written into `periodEvents.endDate`: 0.
- Approximate or `legacy_unknown` records silently promoted to exact/high-confidence prediction inputs: 0; partner-assisted records remain accepted but primary correction/deletion always wins.
- Aggregate production audit reports contain raw IDs, dates, notes or rows: 0.
- Context/pause labels exposed to a partner without separate approved sharing: 0.
- Migration is idempotent and rehearsal aggregate counts reconcile before/after.

## Rollout and rollback

Deploy additive schema and read compatibility first, then dry-run audit, then migration, then guarded new writes, and only afterward remove old write paths. Convex owns `CB_CONNECT_CYCLE_FACTS_V1`, defaulting off, and exposes only an authenticated boolean capability to the UI. Gate 0 approval is required before additive execution; D-012 approval remains required for hard deletion, destructive migration and production exposure. Stop on count mismatch, invariant rejection spike, unauthorized visibility, migration non-idempotency or inability to restore. Rollback reads to compatible fields; never “undo” by deleting migrated history.

## Exit evidence

Store synthetic audit output, suppressed production aggregate counts, migration reconciliation, invariant test report, authenticated browser report and rollback rehearsal under `docs/evidence/cycle-facts-gate-1/`. Gate 2 may not derive exact phase state from approximate or legacy-unknown records unless a later approved policy explicitly handles that uncertainty.
