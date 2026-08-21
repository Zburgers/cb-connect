# Gate 1 Review Remediation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `shipyard:shipyard-executing-plans` to implement this plan task-by-task.

**Goal:** Close every unresolved PR #35 review thread at head `2220a64b6a832c708dbd32e589b52e5af8be1d66` without weakening uncertainty, authority, compatibility, migration, or qualification contracts.

**Architecture:** Deepen four existing modules: capability-aware cycle-fact persistence/read compatibility, explicitly targeted period-event authority, purpose-aware fact eligibility, and bounded legacy classification. Their interfaces become the test surfaces; Convex mutations, queries, and jobs remain thin adapters with high locality. Reconcile the same durable policy through the decision register, execution plan, evidence, runbook, and policy tests.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Convex 1.43, Vitest with `convex-test`, Clerk-authenticated Playwright, Bash policy tests, GitHub Actions.

---

## Authority, baseline, and non-goals

- Implementation base: branch `gate-1/trustworthy-cycle-facts`, exact PR #35 head `2220a64b6a832c708dbd32e589b52e5af8be1d66`.
- Review source: the 13 live unresolved GitHub review threads fetched on 2026-08-21. Re-fetch before implementation and before requesting re-review; do not assume this snapshot remains complete.
- Planning-only handoff: this document does not authorize a merge, deployment, production flag change, migration, thread resolution/reply, or production data operation.
- Preserve optional `periodEvents` fields and flag-off legacy rows. Do not backfill certainty by inference and do not rewrite dates.
- D-012 remains unresolved. This plan adopts the narrow consistent contract: D-012 blocks destructive migration, hard deletion under Gate 1 semantics, final retention behavior, and production **feature exposure**. It does not block deployment of additive/default-off compatibility code. Any broader interpretation requires owner/privacy approval and a plan revision.
- Current evidence is not a green Gate: PR-head deterministic qualification is green, authenticated release smoke is red at fixture setup, and no product journey or zero-skip desktop/mobile evidence exists.
- A major schema/orchestration divergence pauses execution and requires this plan to be revised and re-approved. Minor path/test-name changes may be recorded in the execution summary.

## Architecture audit and current behavior

The deletion test shows four modules worth deepening. Deleting the current helpers would mostly move decisions back into callers, which exposes shallow interfaces and low locality. The remediation should instead concentrate complexity behind these interfaces:

1. **Capability compatibility module — Strong.** `convex/mutations/periods.ts:150-213`, `:215-281`, `:283-461`, `:463-588`, and `:590+` branch writes on `CB_CONNECT_CYCLE_FACTS_V1`, but `convex/queries/history.ts:121-157` always applies exact-only prediction selection. The module interface must select both write semantics and prediction-read semantics from one server capability. This seam has two real adapters already: mutations and internal prediction reads. Deepening it provides leverage across rollback tests and notifications without a public flag mirror.
2. **Period-event command module — Strong.** `findOpenPeriod()` in `convex/mutations/periods.ts:95-113` infers identity from up to 100 newest rows; both end mutations then mutate that inferred row. `evaluatePeriodEventInvariants()` already accepts `targetEventId` and `expectedAuthorityVersion`, and `primaryCorrectionVersion` already distinguishes a primary override from mere primary authorship. Make explicit event identity/version the command interface. This improves locality and preserves the real partner/primary authority seam.
3. **Purpose-aware eligibility module — Strong.** `getCycleFactReadLabel()` in `convex/_helpers/cycleFactEligibility.ts:15-38` intentionally labels a row with an approximate end as approximate, while `isPredictionEligible()` at `:44-50` incorrectly reuses that whole-row label for start-to-start prediction. Split start anchoring from exact coverage. This gives Gate 2 and Gate 3 a stable interface without an adapter that relabels uncertain evidence as exact.
4. **Legacy classification module — Strong.** `classifyLegacyReason()` and overlap logic are duplicated in `convex/internal/cycleDataAudit.ts` and `convex/internal/cycleFactsMigration.ts`. Both load only the earliest `MAX_USER_CONTEXT=100`, so later conflicts are missed. Extract one classification interface and use bounded persisted/indexed scan adapters for audit and migration. This increases depth and prevents policy drift.

Do not create an abstraction merely to rename existing functions. Each new interface below has at least two consumers or centralizes a load-bearing policy. Keep schema/index/job orchestration adjacent to its adapter so the implementation remains navigable.

## Review-thread coverage matrix

