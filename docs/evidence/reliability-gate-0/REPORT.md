# Gate 0 historical evidence report

> **Superseded operating status (2026-08-19):** This report preserves the
> pre-deployment Gate 0 evidence boundary. It is not a current feature or
> deployment gate. Follow
> [`2026-08-19-feature-first-delivery-design.md`](../../plans/2026-08-19-feature-first-delivery-design.md)
> and the current deployment workflow. Operational measurement continues in
> parallel and D-012 blocks only destructive data-lifecycle work.

**Recorded:** 2026-08-17
**Worktree:** `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-0`
**Branch:** `gate-0/reliability-2026-08-04`
**Verdict:** **BLOCKED for production promotion**

This report closes the Gate 0 implementation packet and records the evidence
boundary. It does not claim that Gate 0 production qualification passed. No
production deployment, production Convex mutation, production fixture or
production restore was performed.

## 2026-08-13 ship-hardening follow-up

The follow-up review found and corrected two implementation risks without
touching production data or enabling promotion:

- `/api/health` and `/api/ready` are now excluded from the Clerk middleware
  matcher, preserving process liveness and compatibility readiness when Clerk
  runtime configuration is unavailable.
- Authenticated release smoke now uses the dedicated
  `playwright.release.config.ts`; ordinary Playwright runs no longer inherit
  fixture provisioning and teardown, and both configs restrict discovery to
  browser `*.spec.ts` files so Vitest helpers are not collected as E2E tests.
- CI now smoke-tests the packaged standalone server and verifies that health
  and readiness return their JSON contracts rather than a middleware-generated
  500 response.

Local follow-up verification passed: 19 unit-test files/103 tests, production
build, typecheck, workflow policy tests, packaged standalone runtime smoke,
and `npm audit --omit=dev` with zero vulnerabilities. This is implementation
evidence only; it does not replace the missing production identity, rollback,
restore or 28-day baseline evidence below.

## 2026-08-12 environment verification

The release operator confirmed the intended targets, and read-only GitHub and
production checks verified the following without printing secret values:

- Intended production Convex selector: `prod:festive-malamute-715`.
- Production HTTPS base URL: `https://cb.nakshatraneuratech.dev`.
- Deployment path: the existing PM2 GitHub Actions workflow.
- The `cb-connect-auth-test` environment contains the seven expected
  Clerk/Convex test secret names. Repository and production-environment
  configuration contains the expected production secret/variable names.
- `PROMOTE_PRODUCTION`, `DEPLOY_CONVEX` and
  `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK` are unset.
- `/home/naki/cb-connect-releases` exists but is empty, so there is no durable
  verified rollback candidate.
- Current production `/api/health` is `200`; `/api/ready` is `404`. Production
  is therefore a pre-candidate runtime, not a qualified Gate 0 release.

Environment-scoped CI and production verification were authorized by the owner, but no
deployment or production-secret operation is performed in this local audit.
The workflow guard remediation in this branch now resolves and validates the
rollback candidate before any optional Convex runtime-secret sync or Convex
deploy. With the empty release root and no override, the job fails before any
Convex mutation.

## 2026-08-17 owner-authorized GitHub environment sync

The Gate 0 authority authorized the existing local environment values to be
synced through the GitHub CLI without exposing secret values. The following
protected configuration is present:

- `cb-connect-auth-test` contains all seven required Clerk/Convex fixture
  secrets.
- `production` contains the required frontend/Convex/Clerk runtime secrets,
  CORS origin, and sign-in/sign-up route settings.
- `production` variables contain `CB_CONNECT_PRODUCTION_DEPLOYMENT` and
  `CB_CONNECT_RELEASE_ROOT`.
- `CB_CONNECT_PRODUCTION_BASE_URL` remains configured as the production
  environment secret.
- `PROMOTE_PRODUCTION`, `DEPLOY_CONVEX` and
  `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK` remain unset.

