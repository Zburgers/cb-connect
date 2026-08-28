# Gate 1 Trustworthy Cycle Facts Implementation Plan

**Status:** Implementation complete; deterministic qualification passed;
authenticated qualification pending in the isolated
`gate-1/trustworthy-cycle-facts` worktree. This remains the current execution
authority and records the implementation contract; Gate 1 is not qualified and
production exposure is not authorized. The plan was audited against `main` at
`15d92b54990cc64368fee34a029d5ddf79921b71`; a material architecture or
contract change requires plan revision. The branch was subsequently rebased
onto current `origin/main` at `d69b3cde59e20b59dffe408fde37c917cd3f60e8`.

> **For Codex:** REQUIRED SUB-SKILL: Use
> `shipyard:shipyard-executing-plans` to implement this plan task-by-task.

**Goal:** Make stored cycle history uncertainty-preserving, correction-safe,
and suitable for later prediction without turning estimates or ambiguous
legacy rows into observed facts.

**Architecture:** Extend `periodEvents` additively, centralize fact semantics in
pure helpers, then route existing mutations and reads through those helpers.
Convex is the authority for the default-off capability. Existing rows remain
readable; bounded internal jobs may annotate them but never delete or rewrite
their dates. The UI is enabled only after backend compatibility and release
tests pass.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Convex 1.43,
Vitest/convex-test, Clerk-authenticated Playwright, GitHub Actions.

---

## Operating contract

- Authority order is current code and verified deployment evidence, `AGENTS.md`
  and `convex/_generated/ai/guidelines.md`, `docs/plans/README.md`, this plan,
  then the Gate 1 work-package plan and decision register.
- The August 19 feature-first policy permits additive, backward-compatible,
  default-off work. Historical Gate 0 evidence is not an entry switch.
- D-008 is settled: a valid device-reported IANA timezone is authoritative for
  date-bearing primary writes. Partner writes use the primary user's stored
  validated timezone and fail closed if it is absent or invalid.
- D-009 is settled: exact and approximate dates retain explicit certainty;
  partner assistance is immediately accepted; the primary user's later
  correction or tombstone has final authority.
- D-010 is settled: ambiguous legacy rows remain readable as
  `legacy_unknown` and cannot enter exact-only prediction inputs.
- D-012 blocks destructive deletion/migration, final retention-duration claims,
  production exposure, and production execution of lifecycle cleanup. Additive
  tombstones, compatibility reads, dry runs, and synthetic migration tests are
  allowed. Server-attested non-production identity is required for annotation;
  caller targetDeployment is metadata/typo validation only. No production target
  may be annotated without D-012 approval and a separately approved recovery
  boundary.
- `CB_CONNECT_CYCLE_FACTS_V1` is Convex-only. Unset or any value other than the
  exact string `true` is disabled. No `NEXT_PUBLIC_` mirror is permitted.
- No task may emit raw cycle dates, row IDs, notes, Clerk identities, auth
  state, or secrets into logs or evidence.

## Current-state delta

At the audited `main` baseline, the code already stored some optional
provenance fields and routed primary writes through `calendarDates.ts`, but it
still silently fell back to UTC, auto-closed open facts from later starts and
cron estimates, physically deleted period rows, read unbounded history, and
fed the newest row into prediction without certainty filtering. The ordered
tasks below close those deltas; the plan does not recreate already-landed
timezone plumbing.

## Dependency and concurrency map

```text
1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12
```

Tasks are sequential because Tasks 2-6 share `periods.ts` contracts, Tasks 3
and 8 share `schema.ts`, and Tasks 9-11 depend on generated Convex APIs. Each
task ends in one logical commit. Do not parallelize adjacent tasks that touch a
shared file.

### Task 1: Lock the current Gate 1 contract

<task id="G1.1" name="Contract and plan policy test" tdd="true">
  <description>Add a fast, offline policy test that prevents the implementation from regressing to stale Gate 0 switches, public flags, destructive migration, or the wrong release-test configuration.</description>
  <files>
    <create>scripts/tests/cycle-facts-plan.test.sh</create>
    <modify>package.json</modify>
  </files>
  <steps>
    <step>Write assertions for this plan's current status, Convex-only flag, D-012 boundary, explicit release config, and absence of active Gate 0 approval requirements.</step>
    <step>Run `bash scripts/tests/cycle-facts-plan.test.sh`; expected RED is an assertion identifying the first not-yet-implemented policy contract.</step>
    <step>Add only the package script `test:cycle-facts-plan` and make the test inspect repository text without network access or secrets.</step>
    <step>Run `npm run test:cycle-facts-plan`; expected GREEN is exit 0 with `Gate 1 plan policy: PASS`.</step>
  </steps>
  <verification><command>npm run test:cycle-facts-plan</command><expected>Exit 0 and exact final line `Gate 1 plan policy: PASS`.</expected></verification>
  <commit>`test: lock Gate 1 execution policy`</commit>