| Thread concern | Planned task(s) | Acceptance contract |
|---|---:|---|
| Flag-off backend writes and prediction reads | 1, 2 | Disabled mode preserves legacy auto-close/delete/write shape and newest visible legacy prediction input. |
| Certainty-preserving correction and E2E | 3 | Correction preserves field certainty by default; explicit confirmation is the only promotion path. |
| Single open/targeted event and partner precedence | 4 | End commands target an event/version; partner may end a primary start unless a later primary correction/tombstone wins. |
| Purpose-aware eligibility | 5 | Exact start anchors state/prediction; approximate end cannot claim exact Recorded coverage. |
| Raw duplicate/overlap, complete beyond 100 | 6, 7 | Shared classifier derives conflicts from raw rows and bounded scan proves conflicts after row 100. |
| Actual deployment identity | 8 | Caller label is metadata only; server-attested environment/capability is the safety control. |
| D-008/D-009/D-012 language | 9 | Decision register, plans, evidence, and runbook express one authority contract. |
| Durable policy tests and external auth evidence | 9, 10 | Tests assert invariants, not mutable status prose; failed/missing auth evidence remains pending. |
| Evidence/runbook and Gate 2 rebase | 10 | Gate 1 evidence is current and Gate 2 remains provisional until rebased and requalified. |

## Dependency order

`1 -> 2`; `1 -> 3`; `1 -> 4`; `1 -> 5`; `6 -> 7 -> 8`; tasks 2-8 feed task 9; all feed task 10. Tasks sharing `convex/mutations/periods.ts`, `convex/schema.ts`, or documentation are deliberately sequential. Do not parallelize them in separate worktrees.

### Task 1: Freeze contracts with regression tests

<task id="G1.R1" name="Review regression contract" tdd="true">
  <description>Add failing tests for every behavioral blocker before changing implementation.</description>
  <files>
    <modify>convex/mutations/periods.test.ts</modify>
    <modify>convex/queries/history.test.ts</modify>
    <modify>convex/_helpers/cycleFactEligibility.test.ts</modify>
    <modify>convex/internal/cycleDataAudit.test.ts</modify>
    <modify>convex/internal/cycleFactsMigration.test.ts</modify>
  </files>
  <steps>
    <step>Add a disabled-mode query test proving a legacy row without certainty remains the newest prediction input.</step>
    <step>Add mutation tests proving disabled mode retains auto-close, physical delete, and legacy row shape.</step>
    <step>Add end-command tests for explicit event ID/version, ambiguous open rows, partner ending a primary-started row, and partner rejection after a later primary correction/tombstone.</step>
    <step>Add eligibility tests separating exact-start anchoring from exact-coverage eligibility.</step>
    <step>Add raw-row audit/migration fixtures where duplicate and overlap pairs occur after the first 100 rows.</step>
    <step>Run the focused suite and retain the expected failures mapped to the unresolved threads.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/periods.test.ts convex/queries/history.test.ts convex/_helpers/cycleFactEligibility.test.ts convex/internal/cycleDataAudit.test.ts convex/internal/cycleFactsMigration.test.ts</command>
    <expected>RED only for the newly specified compatibility, targeting, purpose, completeness, and identity contracts; no unrelated regression.</expected>
  </verification>
  <commit>test: lock Gate 1 review remediation contracts</commit>
</task>

### Task 2: Make prediction reads capability-compatible

<task id="G1.R2" name="Flag-off prediction compatibility" tdd="true">
  <description>Use one server-only capability decision for legacy and Gate 1 prediction projections.</description>
  <files>
    <modify>convex/_helpers/cycleFactEligibility.ts</modify>
    <modify>convex/_helpers/cycleFactEligibility.test.ts</modify>
    <modify>convex/queries/history.ts</modify>
    <modify>convex/queries/history.test.ts</modify>
  </files>
  <steps>
    <step>Define a pure selection interface such as `selectPredictionAnchor(periods, mode)` where `mode` is `legacy` or `cycle_facts_v1`; do not read environment variables inside the pure helper.</step>
    <step>In legacy mode, select the newest non-tombstoned row by existing descending query order without manufacturing certainty metadata.</step>
    <step>In Gate 1 mode, select the newest start-anchor-eligible row using Task 5's purpose-aware rule.</step>
    <step>Have `getPredictionInputsForUser` derive mode with `isCycleFactsV1Enabled()` server-side and call the interface.</step>
    <step>Prove unset, false, malformed, and true flag values; prove no `NEXT_PUBLIC_` mirror and no behavior change to history labels.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactsFlag.test.ts convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts</command>
    <expected>Exit 0; disabled mode returns legacy newest-row prediction inputs and enabled mode uses purpose-aware eligibility.</expected>
  </verification>
  <commit>fix: preserve flag-off prediction reads</commit>