This sync establishes CI configuration only. It does not authorize merge,
production deployment, Convex mutation, or a passed Gate 0 promotion verdict.

PR #17's first push at `c474a30` was rejected before job creation because the
workflow referenced nonexistent `github.run_started_at` values and used
`runner.temp` in job-level environment evaluation. The follow-up replaces
those expressions with runtime UTC timestamps and step-level `$RUNNER_TEMP`
setup. Official `actionlint` 1.7.12 and repository workflow policy tests pass
on the corrected files; a successful GitHub run is still required.

The corrected PR run `31622741248` passed deterministic qualification but the
authenticated job stopped at its policy step because `rg` was absent from the
hosted runner. All seven environment secret names were present and redacted;
the browser smoke did not run. The follow-up explicitly installs `ripgrep`
before policy validation and smoke execution. This run is not C2 evidence.

PR run `31623024480` then passed deterministic qualification and reached the
real authenticated browser setup. It failed during the coarse
`primary-onboarding` stage, cleaned the run-owned fixtures and uploaded only a
redacted summary; desktop/mobile journey tests did not begin. The branch now
reports non-sensitive onboarding substages so the next run can distinguish
load, role selection, date entry, submit and redirect without retaining user
or health data. This failed run is evidence that the gate fails closed, not a
C2 pass.

PR run `31623624502` passed deterministic qualification and reached
`primary-register`, where exact fixture ownership rejected the partially
materialized partner row with `fixture_cleanup_identity_mismatch`; browser
journey tests did not begin. Isolated reproduction identified two harness
defects: Clerk can create the linked partner with an empty Convex email before
partner registration, and teardown could keep the app alive long enough for
`ensureUser` to recreate the primary during cleanup. The branch now accepts
an empty email only for an exact Clerk ID bound to the authenticated durable
fixture run, reauthenticates the exact deterministic primary for teardown,
closes the app before cascading data, and provisions a distinct fixture run
per Playwright project. Fresh isolated-dev desktop and mobile lifecycles each
passed 1/1 with zero skips and `remaining=false`.

Protected rerun `31627216861` passed both protected jobs: deterministic
qualification and authenticated release smoke. The smoke ran independent
desktop and mobile fixture lifecycles with zero skips; the production-configured
release job was correctly skipped because production promotion remains
disabled. This closes the current C2 CI-evidence blocker.

## 2026-08-17 protected CI refresh

The documentation refresh briefly exposed a repeatable authenticated setup
failure at `primary-onboarding-date` in run `32008475060` and its failed-job
rerun. Review traced the race to the standalone `/onboarding` route assigning a
role before its Convex user was guaranteed to exist, with the fixture also
advancing before the period step was rendered. The route now ensures the user
before role assignment, and fixture setup waits for the date field; focused
tests and typecheck passed.

