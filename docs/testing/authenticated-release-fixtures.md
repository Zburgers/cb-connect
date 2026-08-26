# Authenticated release-fixture contract

**Decision:** D-004 and D-005
**Status:** Approved 2026-08-05 by the sole project and environment owner
**Scope:** Authenticated release qualification only. Production accounts and production Convex data are explicitly out of scope.

This contract is the approved operating policy for `cb-connect-auth-test`. The decision register is the approval record.

## Approved isolated environments

Use the dedicated non-production Clerk instance labeled `holy clerk` and the isolated Convex deployment `dev:hallowed-hummingbird-284`. The deployment is persistent and shared across PR qualification runs, so authenticated jobs must serialize access before deploying backend code.

The GitHub Actions job must run inside the protected environment `cb-connect-auth-test`. That environment stores the approved test configuration names and the deploy key secret. This document records names and handling rules only.

Required names:

- `CLERK_TEST_ENVIRONMENT_NAME` must equal `holy clerk`
- `CLERK_TEST_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY`
- `CLERK_TEST_FRONTEND_API_URL`
- `CONVEX_TEST_DEPLOY_KEY`
- `CONVEX_TEST_DEPLOYMENT`
- `NEXT_PUBLIC_TEST_CONVEX_URL`
- `NEXT_PUBLIC_TEST_CONVEX_SITE_URL`

The CI job exposes `CONVEX_TEST_DEPLOY_KEY` to the Convex CLI as
`CONVEX_DEPLOY_KEY`. The safe executor validates its non-secret deployment
prefix (`dev:hallowed-hummingbird-284|...`) and rejects `CONVEX_DEPLOYMENT`
because that CLI selector can redirect a development target to its associated
production deployment. The key must not be echoed, printed, or committed.

## Deployment-before-E2E contract

Before authenticated Playwright starts, the CI job must:

1. Fail closed if the deploy key or approved test target is missing.
2. Synchronize only the test-safe Convex runtime configuration required by the fixture harness.
3. Deploy the checked-out commit to `dev:hallowed-hummingbird-284`.
4. Verify the deployed backend identity and compatibility contract before browser execution.
5. Reuse the same fixture pair for desktop and mobile projects.

The test deployment must contain synthetic fixtures only and must never be confused with `prod:festive-malamute-715`.

## Provisioning and cleanup contract

1. Derive a run-scoped fixture namespace from the CI run identifier; do not use a real person's email address or a shared static password.
2. Provision exactly one primary and one partner in the isolated Clerk instance, then create and link a synthetic couple in the isolated Convex deployment.
3. Persist only restricted Playwright storage state under the CI workspace. Never commit it or include it in ordinary logs.
4. On success, failure or cancellation, retry cleanup idempotently: revoke/delete the two test users, remove the synthetic couple and remove run-scoped application data.
5. If provisioning or cleanup cannot prove that it is targeting the isolated environment, fail closed and do not mutate any account.

## Rate limits, retries and concurrency

- Provision at most one fixture pair per CI run and reuse it across browser projects.
- Serialize fixture provisioning and deployment by environment to avoid concurrent mutation of the shared test backend.
- Retry only transient failures with bounded exponential backoff; never retry invalid credentials, authorization failures or an ambiguous target.
- Cleanup retries must be safe when one resource was already removed. Report the resource class and run ID, not tokens or personal data.

## Artifact handling

- Upload traces, screenshots and videos only on failure, to a private restricted artifact store with a seven-day retention.
- Before upload, redact cookies, authorization headers, Clerk IDs, email addresses, pairing codes, message text, period dates, pain values and notification payloads.
- Do not print environment variables, storage-state JSON, raw request bodies or Convex URLs that include credentials.
- The environment owner must approve the redaction test cases and retention period before the authenticated suite becomes a release gate.

## Explicit prohibitions

- No production Clerk users, production Convex selector, production deploy key or production couple may be used as a fixture.
- No fixed credential literals or committed auth-state files.
- No conditional skip when the fixture environment is unavailable; release CI fails closed.

## Approval record

D-004 and D-005 were approved by the sole project/environment owner on 2026-08-05, including agent authority to create and delete synthetic users, the cleanup policy, redaction rules and seven-day retention. E1-E3 may execute in these isolated environments; passing evidence remains required.