</task>

### Task 3: Complete explicit certainty promotion

<task id="G1.R3" name="Certainty-preserving correction" tdd="true">
  <description>Retain certainty per field unless the primary explicitly confirms promotion.</description>
  <files>
    <modify>convex/_helpers/cycleFactCorrections.ts</modify>
    <modify>convex/_helpers/cycleFactCorrections.test.ts</modify>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <modify>e2e/cycle-facts.spec.ts</modify>
  </files>
  <steps>
    <step>Keep `resolveCycleFactCorrection()` as the module interface, but make promotion intent explicit per affected field if one checkbox cannot truthfully cover both start and end.</step>
    <step>Preserve an approximate or `legacy_unknown` start when only its date changes; preserve an existing end certainty when its date changes.</step>
    <step>When adding a previously absent end, require the submitted end certainty instead of inheriting start certainty silently.</step>
    <step>Clear `legacyReason` only when explicit promotion establishes every previously unknown field needed to remove that reason.</step>
    <step>Render unambiguous confirmation copy and send promotion only after the user checks it. Do not send `startCertainty: "exact"` merely because edit mode is enabled.</step>
    <step>Keep both Playwright steps: save a correction and remain Approximate, then explicitly confirm and become Exact.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactCorrections.test.ts convex/mutations/periods.test.ts &amp;&amp; npm run typecheck</command>
    <expected>Exit 0; certainty is preserved by default and promoted only by explicit intent.</expected>
  </verification>
  <commit>fix: require explicit cycle fact certainty promotion</commit>
</task>

### Task 4: Target active events and preserve primary precedence

<task id="G1.R4" name="Targeted period event commands" tdd="true">
  <description>Remove newest-open inference from Gate 1 end writes and model primary precedence as a later override, not authorship.</description>
  <files>
    <modify>convex/_helpers/periodEventInvariants.ts</modify>
    <modify>convex/_helpers/periodEventInvariants.test.ts</modify>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/periods.test.ts</modify>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <modify>e2e/cycle-facts.spec.ts</modify>
  </files>
  <steps>
    <step>Keep the single-open invariant independent of certainty for new Gate 1 writes; closed approximate overlaps remain allowed.</step>
    <step>Add required `periodEventId` and `expectedAuthorityVersion` arguments to enabled-mode primary and partner end commands. Preserve the old no-ID interface only inside flag-off compatibility behavior.</step>
    <step>Load the targeted row by ID, verify ownership/couple access, open state, non-tombstoned state, and version before evaluating invariants.</step>
    <step>Use `primaryCorrectionVersion`/`tombstoneAuthorityVersion` as the precedence marker. A row merely created by the primary has no primary override and may be ended by an authorized partner.</step>
    <step>After any primary correction or tombstone, reject stale or later partner writes even if the partner held a previously valid ID/version.</step>
    <step>Pass `ongoingPeriod._id` from the UI and exercise partner-end-primary-start, primary-correct-after-partner-end, stale write, and tombstone precedence in unit/E2E tests.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/periodEventInvariants.test.ts convex/mutations/periods.test.ts &amp;&amp; npm run typecheck</command>
    <expected>Exit 0; no enabled-mode end write infers a target, only one open row can be created, and primary later overrides win.</expected>
  </verification>
  <commit>fix: target authoritative period events explicitly</commit>
</task>

### Task 5: Split eligibility by purpose

