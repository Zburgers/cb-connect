# Gate 2 four-phase state semantics evidence boundary

**As of:** 2026-08-21

**Status:** Provisional engineering evidence only. This document is not a release qualification, production authorization, pilot authorization, or browser/manual certification.

## Evidence identity

- Worktree: `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-2`
- Branch: `gate-2/four-phase-state-semantics`
- Stacked base: `origin/gate-1/trustworthy-cycle-facts` at `db2753011e9da64c56d511081b22525e7bfdbe3f`; the Gate 2 branch is published at `origin/gate-2/four-phase-state-semantics`; no merge or deployment is claimed.
- Reconciliation application head before this evidence update: `1124bc2` (`fix: preserve Gate 2 exposure and coverage semantics`). The current PR head is tracked separately by GitHub; this report update is documentation-only and does not qualify later commits.
- Provisional origin/main relationship: local `origin/main` at `d69b3cde59e20b59dffe408fde37c917cd3f60e8`; `git merge-base HEAD origin/main` is that same SHA, so the stacked Gate 2 branch is descended from the current local main through the Gate 1 base.
- This is not the final post-PR-35 integration base. The reviewed reconciliation is pushed to the stacked Gate 2 branch; no merge, deploy, or production claim is made.

The evidence is bounded to the committed Gate 2 plan, architecture-audit direction, the implementation commits present on this branch, local command output, and the current coordinator-visible PR status. No application row IDs, user identities, auth responses, tokens, secrets, or raw fixture values are retained here.

## Implemented Gate 2 slices

The following slices are present in the provisional branch. “Implemented” describes code and local tests present at this head; it does not mean release-qualified.

| Slice | Provisional implementation evidence | Boundary covered |
|---|---|---|
| G2.1 | Reconciliation application head `1124bc2` | Pure non-wrapping cycle-state contract, prediction bounds, invalid-date/timezone handling, and local-time Late boundary. |
| G2.2 | Reconciliation application head `1124bc2` | Primary prediction-pause setting, authority binding, and safe mutation behavior. |
| G2.3 | Reconciliation application head `1124bc2` | Privacy-safe reduced partner projection with share-off suppression and forbidden-field coverage. |
| G2.4 | Reconciliation application head `1124bc2` | Authoritative dashboard read-model seam using purpose-aware start anchors, exact-coverage projection, settings, local date/timezone, and the bounds adapter; additive nullable `cycleStateV1`. |
| G2.5 | Reconciliation application head `1124bc2` | History alignment with cycle-state semantics, including the same exact-coverage projection as the dashboard adapter. |
| G2.6 | Reconciliation application head `1124bc2` | Capability-gated primary presentation; v1 rendering is conservative and does not reuse deterministic legacy phase claims. |
| G2.7 | Reconciliation application head `1124bc2` | Reduced partner presentation that does not expose primary-only cycle state or raw event details; entry is driven by server-derived effective exposure. |
| G2.8 | Reconciliation application head `1124bc2` | Copy contract, generic Late/Unknown/Paused treatment, estimate labeling/disclaimer requirements, and seed reconciliation. |
| G2.9 | Reconciliation application head `1124bc2` | Property/timezone/invariant tests for state precedence, non-wrapping behavior, exact coverage, and privacy boundaries. |
| G2.10 | Reconciliation application head `1124bc2` | Convex-only exact-boolean capability boundary; absent or non-literal-true capability remains disabled. |
| G2.11 | Reconciliation application head `1124bc2` | Release journey definitions for enabled/disabled desktop and mobile paths. The journeys were collected locally, but authenticated qualification was not achieved. |

## Current review reconciliation

The reconciliation application head at `1124bc2` carries the reviewed PR #36
reconciliation with narrow additive changes and regression coverage:

- New client capability reads fail closed when an older Convex deployment does
  not expose the optional capability function; explicit server `false` remains
  disabled and explicit server `true` remains preserved.

- Partner `cycleStateV1` is projected in Convex before return. The enabled
  partner payload contains only the reduced projection or `null`; React no
  longer imports or applies the primary projection as a privacy control.
- Gate 1 exact-start versus exact-coverage semantics now survive both the
  dashboard and timeline adapters: an approximate end remains history data and
  an anchor, but cannot produce `RECORDED_EXACT` after the exact start.
- An exact open start is Recorded only on its observed start date. Later open
  dates remain estimated within bounds and never receive a fabricated end or
  period-length-based Recorded coverage.
- Flag-off legacy reads filter Gate 1 tombstones before selecting the recent
  fact, so rollback cannot resurrect deleted data.
