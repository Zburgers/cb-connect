# Gate 4 qualification evidence

## Current candidate — 2026-10-12

**Status: exact-SHA deterministic checks pass; protected authenticated inbox qualification and production operations remain unresolved.** The application-code candidate is 9df43926bac8e51ae6e5266b51f9fd8310f52c51 on gate-4/final-candidate-20261012, based directly on origin/main e08a2a1b02ec186ae67954f9197bb37340e6c971. The evidence below applies to that implementation SHA; it does not claim authenticated E2E or release qualification.

### Exact-SHA deterministic evidence

These checks ran in a clean detached worktree at 9df43926bac8e51ae6e5266b51f9fd8310f52c51. The report edit is separate from that application-code SHA.

| Check | Result |
|---|---|
| npm run typecheck | Pass |
| npm run test:unit | Pass: 78 files, 897 tests |
| npm run build | Pass with an inert synthetic Convex URL; no deployment |
| npm audit --omit=dev | Pass: 0 vulnerabilities |
| npm run test:convex-safe-exec | Pass; expected policy-rejection cases were exercised |
| npm run test:convex-command-policy | Pass |
| npm run test:fixture-evidence-boundary | Pass |
| npm run test:ci-workflow | Pass |
| npm run test:cycle-facts-plan | Pass |
| Prediction-runner, deploy-workflow, release-smoke-workflow, and Convex-env-reconciliation shell tests | Pass |
| npm run benchmark:cycle:golden | Pass; source commit is 9df43926bac8e51ae6e5266b51f9fd8310f52c51, source tree clean, verdict synthetic_not_evidence |
| git diff --check | Pass |

The golden benchmark is synthetic evidence only and does not qualify promotion. Browser test discovery and authenticated browser execution are not included in these results.

### Consolidated reviews

The exact-SHA architecture and reliability re-review found no confirmed P0, P1, or P2 findings and confirmed that the earlier pagination-argument and repeated-source-revocation findings are resolved. The reviewer did not run tests; the deterministic results above are separate local evidence.

The exact-SHA static privacy and security review found no confirmed P0, P1, or P2 findings. It reviewed authorization, recipient and partner isolation, sensitive health data, issuer handling, revocation and freshness races, stale-snapshot suppression, inbox projection, fixture boundaries, and default-off/in-app-only enforcement. The reviewer did not run tests; those results are separate local evidence.

### Relationship delivery and authenticated inbox qualification

The runtime relationship-message path is implemented: the message mutation writes an immutable typed event and schedules the durable event consumer; policy and preference checks create the logical in-app delivery; the consumer projects the delivery into the recipient inbox. The E2E spec exercises a populated partner inbox, verifies the sender inbox stays empty, marks and dismisses a delivered item, then revokes partner access and checks that a pending item disappears.

The authenticated E2E spec was not executed. An earlier fixture setup attempt stopped before creating a fixture-run marker or inbox event because getLegacyClerkSubject rejects the approved synthetic issuer https://holy-clam-29.clerk.accounts.dev. No issuer allowlist or verification logic was weakened. A fresh GET to that issuer's discovery endpoint returned HTTP 200 over TLS; a fresh TLS request to the intended custom issuer https://clerk.cb.nakshatraneuratech.dev still fails with “tlsv1 unrecognized name”. Legacy identity rows remain fail-closed. The protected authenticated run therefore has not demonstrated populated delivery, read/dismiss, partner separation, revocation, zero skips, or fixture cleanup.

A prior isolated test-target deployment and flag attestation applied to code SHA d946a9181a1f5298b58e77c33c43d76434495df9, not this candidate. No deployment of 9df43926bac8e51ae6e5266b51f9fd8310f52c51 was performed, and no production target or flag was changed.

### Existing source PRs

All four source PRs remain open drafts based on gate-4/contract-and-integration. The latest observed heads had no submitted reviews. Their exact deterministic failures were:

| PR | Head | Failure | Other checks |
|---|---|---|---|
| #57 | c5d2f52 | Dependency audit reported three production dependency vulnerabilities, including the sharp/librsvg advisory | Authenticated release smoke and production-configured checks skipped |
| #58 | 50384b3 | Same dependency-audit failure on its older base | Authenticated release smoke and production-configured checks skipped |
| #59 | a177e70 | Unit test failed because event idempotency lacked relationshipMembershipId; the integrated candidate includes it | Authenticated release smoke and production-configured checks skipped |
| #60 | 1456ed6 | Same dependency-audit failure as #57/#58 | Authenticated release smoke and production-configured checks skipped |

The candidate audit reports zero production dependency vulnerabilities and its full unit suite passes. These source PRs will be marked superseded only after the consolidated PR against main exists; their source branches will be preserved.

### Production promotion and rollback

Main deployment run 38132266518 at e08a2a1 failed both Verify qualified release promotion and Restore prior verified release after failed promotion. PM2 reported online, but release verification failed. scripts/verify-release.sh reported only that its /api/health curl failed, so the workflow log does not expose the exact HTTP, TLS, or connection cause. A successful promotion or rollback recheck has not been recorded. This remains a release-operations blocker.

### Release boundaries

D-011, D-012, D-013, and D-015 remain in force. Notification behavior remains default-off and in-app-only; no external provider or POST path was enabled. No production flags, destructive retention changes, deployment, or merge to main were authorized or performed. The outdated-prediction-snapshot rule remains intact: dependent notification work stays suppressed until a current authoritative snapshot exists.

**Conclusion:** the integrated implementation has passing exact-SHA deterministic evidence and a clean architecture review. Authenticated inbox qualification, exact-candidate environment attestation, and production promotion/rollback evidence are still outstanding. This candidate is not release-qualified.

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
