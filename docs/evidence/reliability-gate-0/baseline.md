# Gate 0 preflight baseline

**Captured:** 2026-08-04
**Checkout:** `main` at `3ba6d7a` (local merge of the planning batch and refreshed `origin/main`)
**Scope:** Read-only preflight. This document does not approve production readiness or deployment.

## Observed

| Boundary | Evidence | Observation |
|---|---|---|
| Git checkout | `git status --short --branch`, `git log` | Local `main` is clean and is two commits ahead of `origin/main`: planning commit `5bc2e73` and merge commit `3ba6d7a`. `origin/main` is `d3ef5a7`. |
| Planning integration | `git log --graph` | The planning batch is present on local `main`; the upstream PR #8 history is retained as the other parent of `3ba6d7a`. |
| PR #8 | [PR #8](https://github.com/Zburgers/cb-connect/pull/8) | Merged to `main` at `d3ef5a7a181de24d9d168d7362329382d2ae317e` on 2026-08-03. |
| CI | [CI run 30852430557](https://github.com/Zburgers/cb-connect/actions/runs/30852430557) | Completed with `success` for `d3ef5a7`. |
| Deployment | [Deploy run 30852430655](https://github.com/Zburgers/cb-connect/actions/runs/30852430655) | Completed with `failure` in the `Build & Deploy` job for `d3ef5a7`; frontend promotion was not proven. |
| Public liveness | `GET https://cb.nakshatraneuratech.dev/api/health` | HTTP 200. Body contained `status`, `timestamp` and `service` only; no release or backend identity was exposed. |
| Convex function metadata | `npx convex function-spec --deployment festive-malamute-715` | The queried deployment exposed `mutations/periods.js:{logPeriodStart,logPeriodEnd,assistLogPeriodStart,assistLogPeriodEnd,updatePeriodEvent,deletePeriodEvent,autoEndPeriods,updateCycleSettings}`, `mutations/messages.js:{markDelivered,markRead}` and `queries/messages.js:unreadSummary`. |
| Local process state | `pm2 list`, `ss -ltnp` | PM2 is not installed on this workstation. Local listeners were observed on loopback ports 3000 and 3001; these are not production-host evidence. |
| Open GitHub issues | `gh issue list --state open` | Open issues include privacy, notification idempotency, pairing security, chat race safety and role/chat deletion findings. No labels were assigned in the returned list. |

## Inferred, not independently verified

- `festive-malamute-715` is the documented production Convex selector candidate because the function-spec query succeeded and the dated research dossier identifies it as production. The release operator must confirm it before D-003 is resolved.
- The public liveness response shows a serving frontend, but it does not identify the deployed commit, backend compatibility version, PM2 persistence, listener owner or rollback pair.
- The historical runner name `razor-crest` is evidence from the dated research dossier, not a current host/process observation.

## Unknown or blocked

- Named release operator, incident owner and escalation route (D-002).
- Exact production selector authority and approved frontend/backend compatibility-version scheme (D-003).
- Isolated Clerk/Convex preview or test environment and credential owner (D-004).
- Approved Clerk provisioning, cleanup and restricted-artifact owner/process (D-005).
- Baseline window, approved SLOs and error-budget approver (D-006).
- Backup/restore owner, approved non-production restore target and RPO/RTO approval (D-007).
- Current production host, PM2 process, listener, startup persistence, frontend commit/build identity and backend compatibility identity.

## Safety review

This record contains no credentials, user identifiers, health values, raw environment values or unrestricted command logs. The candidate Convex selector is a deployment name, not a credential.

## Gate 0 conclusion

The checkout and planning history are integrated, but this baseline does not qualify a release. Gate 0 remains blocked until the required decision authorities approve D-002 through D-007 and the implementation plan produces authenticated, deployment, rollback and measurement evidence.
