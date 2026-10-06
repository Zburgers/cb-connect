# G4-EVENT-V1 catalog

This catalog freezes Gate 4 domain intent. Events address authorized CB Connect users; a `NotificationDelivery` resolves the in-app destination separately. Every V1 event permits only `in_app`. No event stores rendered copy, message text, health values, contact details, device tokens, or provider destinations.

The typed `sourceIdentity`, `sourceReference`, source authority version, recipient IDs, idempotency key, and local-day key components are restricted server-side metadata. They are not client fields, telemetry dimensions, or retention instructions. `validity` controls whether an event can still be projected; it does not authorize deletion. Existing source authorization is rechecked at projection and read time. The persisted `sourceIdentity` remains optional only for old readable rows; new writes require it, and rows without it fail closed.

| Event type | Producer → recipient | Privacy class | Valid while | Event idempotency components | Cancel/supersede when |
|---|---|---|---|---|---|
| `assisted_period_start.v1` | Accepted period start → primary | `primary_private_health` | Source authority remains current and the primary retains access | `type, periodEventId, authorityVersion, primaryId` | Source correction/deletion or primary access revocation |
| `assisted_period_end.v1` | Accepted period end → primary | `primary_private_health` | Source authority remains current and the primary retains access | `type, periodEventId, authorityVersion, primaryId` | Source correction/deletion or primary access revocation |
| `period_window_approaching.v1` | Current served V2 snapshot → primary | `primary_private_inferred_health` | Designated due local day while the snapshot and prediction remain current | `type, primaryId, latestEligibleStartEventId, sourceAuthorityVersion, dueLocalDay, reminderWindowVersion` | New start, correction/tombstone, pause, timezone change, stale snapshot, or preference off |
| `late_status.v1` | Approved served Late state → primary | `primary_private_inferred_health` | The current Late state remains valid | `type, primaryId, sourceAuthorityVersion, localDay, reminderWindowVersion` | Late state changes, pause, source change, or preference off; producer/copy stay disabled under D-011 |
| `pain_check_in.v1` | Explicit primary request → primary | `primary_private_health` | Selected local day while the request is active | `type, requestId, requestVersion, primaryId` | Request edit, cancellation, or revocation; score thresholds never create a request |
| `partner_linked.v1` | Active link transition → each participant separately | `account_relationship_sensitive` | Link generation remains active | `type, coupleId, linkGeneration, recipientId` | Link revoked |
| `partner_message.v1` | New couple message → other active member | `relationship_private_free_text_source` | Message and active link still exist | `type, messageId, recipientId` | Message deleted, chat cleared, or link revoked; no message body or preview is copied |
| `partner_nudge.v1` | New nudge → nudge receiver | `relationship_private_emoji_source` | Nudge is unseen and link remains active | `type, nudgeId, receiverId` | Nudge seen or link revoked; the existing nudge read state remains authoritative |
| `partner_chat_cleared.v1` | Explicit chat clear → other active member | `account_relationship_sensitive` | Until newer chat state or link revocation | `type, coupleId, clearOperationId, relationshipMembershipId, recipientId` | Newer chat state or link revoked; no cleared content is copied |
| `connected_since_updated.v1` | Explicit setting update → other active member | `account_relationship_sensitive` | Until setting version changes or link revocation | `type, coupleId, settingVersion, relationshipMembershipId, recipientId` | Newer setting version or link revoked; no date or name is copied |

## Contract checks

- The runtime catalog and strict event-envelope validator live in `convex/_helpers/notificationTypes.ts`.
- A new event has an immutable discriminated `sourceIdentity` matching its event type, exact source row, owner, recipient and current authority; only old stored rows may omit it. See the typed source identity contract in `delivery-contract.md`.
- A V1 event has `eventVersion: 1`; the schema never accepts arbitrary payload fields.
- Recipient identity is separate from destination identity. In-app delivery uses the recipient's inbox; no email, push, SMS, or Discord delivery is enabled by this catalog.
- Event, logical-delivery, and provider idempotency are separate scopes. Provider support does not imply exactly-once physical delivery.
- Retention, deletion, and account/couple erasure remain governed by D-012. Expiry or cancellation never means hard deletion.
