# Gate 4 qualification evidence

## Current candidate — 2026-10-13

**Status: implementation, deterministic checks, and authenticated synthetic populated-inbox qualification pass on the tested source SHA. Production release readiness remains blocked by the separate promotion/rollback failure and owner-gated decisions.** The tested source candidate is f1a3db50bb9a9579a31c46860336b10b31ba5cd4 on gate-4/final-candidate-20261012. This report update is documentation-only.

### Exact-SHA deterministic evidence

The following checks ran against source SHA f1a3db50bb9a9579a31c46860336b10b31ba5cd4:

| Check | Result |
|---|---|
| npm run test:unit -- --run | Pass: 78 files, 900 tests |
| Focused inbox pagination regression | Pass: 9 tests |
| npm run typecheck | Pass |
| npm run build | Pass with inert synthetic Clerk and Convex values; no deployment |
| npm audit --omit=dev | Pass: 0 vulnerabilities |
| CI workflow, cycle-facts, Convex safe-exec/command, and fixture-evidence policy scripts | Pass; safe-exec negative cases emitted expected rejection output |
| Auth-fixture, release-smoke, deploy-workflow, Convex-env-reconciliation, and prediction-runner policy scripts | Pass |
| Golden cycle benchmark | Pass; source commit is f1a3db50bb9a9579a31c46860336b10b31ba5cd4, source tree clean, verdict synthetic_not_evidence |
| git diff --check | Pass |