The current application head `f0704cd` was then verified by [CI run
32010663067](https://github.com/Zburgers/cb-connect/actions/runs/32010663067).
Deterministic qualification and authenticated release smoke both passed. The
desktop and mobile fixture lifecycles completed with zero skips. The
production-configured immutable release job was skipped because the workflow
was triggered by a pull-request event; no production promotion was attempted.
This supersedes the older protected-run references for current C2 evidence.

## Criterion review

| Criterion | Evidence kind | Artifact | Result |
|---|---|---|---|
| G1 dependency remediation | Direct local qualification | `6509bbf`, `3a64142`, `bb30aeb`, `e26afb4`; `npm audit --omit=dev` reports 0 vulnerabilities | PASS |
| C1 local qualification | Direct local qualification | [`ship-hardening-2026-08-13.md`](ship-hardening-2026-08-13.md); build, typecheck, 19 files/103 tests, policy tests and full production audit pass in the final review tree | PASS |
| C2 authenticated release smoke | Protected CI direct evidence | [`c2-protected-2026-08-17.md`](c2-protected-2026-08-17.md); current run `32010663067` passed deterministic qualification and authenticated desktop/mobile smoke with zero skips; the production-configured release was skipped for the pull-request event | PASS |
| C3 immutable artifact | Direct local qualification and reviewed workflow policy | `a5be590` plus final branch review; standalone package checksum/extraction pass, trusted push-main artifact waits for qualification and authenticated smoke, and deployment consumes that exact artifact | PASS for implementation; trusted CI execution and runtime promotion remain unproven |
| V1 backend release | Isolated-development direct evidence | [`v1-dev-proof.md`](v1-dev-proof.md); `dev:hallowed-hummingbird-284` returned backend deployment and `v1` identity | PASS for isolated dev; production not executed |
| V2 compatible promotion | Local implementation and synthetic endpoint/process tests | `379e8c6` plus final review remediation; verifier covers identity/readiness/TLS/listener/PM2 persistence, deploys from a durable release root, serializes promotion and limits automatic rollback to frontend promotion failures | PASS for implementation; production evidence missing |
| X1 rollback and restore | Synthetic-only dry-run | [`x1-dev-proof.md`](x1-dev-proof.md); production/unresolved/destructive inputs reject | PASS for guardrail; measured restore not executed |
| G2 SLO and error budget | Approved definitions and response policy; baseline absent | [`slo.md`](../../reliability/slo.md), [`error-budget-policy.md`](../../reliability/error-budget-policy.md), [`incident-response.md`](../../reliability/incident-response.md), `924c6df` | BLOCKED: 28-day baseline not measured |
| Frontend identity | Isolated dev/local artifact evidence | C3 manifest/package checks and V1 dev proof | Production identity not verified |
| Backend identity | Isolated dev direct query | V1 dev proof for `dev:hallowed-hummingbird-284`, compatibility `v1` | Production identity not verified |
| Rollback | Synthetic-only policy evidence | X1 proof and [rollback runbook](../../runbooks/release-rollback.md) | Production rollback/recovery evidence missing |

## P0/P1 and active issues

- G1’s reachable production dependency advisories are remediated and CI now
  enforces the complete non-development audit.
- The Gate 0 deployment issue remains active because production coordinated
  release identity, listener/TLS/readiness, PM2 persistence and rollback
  evidence are not directly verified.
- The authenticated browser issue is remediated: deterministic
  release smoke, pre-dashboard durable cleanup ownership, exact empty-email
  recovery, teardown reauthentication, project-isolated fixture lifecycles,
  strict Convex test URL validation, onboarding user readiness and fail-closed
  environment-scoped CI are implemented. Protected PR run `32010663067` passed
  both desktop and mobile authenticated journeys with zero skips.
- Production promotion is disabled by default. `PROMOTE_PRODUCTION`,
  `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK` and `DEPLOY_CONVEX` remain unset;
  pushing or merging this branch does not authorize production mutation.
- No Gate 0 exit claim is made from a green build, a health response, prior
  isolated-dev E3 evidence or a synthetic fixture.

## Approvals and boundary

**Approver status:** The sole project owner approved D-002 through D-007 and
is the release operator, incident authority and recovery approver. No
approval of a passed Gate 0 production promotion is recorded.

D-002 through D-007 remain owner-approved decisions for the implementation
contracts. Those approvals establish the target, compatibility scheme,
isolated fixture boundary, SLO definitions and recovery objectives; they are
not evidence that production behavior or the baseline has been measured.

The remaining evidence requires authorized external state: a production release
run with the approved selector and HTTPS base URL, a measured synthetic
backup/restore, and the 28-day allowlisted telemetry baseline. This worktree
must not invent or substitute those results.

## Final verdict

Gate 0 engineering implementation, authenticated CI qualification and the
final push-safety remediation are closed at the commit boundaries recorded in
the execution log, but Gate 0 production promotion is **BLOCKED**. Gate 1 remains
blocked and unexposed until the missing direct evidence is obtained and the
owner records the resulting approval. The next safe action is to run the
direct production/recovery/baseline evidence and owner approval; no production
deployment is implied by this report.