- Gate 2 dashboard/UI behavior requires the independent Gate 1 capability;
  partner presentation additionally consumes the server-derived
  `cycleStateV1Exposed` signal rather than reconstructing authorization from
  the two raw capability booleans. An exposed `null` remains the v1
  privacy-safe empty state.
- D-011 ordinary-user exposure is technically fail-closed. Only the existing
  same-run fixture/test audience can receive v1 while approval is absent.
- Authenticated E2E now queries the partner dashboard payload and checks the
  share-on projection plus share-off/revocation null behavior without logging
  secrets, identifiers, dates, or auth responses.

## State and exposure boundary

The intended projection represented by the implementation is:

| State | Evidence-bound behavior |
|---|---|
| Recorded | Requires eligible exact coverage; approximate, legacy-unknown, tombstoned, malformed, or otherwise ineligible facts cannot become exact. |
| Calendar estimate | Estimate is explicitly labeled; an open event is not promoted to Recorded merely because a configured period length exists. Estimated ovulation retains a disclaimer slot. |
| Late | Uses the next local calendar day after the prediction bound; no modulo rollover, biological phase claim, or phase guidance. |
| Unknown | Used when exact coverage or prediction context is insufficient; no fabricated phase or cycle-day claim. |
| Prediction paused | Explicit pause has precedence and suppresses phase guidance. |
| Partner share-off | Partner projection returns the safe empty state and does not leak cycle state, event identifiers, dates, timezone, notes, or other primary details. |

The v1 path is default-off and capability-gated. D-011 remains an exposure boundary: passing engineering copy/presentation tests does not approve health-adjacent copy for ordinary users. D-015 remains a pilot boundary: no cohort, percentage, or pilot authorization is asserted.

## Local verification evidence

Dependencies were provisioned from the committed lockfile with:

```text
npm ci --ignore-scripts --no-audit --no-fund
```

Focused commands run at provisional HEAD and observed results:

| Scope | Exact command | Observed result |
|---|---|---|
| G2.1 | `npm run test:unit -- --run convex/_helpers/predictionBounds.test.ts convex/_helpers/cycleState.test.ts` | 2 files, 23 tests passed. |
| G2.2 | `npm run test:unit -- --run convex/mutations/periods.test.ts convex/queries/history.test.ts` | 2 files, 39 tests passed. |
| G2.3 | `npm run test:unit -- --run convex/_helpers/partnerCycleProjection.test.ts` | 1 file, 21 tests passed. |
| G2.4 | `npm run test:unit -- --run convex/_helpers/cycleReadModel.test.ts convex/queries/dashboard.test.ts` | 2 files, 18 tests passed after reconciliation. |
| G2.5 | `npm run test:unit -- --run convex/_helpers/timelinePhases.test.ts convex/queries/history.test.ts` | 2 files, 21 tests passed. |
| G2.6 | `npm run test:unit -- --run components/dashboard/cycleStatePresentation.test.ts` | 1 file, 11 tests passed. |
| G2.7 | `npm run test:unit -- --run components/partner/partnerCyclePresentation.test.ts` | 1 file, 8 tests passed. |
| G2.8 | `npm run test:unit -- --run components/dashboard/cycleStateCopy.test.ts` | 1 file, 11 tests passed. |
| G2.8 policy | `bash scripts/tests/cycle-state-copy.test.sh` | `Gate 2 copy policy: PASS`. |
| G2.9 | `npm run test:unit -- --run convex/_helpers/cycleState.property.test.ts convex/_helpers/cycleState.timezone.test.ts` | 2 files, 15 tests passed. |
| G2.10 | `npm run test:unit -- --run convex/_helpers/cycleStateFlag.test.ts convex/queries/capabilities.test.ts` | 2 files, 13 tests passed. |
| G2.10 policy | `bash scripts/tests/deploy-workflow.test.sh` | Qualified-artifact, durable-promotion, and rollback policy: PASS. |
| Reconciliation focus | `npm run test:unit -- --run convex/_helpers/cycleReadModel.test.ts convex/_helpers/cycleStateExposure.test.ts convex/queries/dashboard.test.ts convex/_helpers/partnerCycleProjection.test.ts` | 4 files, 44 tests passed. |
| G2.11 collection | `npm run test:e2e:release -- --list e2e/cycle-state.spec.ts --project=release-desktop --project=release-mobile` | 2 tests collected: one desktop and one mobile. Collection is not execution or qualification. |

Full local verification commands and observed results:

