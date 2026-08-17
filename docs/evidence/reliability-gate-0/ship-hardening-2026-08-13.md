# Gate 0 ship-hardening evidence

**Recorded:** 2026-08-13
**Worktree:** `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-0`
**Branch:** `gate-0/reliability-2026-08-04`
**Deployment class:** local packaged artifact only

## Changes verified

- `/api/health` and `/api/ready` are excluded from the Clerk middleware
  matcher; the route handlers retain separate liveness and compatibility
  readiness contracts.
- Default Playwright behavior remains non-release; authenticated release smoke
  selects `playwright.release.config.ts` explicitly.
- The standalone artifact is copied to a clean temporary runtime directory and
  started without Clerk credentials. Health returns HTTP 200, and readiness
  returns a valid HTTP 200 or 503 JSON contract depending on the baked Convex
  target state; no middleware-generated 500 is accepted.

## Verification

- `git diff --check` — PASS
- `bash scripts/tests/ci-workflow.test.sh` — PASS
- `bash scripts/tests/deploy-workflow.test.sh` — PASS
- `bash scripts/tests/pm2-config.test.sh` — PASS
- `bash scripts/tests/release-smoke-workflow.test.sh` — PASS
- `bash scripts/tests/verify-release.test.sh` — PASS
- `npm run test:unit -- --run` — PASS, 19 files/103 tests
- `npm run build` — PASS
- `bash scripts/tests/standalone-runtime.test.sh` — PASS
- `npm audit --omit=dev` — PASS, 0 vulnerabilities

No production selector, credential, user identifier or health data is recorded
here. This artifact does not establish production promotion readiness.
