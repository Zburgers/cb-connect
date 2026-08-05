# Gate 0 measurement and recovery proposal

**Decisions:** D-006 and D-007
**Status:** Approved 2026-08-05 by the sole project owner acting as product, operations and recovery authority
**Scope:** Define what must be measured and rehearsed before Gate 0 promotion. No target below is evidence of achieved reliability.

This contract is approved for Gate 0. The decision register is the approval record. Targets are owner-approved objectives, but are not demonstrated as achieved until measured evidence supports them.

## Proposed critical-journey SLIs (D-006)

| SLI | Numerator | Denominator | Exclusions | Proposed initial target |
|---|---|---|---|---|
| Release readiness | Requests returning `ready` with matching frontend/backend compatibility | Valid readiness probes during a release window | Deliberate test probes and maintenance windows recorded before the window | 99.5% monthly |
| Authenticated session start | Sessions reaching the authenticated shell without an application error | Valid synthetic fixture sign-in attempts | Invalid credentials, unavailable approved fixture environment and user cancellation | 99.5% |
| Critical mutation success | Approved period, couple-link, message-send and receipt mutations returning success | Authorized synthetic or aggregate production attempts with a stable request ID | Client cancellation before request, rejected validation and intentionally unauthenticated requests | 99.9% |
| Scheduled effect uniqueness | Idempotent notification/scheduled-effect keys emitted at most once | Accepted scheduled-effect intents | Disabled destinations and explicitly rejected consent | 100% duplicate-free |
| Recovery readiness | Rehearsals meeting the approved decision and restore objectives | Approved non-production rollback/restore rehearsals | Aborted rehearsals with a documented infrastructure cause | 100% before promotion |

Telemetry may record route/function class, outcome, bounded reason, duration bucket, release identity and synthetic-run marker. It must not record dates, period history, notes, pain values, message text, user IDs, couple IDs, tokens or notification content.

## Baseline and approval process

Engineering will collect a 28-day baseline after the redacted telemetry contract is deployed. The baseline report must show counts, missing-data treatment, exclusions and confidence/coverage limitations for each SLI. The targets are owner-approved objectives, not demonstrated achievements, until the baseline evidence is reported; a green build or HTTP 200 health response cannot substitute for the baseline.

The operator approval must also name the error-budget response: pause non-critical rollout, open an incident, or accept a bounded exception with owner, reason, controls and expiry. Privacy/security review is required for telemetry fields before collection.

## Proposed backup and restore objective (D-007)

Engineering proposes:

- **Backup owner:** a named release operator, with engineering as the executor and product as the recovery approver.
- **Restore target:** a disposable, access-restricted non-production Convex deployment containing synthetic data only. The exact selector must be supplied by the operator and recorded before rehearsal.
- **Backup source:** an approved Convex export or provider-supported backup from the non-production fixture deployment; never a destructive production export for this rehearsal.
- **RPO:** 24 hours for the initial Gate 0 objective, subject to operator/product approval.
- **RTO:** four hours for data restore, integrity checks and documented service recovery, subject to operator/product approval.
- **Integrity checks:** expected synthetic users/couples, schema-readable records, authorization boundaries and absence of unexpected cross-couple data.
- **Evidence:** redacted command output, source/target selectors classified by environment, start/end timestamps, measured RPO/RTO and approver sign-off.

Rollback and restore scripts must reject production selectors, unresolved targets and destructive Git operations. A restore rehearsal is not complete merely because a backup command exits successfully.

## Approval record

D-006 and D-007 were approved by the sole project owner on 2026-08-05. The 28-day baseline, proposed targets, exclusions, pause/incident response, `dev:hallowed-hummingbird-284` synthetic-only rehearsal target, 24-hour RPO and four-hour RTO are binding Gate 0 objectives. O2 and planning for X1 may proceed; X1 must revalidate that its target remains non-production immediately before rehearsal.