</task>

### Task 2: Fail closed on calendar authority

<task id="G1.2" name="Device-local calendar hardening" tdd="true">
  <description>Remove identified-user UTC fallback and preserve stable date-only behavior through timezone changes and DST boundaries.</description>
  <files>
    <modify>convex/_helpers/calendarDates.ts</modify>
    <modify>convex/_helpers/calendarDates.test.ts</modify>
    <modify>convex/mutations/periods.future-dates.test.ts</modify>
  </files>
  <steps>
    <step>Add tests for missing and invalid timezone rejection, Kolkata/Los Angeles local-midnight boundaries, DST transitions, and unchanged `YYYY-MM-DD` values after a timezone update.</step>
    <step>Run `npx vitest run convex/_helpers/calendarDates.test.ts convex/mutations/periods.future-dates.test.ts`; expected RED is the current missing-timezone case resolving to UTC.</step>
    <step>Split validation from fallback in `calendarDates.ts`; authenticated period writes must call the fail-closed resolver.</step>
    <step>Run the focused tests; expected GREEN is all tests passing with no runner-timezone dependency.</step>
  </steps>
  <verification><command>npx vitest run convex/_helpers/calendarDates.test.ts convex/mutations/periods.future-dates.test.ts</command><expected>Exit 0; missing or invalid identified-user zones are rejected.</expected></verification>
  <commit>`fix: enforce device-local cycle dates`</commit>
</task>

### Task 3: Add backward-compatible fact metadata

<task id="G1.3" name="Cycle fact schema and semantics" tdd="true">
  <description>Add optional certainty, legacy reason, authority version, and tombstone metadata while validating all new writes as a discriminated semantic contract.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/_helpers/cycleFactSemantics.ts</create>
    <create>convex/_helpers/cycleFactSemantics.test.ts</create>
  </files>
  <steps>
    <step>Write table-driven tests for `exact`, `approximate`, and `legacy_unknown`; require a legacy reason only for unknown rows, forbid hidden ranges, and require tombstone actor/time/version together.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactSemantics.test.ts`; expected RED is the missing module.</step>
    <step>Add only optional fields to `periodEvents`: start/end certainty, legacy reason, authority version, and tombstone metadata. Implement the pure validator and stable error codes.</step>
    <step>Run the focused test plus `npx convex codegen`; expected GREEN is passing tests and generated types with existing rows still valid.</step>
  </steps>
  <verification><command>npx vitest run convex/_helpers/cycleFactSemantics.test.ts &amp;&amp; npx convex codegen</command><expected>Exit 0; no existing required field changes.</expected></verification>
  <commit>`feat: add explicit cycle fact semantics`</commit>
</task>

### Task 4: Centralize conflict and authority rules

<task id="G1.4" name="Period invariant helper" tdd="true">
  <description>Define one pure decision function for format/order checks, exact duplicate/overlap rejection, approximate isolation, stale-write rejection, and primary precedence.</description>
  <files>
    <create>convex/_helpers/periodEventInvariants.ts</create>
    <create>convex/_helpers/periodEventInvariants.test.ts</create>
  </files>
  <steps>
    <step>Write table tests for duplicate exact starts, closed/open overlap, end-before-start, approximate coexistence, stale authority versions, revoked partner access, and primary correction after partner assistance.</step>
    <step>Run `npx vitest run convex/_helpers/periodEventInvariants.test.ts`; expected RED is the missing module.</step>
    <step>Implement stable result/error codes without database access. Approximate and legacy-unknown rows never satisfy exact-only evidence.</step>
    <step>Run the test; expected GREEN covers every table row.</step>
  </steps>
  <verification><command>npx vitest run convex/_helpers/periodEventInvariants.test.ts</command><expected>Exit 0 with all invariant cases passing.</expected></verification>
  <commit>`test: define trustworthy period invariants`</commit>
</task>

### Task 5: Route primary writes through fact semantics

<task id="G1.5" name="Primary cycle fact writes" tdd="true">
  <description>Write exact/approximate facts explicitly, reject conflicts, stop auto-closing from a new start, and replace physical deletion with a primary-authority tombstone.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Add convex-test cases for exact/approximate starts and ends, overlaps, version mismatch, correction precedence, tombstone visibility, and no `ctx.db.delete` path.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts`; expected RED includes current auto-close and physical-delete behavior.</step>
    <step>Add certainty/version arguments with validators, query a bounded indexed conflict window, invoke Tasks 3-4 helpers, and tombstone rather than delete. Keep legacy callers compatible while the flag is off.</step>
    <step>Run the focused tests; expected GREEN preserves existing authorization and rejects stale/conflicting writes.</step>
  </steps>
  <verification><command>npx vitest run convex/mutations/periods.test.ts</command><expected>Exit 0; no inferred end or hard delete is produced.</expected></verification>
  <commit>`feat: make primary period writes factual`</commit>
