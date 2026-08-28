# Convex compatibility release runbook

Every green `main` release deploys Convex through the protected `production`
environment before promoting the matching frontend. The workflow requires a
valid `CONVEX_DEPLOY_KEY` and validates the exact target
`prod:festive-malamute-715`; there is no manual deployment switch.

## Immutable target

- Selector: `prod:festive-malamute-715`
- Compatibility: `v1`
- Workflow variable: `CB_CONNECT_PRODUCTION_DEPLOYMENT`
- Backend identity query: `queries/system:getBackendIdentity`
- Required evidence: function specification plus the query result containing the approved deployment and compatibility tag

The workflow rejects any target other than the approved selector and invokes
all stateful Convex operations through `scripts/convex-safe-exec` in explicit
`production` mode. The wrapper verifies effective backend identity immediately
before and after each operation. No CLI default or `--prod` shortcut is valid
evidence of target identity.

## Preview/test rehearsal

Before any production execution, deploy the same commit to the approved
preview/test deployment `dev:hallowed-hummingbird-284` with its own deploy key
provided through `CONVEX_DEPLOY_KEY` and invoke the wrapper in explicit `test`
mode. Verify `getBackendIdentity`, the `v1`
compatibility tag, and the generated function specification. Keep synthetic
data only; never use production users or production data for this rehearsal.

The rehearsal target is shared and persistent, so concurrent qualification
runs must serialize before deployment. Do not use `cancel-in-progress: true`
for this environment because it can strand synthetic fixtures mid-cleanup.

## Production stop conditions

Stop without frontend promotion when the selector, deploy key, compatibility tag, function specification, or identity query is missing or mismatched. A successful Convex command without matching identity evidence is not a qualified release.

Never record deploy keys, Clerk credentials, Convex URLs containing credentials, user identifiers, or health data in evidence or logs.
