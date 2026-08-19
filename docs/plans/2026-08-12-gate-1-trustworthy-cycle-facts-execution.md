# Gate 1 Trustworthy Cycle Facts Implementation Plan

> **Codex/Shipyard execution:** Use the native `shipyard:shipyard-executing-plans` skill to execute these tasks in order. Do not use Claude-style `/shipyard:*` commands.

**Goal:** Make cycle history explicit, uncertainty-preserving and correction-safe while keeping legacy data readable and preventing inferred dates from becoming facts.

**Architecture:** Additive Convex fields and pure validators land before new writes. Device-local IANA timezone is authoritative for user-facing calendar dates. Partner assistance is accepted immediately; the menstruating/primary user's later correction or deletion/tombstone has final authority. Approximate and `legacy_unknown` records remain explicit and are excluded from exact-only prediction inputs.

**Tech Stack:** Next.js App Router, Convex schema/mutations/queries, TypeScript, Vitest/convex-test, Playwright, shell policy tests.

---

## Execution boundary and decisions

This plan is approved for additive, default-off, non-destructive execution.
G1.0 must be updated to enforce the feature-first boundary: the approved dated
plan and isolated target are required, while historical Gate 0 measurement is
not a blocker.

D-012 blocks hard deletion, destructive migration and final retention
behavior, but does not block additive schema, pure helpers, tests, capability
plumbing or non-destructive compatibility work. D-012's safe
proposed default is: retain original rows, use tombstones for user-visible
deletion, minimize aggregate evidence, and do not select a final retention
duration until the owner explicitly approves it. No task below authorizes a
destructive operation.

The single feature-flag architecture is default-off and shared by Convex and
the UI. Convex's `CB_CONNECT_CYCLE_FACTS_V1` environment variable is the only
authority; unset or any value other than `true` means disabled. An
authenticated `convex/queries/capabilities.ts` query returns only a boolean
capability. Browser code reads that query through Convex and never reads the
server-only environment variable or invents a `NEXT_PUBLIC_` copy. The
deployment workflow and runbook set/document the optional Convex variable.

Approximate facts store exactly the user-selected `YYYY-MM-DD` best estimate
plus explicit `approximate` certainty. The system never infers a hidden
plus/minus window. Date-format, local-future and end-before-start validation
still apply to the selected value; exact-only overlap/uniqueness invariants
and prediction inputs exclude approximate rows unless a later policy
explicitly opts them in. The certainty union remains additive so future
precision metadata can be introduced without rewriting the date.

Legacy audit and migration are internal, aggregate-first and resumable. Every
batch uses an index and pagination/cursor, never unbounded `.collect()` or
`.filter()`. Ambiguous rows are retained and marked `legacy_unknown` with a
reason code; there is no destructive rollback.

## Dependency and file-order map

`G1.0 → G1.1 → G1.2 → G1.3 → G1.4 → G1.5 → G1.6 → G1.7 → G1.8 → G1.9 → G1.10 → G1.11 → G1.12 → G1.13 → G1.14`.

Tasks touching `convex/schema.ts`, `convex/mutations/periods.ts`,
`convex/mutations/periods.test.ts`, or the dashboard log/partner pages are
deliberately sequential. Each task is one TDD cycle and should fit within
roughly 20 minutes; the commit shown is a future execution boundary and is
not run during this audit.

### Task G1.0: Revalidate the executable entry gate

<task id="G1.0" name="Gate 1 entry evidence and migration boundary">
  <description>Make entry evidence fail closed today but PASS once Gate 0 approval, D-012 scope, the isolated target and the aggregate-only rehearsal are actually present.</description>
  <files>
    <create>scripts/tests/cycle-facts-entry.test.sh</create>
    <create>scripts/tests/fixtures/cycle-facts-entry/blocked/REPORT.md</create>
    <create>scripts/tests/fixtures/cycle-facts-entry/approved/REPORT.md</create>
    <create>scripts/tests/fixtures/cycle-facts-entry/approved/decision-register.md</create>
    <create>scripts/tests/fixtures/cycle-facts-entry/approved/target.env</create>
    <create>docs/evidence/cycle-facts-gate-1/entry-preplan-2026-08-12.md</create>
    <create>docs/evidence/cycle-facts-gate-1/entry-criteria.md</create>
  </files>
  <steps>
    <step>Write the shell test and blocked/approved fixtures. Require an approved Gate 0 verdict, explicit D-012 non-destructive scope, an isolated non-production target and a completed synthetic audit/recovery rehearsal.</step>
    <step>Run `bash scripts/tests/cycle-facts-entry.test.sh --fixture scripts/tests/fixtures/cycle-facts-entry/blocked`; expected failure is exit 1 with `BLOCKED: Gate 0 approval is absent` and no network, Convex or production access.</step>
    <step>Record that exact blocked result in `docs/evidence/cycle-facts-gate-1/entry-preplan-2026-08-12.md`; do not encode it as the task's permanent expected result.</step>
    <step>Implement only the fixture-driven checks and an explicit PASS branch; do not weaken the guard or read secrets.</step>
    <step>Run `bash scripts/tests/cycle-facts-entry.test.sh --fixture scripts/tests/fixtures/cycle-facts-entry/approved`; expected result is exit 0 with `Gate 1 entry criteria: PASS`.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/cycle-facts-entry.test.sh --fixture scripts/tests/fixtures/cycle-facts-entry/approved</command>
    <expected>PASS with the exact `Gate 1 entry criteria: PASS` line; the blocked fixture remains a separate expected exit-1 regression case.</expected>
  </verification>
  <commit>Future execution commit: `test: add executable Gate 1 entry criteria`.</commit>