| Exact command | Observed result |
|---|---|
| `npm run test:unit -- --run` | 43 files, 347 tests passed. |
| `npm run typecheck` | Passed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.invalid npm run build` | Passed with exit 0 after compilation and static generation; the build listed 13 routes. |
| `bash scripts/tests/cycle-state-copy.test.sh && bash scripts/tests/deploy-workflow.test.sh && bash scripts/tests/ci-workflow.test.sh` | All three policy checks passed. |
| `npm audit --omit=dev` | 0 vulnerabilities. |
| `git diff --check` | Passed. |

Post-reconciliation deterministic verification was rerun against application
head `1124bc2` before this documentation update:

| Exact command | Observed result |
|---|---|
| `npm run test:unit -- --run convex/_helpers/cycleReadModel.test.ts convex/_helpers/timelinePhases.test.ts convex/queries/dashboard.test.ts convex/queries/history.test.ts convex/_helpers/cycleStateExposure.test.ts components/partner/partnerCyclePresentation.test.ts` | 6 files, 63 tests passed. |
| `npm run test:unit -- --run` | 43 files, 357 tests passed. |
| `npm run typecheck` | Passed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.invalid npm run build` | Passed with exit 0. |
| `npm audit --omit=dev` | 0 vulnerabilities. |
| `git diff --check` | Passed. |
| `npm run test:cycle-facts-plan` | `Gate 1 plan policy: PASS`. |
| `bash scripts/tests/cycle-state-copy.test.sh` | `Gate 2 copy policy: PASS`. |
| `bash scripts/tests/deploy-workflow.test.sh` | Deployment policy: PASS. |
| `bash scripts/tests/ci-workflow.test.sh` | CI qualification/workflow policy: PASS. |

## Isolated local runtime attempt

An earlier provisional head was run on an isolated local port with an inert Convex URL:

```text
npx next dev --port 3111
```

Observed responses were root `200`, health `200`, readiness `503` (expected
without a reachable Convex deployment), and signed-out dashboard/partner
routes `404`. The server was stopped after the check. Chrome DevTools/browser
manual validation was unavailable because no X server exists.

An earlier no-URL attempt returned HTTP 500 because the Convex client could
not be constructed without an address. No authenticated fixture, browser
journey, manual UI qualification, secret, token, or auth response is recorded.

## PR #35 and release blockers

At the reviewed heads before this reconciliation, protected CI was current as
follows: PR #35 head `3b98006f` and PR #36 head `3c9d98f4` each had green
deterministic qualification and green repository authenticated release smoke;
the production-configured immutable release check was skipped in both runs
(`32451060427` and `32451260251`, respectively). The generic authenticated
smoke is not the dedicated Gate-2 enabled/disabled desktop/mobile qualification
matrix and does not establish manual or production certification.

Both PRs remain open, PR #35 remains draft, and neither is a merged final base.
The current post-reconciliation heads and their fresh CI state are tracked by
GitHub after push; no merge, deployment, production exposure, Gate-2 release
qualification, or browser/manual certification is claimed by this report.

These boundaries remain even though the stale fixture-link failure recorded by
the earlier provisional report is no longer the current protected-CI status.

The local environment also lacks the approved authenticated fixture inputs
(`CLERK_TEST_ENVIRONMENT_NAME`, Clerk test key/configuration, and the approved
Convex test deployment/URL), so no authenticated retry was performed. This is
an environment/setup blocker, not a product-journey result.

## Required next gates

1. Complete human review/approval of PR #35, then manually merge PR #35 through the responsible integration path.
2. Fetch the resulting final `origin/main`; verify whether PR #36's `db27530` stacked base is still exact, and rebase/requalify it if the merge changes the base SHA.
3. Rerun full build, typecheck, unit, policy, diff, and approved isolated non-production Playwright execution on the final stack. Enabled and disabled desktop/mobile runs must complete with zero skips before claiming release qualification.
4. Obtain the D-011 copy and ordinary-user exposure decision; retain the capability default-off boundary until approved.
5. Obtain the D-015 pilot cohort/percentage authorization; no pilot rollout is authorized by this report.
6. Make any production release decision only after the preceding evidence is green and the separate production controls are satisfied.

## Redaction and claim policy

This report intentionally excludes raw application identifiers, period/event identifiers, user identities, Clerk details, auth responses, tokens, secrets, and fixture values. Commit references are retained only to identify the provisional implementation slices. The report does not claim a browser/manual result, authenticated release qualification, production readiness, merge, deploy, or exposure authorization.
