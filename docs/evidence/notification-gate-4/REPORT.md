# Gate 4 qualification evidence

## Current candidate — 2026-10-13

**Status: exact-SHA deterministic and authenticated synthetic inbox qualification pass; release readiness remains blocked by production operations evidence and owner-gated decisions.** The application-code candidate is `bc315fb7023020e6ea513253e17865af8620d8ea` on `gate-4/final-candidate-20261012`. The report edit is documentation-only and separate from this tested application-code SHA.

### Exact-SHA deterministic evidence

The following checks ran against application SHA `bc315fb7023020e6ea513253e17865af8620d8ea`:

| Check | Result |
|---|---|
| `npm run test:unit -- --run` | Pass: 78 files, 899 tests |
| Affected notification, scheduler, auth, and auth-environment tests | Pass: 5 files, 109 tests |
| `npm run typecheck` | Pass after the production build completed |
| `npm run build` | Pass with inert synthetic Clerk/Convex build values; no production deployment |
| `npm audit --omit=dev` | Pass: 0 vulnerabilities |
| `npm run test:convex-safe-exec` | Pass; expected negative policy cases were exercised |
| `npm run test:convex-command-policy` | Pass |
| `npm run test:fixture-evidence-boundary` | Pass |
| `npm run test:ci-workflow` | Pass |
| `npm run test:cycle-facts-plan` | Pass |
| Auth-fixture, release-smoke, deploy-workflow, Convex-env-reconciliation, and prediction-runner policy scripts | Pass |
| `npm run benchmark:cycle:golden` | Pass; source commit is `bc315fb7023020e6ea513253e17865af8620d8ea`, source tree clean, verdict `synthetic_not_evidence` |
| `git diff --check HEAD^ HEAD` | Pass |

An initial standalone typecheck ran concurrently with Next.js regenerating `.next/types` and failed on missing generated files. The typecheck was rerun after the build and passed; the build's own type validation also passed. The golden benchmark is synthetic evidence only and does not qualify promotion.

### Fresh PR #63 review and remediation

The reviewer confirmed a P2 inbox pagination bug: filtering stale/revoked rows after fetching a page could return a short or empty page even while older valid inbox items remained. `convex/queries/notifications.ts` now scans successive pages with the same Convex pagination cursor, fills the requested page, and caps a request at 200 scanned rows. A regression covers a stale prefix longer than the requested page and verifies the next page has no skipped valid items. Bounded exhaustion is surfaced as “No current notifications on this page” instead of claiming the inbox is empty.

The first authenticated desktop run also exposed a genuine Convex runtime error: scheduler reconciliation called four paginated queries in one mutation. The scheduler now performs at most one paginated query per mutation and uses bounded prefix reads for other streams; full prefixes resume through their own paginator, and already-issued cursors are not advanced or replaced. The existing scheduler continuation and source-fence tests pass.

### Issuer handling and authenticated populated-inbox E2E

The approved synthetic issuer `https://holy-clam-29.clerk.accounts.dev` is accepted only for the isolated `dev:hallowed-hummingbird-284` backend when fixture cleanup is enabled. The production issuer check remains exact and foreign issuers remain rejected. No issuer verification was weakened. The isolated backend identity reported deployment `dev:hallowed-hummingbird-284`, compatibility `v1`, and deploy time `2026-10-12T18:33:40.837Z`; the deployed code was application SHA `bc315fb7023020e6ea513253e17865af8620d8ea`.

`e2e/notifications-in-app.spec.ts` passed on the exact application SHA:

| Project | Result |
|---|---|
| `release-desktop` | 3 passed, 0 failed, 0 skipped |
| `release-mobile` | 3 passed, 0 failed, 0 skipped |

Both projects exercised populated partner delivery, sender inbox isolation, read/dismiss, access revocation, and primary/partner preference behavior. The previously failing primary preference save passed on both projects. Each authenticated teardown proof recorded `remaining=false` and zero rows across the approved fixture tables. The private local Playwright artifacts are retained under `/tmp/cb-connect-gate4-bc315fb-zREq5A`; teardown proofs are under `e2e/.evidence/` for run IDs `local-20261012183636575-367ef7e9` and `local-20261012183447279-3690293b`.

The wrapper's final artifact-parent removal reported `ENOTEMPTY` because it retained the two Playwright artifact directories. Both Playwright invocations exited successfully and both `.last-run.json` records say `passed` with zero failed tests. The wrapper restored all five temporary notification flags to `false`; no production flags were changed.

### Final targeted review

One targeted final re-review of the exact code SHA and qualification evidence is pending. It will be requested after this candidate and its evidence are published to PR #63. No broad reviewer loop is planned.

### Existing source PRs

PRs #57-#60 were open drafts based on gate-4/contract-and-integration, with no submitted reviews. Their latest observed heads and exact deterministic failures before supersession were:

| PR | Head | Failure | Other checks |
|---|---|---|---|
| #57 | c5d2f52 | Dependency audit reported three production dependency vulnerabilities, including the sharp/librsvg advisory | Authenticated release smoke and production-configured checks skipped |
| #58 | 50384b3 | Same dependency-audit failure on its older base | Authenticated release smoke and production-configured checks skipped |
| #59 | a177e70 | Unit test failed because event idempotency lacked relationshipMembershipId; the integrated candidate includes it | Authenticated release smoke and production-configured checks skipped |
| #60 | 1456ed6 | Same dependency-audit failure as #57/#58 | Authenticated release smoke and production-configured checks skipped |

The candidate audit reports zero production dependency vulnerabilities and its full unit suite passes. After PR #63 was opened against main, all four source PRs were closed as superseded with provenance comments pointing to #63. Their remote branches and original SHAs were preserved.

### Production promotion and rollback

Main deployment run 38132266518 at e08a2a1 failed both Verify qualified release promotion and Restore prior verified release after failed promotion. PM2 reported online, but release verification failed. scripts/verify-release.sh reported only that its /api/health curl failed, so the workflow log does not expose the exact HTTP, TLS, or connection cause. A successful promotion or rollback recheck has not been recorded. This remains a release-operations blocker.

### Release boundaries

D-011, D-012, D-013, and D-015 remain in force. Notification behavior remains default-off and in-app-only; no external provider or POST path was enabled. The exact candidate was deployed only to the approved isolated test backend; all five notification flags were restored to `false` after E2E. No production flags were changed, no production deployment or merge to main was performed, and no destructive retention changes were made. The outdated-prediction-snapshot rule remains intact: dependent notification work stays suppressed until a current authoritative snapshot exists.

**Conclusion:** implementation, deterministic checks, and authenticated synthetic populated-inbox qualification pass on application SHA `bc315fb7023020e6ea513253e17865af8620d8ea`. Gate 4 is ready for one targeted final review, but is not release-qualified: production promotion/rollback verification failed in run [38132266518](https://github.com/Zburgers/cb-connect/actions/runs/38132266518), and owner-gated decisions and operations evidence remain outstanding. No production deployment, merge, or production flag change was performed.

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