</task>

### Task G1.1: Establish the pure device-local date contract

<task id="G1.1" name="Device-local timezone contract">
  <description>Validate an authenticated user's device-local IANA timezone and resolve date-only comparisons without a server-UTC fallback.</description>
  <files>
    <modify>convex/_helpers/calendarDates.ts</modify>
    <modify>convex/_helpers/calendarDates.test.ts</modify>
  </files>
  <steps>
    <step>Write failing tests for valid IANA zones, invalid zones, DST transitions and local-midnight future-date boundaries.</step>
    <step>Run `npx vitest run convex/_helpers/calendarDates.test.ts`; expected failure is the new invalid-zone, DST or local-midnight assertion.</step>
    <step>Implement the smallest pure resolver: validate IANA input, normalize the date in that zone and return stable validation errors.</step>
    <step>Run `npx vitest run convex/_helpers/calendarDates.test.ts`; expected result is PASS for all timezone and DST cases.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/calendarDates.test.ts</command>
    <expected>PASS; no identified-user case uses runner UTC as its calendar authority.</expected>
  </verification>
  <commit>Future execution commit: `test: define device-local calendar contract`.</commit>
</task>

### Task G1.2: Route period writes through the timezone contract

<task id="G1.2" name="Timezone-aware period writes">
  <description>Persist and use the authenticated user's validated device timezone for primary and partner-assisted date-bearing mutations.</description>
  <files>
    <modify>convex/mutations/users.ts</modify>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
    <modify>convex/mutations/periods.future-dates.test.ts</modify>
  </files>
  <steps>
    <step>Write failing convex-test cases for timezone persistence/change, invalid zone rejection and future dates around a local midnight.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts convex/mutations/periods.future-dates.test.ts`; expected failure is at least one timezone-authority assertion.</step>
    <step>Make the minimal mutation wiring change so the resolver from G1.1 is called for every date-bearing write and partner assistance uses the primary user's date contract.</step>
    <step>Run the same command; expected result is PASS with existing period behavior preserved.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts convex/mutations/periods.future-dates.test.ts</command>
    <expected>PASS; invalid zones fail closed and future-date checks use device-local dates.</expected>
  </verification>
  <commit>Future execution commit: `feat: enforce device-local period dates`.</commit>
</task>

### Task G1.3: Add the authoritative default-off capability

<task id="G1.3" name="Convex cycle-facts capability">
  <description>Create one backend flag reader and an authenticated, non-sensitive capability query for the UI.</description>
  <files>
    <create>convex/_helpers/cycleFactsFlag.ts</create>
    <create>convex/_helpers/cycleFactsFlag.test.ts</create>
    <create>convex/queries/capabilities.ts</create>
    <create>convex/queries/capabilities.test.ts</create>
  </files>
  <steps>
    <step>Write failing tests for unset/false/true `CB_CONNECT_CYCLE_FACTS_V1`, unauthenticated rejection and the exact `{ cycleFactsV1: boolean }` public shape.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactsFlag.test.ts convex/queries/capabilities.test.ts`; expected failure is missing modules/functions.</step>
    <step>Implement the helper using only Convex `process.env`, require authentication in the query, and return no environment value or secret.</step>
    <step>Run the same command; expected result is PASS for default-off, enabled and auth cases.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactsFlag.test.ts convex/queries/capabilities.test.ts</command>
    <expected>PASS; Convex is authoritative and the query exposes only a boolean capability.</expected>
  </verification>
  <commit>Future execution commit: `feat: add default-off cycle facts capability`.</commit>
</task>

### Task G1.4: Consume the capability in browser code

