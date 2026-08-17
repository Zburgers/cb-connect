# Gate 0 error-budget policy

**Decision:** D-006
**Status:** Response policy approved 2026-08-05; budgets not yet measured

The budget is the complement of each approved target over the stated
measurement window. The budget is actionable only when the numerator,
denominator, exclusions and coverage are reported from the allowlisted
telemetry contract.

| SLI | Target | Error budget | Burn / data response | Approver |
|---|---:|---:|---|---|
| Release readiness | 99.5% monthly | 0.5% | Pause non-critical rollout, verify the compatible release pair and open an owner-visible incident | Sole project owner / release operator |
| Authenticated session start | 99.5% | 0.5% | Pause authenticated exposure, protect the fixture environment, redact artifacts and open an incident | Sole project owner / release operator |
| Critical mutation success | 99.9% | 0.1% | Pause affected mutation rollout, preserve request-class evidence without user content, and open an incident | Sole project owner / release operator |
| Scheduled effect uniqueness | 100% duplicate-free | 0 duplicates | Disable the affected scheduled effect/channel, investigate idempotency and open a P0 incident | Sole project owner / release operator |
| Recovery readiness | 100% before promotion | 0 failed required rehearsals | Block promotion until the compatible rollback/restore rehearsal and integrity evidence are complete | Sole project owner / release operator |

## Universal responses

- A P0, privacy or security failure pauses non-critical rollout immediately and
  opens an owner-visible incident.
- A target miss or material budget burn blocks the affected promotion until the
  owner records containment, evidence, reason, controls and expiry.
- Missing baseline coverage is not a green result. It keeps the affected SLO
  unqualified and prevents a Gate 0 promotion claim.
- A bounded exception requires the sole owner, a written reason, controls,
  expiry and a named follow-up. No exception is currently recorded.
- Recovery uses only a previously recorded compatible frontend/backend pair;
  production restoration is not part of the synthetic X1 rehearsal.

## Baseline and review

The required baseline window is 28 days after telemetry deployment. The
current state is **not measured**: no SLO is labeled achieved and no budget is
reported as available. The owner reviews the first baseline, then revisits the
policy at least quarterly and after an ownership, hosting, privacy or
compatibility change.
