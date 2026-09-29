# G4-DELIVERY-V1 contract

This document freezes the provider-neutral notification lifecycle used by Gate 4. It complements [G4-EVENT-V1](event-catalog.md), which is the authority for domain event meaning, recipients, privacy class, validity, event keys, and allowed channels.

## Durable records and identity boundaries

The records represent different facts and remain separate:

1. `NotificationEvent` records a confirmed domain intent and the authorized CB Connect recipient. It contains a catalog type/version, opaque source reference and source authority version, recipient/user IDs, privacy class, validity rule, event idempotency key, and allowed channel. It has no copy, external address, destination, or provider data.
2. `InboxItem` is the recipient-scoped in-app projection. It references its event and stores only the frozen template version, route enum, current/read/dismissed state, and timestamps. It is not a delivery receipt.
3. `NotificationDelivery` is one logical attempt to fulfill an event through one channel and stable destination identity. Its unique logical key is `eventId + channel + stableDestinationId`; a changed destination version does not create another logical delivery.
4. `DeliveryAttempt` is one bounded execution attempt. It references the logical delivery and records attempt ordinal/generation, destination version, normalized outcome, allowlisted error code, and timestamps. It never defines recipient, eligibility, rendered copy, or logical-delivery success by itself.

For in-app delivery, the stable destination is the recipient's inbox and needs no destination registry. Any future email, push, SMS, or other destination must be resolved independently from an approved destination record. Domain events always address CB Connect user IDs, never delivery endpoints.

## Three idempotency scopes

| Scope | Stable components | Guarantee |
|---|---|---|
| Domain event | Exact ordered components in G4-EVENT-V1, including event type and domain transition/recipient versions | Transactional retries converge on one logical event. Incidental snapshot refreshes and executor timestamps are excluded. |
| Logical delivery | `eventId + channel + stableDestinationId` | Transactional retries converge on one logical delivery per channel/destination. Destination token/version rotation does not create a new logical key. |
| Provider request | Opaque stable derivation of the logical delivery key, used only when a future adapter declares compatible provider scope and dedupe lifetime | A capability may prevent some duplicate provider effects. It does not promise exactly-once physical delivery across arbitrary providers. Retry count never changes the key. |

The runtime helpers serialize key components as JSON arrays to avoid delimiter ambiguity. Event channels are validated against the catalog; every current V1 event permits only `in_app`. No Gate 4 provider adapter, external destination table, network dispatch, or provider receipt endpoint exists.

## Provider-neutral state contract

Delivery status, eligibility, and factual provider outcome are separate. The finite status set is `pending`, `processing`, `accepted`, `delivered`, `retry_wait`, `failed_permanent`, `unknown`, `expired`, `suppressed`, and `cancelled`. Provider outcome is one of `none`, `accepted`, `delivered`, `retryable_failure`, `permanent_failure`, or `unknown`.

| Fact | Contract |
|---|---|
| Claim | Only eligible `pending` or due `retry_wait` work can be claimed. Claims are fenced by generation/lease in the durable implementation. |
| In-app persistence | A successful inbox persistence is recorded atomically with the `delivered` logical state and successful attempt. Here `delivered` means inbox persistence only, not display, read, or external receipt. |
| Provider acceptance | `accepted` means a provider accepted the request. It does not mean device delivery or that a user read it. |
| Provider receipt | A documented authenticated receipt may advance an accepted provider outcome to `delivered`. Duplicate/out-of-order receipts never regress the factual outcome. A conflicting terminal receipt is an anomaly. |
| Known retryable failure | `retry_wait` is allowed only when the adapter has established the request was not accepted; retry deadline and attempt budget are bounded. A provider `Retry-After` is a minimum deadline. |
| Permanent failure | `failed_permanent` is terminal for automatic processing. It is never replayed through a dead-letter path. |
| Ambiguous result | Timeout after possible dispatch, lost response, or a failed result write after acceptance becomes `unknown`. It is not blindly resent. Only documented safe provider dedupe or lookup can resolve it. |
| Cancellation/expiry | Supersession, revocation, disabled purpose, or expired validity prevents future projection/retry. A late receipt may add factual outcome but cannot restore eligibility or resurrect inbox content. No cancellation means hard deletion. |

`in_app` never has provider acceptance, provider receipt, or physical delivery states. Provider-neutral fakes belong only in deterministic tests and do not authorize network effects.

## Frozen rendering contract

Each logical delivery retains immutable `templateVersion`, `locale`, `variableSchemaVersion`, and `payloadHash` identity. Render payloads contain only finite code-owned title/body keys and an allowlisted route; they cannot carry arbitrary strings. The hash covers this code-defined static payload only; it is internal metadata, not an anonymization or telemetry dimension. A retry uses the same identity and payload. A newer template applies only to newly created logical deliveries. Source correction cancels/supersedes old work rather than re-rendering it.

The N4 `renderFrozen(args)` input is `eventType`, `templateVersion`, `locale`, and `variableSchemaVersion`; it accepts no caller variables. The result is a `FrozenRenderIdentity` plus finite, code-owned `titleKey`, `bodyKey`, and an allowlisted route (`periods`, `messages`, `pain`, or `settings`). No message preview, health value, recipient identity, or user text is interpolated. Health-adjacent templates remain gated by D-011.

## Frozen lane entry points

These argument/result shapes are owned here. Implementations belong to their assigned lanes and must not alter the contract without a reviewed contract change.

| Entry point | Frozen input | Owner |
|---|---|---|
| `reconcileSource(ctx, sourceRef, authorityVersion)` | `{ sourceRef, authorityVersion }` | CHRONOS scheduler; consumes VEGA source-authority metadata |
| `projectInApp(ctx, eventId, expectedGeneration)` | `{ eventId, expectedGeneration }` | VEGA projector, after current recipient/source/purpose checks |
| `cancelSource(ctx, sourceRef, reason)` | `{ sourceRef, reason }`, where reason is an allowlisted cancellation code | VEGA outbox helpers |
| `reconcileUserSchedule(ctx, userId)` | `{ userId }` | CHRONOS scheduler; VEGA preference mutation invokes it transactionally after handoff |
| `renderFrozen(args)` | `{ eventType, templateVersion, locale, variableSchemaVersion }` | MUSE templates; returns identity and fixed payload keys/route |

The future-only adapter boundary receives a current dispatch authorization containing a non-in-app channel, independently resolved destination identity/version, stable logical key, optional provider idempotency key, expiry, frozen render identity, and the static payload. Its normalized result is exactly one of `accepted(providerMessageId?)`, `retryable_failure(errorCode, retryAfterMs?)`, `permanent_failure(errorCode)`, or `unknown(errorCode?)`. A retryable result means non-acceptance is known; ambiguity is `unknown`. This boundary is contract-only in Gate 4 and has no runtime caller.