</task>

### Task 6: Enforce immediate partner assistance with primary precedence

<task id="G1.6" name="Partner-assisted fact writes" tdd="true">
  <description>Accept authorized partner facts immediately while preventing revoked or stale partner writes from overriding primary corrections or tombstones.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Add tests for exact/approximate assistance, missing primary timezone, disabled sharing, revoked membership, stale version, primary correction, and primary tombstone.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts`; expected RED is missing certainty/version handling.</step>
    <step>Reuse Tasks 2-4 contracts; do not introduce a pending approval state. Ensure notification payloads contain no new sensitive metadata.</step>
    <step>Run the focused tests; expected GREEN shows immediate acceptance and primary precedence.</step>
  </steps>
  <verification><command>npx vitest run convex/mutations/periods.test.ts</command><expected>Exit 0; revoked/stale assistance fails and primary authority wins.</expected></verification>
  <commit>`feat: bound partner-assisted cycle facts`</commit>
</task>

### Task 7: Remove inferred endings from stored facts

<task id="G1.7" name="Derived estimate separation" tdd="true">
  <description>Retire cron/configured-duration writes to `periodEvents.endDate` and return estimates only as explicitly derived presentation data.</description>
  <files>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/crons.ts</modify>
    <modify>convex/_helpers/timelinePhases.ts</modify>
    <modify>convex/_helpers/timelinePhases.test.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
  </files>
  <steps>
    <step>Add tests proving cron execution and later starts cannot patch an observed end, and open rows return a labeled estimate without changing persistence.</step>
    <step>Run `npx vitest run convex/mutations/periods.test.ts convex/_helpers/timelinePhases.test.ts`; expected RED is the current `autoEndPeriods` mutation.</step>
    <step>Unregister the auto-end cron, retire the internal mutation, and model configured duration only in the derived timeline result.</step>
    <step>Run focused tests plus `npx convex codegen`; expected GREEN has no registered inferred-fact writer.</step>
  </steps>
  <verification><command>npx vitest run convex/mutations/periods.test.ts convex/_helpers/timelinePhases.test.ts &amp;&amp; npx convex codegen</command><expected>Exit 0; predictions do not mutate observed fields.</expected></verification>
  <commit>`fix: separate period estimates from facts`</commit>
</task>

### Task 8: Build the bounded legacy classifier and dry run

<task id="G1.8" name="Aggregate legacy audit" tdd="true">
  <description>Classify legacy rows in bounded pages and expose only suppressed reason-code totals through internal functions.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/internal/cycleDataAudit.ts</create>
    <create>convex/internal/cycleDataAudit.test.ts</create>
    <create>docs/runbooks/cycle-data-audit.md</create>
  </files>
  <steps>
    <step>Add synthetic tests for clean, missing-provenance, inferred-end, duplicate, overlap, and unprovable rows; assert page size is at most 100 and counts 1-4 render as `&lt;5`.</step>
    <step>Run `npx vitest run convex/internal/cycleDataAudit.test.ts`; expected RED is the missing internal function.</step>
    <step>Add an indexed audit-run table and internal paginated query/mutation using validators and `internalQuery`/`internalMutation`. Never use `.filter()` or unbounded `.collect()`.</step>
    <step>Run the test; expected GREEN returns only reason codes, suppressed counts, cursor, and completion state.</step>
  </steps>
  <verification><command>npx vitest run convex/internal/cycleDataAudit.test.ts</command><expected>Exit 0; output contains no IDs, dates, notes, or payloads.</expected></verification>
  <commit>`feat: add bounded legacy cycle audit`</commit>
</task>

### Task 9: Add an idempotent annotation runner

<task id="G1.9" name="Legacy unknown annotation" tdd="true">
  <description>Annotate ambiguous rows as `legacy_unknown` in resumable internal batches without deleting or rewriting original dates.</description>
  <files>
    <create>convex/internal/cycleFactsMigration.ts</create>
    <create>convex/internal/cycleFactsMigration.test.ts</create>
    <create>docs/runbooks/cycle-facts-migration.md</create>
  </files>
  <steps>
    <step>Add tests for dry run, batch bound 100, cursor continuation, duplicate run ID, interruption/resume, already-annotated rows, and preservation of every original date and row.</step>
    <step>Run `npx vitest run convex/internal/cycleFactsMigration.test.ts`; expected RED is the missing module.</step>
    <step>Implement internal-only indexed pagination and scheduler continuation with persisted run state. Default to dry run; require an explicit non-production target for write mode.</step>
    <step>Run the test; expected GREEN makes repeated batches no-ops and preserves all source rows.</step>
  </steps>
  <verification><command>npx vitest run convex/internal/cycleFactsMigration.test.ts</command><expected>Exit 0; dry run is default and annotation is bounded, resumable, and idempotent.</expected></verification>
  <commit>`feat: annotate ambiguous legacy cycle facts`</commit>
</task>

### Task 10: Make history and prediction reads fact-aware

<task id="G1.10" name="Fact-aware read projections" tdd="true">
  <description>Keep approximate and legacy-unknown rows visible with labels, hide tombstones from ordinary history, and permit only exact non-tombstoned facts in prediction inputs.</description>
  <files>
    <create>convex/_helpers/cycleFactEligibility.ts</create>
    <create>convex/_helpers/cycleFactEligibility.test.ts</create>
    <modify>convex/queries/history.ts</modify>
    <modify>convex/queries/history.test.ts</modify>
  </files>
  <steps>
    <step>Add tests for exact, approximate, unknown, tombstoned, and mixed newest-row histories; assert partner sharing boundaries remain server-side.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts`; expected RED is the missing helper and current newest-row prediction behavior.</step>
    <step>Add a pure eligibility helper, replace unbounded history reads with a documented bound or pagination, and select the newest eligible exact fact for prediction.</step>
    <step>Run focused tests; expected GREEN labels uncertain history and excludes it from prediction.</step>
  </steps>
  <verification><command>npx vitest run convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts</command><expected>Exit 0; no approximate, unknown, or tombstoned row enters exact-only prediction.</expected></verification>
  <commit>`feat: make cycle reads certainty-aware`</commit>