<task id="G1.4" name="UI capability adapter">
  <description>Make the UI use the authenticated capability query instead of attempting to read a server-only environment variable.</description>
  <files>
    <create>lib/cycleFactsCapability.ts</create>
    <create>lib/cycleFactsCapability.test.ts</create>
    <modify>app/(dashboard)/layout.tsx</modify>
  </files>
  <steps>
    <step>Write a failing pure adapter test for loading, disabled, enabled and query-error states; assert that no `process.env.CB_CONNECT_CYCLE_FACTS_V1` reference exists in client code.</step>
    <step>Run `npx vitest run lib/cycleFactsCapability.test.ts`; expected failure is the missing adapter module.</step>
    <step>Implement the adapter and dashboard wiring with the generated Convex capability query; keep disabled/loading behavior legacy-safe.</step>
    <step>Run `npx vitest run lib/cycleFactsCapability.test.ts && npm run typecheck`; expected result is PASS and a clean typecheck.</step>
  </steps>
  <verification>
    <command>npx vitest run lib/cycleFactsCapability.test.ts && npm run typecheck</command>
    <expected>PASS; browser code has no direct read of the Convex server environment.</expected>
  </verification>
  <commit>Future execution commit: `feat: consume cycle facts capability in UI`.</commit>
</task>

### Task G1.5: Add explicit fact metadata without breaking rows

<task id="G1.5" name="Cycle fact certainty and authority schema">
  <description>Add optional certainty, provenance, authority and tombstone fields while keeping existing period rows readable.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/schema.test.ts</create>
    <create>convex/_helpers/cycleFactSemantics.ts</create>
    <create>convex/_helpers/cycleFactSemantics.test.ts</create>
  </files>
  <steps>
    <step>Write failing pure tests for `exact`, `approximate` and `legacy_unknown`, actor/source, primary authority, and tombstone combinations.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactSemantics.test.ts`; expected failure is a missing helper or invalid metadata assertion.</step>
    <step>Add optional schema fields and a pure validator; never infer a date range from an approximate date and never require new fields on legacy rows.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactSemantics.test.ts convex/schema.test.ts`; expected result is PASS and legacy fixture validation remains compatible.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactSemantics.test.ts convex/schema.test.ts</command>
    <expected>PASS; approximate values remain explicit and no hidden precision is created.</expected>
  </verification>
  <commit>Future execution commit: `feat: add explicit cycle fact metadata`.</commit>
</task>

### Task G1.6: Centralize exact-only invariants

<task id="G1.6" name="Period fact invariants">
  <description>Enforce date validity, end ordering and exact-only duplicate/overlap rules in a reusable pure helper.</description>
  <files>
    <create>convex/_helpers/periodEventInvariants.ts</create>
    <create>convex/_helpers/periodEventInvariants.test.ts</create>
  </files>
  <steps>
    <step>Write table-driven failing tests for duplicate exact starts, exact interval overlap, open-event conflicts, end-before-start and approximate-row exclusion from exact-only rules.</step>
    <step>Run `npx vitest run convex/_helpers/periodEventInvariants.test.ts`; expected failure is the missing helper.</step>
    <step>Implement pure `YYYY-MM-DD` checks with stable error codes; always apply format/order/local-future checks, but do not treat approximate rows as exact evidence.</step>
    <step>Run the same command; expected result is PASS for every invariant table.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/periodEventInvariants.test.ts</command>
    <expected>PASS; exact-only rules exclude approximate and legacy-unknown evidence.</expected>
  </verification>
  <commit>Future execution commit: `test: define cycle fact invariants`.</commit>
</task>

### Task G1.7: Wire authority-aware writes

<task id="G1.7" name="Immediate partner assistance and primary precedence">
  <description>Accept partner-assisted facts immediately and make primary correction or deletion/tombstone authoritative against stale or revoked partner writes.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Write failing convex-test cases for immediate partner acceptance, approximate partner dates, primary correction, primary tombstone, stale partner write and revoked partner access.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts`; expected failure is at least one missing authority/optimistic-concurrency assertion.</step>
    <step>Wire actor/source/authority metadata and transaction-version checks; primary updates win, stale/revoked partner writes fail, and deletion uses a tombstone rather than hard deletion.</step>
    <step>Run the same command; expected result is PASS without a partner confirm/reject state.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts</command>
    <expected>PASS; assistance is immediately accepted, primary autonomy wins, and stale/revoked writes fail.</expected>
  </verification>
  <commit>Future execution commit: `feat: enforce primary authority for cycle facts`.</commit>
</task>

### Task G1.8: Stop inferred dates from mutating facts

<task id="G1.8" name="Derived estimates without observed-fact mutation">
  <description>Prevent cron/configured-duration logic from writing predicted endings into observed period rows.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/crons.ts</modify>
    <modify>convex/_helpers/timelinePhases.ts</modify>
    <modify>convex/_helpers/timelinePhases.test.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Write failing tests proving configured duration and later starts never patch an observed `endDate`.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts convex/_helpers/timelinePhases.test.ts`; expected failure is an inferred-end mutation assertion.</step>
    <step>Remove the fact mutation and return an explicitly labeled derived estimate/correction-required state instead.</step>
    <step>Run the same command; expected result is PASS with open and approximate state preserved.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts convex/_helpers/timelinePhases.test.ts</command>
    <expected>PASS; predictions never mutate observed dates.</expected>
  </verification>
  <commit>Future execution commit: `fix: keep predicted endings out of facts`.</commit>
