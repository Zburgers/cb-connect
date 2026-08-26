# CB Connect Gates 0-2 Final QA Run 3

## Executive verdict

**RUN 3: BLOCKED / NOT QUALIFIED.** The exact PR stack passed the complete deterministic baseline and current-head protected CI. The independent authenticated qualification could not enter fixture setup because the approved local `holy clerk` and `dev:hallowed-hummingbird-284` credential handoff was absent. The one authoritative Playwright attempt ended at the configured 120-second webserver timeout while `ConvexReactClient` rejected an empty `NEXT_PUBLIC_CONVEX_URL`. This is `ENVIRONMENT_CONFIGURATION`, not a repository-remediable product failure. Luna was not used.

No product, test, harness, documentation, generated source, commit, rebase, or stateful Convex change occurred during qualification. Production `prod:festive-malamute-715` was neither selected nor used.

## Qualification identity

| Field | Value |
|---|---|
| QA run | Run 3 |
| Qualified source SHA | `db3ee0fd53c2ae8e2b88ee85030017a903708b90` |
| Qualified tree SHA | `49fdc867fc4c28f9cf9ddd6b08ccc49cafce5a7a` |
| Gate 1 SHA / PR #36 base | `19830d75bbef47f2b95fa1df35ae7e8f50b6df5e` |
| Current `origin/main` | `fc95ab2f7e24e8019fbd769333b9bface2561f5e` |
| Merge base with `origin/main` | `4382c97b107853964a7439d4e51a6d1f1e5ff35e` |
| Started | `2026-08-26T22:29:12Z` |
| Approved test target | `dev:hallowed-hummingbird-284` |
| Compatibility | `v1` |
| Source worktree | fresh, detached, clean |

The stale `eb53460c...` freeze is historical. Run 2 was genuinely attempted and blocked before fixture setup, so this attempt is Run 3. Historical evidence was preserved.

## Current PR stack and CI

GitHub confirmed PR #35 head `19830d75...` and PR #36 head `db3ee0fd...`, with PR #36 based exactly on PR #35. CI run `32977987384` (#35) and run `32978188067` (#36) completed successfully: deterministic qualification PASS, authenticated release smoke PASS, production release SKIPPED.

## P0 guard

Repository safe-executor and raw-command policy suites passed. The only allowed stateful path remained `bash scripts/convex-safe-exec test -- ...`. No stateful command was attempted because the required test deploy credential was absent. Effective production selection count: zero. P0 count: zero.

## Deterministic baseline

All commands passed: `npm ci`; typecheck; inert-URL production build; unit suite (**44 files, 361 tests**); `npm audit --omit=dev` (**0 vulnerabilities**); `git diff --check`; safe-executor, raw-command, CI, Gate 1, auth-fixture, Gate 2 copy, release, deployment, packaging, PM2, standalone-runtime, verification, and rollback policy scripts. The source remained clean.

## Authoritative authenticated attempt

One attempt ran the release-smoke, cycle-facts, and cycle-state specs for desktop and mobile. It exited 1 at `2026-08-26T22:33:42Z` after the configured 120-second webserver timeout. First wrong layer: `ENVIRONMENT_CONFIGURATION`. Missing protected inputs prevented a valid Convex URL and therefore prevented Clerk handshake, fixture-run creation, onboarding, pairing, storage-state creation, navigation, mode mutation, backend assertions, and browser tests. No diagnostic rerun was used; this is not a flake.

## Mode matrix and historical findings

M0-M5 and all sharing combinations are BLOCKED because fixture setup never began. QA-001, QA-002, QA-003, QA-004, QA-005, and historical P0-I0 are `BLOCKED` for independent runtime reconciliation; deterministic remediation tests are green but are not substituted for required authenticated assertions.

## Gate results

- Gate 0 desktop/mobile: BLOCKED; zero-skip execution not reached.
- Gate 1 off/on desktop/mobile: BLOCKED; zero-skip execution not reached.
- Gate 2 off/on desktop/mobile: BLOCKED; zero-skip execution not reached.
- Partner history privacy: BLOCKED before direct authenticated server assertions.
- Partner cycle-state privacy: BLOCKED before reduced-projection assertions.
- Cross-gate matrix: BLOCKED before feature-mode transitions.
- Manual desktop/mobile: BLOCKED because no authenticated fixture/browser state existed.

No result above is represented as PASS. No screenshots exist because the application never reached a valid renderable authenticated state.

## Failure accounting

| Item | Result |
|---|---|
| Classification | `ENVIRONMENT_CONFIGURATION` |
| Remediable repository findings | 0 |
| Luna remediation | Not used |
| Flakes | 0 |
| Unresolved P0 | 0 |
| Unresolved observed product P1 | 0 |
| Required qualification blockers | 1 |

## Evidence index

- `qualification-identity.env` - non-secret Run 3 freeze.
- `summaries/static-results.tsv` - command exit codes and timestamps.
- `summaries/authenticated-attempt.tsv` - authoritative attempt exit status.
- `logs/*.log` - sanitized deterministic and authenticated logs, retained externally during execution.

## Deferred authority and next action

The environment owner must provide a secret-safe local handoff for the protected `cb-connect-auth-test` inputs, or add an owner-approved protected workflow that executes the full Gates 0-2 matrix. Then begin a new honest qualification attempt from a newly verified exact PR stack. Do not merge, production deploy, enable D-011, approve D-012, or claim Gates 0-2 qualified from this run.

## Final verdict

**BLOCKED / NOT QUALIFIED.** Deterministic and current-head CI evidence is green, but the required independent authenticated Gate 0, Gate 1, Gate 2, privacy, cross-gate, and manual desktop/mobile evidence does not exist for Run 3.