GitHub CI run [38302974654](https://github.com/Zburgers/cb-connect/actions/runs/38302974654) passed deterministic qualification on this exact SHA. Its authenticated release smoke and production-configured immutable-release jobs were skipped by the workflow's current scope; the local authenticated E2E below is separate evidence.

The build used inert synthetic Clerk and Convex values. The benchmark is synthetic evidence only and does not qualify promotion.

### Review findings and remediation

The targeted review on prior head 30f357d found two P2 pagination defects: a dismissed buffered inbox item could reappear, and Convex split pagination could discard buffered overflow. Commit 93f269f1f27001d44df1cb3f47a38da1f39cb8f8 fixes both in the shared query/helper path. Revalidation now requires the item to remain current and owned by the viewer. Split cursors are wrapped and validated; bounded split subqueries preserve overflow, and source reads are capped at 200 rows. The regressions cover a dismissed buffered item and a split range with 21 valid items on one side and one on the other. Generated Convex API declarations were synchronized in f1a3db50bb9a9579a31c46860336b10b31ba5cd4.

No issuer verification, cross-tenant isolation, or fixture boundary was weakened. The single targeted read-only final review approved changes from 30f357d through f1a3db50bb9a9579a31c46860336b10b31ba5cd4 with no P0–P2 findings. It confirmed split overflow preservation, bounded cursor validation and source reads, fail-closed item revalidation, and unchanged tenant, issuer, and fixture controls. Test results remain author evidence.

### Issuer handling and authenticated populated-inbox E2E

The approved test Clerk environment is holy clerk, with issuer https://holy-clam-29.clerk.accounts.dev. The test issuer is accepted only with the exact isolated backend dev:hallowed-hummingbird-284 and the approved fixture cleanup path. The production issuer remains exactly https://clerk.cb.builtbynaki.tech; foreign issuers remain rejected. loadAuthEnvironment continues to enforce the approved test host, test keys, Convex deployment, and Convex URL. Authenticated sign-in and fixture setup succeeded under those checks; no Clerk issuer mismatch occurred on the final runs.

Source SHA f1a3db50bb9a9579a31c46860336b10b31ba5cd4 was deployed only to dev:hallowed-hummingbird-284. Backend identity reported compatibility v1, deployment dev:hallowed-hummingbird-284, and deployed-at 2026-10-12T20:19:15.000Z. e2e/notifications-in-app.spec.ts passed:

| Project | Result |
|---|---|
| release-desktop | 3 passed, 0 failed, 0 skipped |
| release-mobile | 3 passed, 0 failed, 0 skipped |

Both projects exercised populated partner delivery, sender inbox isolation, read/dismiss, revocation, and primary/partner preferences. The unique run evidence is under e2e/.evidence/local-g4-f1a3db5-qualified-20261012T203228Z/. Both teardown proofs report remaining=false and zero rows in every approved fixture table. All five notification flags were enabled only on the isolated test deployment for the run, restored by an exit trap, and verified false afterward.

The first local attempt exposed a machine-level browser mismatch: the installed Playwright 1.59.1 expected Chromium 147.0.7727.15, but that revision was absent. Its installer stalled after downloading the archive, so it was stopped without replacing other cached browsers. The authenticated E2E then passed using the existing Chrome for Testing 151.0.7922.34 via the explicit Playwright executable path. A separate mobile retry initially reused the desktop fixture run ID and was correctly rejected by the fixture guard; the final desktop and mobile runs used distinct run IDs. The pinned Playwright browser revision remains unverified.

An older .last-run.json records the pre-fix preference helper failure: Playwright check was called when “Message activity” was already checked. The helper now checks state before toggling; final desktop and mobile preference cases pass.

### Production promotion and rollback

Main deployment run 38132266518 at e08a2a1 failed both Verify qualified release promotion and Restore prior verified release after failed promotion. PM2 reported online, but release verification failed. scripts/verify-release.sh reported only that its /api/health curl failed, so the workflow log does not expose the exact HTTP, TLS, or connection cause. No successful promotion or rollback recheck has been recorded. This remains a release blocker.

### Release boundaries

D-011, D-012, D-013, and D-015 remain in force. Notification behavior remains default-off and in-app-only; no external provider or POST path was enabled. The exact candidate was deployed only to the approved isolated test backend; all five notification flags were restored to false after E2E. No production flags were changed, no production deployment or merge to main was performed, and no destructive retention changes were made. The outdated-prediction-snapshot rule remains intact: dependent notification work stays suppressed until a current authoritative snapshot exists.

**Conclusion:** implementation, deterministic checks, and authenticated synthetic populated-inbox qualification pass on source SHA f1a3db50bb9a9579a31c46860336b10b31ba5cd4. Gate 4 is not production release-qualified: run [38132266518](https://github.com/Zburgers/cb-connect/actions/runs/38132266518) left production promotion and rollback verification failed, and owner-gated decisions remain outstanding. The single targeted review approved source range 30f357d through f1a3db50bb9a9579a31c46860336b10b31ba5cd4 with no P0–P2 findings. The pinned Playwright browser build was not verified; authenticated desktop/mobile E2E passed on Chrome 151. No production deployment, merge, or production flag change was performed.

## Historical checkpoint (retained; not current evidence)

**Status: implementation in progress; not qualified or complete.** This report
records local evidence for `gate-4/contract-and-integration` at
`a4c36b28d6957e4d965e026ae01417cff5a9ee06` (also the observed
`origin/gate-4/contract-and-integration` head). It does not attest a deployed
backend, runtime flags, authenticated user behavior, or production readiness.

## Local evidence at the recorded SHA

The following results were captured on the exact SHA above in the prior local
qualification pass. They were not rerun while writing this report.

| Check | Result | Scope |
|---|---|---|
| `npm run test:unit -- --run` | Pass: 78 files, 892 tests | Deterministic local unit suite |
| `npm run typecheck` | Pass | TypeScript check, run after build |
| `npm run build` | Pass | Local build with inert qualification URLs/keys and explicit build metadata; no deploy |
| `npm run test:convex-safe-exec` | Pass | Safe-exec policy checks; negative cases intentionally print errors |
| `npm run test:convex-command-policy` | Pass | Command policy |
| `npm run test:fixture-evidence-boundary` | Pass | Fixture evidence boundary |
| `npm run test:ci-workflow` | Pass | CI workflow policy |
| `bash scripts/tests/deploy-workflow.test.sh` | Pass | Deploy workflow policy tests; no deployment |
| `npx playwright test e2e/notifications-in-app.spec.ts --list` | Pass: 4 tests discovered | Discovery only; no browser/authenticated test executed |
| `git diff --check HEAD~3 HEAD` and `git show --check` | Pass | Recent integrated commits |

An independent exact-root review approved the root at this SHA with no P0–P2
findings. The reviewer did not run tests; the local results above are author
evidence. Earlier lane reviews and test results are not substitutes for
integrated authenticated qualification.

## Outstanding qualification

- [ ] Run the full notification failure matrix and repository gates on the
  final candidate SHA, including focused changed-suite logs.
- [ ] Exercise populated, empty, unavailable, read, dismiss, correction,
  revocation, primary, and partner cases on authenticated desktop and mobile.
  The current notification E2E accepts empty/unavailable inboxes and explicitly
  does not seed a populated inbox; test discovery is not coverage.
- [ ] Close the relationship-event delivery seam: message producers persist
  typed events, but no generic event-to-delivery consumer currently creates a
  logical delivery for them. The existing scheduler delivery path covers
  scheduled prediction work only; that template remains blocked under D-011.
  Any fixture-only projector evidence must be labeled as such and cannot stand
  in for this runtime path.
- [ ] Run protected exact-head authenticated qualification against the
  isolated `dev:hallowed-hummingbird-284` test backend, with explicit target
  and flag attestation, zero skips, and zero fixture residue. The current
  main-trusted workflow accepts only PRs 49–51 and runs the release smoke, not
  this notification spec; it cannot qualify this branch as written.
- [ ] Record privacy/content review for the event/template catalog, legacy-log
  inventory, and two unrelated synthetic couples. Health/Late copy and
  projection remain denied pending D-011.
- [ ] Record the D-012 decision or explicit deferral. No retention/deletion
  migration or production exposure is authorized while it is unresolved.
- [ ] Capture exact-target operations evidence: runtime identity and flags,
  name-only Discord secret absence, queue/recovery counters, kill controls,
  worker outage/recovery, bounded latency/SLO comparison, and rollback artifact.
- [ ] Keep D-015 pilot approval and D-013 real-outcome claims out of scope.

## Boundaries and blockers

All notification behavior remains default-off and in-app-only. No external
provider or POST path is enabled. No production flags were changed and no
deployment was run. No destructive retention, deletion, or migration was
performed. Late/health-adjacent copy remains blocked under D-011.

The protected authenticated workflow is sourced from trusted `main`, is
restricted to PRs 49–51, and deploys candidate Convex code only to the isolated
test backend. Updating the trusted workflow or merging a candidate would cross
the separate main-CI deployment boundary; this report makes no such change.
The owner-confirmed Clerk issuer is
`https://clerk.cb.nakshatraneuratech.dev`; domain renewal is outstanding and
TLS discovery has not been validated. Unresolved legacy identity rows therefore
remain fail-closed. The separate `holy clerk` synthetic test environment is
not production issuer evidence.

**Conclusion:** Gate 4 implementation has substantial local coverage, but exact
authenticated qualification, privacy/operations evidence, and owner-gated
decisions remain open. Do not mark Gate 4 complete or call an application PR
ready until the outstanding evidence is obtained on one exact candidate SHA.
