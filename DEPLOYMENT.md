# Deployment Guide — CB Connect

## Current release boundary

Every successful push-`main` CI run automatically deploys the exact qualified
Convex and frontend release. There are no manual promotion variables. CI and
the deployment workflow are the release authority; historical Gate 0 evidence
does not block shipping or feature development.

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
the durable rollback candidate immediately after artifact materialization,
then runs the validated Convex release before PM2 promotion. A missing managed
`current` pointer is the first-release bootstrap case; an existing pointer must
resolve to a checksum-verified compatible release.

Set the protected production Actions variable `CB_CONNECT_RELEASE_ROOT` to a
pre-provisioned, writable absolute host directory outside both the GitHub
workspace and runner temporary directory (for example `/srv/cb-connect`). The
workflow retains immutable artifact, manifest and extracted candidates below
`$CB_CONNECT_RELEASE_ROOT/releases`, starts PM2 from the durable extracted
candidate, and updates `$CB_CONNECT_RELEASE_ROOT/current` only after verified
promotion. Promotions are serialized. On failure, it restores the last
checksum-verified compatible candidate. The first verified release establishes
the rollback chain.

Convex deployment requires a non-empty protected `CONVEX_DEPLOY_KEY`, deploys
the qualified commit, and never rebuilds the frontend. Schema and function
changes must remain backward-compatible because frontend rollback does not
reverse production data.

The intended production selector is `prod:festive-malamute-715`. All stateful
Convex operations must run through `scripts/convex-safe-exec` with explicit
`test` or `production` mode. The wrapper validates the deployment prefix of
the bound `CONVEX_DEPLOY_KEY`, credential class, and non-CLI consistency
variables in the same process; it rejects `CONVEX_DEPLOYMENT`, which can
redirect a development selector to production, and verifies effective backend
identity immediately before and after the operation. Production mode
additionally requires `CB_CONNECT_PROTECTED_EXECUTION=1`. The shared
compatibility tag is `v1`.
`GET /api/health` is liveness only. `GET /api/ready` is the
frontend/backend compatibility signal and must be verified without recording
response bodies that may reveal operational details.

## Gate 1 trustworthy cycle facts

The `CB_CONNECT_CYCLE_FACTS_V1` capability is a Convex-only, default-off
setting. An absent value, an empty value or any value other than the exact
string `true` leaves the existing cycle UI and backward-compatible reads in
place. It must never be copied into a `NEXT_PUBLIC_*` variable or exposed as
browser configuration.

Enable the capability only on an explicitly approved non-production Convex
deployment after its authenticated desktop/mobile qualification is retained.
Production exposure is blocked until D-012 is approved and a separate rollout
decision is recorded; this implementation does not authorize enabling the flag
there. Do not run the metadata migration or any destructive migration as part
of frontend release promotion.

Rollback is the reversible flag-off path: remove the Convex setting or set it
to a value other than `true`, then verify that older clients still read the
additive schema. Frontend rollback remains compatible with the additive
backend; it does not delete or reverse cycle data.

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
secret-backed fixture environment and its dedicated configuration. The CI job
deploys the checked-out commit to the shared test deployment before Playwright
starts, then verifies the backend identity contract:

```bash
npm run test:e2e:release -- e2e/release-smoke.spec.ts --project=release-desktop
npm run test:e2e:release -- e2e/release-smoke.spec.ts --project=release-mobile
```

Missing fixture configuration is a failure, not a reason to add static
credentials, reuse production accounts, or skip the test. Ordinary
`npm run test:e2e` uses the default non-release Playwright configuration and
does not provision Gate 0 fixture users.

The shared authenticated test deployment is `dev:hallowed-hummingbird-284`.
Its Convex deploy key is consumed through `CONVEX_DEPLOY_KEY` inside the
protected `cb-connect-auth-test` GitHub environment. Runs against that target
must serialize so concurrent PRs do not deploy different commits into the same
backend at once. CI invokes `scripts/convex-safe-exec test` for identity
checks, runtime configuration, and deployment; a caller-side preflight is not
considered sufficient.

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