<task id="G1.R5" name="Purpose-aware cycle fact eligibility" tdd="true">
  <description>Make exact-start anchoring and exact Recorded coverage distinct policies.</description>
  <files>
    <modify>convex/_helpers/cycleFactEligibility.ts</modify>
    <modify>convex/_helpers/cycleFactEligibility.test.ts</modify>
    <modify>convex/queries/history.ts</modify>
    <modify>convex/queries/history.test.ts</modify>
    <modify>docs/plans/2026-08-01-02-trustworthy-cycle-facts.md</modify>
    <modify>docs/plans/2026-08-01-03-four-phase-state-semantics.md</modify>
    <modify>docs/plans/2026-08-01-04-personalized-prediction-and-evaluation.md</modify>
  </files>
  <steps>
    <step>Replace ambiguous `isPredictionEligible()` with named interfaces such as `isStartAnchorEligible()` and `isExactCoverageEligible(date)`.</step>
    <step>`isStartAnchorEligible()` requires visible, non-legacy, exact `startCertainty`; end uncertainty must not poison the start.</step>
    <step>`isExactCoverageEligible()` requires exact start and, for coverage after start, an exact end; approximate/unknown end never claims exact Recorded menstruation.</step>
    <step>Keep `getCycleFactReadLabel()` conservative for whole-row display. Do not relabel a mixed-certainty row as wholly exact.</step>
    <step>Document Gate 2's state-anchor adapter and Gate 3's start-to-start adapter against these interfaces so provisional code can rebase without inventing a third policy.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleFactEligibility.test.ts convex/queries/history.test.ts</command>
    <expected>Exit 0; exact-start/approximate-end facts anchor state and prediction but fail exact-coverage checks.</expected>
  </verification>
  <commit>fix: make cycle fact eligibility purpose-aware</commit>
</task>

### Task 6: Deepen raw legacy classification

<task id="G1.R6" name="Shared legacy classification module" tdd="true">
  <description>Derive duplicate and overlap reasons from raw rows once, without trusting preseeded `legacyReason`.</description>
  <files>
    <create>convex/_helpers/legacyCycleFactClassification.ts</create>
    <create>convex/_helpers/legacyCycleFactClassification.test.ts</create>
    <modify>convex/internal/cycleDataAudit.ts</modify>
    <modify>convex/internal/cycleFactsMigration.ts</modify>
  </files>
  <steps>
    <step>Define a pure classifier interface over a current raw row plus proven conflict facts from the scan adapter.</step>
    <step>Set precedence explicitly: tombstone ignored; raw duplicate; raw overlap; existing non-conflict legacy reason; inferred system end; missing provenance; unprovable; clean.</step>
    <step>Do not accept `legacyReason: duplicate|overlap` as proof. Existing labels may be checked for reconciliation but raw relations determine those counts.</step>
    <step>Make audit and migration import this module; delete their copied interval/classification functions.</step>
    <step>Apply the deletion test: removing the module must force both adapters to reimplement the same policy, demonstrating useful depth.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/legacyCycleFactClassification.test.ts convex/internal/cycleDataAudit.test.ts convex/internal/cycleFactsMigration.test.ts</command>
    <expected>Exit 0; unannotated conflicting rows classify as duplicate/overlap and copied classifiers no longer exist.</expected>
  </verification>
  <commit>refactor: centralize legacy cycle fact classification</commit>
</task>

### Task 7: Make classification complete and bounded beyond 100 rows

<task id="G1.R7" name="Paginated per-user conflict scan" tdd="true">
  <description>Replace truncated semantic context with a resumable indexed sweep that is complete for arbitrarily large user histories.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <modify>convex/internal/cycleDataAudit.ts</modify>
    <modify>convex/internal/cycleDataAudit.test.ts</modify>
    <modify>convex/internal/cycleFactsMigration.ts</modify>
    <modify>convex/internal/cycleFactsMigration.test.ts</modify>
  </files>
  <steps>
    <step>Add the minimum additive run/work-state fields or table and indexes needed to persist a `(userId,startDate,_id)` scan cursor and conflict state; never store an unbounded array in one document.</step>
    <step>Iterate `periodEvents` in `by_user_and_start` order using bounded pages. Carry duplicate-start state across page boundaries.</step>
    <step>Persist active prior intervals as bounded work rows indexed by run/user/end (or an equally complete indexed representation), pruning intervals whose exact end precedes the next start. Open intervals remain active.</step>
    <step>When any active interval intersects the current row, mark overlap from raw dates. Ensure a duplicate pair is deterministically classified as duplicate before overlap.</step>
    <step>Store per-row derived classification for the run so audit aggregation and migration annotation consume identical results without rescanning an unbounded user in one transaction.</step>
    <step>Use scheduler continuation and idempotent run/cursor checks. Cap each transaction's reads/writes and expose only suppressed aggregate counts/progress.</step>
    <step>Add 101+ row tests where rows 101/102 duplicate and rows 103/104 overlap, including a conflict crossing a page boundary and rerun/resume behavior.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/cycleDataAudit.test.ts convex/internal/cycleFactsMigration.test.ts</command>
    <expected>Exit 0; conflicts after row 100 and across cursors are counted/classified exactly once; every transaction remains bounded.</expected>
  </verification>
  <commit>fix: complete bounded legacy conflict scans</commit>