</task>

### Task G1.9: Add a bounded aggregate legacy audit

<task id="G1.9" name="Aggregate-only legacy audit">
  <description>Produce redacted reason-code counts without exposing row IDs, dates, notes or payloads.</description>
  <files>
    <create>convex/internal/cycleDataAudit.ts</create>
    <create>convex/internal/cycleDataAudit.test.ts</create>
    <create>scripts/tests/cycle-facts-audit.test.sh</create>
    <create>docs/runbooks/cycle-data-audit.md</create>
  </files>
  <steps>
    <step>Write synthetic fixtures for clean, missing-provenance, inferred-ending, duplicate, overlap, approximate and unprovable rows.</step>
    <step>Run `npx vitest run convex/internal/cycleDataAudit.test.ts`; expected failure is the missing internal audit contract.</step>
    <step>Implement an internal paginated query with an index and bounded page size; return only counts/reason codes with minimum-group suppression.</step>
    <step>Run `npx vitest run convex/internal/cycleDataAudit.test.ts && bash scripts/tests/cycle-facts-audit.test.sh`; expected result is PASS and no raw identifiers/dates/notes.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/cycleDataAudit.test.ts && bash scripts/tests/cycle-facts-audit.test.sh</command>
    <expected>PASS; audit output is aggregate-only and every page has a bounded continuation.</expected>
  </verification>
  <commit>Future execution commit: `feat: add bounded aggregate cycle-fact audit`.</commit>
</task>

### Task G1.10: Add resumable, idempotent legacy migration state

<task id="G1.10" name="Legacy unknown migration contract">
  <description>Define the additive migration cursor/run state and pure classification that preserves every row and marks unprovable facts `legacy_unknown`.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/migrations/cycleFacts.ts</create>
    <create>convex/migrations/cycleFacts.test.ts</create>
  </files>
  <steps>
    <step>Write failing tests for classification, duplicate execution, interrupted cursor state and the no-delete guarantee.</step>
    <step>Run `npx vitest run convex/migrations/cycleFacts.test.ts`; expected failure is the missing migration contract.</step>
    <step>Add a run-state table and pure batch classifier; use optional additive fields and reason codes, with no original-row deletion or date rewrite.</step>
    <step>Run the same command; expected result is PASS for idempotent classification and resume state.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/migrations/cycleFacts.test.ts</command>
    <expected>PASS; all rows remain, ambiguous rows are `legacy_unknown`, and rerunning a batch is a no-op.</expected>
  </verification>
  <commit>Future execution commit: `feat: define resumable legacy fact migration`.</commit>
</task>

### Task G1.11: Execute migration in bounded internal batches

<task id="G1.11" name="Internal paginated migration runner">
  <description>Implement a resumable internal mutation that processes a bounded indexed page and schedules the next cursor.</description>
  <files>
    <create>convex/internal/cycleFactsMigration.ts</create>
    <create>convex/internal/cycleFactsMigration.test.ts</create>
    <create>docs/runbooks/cycle-facts-migration.md</create>
  </files>
  <steps>
    <step>Write failing tests for page-size bounds, cursor continuation, idempotent run IDs, dry-run counts and a forced interruption.</step>
    <step>Run `npx vitest run convex/internal/cycleFactsMigration.test.ts`; expected failure is the missing internal mutation.</step>
    <step>Implement internal-only indexed pagination, bounded updates, persisted cursor/run state and `ctx.scheduler.runAfter` continuation; never call `.collect()` or `.filter()` over the table.</step>
    <step>Run the same command; expected result is PASS with a resumed run producing the same aggregate outcome as one uninterrupted run.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/cycleFactsMigration.test.ts</command>
    <expected>PASS; every batch is bounded/resumable/idempotent and no destructive rollback exists.</expected>
  </verification>
  <commit>Future execution commit: `feat: run cycle-fact migration in bounded batches`.</commit>
