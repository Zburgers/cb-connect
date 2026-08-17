# Gate 0 service-level objectives

**Decision:** D-006
**Status:** Targets and definitions approved 2026-08-05; baseline not measured

These SLOs define the Gate 0 measurement contract. They are not evidence that
the service has achieved the targets. The baseline starts only after the
allowlisted telemetry contract is deployed and runs for 28 days.

The measurement owner and review approver are the sole project owner acting as
release operator, product owner and incident authority. The review date is
after the first 28-day baseline and at least quarterly thereafter; the
decision-register review date is 2026-11-05.

| SLI | Owner | Numerator | Denominator | Exclusions | Target | Baseline | Evidence / review |
|---|---|---|---|---|---:|---|---|
| Release readiness | Sole project owner / release operator | Requests returning `ready` with matching frontend/backend compatibility | Valid readiness probes during a release window | Deliberate test probes and maintenance windows recorded before the window | 99.5% monthly | Not measured; no 28-day production baseline | [D-006 measurement plan](gate-0-measurement-plan.md); review after first 28-day baseline |
| Authenticated session start | Sole project owner / release operator | Sessions reaching the authenticated shell without an application error | Valid synthetic fixture sign-in attempts | Invalid credentials, unavailable approved fixture environment and user cancellation | 99.5% | Not measured; protected test credentials are not available in this local shell | [fixture contract](../testing/authenticated-release-fixtures.md); review after first 28-day baseline |
| Critical mutation success | Sole project owner / release operator | Approved period, couple-link, message-send and receipt mutations returning success | Authorized synthetic or aggregate production attempts with a stable request ID | Client cancellation before request, rejected validation and intentionally unauthenticated requests | 99.9% | Not measured; no allowlisted baseline report exists | [telemetry contract](telemetry-contract.md); review after first 28-day baseline |
| Scheduled effect uniqueness | Sole project owner / release operator | Idempotent notification/scheduled-effect keys emitted at most once | Accepted scheduled-effect intents | Disabled destinations and explicitly rejected consent | 100% duplicate-free | Not measured; no production or synthetic effect baseline exists | [D-006 measurement plan](gate-0-measurement-plan.md); review after first 28-day baseline |
| Recovery readiness | Sole project owner / release operator | Rehearsals meeting the approved release and restore objectives | Approved non-production rollback/restore rehearsals | Aborted rehearsals with a documented infrastructure cause | 100% before promotion | Dry-run policy passed; measured restore RPO/RTO and integrity are not recorded | [X1 proof](../evidence/reliability-gate-0/x1-dev-proof.md); review after first measured rehearsal and 28-day baseline |

## Measurement rules

Only the fields in [the redacted telemetry contract](telemetry-contract.md)
may be serialized. Counts, missing-data treatment, exclusions and coverage
limitations must accompany every baseline report. Synthetic measurements must
remain visibly distinct from aggregate production measurements.

Missing telemetry, an unavailable approved fixture environment or an
unclassifiable event is not a successful observation. It is reported as a
coverage limitation and blocks claiming the target was achieved.

## Approval boundary

D-006 approved the definitions, initial targets, 28-day baseline window and
pause/incident response on 2026-08-05. The approval authorizes measurement; it
does not supply the baseline or authorize production fixture creation.
