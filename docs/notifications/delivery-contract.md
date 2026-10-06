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
| `projectInApp(ctx, args)` | `{ eventId, expectedGeneration, expectedSourceAuthorityVersion?, expectedReminderWindowVersion? }`; the source and reminder-window fences are paired and required for `period_window_approaching.v1` and `late_status.v1` | VEGA projector; scheduled types remain denied until N8 integrates fresh source and preference checks |
| `cancelSource(ctx, sourceRef, reason)` | `{ sourceRef, reason }`, where reason is an allowlisted cancellation code | VEGA outbox helpers |
| `reconcileUserSchedule(ctx, userId)` | `{ userId }` | CHRONOS scheduler; VEGA preference mutation invokes it transactionally after handoff |
| `renderFrozen(args)` | `{ eventType, templateVersion, locale, variableSchemaVersion }` | MUSE templates; returns identity and fixed payload keys/route |
| `isNotificationSourceCurrent(ctx, event)` | Read-only; accepts `QueryCtx` or `MutationCtx`, returns `true` only for a present, matching, currently authorized source identity | VEGA N8; shared by inbox reads and the in-app projector |

## Typed event source identity (contract amendment, 2026-10-06)

Every newly written event carries one immutable, discriminated `sourceIdentity`. It is restricted server-side metadata, not client input or rendered content. Keep the persisted field optional so pre-amendment rows remain schema-readable; do not backfill them. New-write validators require the identity and validate its event type and envelope recipient. An absent, malformed, mismatched, or stale identity fails closed. Existing `sourceReference` remains for indexes and cancellation compatibility; it is never source authority.

```ts
type RelationshipSourceIdentity = {
  coupleId: Id<"couples">;
  relationshipMembershipId: Id<"coupleMembers">;
  ownerUserId: Id<"users">;
  recipientUserId: Id<"users">;
};

type NotificationSourceIdentity =
  | {
      eventType: "assisted_period_start.v1" | "assisted_period_end.v1";
      sourceId: Id<"periodEvents">;
      authorityVersion: number;
      primaryId: Id<"users">;
    }
  | {
      eventType: "period_window_approaching.v1";
      primaryId: Id<"users">;
      latestEligibleStartEventId: Id<"periodEvents">;
      sourceAuthorityVersion: string;
      reminderWindowVersion: number;
      dueLocalDay: string;
    }
  | {
      eventType: "late_status.v1";
      primaryId: Id<"users">;
      latestEligibleStartEventId: Id<"periodEvents">;
      sourceAuthorityVersion: string;
      reminderWindowVersion: number;
      localDay: string;
    }
  | {
      eventType: "pain_check_in.v1";
      requestId: Id<"painReminderRequests">;
      painLogId: Id<"painLogs">;
      requestVersion: number;
      primaryId: Id<"users">;
      selectedLocalDay: string;
    }
  | (RelationshipSourceIdentity & {
      eventType: "partner_linked.v1";
      sourceId: Id<"coupleMembers">;
    })
  | (RelationshipSourceIdentity & {
      eventType: "partner_message.v1";
      sourceId: Id<"coupleMessages">;
    })
  | (RelationshipSourceIdentity & {
      eventType: "partner_nudge.v1";
      sourceId: Id<"nudges">;
    })
  | (RelationshipSourceIdentity & {
      eventType: "partner_chat_cleared.v1";
      sourceId: Id<"couples">;
      clearOperationVersion: number;
    })
  | (RelationshipSourceIdentity & {
      eventType: "connected_since_updated.v1";
      sourceId: Id<"couples">;
      settingVersion: number;
    });
```

Every numeric identity version (`authorityVersion`, `reminderWindowVersion`, `requestVersion`, `clearOperationVersion`, and `settingVersion`) is a positive safe integer. Both new-write validators and the source reader enforce `Number.isSafeInteger(value) && value > 0`; `v.number()` alone is insufficient because Convex accepts non-finite numbers.

`sourceIdentity` is authoritative for domain-source identity. The existing event envelope's `sourceAuthorityVersion` is a compatibility projection only; new writes and the reader must require it to equal this mapping:

