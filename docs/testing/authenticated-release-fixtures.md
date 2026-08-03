# Authenticated release-fixture proposal

**Decision:** D-004 and D-005
**Status:** Engineering proposal; blocked pending environment-owner approval
**Scope:** Gate 0 qualification only. Production accounts and production Convex data are explicitly out of scope.

This document is a proposal, not an approval record. It becomes binding only after the environment owner and engineering approver are recorded in the decision register.

## Proposed isolated environments

Use a dedicated non-production Clerk instance and a dedicated Convex preview/test deployment owned by the release engineering team. The test deployment must be disposable, contain synthetic fixtures only and be addressable independently from `festive-malamute-715`.

The GitHub Actions job should use a protected environment named `cb-connect-auth-test` with access limited to the approved environment owner and release workflow. Values belong in the environment secret store; this document records names and handling rules only.

Proposed secret/configuration names:

- `CLERK_TEST_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY`
- `CLERK_TEST_FRONTEND_API_URL`
- `CONVEX_TEST_DEPLOY_KEY`
- `CONVEX_TEST_DEPLOYMENT`
- `NEXT_PUBLIC_TEST_CONVEX_URL`
- `NEXT_PUBLIC_TEST_CONVEX_SITE_URL`

The environment owner must confirm whether Clerk's supported test-user mechanism is the Backend API, a dashboard-managed fixture set or another approved interface. The adapter must not silently fall back to production credentials.

## Provisioning and cleanup contract

1. Derive a run-scoped fixture namespace from the CI run identifier; do not use a real person's email address or a shared static password.
2. Provision exactly one primary and one partner in the isolated Clerk instance, then create/link a synthetic couple in the isolated Convex deployment.
3. Persist only restricted Playwright storage state under the CI workspace. Never commit it or include it in ordinary logs.
4. On success, failure or cancellation, retry cleanup idempotently: revoke/delete the two test users, remove the synthetic couple and remove run-scoped application data.
5. If provisioning or cleanup cannot prove that it is targeting the isolated environment, fail closed and do not mutate any account.

## Rate limits and retries

- Provision at most one fixture pair per CI run and reuse it across browser projects.
- Serialize fixture provisioning by environment to avoid Clerk rate-limit bursts.
- Retry only transient failures with bounded exponential backoff; never retry invalid credentials, authorization failures or an ambiguous target.
- Cleanup retries must be safe when one resource was already removed. Report the resource class and run ID, not tokens or personal data.

## Artifact handling

- Upload traces, screenshots and videos only on failure, to a private restricted artifact store with a proposed seven-day retention.
- Before upload, redact cookies, authorization headers, Clerk IDs, email addresses, pairing codes, message text, period dates, pain values and notification payloads.
- Do not print environment variables, storage-state JSON, raw request bodies or Convex URLs that include credentials.
- The environment owner must approve the redaction test cases and retention period before the authenticated suite becomes a release gate.

## Explicit prohibitions

- No production Clerk users, production Convex selector, production deploy key or production couple may be used as a fixture.
- No fixed credential literals or committed auth-state files.
- No conditional skip when the fixture environment is unavailable; release CI fails closed.

## Approval required

D-004 requires the named owner for the isolated Clerk/Convex environments and credential custody. D-005 requires that owner and engineering to approve the provisioning interface, cleanup authority, retry policy, artifact redaction and retention. Until those approvals are recorded in the decision register, E1–E3 and the authenticated release gate remain blocked.