</task>

### Task 8: Attest actual migration environment identity

<task id="G1.R8" name="Server-attested migration target" tdd="true">
  <description>Make annotation authorization depend on immutable server deployment identity and an allowlisted server capability, not caller input.</description>
  <files>
    <modify>convex/internal/cycleFactsMigration.ts</modify>
    <modify>convex/internal/cycleFactsMigration.test.ts</modify>
    <modify>convex/schema.ts</modify>
    <modify>.github/workflows/deploy.yml</modify>
    <modify>scripts/tests/deploy-workflow.test.sh</modify>
    <modify>docs/runbooks/cycle-facts-migration.md</modify>
  </files>
  <steps>
    <step>Define the server identity source from deployment-managed configuration set by the deployment workflow, including environment class and exact deployment selector. A client/caller argument must never populate it.</step>
    <step>Require both an actual non-production class (`dev|preview|staging`) and an exact allowlisted selector/capability for annotation mode. Missing, production, malformed, or mismatched identity fails closed.</step>
    <step>Retain `targetDeployment` only as operator metadata and require it to match the attested selector for typo detection; matching metadata alone grants nothing.</step>
    <step>Persist the attested selector/class on the run for evidence and reject resume if current server identity differs.</step>
    <step>Make deployment policy tests prove production cannot receive the annotation capability and that ordinary app/runtime variables cannot spoof it.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/cycleFactsMigration.test.ts &amp;&amp; bash scripts/tests/deploy-workflow.test.sh</command>
    <expected>Exit 0; production and caller-label spoofing fail, approved non-production identity passes, and resume detects identity drift.</expected>
  </verification>
  <commit>fix: attest cycle migration deployment identity</commit>
</task>

### Task 9: Reconcile authority and durable policy tests

<task id="G1.R9" name="Gate 1 authority contract" tdd="true">
  <description>Make D-008, D-009, D-012 and policy tests express one durable contract.</description>
  <files>
    <modify>docs/decisions/major-release-decision-register.md</modify>
    <modify>docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md</modify>
    <modify>docs/plans/README.md</modify>
    <modify>docs/evidence/cycle-facts-gate-1/REPORT.md</modify>
    <modify>docs/runbooks/cycle-facts-migration.md</modify>
    <modify>scripts/tests/cycle-facts-plan.test.sh</modify>
  </files>
  <steps>
    <step>State that D-008 and D-009 authorize their additive/default-off contracts under feature-first delivery; remove historical Gate 0 approval wording everywhere.</step>
    <step>Make D-012's table and detail agree with the authority baseline above: production feature exposure and destructive lifecycle behavior remain blocked; additive/default-off deployment is separate.</step>
    <step>Replace greps for mutable qualification prose with durable assertions: Convex-only exact-true flag, default-off behavior, legacy compatibility branch, no destructive enabled-mode delete, migration identity attestation, no stale Gate 0 switches, and external authenticated evidence requirement.</step>
    <step>Do not make a script assert that authenticated qualification passed. It may assert that the evidence document names the required external artifact and does not authorize exposure while absent/failed.</step>
  </steps>
  <verification>
    <command>npm run test:cycle-facts-plan &amp;&amp; bash scripts/tests/deploy-workflow.test.sh</command>
    <expected>Exit 0; tests enforce durable invariants and allow qualification status text to truthfully remain pending.</expected>
  </verification>
  <commit>docs: reconcile Gate 1 authority and policy</commit>
</task>

### Task 10: Requalify, update evidence, and preserve Gate 2 rebase

