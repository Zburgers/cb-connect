# C2 protected CI proof

- Recorded: 2026-08-17
- Commit: `f0704cd07d18c3100bc0b55eb1dbe518cb56a2c4`
- Pull request: [PR #17](https://github.com/Zburgers/cb-connect/pull/17)
- Workflow run: [CI run 32010663067](https://github.com/Zburgers/cb-connect/actions/runs/32010663067)
- Deterministic qualification: PASS
- Authenticated release smoke: PASS for independent desktop and mobile fixture lifecycles, with zero skips
- Production-configured immutable release: SKIPPED because this was a pull-request event; no production promotion was attempted
- Promotion switches: `PROMOTE_PRODUCTION`, `DEPLOY_CONVEX` and `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK` remain unset
- Secrets and fixture identifiers: omitted

The PR-head run also covers the onboarding remediation that waits for the
standalone route to ensure its Convex user before assigning a role. This is
current protected CI evidence for C2. It does not establish production
frontend/backend identity, PM2 persistence, rollback readiness, measured
restore objectives or the 28-day SLO baseline.