</task>

### Task 11: Add the authoritative capability and flagged UI

<task id="G1.11" name="Default-off capability and UI" tdd="true">
  <description>Expose an authenticated boolean capability from Convex and show certainty, correction, and tombstone controls only when enabled.</description>
  <files>
    <create>convex/_helpers/cycleFactsFlag.ts</create>
    <create>convex/_helpers/cycleFactsFlag.test.ts</create>
    <create>convex/queries/capabilities.ts</create>
    <create>convex/queries/capabilities.test.ts</create>
    <modify>app/(dashboard)/layout.tsx</modify>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <modify>app/(dashboard)/dashboard/partner/page.tsx</modify>
  </files>
  <steps>
    <step>Add tests for unset/false/true environment values, unauthenticated rejection, exact `{ cycleFactsV1: boolean }` output, and no public/client environment access.</step>
    <step>Run `npx vitest run convex/_helpers/cycleFactsFlag.test.ts convex/queries/capabilities.test.ts`; expected RED is missing modules.</step>
    <step>Implement the authenticated query and consume it with `useQuery` in the existing client dashboard tree. Preserve the current UI during loading/disabled/error states; enabled forms send explicit certainty/version fields.</step>
    <step>Run focused tests, `npx convex codegen`, and typecheck; expected GREEN has no `NEXT_PUBLIC_CB_CONNECT_CYCLE_FACTS_V1` reference.</step>
  </steps>
  <verification><command>npx vitest run convex/_helpers/cycleFactsFlag.test.ts convex/queries/capabilities.test.ts &amp;&amp; npx convex codegen &amp;&amp; npm run typecheck</command><expected>Exit 0; capability is authenticated, boolean-only, and default-off.</expected></verification>
  <commit>`feat: expose flagged trustworthy cycle facts`</commit>