<task id="G1.R10" name="Review remediation qualification" tdd="false">
  <description>Run deterministic checks, retain honest external-evidence status, and hand off the final Gate 1 base to Gate 2.</description>
  <files>
    <modify>e2e/cycle-facts.spec.ts</modify>
    <modify>docs/evidence/cycle-facts-gate-1/REPORT.md</modify>
    <modify>docs/plans/README.md</modify>
    <modify>docs/runbooks/cycle-facts-migration.md</modify>
  </files>
  <steps>
    <step>Run focused tests after each task, then full unit, typecheck, build, policy suites, and `git diff --check` at the final remediation SHA.</step>
    <step>Run `npx convex codegen` only against an approved non-production Convex deployment; record blocked if identity/configuration is unavailable.</step>
    <step>Run both release projects in flag-off and enabled modes using approved Clerk/Convex fixtures. Missing setup, skips, or fixture-stage failure is red external evidence, not a fake green.</step>
    <step>Update the evidence report with exact SHA, commands, CI run IDs, projects, skip count, and retained redacted artifacts. Separate deterministic, authenticated, deployment, and production evidence.</step>
    <step>Re-fetch unresolved PR #35 threads and map each to code/test evidence. Do not resolve or reply unless separately authorized.</step>
    <step>Freeze provisional Gate 2 worktrees based on `a6d3966`. After Gate 1 remediation lands on `main`, rebase/cherry-pick Gate 2 in dependency order and rerun all Gate 2 focused/full tests. In particular, adapt `cycleState` and `cycleReadModel` to Task 5's purpose-aware interfaces.</step>
    <step>Preserve `gate-2/evidence` commit `3c8e74d` as historical provisional evidence; do not claim it qualifies the rebased code. Create new evidence only after requalification.</step>
  </steps>
  <verification>
    <command>npm run test:unit -- --run &amp;&amp; npm run typecheck &amp;&amp; npm run build &amp;&amp; npm run test:cycle-facts-plan &amp;&amp; bash scripts/tests/ci-workflow.test.sh &amp;&amp; bash scripts/tests/deploy-workflow.test.sh &amp;&amp; git diff --check</command>
    <expected>Exit 0 for deterministic checks at one exact SHA. Authenticated desktop/mobile and deployment/production evidence are reported separately and remain pending unless actually retained.</expected>
  </verification>
  <commit>test: qualify Gate 1 review remediation</commit>
</task>

## Rollback and recovery

1. Before exposure, rollback is deployment of the previous compatible frontend/backend pair or disabling `CB_CONNECT_CYCLE_FACTS_V1`; disabled prediction reads must be proven compatible by Task 2.
2. Optional schema/index additions are forward-compatible and are not removed during emergency rollback. Do not roll back by deleting annotation/work rows until the recovery plan proves they are isolated and disposable.
3. Stop a migration by leaving `scheduleNext` false or disabling its server-side non-production capability. Existing run/work rows remain resumable and contain no raw evidence output.
4. Production annotation and destructive cleanup are outside this plan. D-012 and explicit recovery approval are required before either.
5. If Gate 2 rebase fails semantically, keep Gate 2 provisional and return to this plan; do not weaken Gate 1 eligibility or authority to make the rebase green.

## Required final evidence

- Exact branch/SHA and PR head; clean/dirty status and diff scope.
- All unresolved thread URLs mapped to task, implementation commit, focused test, and current resolution state.
- Focused and full Vitest counts; typecheck/build/policy output; Convex codegen status.
- Flag-off and enabled authenticated Playwright results for `release-desktop` and `release-mobile`, with zero skips required for a pass.
- Actual non-production Convex identity proof for migration tests, with secrets and raw provider responses excluded.
- No production flag enablement, migration, merge, deployment, push, thread reply, or thread resolution unless separately authorized.
- Gate 2 old base (`a6d3966`), final Gate 1/main base, rebase mapping, and fresh post-rebase qualification; prior `3c8e74d` evidence labeled provisional/historical.

## Risks and blockers

- **Schema/orchestration risk:** Complete overlap detection across unbounded histories requires persisted bounded scan state. If Convex transaction/index constraints invalidate the proposed sweep, stop and revise the plan rather than restoring `MAX_USER_CONTEXT` truncation.
- **Semantic risk:** A date can be an exact start and have an approximate end. Any adapter that collapses those into one boolean will reintroduce the Gate 2/Gate 3 defect.
- **Concurrency risk:** Explicit event IDs do not replace optimistic concurrency; every enabled-mode update must also check `expectedAuthorityVersion` and primary override markers.
- **Rollback risk:** Flag-off is credible only when both writes and prediction/notification reads follow legacy semantics. Test both against the same deployment artifact.
- **Authority blocker:** D-012 and a separate exposure decision still block production feature exposure and destructive lifecycle behavior.
- **External-evidence blocker:** Approved Clerk/Convex fixture identity and credentials are required for authenticated desktop/mobile qualification. A setup failure remains a blocker, not a skip or policy-test pass.
- **Gate 2 blocker:** Every provisional Gate 2 branch predates final PR #35 remediation and must be rebased/requalified after Gate 1 lands.
