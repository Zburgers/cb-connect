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

The workflow rejects any target other than the approved selector and passes the same selector through an explicit `--env-file` to `npx convex deploy`. It then records a function specification and invokes the identity query against that same selector. No CLI default or `--prod` shortcut is evidence of target identity.

## Preview/test rehearsal

Before any production execution, deploy the same commit to an explicitly named preview/test deployment with its own deploy key. Verify `getBackendIdentity`, the `v1` compatibility tag, and the generated function specification. Keep synthetic data only; never use production users or production data for this rehearsal.

## Production stop conditions

Stop without frontend promotion when the selector, deploy key, compatibility tag, function specification, or identity query is missing or mismatched. A successful Convex command without matching identity evidence is not a qualified release.

Never record deploy keys, Clerk credentials, Convex URLs containing credentials, user identifiers, or health data in evidence or logs.