| Identity kind | Required envelope `sourceAuthorityVersion` |
|---|---|
| Assisted period start/end | `period-authority:${authorityVersion}` |
| Prediction window / Late status | Exactly `sourceIdentity.sourceAuthorityVersion`, parsed as the canonical G4-SOURCE-V1 tuple |
| Pain check-in | `pain-reminder-request:v${requestVersion}` |
| Partner linked, message, or nudge | `relationship-membership:${relationshipMembershipId}` |
| Partner chat cleared | `chat-clear:${clearOperationVersion}` |
| Connected-since updated | `connected-since-setting:${settingVersion}` |

The reader compares every identity field with both the event envelope and the current domain source; matching the envelope projection alone never grants authority. For relationship identities, `relationshipMembershipId` is the active partner membership row that anchors the link generation; it is not necessarily the recipient's membership row. `ownerUserId` and `recipientUserId` must exactly equal the corresponding event-envelope fields. The owner and source-row bindings are frozen per kind:

| Event kind | Owner source binding | Recipient source binding |
|---|---|---|
| `partner_linked.v1` | `sourceId === relationshipMembershipId`; owner is the user on that newly active partner membership who completed linking. | Either active member, with one separately keyed event per member. The linker's self-notice has `ownerUserId === recipientUserId`; the other member's notice has distinct IDs. |
| `partner_message.v1` | `coupleMessages.senderId` | Derive the recipient as the other active member in the couple's current `relationshipMembershipId` generation. `coupleMessages` does not store a recipient; the derived member must match the event envelope's `recipientUserId`. |
| `partner_nudge.v1` | `nudges.senderId` | `nudges.receiverId` |
| `partner_chat_cleared.v1` | `couples.chatClearedBy`, written atomically with the current `chatClearedAt` by the authenticated clearer | The other active member in that couple |
| `connected_since_updated.v1` | `couples.connectedSinceUpdatedBy` for the current setting version | The other active member in that couple |

The reader verifies an active couple with exactly one primary and partner membership, the current partner-row generation ID, identity/event/envelope agreement, and the exact source row. For chat-clear source authority, the couple's current `chatClearedAt` and `chatClearedBy` must match the identity's clear version and owner. Legacy clears without `chatClearedBy` fail closed; no actor is inferred or backfilled. Message recipient authority is derived from the two active members in the message's current generation, never from a nonexistent message recipient field; the derived recipient must match both typed identity and event envelope. Message and nudge checks use the partner generation row for either sender direction; they never alter chat acknowledgement or nudge-seen state. Other relationship kinds require distinct active owner and recipient members. Missing generation IDs on legacy source rows deny.

Scheduled identities are checked against `parseSourceAuthorityVersion`, the current served V2 read model, current source revision, and the recipient's current purpose preference/window revision. A shadow, stale, absent, paused, or unavailable served snapshot cannot authorize prediction work. Pain identities bind an active request/version to its existing pain log and primary owner. Assisted-period identities bind the exact period event, primary, and accepted authority version. No sharing flag grants another user access to health sources.

The reader is read-only and returns false for unknown types or any failed check. `getMyInbox` omits items whose event is not current; `projectInApp` suppresses/cancels disallowed work. Both call this same reader. It compares the typed identity with the stored event and current source, rather than inferring authority from event type, route, inbox state, timestamps, or parsed `sourceReference` text. No event without `sourceIdentity` can be projected or returned as current.

Idempotent replay compares the complete source identity as well as the existing envelope fields. Add `relationshipMembershipId` to the idempotency components for `partner_chat_cleared.v1` and `connected_since_updated.v1`, because their timestamp-based operation/setting versions can repeat after relinking. `partner_linked.v1` already includes its link-generation membership ID. This prevents equal timestamps across relinks from colliding or reviving prior rows.

The future-only adapter boundary receives a current dispatch authorization containing a non-in-app channel, independently resolved destination identity/version, stable logical key, optional provider idempotency key, expiry, frozen render identity, and the static payload. Its normalized result is exactly one of `accepted(providerMessageId?)`, `retryable_failure(errorCode, retryAfterMs?)`, `permanent_failure(errorCode)`, or `unknown(errorCode?)`. A retryable result means non-acceptance is known; ambiguity is `unknown`. This boundary is contract-only in Gate 4 and has no runtime caller.
