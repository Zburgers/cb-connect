# Gate 0 incident response

## Authority and triggers

The sole project owner is the release operator, incident owner and escalation
authority. Open an incident for any P0, privacy/security concern, release
identity mismatch, readiness failure, authenticated critical-journey failure,
duplicate scheduled effect, failed integrity check or material error-budget
burn. A missing or incomplete baseline is a qualification blocker, not a
reason to invent an incident metric.

## Response sequence

1. Record UTC start time, release manifest identity, environment class,
   frontend/backend compatibility pair and the failing check. Redact secrets,
   user identifiers, message text, period history, notes, pain values and
   notification content.
2. Stop the affected promotion or non-critical rollout. Preserve the healthy
   process until a verified replacement or rollback is ready.
3. Classify the event as release, authentication, mutation, scheduled-effect,
   recovery, privacy or security. Record the bounded telemetry reason and
   whether the observation is synthetic.
4. For release failures, verify the artifact checksum, `/api/health`,
   `/api/ready`, listener/TLS state and persisted PM2 state. Roll back only to
   a recorded compatible pair using the [rollback runbook](../runbooks/release-rollback.md).
5. For restore failures, stop the rehearsal, retain redacted evidence and
   compare the integrity checks with the [backup/restore runbook](../runbooks/backup-restore.md).
6. Record containment, customer/data impact if known, owner, controls,
   follow-up and expiry. Do not infer impact from a green build or liveness
   response.

## Closure

The owner closes an incident only after the failing SLI is remeasured with
coverage, the compatible release or recovery path is verified, residual risk
and expiry are recorded, and any required privacy/security follow-up is
assigned. An exception cannot silently extend past its expiry.

## Evidence boundary

The [redacted telemetry contract](telemetry-contract.md) is the allowlist for
serialized reliability observations. The first 28-day baseline must report
counts, denominator treatment, exclusions and coverage limitations for every
SLI in [slo.md](slo.md). Until that report exists, Gate 0 remains blocked for
production promotion even if local tests and isolated-dev checks pass.