</task>

### Task G1.12: Make reads prediction-safe

<task id="G1.12" name="Fact eligibility and history projection">
  <description>Exclude approximate and legacy-unknown rows from exact-only prediction inputs while preserving them in history with labels.</description>
  <files>
    <modify>convex/queries/history.ts</modify>
    <modify>convex/queries/history.test.ts</modify>
    <create>convex/_helpers/cycleFactEligibility.ts</create>
    <create>convex/_helpers/cycleFactEligibility.test.ts</create>
  </files>
  <steps>
    <step>Write failing tests for history visibility versus prediction eligibility across exact, approximate, tombstoned and legacy-unknown rows.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts`; expected failure is the missing eligibility policy.</step>
    <step>Implement one pure policy helper and use it in history/prediction projections without deleting or silently relabeling rows.</step>
    <step>Run the same command; expected result is PASS with explicit labels and exact-only filtering.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts</command>
    <expected>PASS; approximate/legacy-unknown facts remain readable but do not enter exact-only predictions.</expected>
  </verification>
  <commit>Future execution commit: `feat: separate fact history from prediction inputs`.</commit>
</task>

### Task G1.13: Add factual logging journeys

<task id="G1.13" name="Cycle facts authenticated UI">
  <description>Expose exact/approximate labels, immediate partner assistance and primary correction/tombstone controls only when the capability is enabled.</description>
  <files>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <modify>app/(dashboard)/dashboard/partner/page.tsx</modify>
    <create>e2e/cycle-facts.spec.ts</create>
  </files>
  <steps>
    <step>Write failing browser cases for exact/approximate input, accepted partner assistance, primary correction/tombstone, stale partner failure and legacy-unknown display.</step>
    <step>Run `npx playwright test e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile`; expected failure is the missing spec/feature behavior.</step>
    <step>Implement the smallest form and labels behind the capability query; do not add a partner confirmation or confirm/reject journey.</step>
    <step>Run the same command against isolated fixtures; expected result is PASS on desktop and mobile with zero skips and explicit estimate labels.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile</command>
    <expected>PASS on desktop and mobile with zero skips; primary autonomy and approximate certainty are visible.</expected>
  </verification>
  <commit>Future execution commit: `feat: add cycle facts authenticated journeys`.</commit>
</task>

### Task G1.14: Wire deployment, evidence and rollback review

<task id="G1.14" name="Flag runbook and Gate 1 evidence">
  <description>Document and test default-off deployment, evidence collection and rollback without enabling production exposure or destructive retention behavior.</description>
  <files>
    <modify>.github/workflows/deploy.yml</modify>
    <modify>scripts/tests/deploy-workflow.test.sh</modify>
    <modify>DEPLOYMENT.md</modify>
    <create>docs/evidence/cycle-facts-gate-1/REPORT.md</create>
    <modify>docs/plans/README.md</modify>
    <modify>docs/decisions/major-release-decision-register.md</modify>
  </files>
  <steps>
    <step>Write a policy assertion requiring `CB_CONNECT_CYCLE_FACTS_V1` to be optional/default-off, Convex-only, and absent from browser/public env; assert rollback is flag-off plus compatible reads.</step>
    <step>Run `bash scripts/tests/deploy-workflow.test.sh`; expected failure is the missing cycle-facts flag/runbook policy assertion.</step>
    <step>Update the existing PM2/Convex deployment path and runbook; do not add promotion opt-in, production secrets, destructive migration or a `NEXT_PUBLIC_` flag. Record D-012 as proposed default pending owner approval.</step>
    <step>Run `bash scripts/tests/deploy-workflow.test.sh && git diff --check`; expected result is PASS and no whitespace errors.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/deploy-workflow.test.sh && git diff --check</command>
    <expected>PASS; deploy policy remains fail-closed and frontend-only behavior remains unchanged while the flag is off.</expected>
  </verification>
  <commit>Future execution commit: `docs: document cycle facts rollout and rollback`.</commit>
</task>

## Execution-wide verification and exit

After all task commits, run the exact project scripts sequentially:

```bash
npm run build
npm run typecheck
npm run test:unit -- --run
npm run test:ci-workflow
bash scripts/tests/deploy-workflow.test.sh
npm audit --omit=dev
npm run test:e2e -- --project=release-desktop --project=release-mobile
```

CI, deployment logs and Git history are the default execution evidence. Any
separate Gate 1 report should contain only results those systems cannot retain
safely. D-012 must be resolved before any destructive behavior; it does not
block the additive tasks that precede it.