</task>

### Task 12: Qualify authenticated journeys and rollout safety

<task id="G1.12" name="Gate 1 release qualification" tdd="true">
  <description>Prove desktop/mobile primary and partner journeys, default-off compatibility, automatic deployment policy, and flag-off rollback.</description>
  <files>
    <create>e2e/cycle-facts.spec.ts</create>
    <modify>scripts/tests/deploy-workflow.test.sh</modify>
    <modify>DEPLOYMENT.md</modify>
    <modify>docs/plans/README.md</modify>
    <create>docs/evidence/cycle-facts-gate-1/REPORT.md</create>
  </files>
  <steps>
    <step>Add authenticated cases for exact/approximate input, immediate partner assistance, primary correction/tombstone, revoked/stale partner rejection, unknown legacy display, and flag-off legacy behavior.</step>
    <step>Run `npm run test:e2e:release -- e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile`; expected RED is missing UI behavior. Zero skips are required.</step>
    <step>Add deploy-policy assertions that the Convex flag is optional/default-off and never copied to public frontend environment. Document rollback as flag-off plus backward-compatible reads; do not authorize a destructive migration or enable production exposure.</step>
    <step>Run the focused browser and deployment-policy tests; expected GREEN is desktop/mobile pass with zero skips and policy exit 0.</step>
  </steps>
  <verification><command>npm run test:e2e:release -- e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile &amp;&amp; bash scripts/tests/deploy-workflow.test.sh</command><expected>Both projects pass with zero skips; deploy policy exits 0; flag remains off.</expected></verification>
  <commit>`test: qualify trustworthy cycle facts rollout`</commit>
</task>

## Implementation status

All twelve tasks are implemented in the ordered commits below. The two
additional test-alignment commits preserve the same contracts without changing
the task order.

| Task | Implementing commit | Result |
|---|---|---|
| G1.1 | `5db169f` | Gate 1 policy guard and default-off boundary |
| G1.2 | `c233cf6` | Device-local calendar authority and fail-closed timezone handling |
| G1.3 | `48d7043` | Additive certainty, provenance and tombstone semantics |
| G1.4 | `b668c4b` | Shared duplicate, overlap and authority invariants |
| G1.5 | `e8e6d7e` | Factual primary writes and tombstone corrections |
| G1.6 | `f6c2684` | Bounded partner assistance with primary precedence |
| G1.7 | `19681f9` | Derived estimates separated from stored facts |
| G1.8 | `0c2d132` | Bounded aggregate legacy audit |
| G1.9 | `76f3ccd` | Resumable `legacy_unknown` annotation |
| G1.10 | `1909de9` | Certainty-aware history and prediction reads |
| G1.11 | `3341363` | Authenticated Convex capability and flagged UI |
| G1.12 | `1156636` | Release qualification, policy checks and evidence report |

`286959e` and `5b3afb3` are test-fixture alignment follow-ups. Deterministic
qualification passed at the current PR head; authenticated desktop/mobile
qualification remains pending because retained release smoke stopped at
fixture linking before exercising a product journey. The results and separate
production-exposure boundary are recorded in
[`docs/evidence/cycle-facts-gate-1/REPORT.md`](../evidence/cycle-facts-gate-1/REPORT.md).

## Phase verification and exit criteria

Run sequentially because build generates `.next/types` consumed by typecheck:

```bash
npm ci
npm run build
npm run typecheck
npm run test:unit -- --run
npm run test:ci-workflow
npm run test:cycle-facts-plan
bash scripts/tests/deploy-workflow.test.sh
npm audit --omit=dev
npm run test:e2e:release -- e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile
git diff --check
```

Gate 1 engineering is complete only when every command exits 0, authenticated
desktop/mobile tests have zero skips, generated Convex APIs are current, and
the feature remains default-off. The current PR is not Gate 1 qualified until
that authenticated evidence is retained. Production exposure is blocked until
D-012 is approved and a separate exposure decision is recorded; D-012 must
also be resolved before hard deletion, destructive migration, or final
retention behavior. Task 9 production execution additionally needs an
approved target, dry-run result, and recovery boundary.

## Execution handoff

Execute with `shipyard:shipyard-executing-plans` in an isolated worktree, one
task and one logical commit at a time. After each task, perform spec-compliance
then code-quality review. Pause and revise this plan for any schema,
authorization, privacy, or migration-boundary divergence.
