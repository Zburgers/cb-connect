# Gate 0 redacted telemetry contract

**Decision:** D-006
**Status:** Approved contract; instrumentation and baseline measurement remain later Gate 0 work.

This contract defines the only event shape that may be serialized for critical-journey reliability metrics. It is intentionally allowlist-based: unknown fields are rejected instead of being forwarded.

## Serialized shape

```ts
type SerializedTelemetry = {
  operation:
    | "release_readiness"
    | "authenticated_session_start"
    | "critical_mutation"
    | "scheduled_effect_uniqueness"
    | "recovery_readiness";
  outcome: "success" | "failure";
  reason:
    | "ok"
    | "timeout"
    | "unavailable"
    | "mismatch"
    | "invalid_fixture"
    | "validation_rejected"
    | "unauthenticated"
    | "client_cancelled"
    | "duplicate"
    | "infrastructure_failure";
  durationBucket:
    | "0-10ms"
    | "10-50ms"
    | "50-100ms"
    | "100-250ms"
    | "250-500ms"
    | "500-1000ms"
    | "1000ms+";
  synthetic: boolean;
};
```

Callers provide a numeric `durationMs`; the serializer emits only the bounded bucket. It never emits the raw duration.

## Privacy boundary

The serializer rejects dates, period history, notes, pain values, message text, emails, user IDs, couple IDs, tokens, notification content, arbitrary operation/reason strings and every other unknown field. Release identity may be correlated separately through the approved release metadata contract; it is not copied into this generic event payload.

The `synthetic` marker distinguishes approved fixture measurements from aggregate production measurements. It does not authorize production fixture creation or make synthetic results production evidence.

## D-006 relationship

The operations map to the approved release-readiness, authenticated-session, critical-mutation, scheduled-effect-uniqueness and recovery-readiness SLIs. The reason and outcome enums support the documented exclusions without storing their sensitive source data. The targets are owner-approved objectives, but are not demonstrated as achieved until the approved 28-day baseline provides direct evidence and the error-budget policy is exercised.

This file defines serialization only. It does not add event collection, storage, dashboards, user-facing analytics or a Gate 0 completion claim.
