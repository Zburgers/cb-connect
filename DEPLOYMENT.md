# Deployment Guide — CB Connect

## Current release boundary

Gate 0's implementation packet is complete, but its production promotion
verdict is **[BLOCKED](docs/evidence/reliability-gate-0/REPORT.md)**. This
guide is an operational reference, not authorization to deploy. Do not claim a
release from a local build, `/api/health`, a historical workflow run, or the
isolated development deployment.

Production promotion remains contingent on all of the following. The current
C2 authenticated-smoke result is recorded in the
[protected CI proof](docs/evidence/reliability-gate-0/c2-protected-2026-08-17.md):

- continued passing authenticated-smoke CI from the secret-backed test
  environment;
- separately authorized production Convex/frontend promotion with matching
  `v1` identity, HTTPS, listener, readiness and PM2-persistence evidence;
- a measured synthetic restore rehearsal with integrity and RPO/RTO results;
- the 28-day allowlisted SLO baseline; and
- an approved refreshed Gate 0 report.

The detailed implementation record is in
[the Gate 0 execution plan](docs/plans/2026-08-04-00-production-reliability-execution.md).
The current evidence and next-safe-action boundary are in the report above.

## Automation contract

The generic CI qualification build is deliberately secret-free and uses inert
public placeholders; it is never packaged or promoted. After it and the
authenticated smoke pass, the push-`main`-only `release-artifact` job enters
the protected production environment, builds once with the approved public
Convex/Clerk configuration, and publishes the sole promotable artifact.

The deployment workflow runs only after that whole `CI` workflow succeeds. It
rejects superseded commits, downloads the C3 artifact by the completed CI run
ID, and verifies its checksum, commit SHA, CI build ID and approved `v1`
compatibility identity before any production change. It does not rebuild or
repackage the frontend on the self-hosted runner. It resolves and validates
the durable rollback candidate immediately after artifact materialization and
fails closed before any optional Convex runtime-secret sync or Convex deploy
when no candidate exists and the first-promotion override is unset.

Production promotion is disabled by default even for a successful `main` CI
run. An operator must set the repository Actions variable
`PROMOTE_PRODUCTION=true` for the deployment job to exist (a job-level
condition cannot rely on an environment-only variable before the job starts).
Before PM2 is changed, the workflow also requires a checksum-verified
compatible `current` rollback candidate. A first promotion without one
additionally requires the separate `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK=true`
variable in the production environment. Leave both unset for normal merges and
whenever production evidence remains blocked; neither variable authorizes a
release by itself.

Set the protected production Actions variable `CB_CONNECT_RELEASE_ROOT` to a
pre-provisioned, writable absolute host directory outside both the GitHub
workspace and runner temporary directory (for example `/srv/cb-connect`). The
workflow retains immutable artifact, manifest and extracted candidates below
`$CB_CONNECT_RELEASE_ROOT/releases`, starts PM2 from the durable extracted
candidate, and updates `$CB_CONNECT_RELEASE_ROOT/current` only after verified
promotion. Promotions are serialized. On failure, it restores the last
checksum-verified compatible candidate; a first release has no automatic
rollback candidate and fails closed.

Convex promotion remains opt-in through `DEPLOY_CONVEX=true`. That path
requires a non-empty deploy key before installing the qualified commit's
dependencies for an explicit Convex release; it never rebuilds the frontend.
No protected preview/test selector or environment is currently configured, so
this workflow does not claim preview/test promotion evidence.

The intended production selector is `prod:festive-malamute-715`; revalidate it
immediately before any authorized promotion. The shared compatibility tag is
`v1`. `GET /api/health` is liveness only. `GET /api/ready` is the
frontend/backend compatibility signal and must be verified without recording
response bodies that may reveal operational details.

## Configuration boundary

Use protected GitHub environments/secrets for runtime configuration. Never
commit, echo, paste into evidence, or place values in `pm2.config.js` for:

- `CONVEX_DEPLOY_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, or any
  Clerk test secret;
- `CONVEX_DEPLOYMENT`, Clerk frontend API values, Convex URLs or production
  origins when they are environment-specific;
- fixture storage states, fixture manifests, user identifiers, or health data.

`NEXT_PUBLIC_*` settings are browser configuration, not secret storage. They
must not contain private credentials. `CLERK_WEBHOOK_SECRET` is optional until
a Clerk webhook endpoint is configured; webhook invocation fails closed when
the secret is absent.

## Safe local qualification

These commands qualify the checked-out code only; they do not authorize a
deployment or mutate production:

```bash
npm ci --no-audit --no-fund
npm run build
npm run typecheck
npm run test:unit -- --run
npm audit --omit=dev
bash scripts/tests/package-release.test.sh
bash scripts/tests/standalone-runtime.test.sh
bash scripts/tests/pm2-config.test.sh
bash scripts/tests/verify-release.test.sh
bash scripts/tests/rehearse-rollback.test.sh
git diff --check
```

The authenticated release smoke must run only through its approved
secret-backed fixture environment and its dedicated configuration:

```bash
npm run test:e2e:release -- e2e/release-smoke.spec.ts --project=release-desktop
npm run test:e2e:release -- e2e/release-smoke.spec.ts --project=release-mobile
```

Missing fixture configuration is a failure, not a reason to add static
credentials, reuse production accounts, or skip the test. Ordinary
`npm run test:e2e` uses the default non-release Playwright configuration and
does not provision Gate 0 fixture users.

## Promotion, rollback and recovery

Do not use manual `pm2 delete`, `pm2 stop`, `kill -9`, `rm -rf .next`, or a
host-side rebuild as a release procedure. They can discard the healthy process
or bypass the qualified artifact and evidence chain.

For an authorized release, use the reviewed automation path and record only
redacted results in the Gate 0 log/report. For a previously recorded compatible
pair, follow the [release rollback runbook](docs/runbooks/release-rollback.md).
For the synthetic non-production rehearsal, follow the
[backup/restore runbook](docs/runbooks/backup-restore.md). The checked-in
rehearsal script rejects production selectors and destructive actions.

## Troubleshooting boundary

If a listener, readiness, artifact, identity or PM2 check fails, stop the
promotion and preserve the failed evidence. Do not repair the condition by
deleting a process, clearing build directories, changing live secrets, or
running an unreviewed production command. Record the bounded failure in
`issues.md` and use the compatible rollback process only when its preconditions
are met.
