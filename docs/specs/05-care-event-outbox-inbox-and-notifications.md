# Care Event Outbox, Inbox, and Notifications

| Field | Value |
|---|---|
| Status | Proposed — implementation not started |
| Owner | CB Connect backend/notifications |
| Milestone | `v0.2.0` minimum event, inbox, and delivery foundation |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | Trust/auth spec 01; relationship lifecycle spec 02; Care Loop event and consent contract; [GitHub issue #9](https://github.com/Zburgers/cb-connect/issues/9) |

## Purpose

Provide one durable path from a committed domain transition to an in-app inbox item and, when explicitly permitted, a generic external alert. Events, recipient inbox state, preferences, devices, delivery plans, network attempts, and provider receipts are separate records because they have different authorization, retry, retention, and privacy lifecycles.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.

## v0.2.0 boundary

The minimum release includes:

- immutable, deduplicated care/domain events written with the source transition;
- a recipient-safe, paginated in-app inbox with unread/read/archive state;
- category and channel preferences, pause state, quiet hours, and timezone;
- durable delivery planning, claims, attempts, cancellation, and receipt-ready state;
- generic external previews and a mandatory authorization/consent recheck before send;
- an isolated legacy Discord adapter for explicitly allowed legacy categories;
- cancellation after event expiry/cancellation, relationship unlink/revoke/safety reset, account disablement, preference withdrawal, or device revocation.

The v0.2.0 product channels are `in_app` and, temporarily, `discord_legacy`. Mobile push, email, SMS, critical alerts, and rich lock-screen content are not release commitments. The records and adapter contract MUST allow a later `push` provider without changing event identity or inbox semantics.

## Current gaps

The reviewed implementation has these verified gaps:

1. `notificationLog` mixes in-app activity, domain facts, Discord outcomes, and user-visible history in one row with `payload: v.any()` and only `sent`/`failed` states.
2. Domain mutations insert `notificationLog` rows marked `sent` even when no external send occurred. Other paths call Discord directly, so identical product events have different meanings.
3. `externalNotificationConsent` is one coarse user boolean. There is no category/channel preference, quiet-hours rule, pause, recipient sensitivity, device registration, or destination revocation.
4. The prediction cron and event actions have no stable event or delivery key. A retry after provider acceptance can duplicate the alert; issue #9 tracks this confirmed failure mode.
5. The Discord action records success only after the network request and cannot distinguish rejected, accepted, delivered, or ambiguous outcomes.
6. Authorization and consent are checked before scheduling in some producers but not rechecked immediately before the external side effect.
7. Event cancellation, Care Card expiry, unlink, safety reset, and account deletion do not cancel queued work.
8. The daily job scans primary users with an unbounded filtered collection and uses a direct daily-cron helper rather than the current project Convex scheduling pattern.
9. External messages can contain dates or detailed health context. The settings history projection can expose stored message text and arbitrary payload keys.
10. There is no user timezone, daylight-saving policy, provider receipt, retry budget, sending lease, or dead-letter state.

## Normative invariants

### Event and inbox

1. A domain event MUST be inserted in the same Convex transaction as the state transition it represents. A failed domain mutation produces no event.
2. Events MUST be immutable except for bounded lifecycle fields such as cancellation time. Corrections create a new versioned event; they do not rewrite history.
3. The event dedupe key MUST be derived from stable domain identity and transition/version, never wall-clock time or a random request ID.
4. An event MUST contain only routing IDs, typed safe metadata, and a generic preview key. Private notes, raw health values, message bodies, care reasons, and provider tokens MUST NOT enter the event.
5. One recipient/event pair MUST produce at most one inbox item. Inbox reads MUST resolve a current, recipient-safe DTO rather than expose the event document.
6. The in-app inbox is the canonical user-visible notification record. External delivery failure MUST NOT remove or duplicate its inbox item.

### Authorization, consent, and privacy

1. Planning-time eligibility is advisory. The sender MUST re-read current account status, recipient identity, event/entity state, relationship state, sharing permission, preference, device state, and expiry immediately before every external attempt.
2. Any failed recheck MUST cancel or suppress the plan without provider contact. Revocation wins over a queued retry or previously granted consent.
3. External previews MUST be generic by default, for example: “A new care request is waiting in CB Connect.” They MUST NOT reveal cycle phase, pain, symptoms, date, medication, custom text, requested action, partner identity, or safety-reset reason.
4. External payloads MUST contain only an opaque deep-link route or entity reference that requires fresh authenticated authorization in the app. No bearer secret or reusable health payload may appear in a link.
5. Preference withdrawal, unlink, relationship revocation, safety reset, event cancellation/expiry, account disablement, and device revocation MUST prevent all unsent attempts.
6. A safety reset MUST NOT generate a counterpart notification. Cancellation telemetry MUST not identify safety reset as the reason outside restricted audit data.

### Delivery and retries

1. A delivery plan MUST be durably and uniquely claimed before calling a provider. Only the active lease holder may send.
2. Provider adapters MUST accept a stable idempotency key when the provider supports one. The system promises effectively-once planning, not impossible exactly-once behavior across providers.
3. A definitive transient failure MAY retry with a bounded policy. An ambiguous outcome from a provider without idempotency support MUST NOT auto-retry, because a duplicate sensitive alert is worse than relying on the inbox.
4. Attempt and receipt rows are append-only operational records. Current delivery state is a projection on the plan, not inferred by counting log rows.
5. All workers MUST use indexed, bounded batches and scheduled continuation. No user-wide or delivery-wide unbounded `.collect()` scan is allowed.

## Stable identity and dedupe keys

| Record | Stable key example | Rule |
|---|---|---|
| Domain event | `care_request:{requestId}:published:v{revision}` | One key per meaningful transition/version |
| Prediction event | `period_prediction:{userId}:{predictedDate}:3d:{algorithmVersion}` | Same schedule run creates the same event |
| Inbox item | `{eventId}:{recipientUserId}` | One recipient-visible item per event |
| Delivery plan | `{eventId}:{recipientUserId}:{channel}` | Devices are destinations under one channel plan |
| Device destination | `{planId}:{deviceId}` | Separate revocation and provider result per device |
| Attempt | `{planId}:{destinationId}:{attemptNumber}` | Attempt number allocated transactionally |

Convex indexes do not declare uniqueness. Each creation mutation MUST query the full indexed key with `.unique()` and insert/return the existing record in one transaction so optimistic concurrency prevents duplicate committed claims.

## Record sketches

These are conceptual schemas; implementation validators use discriminated unions and explicit indexes in `convex/schema.ts`.

```ts
careEvents: {
  dedupeKey, type, category, actorUserId?, recipientUserId,
  coupleId?, entityType, entityId, entityRevision,
  previewKey, safeArgs?, createdAt, expiresAt?, cancelledAt?
}

notificationInbox: {
  inboxKey, eventId, recipientUserId, category,
  state, // unread | read | archived
  createdAt, readAt?, archivedAt?, invalidatedAt?
}

notificationPreferences: {
  userId, category, channel,
  enabled, previewPolicy, // generic_only for every external channel in v0.2.0
  quietStartMinute?, quietEndMinute?, timeZone?,
  pausedUntil?, updatedAt
}

notificationDevices: {
  userId, channel, provider, tokenCiphertext, tokenFingerprint,
  platform, status, // active | revoked | invalid
  registeredAt, lastSeenAt, revokedAt?, providerEnvironment
}

notificationDeliveryPlans: {
  deliveryKey, eventId, recipientUserId, channel,
  state, // planned | deferred | claimed | delivered | suppressed | cancelled | failed | unknown
  notBefore, expiresAt?, attemptCount, nextAttemptAt?,
  leaseId?, leaseExpiresAt?, finalReason?, createdAt, updatedAt
}

notificationDeliveryAttempts: {
  planId, destinationId?, attemptNumber, idempotencyKey,
  startedAt, completedAt?, outcome, // accepted | retryable_failure | permanent_failure | unknown
  providerCode?, safeErrorCode?, providerMessageIdHash?
}

notificationDeliveryReceipts: {
  attemptId, provider, providerReceiptKey, status,
  occurredAt?, receivedAt, safeReasonCode?
}
```

Required indexes include full stable keys plus bounded worker paths: plan state/next-attempt time, recipient/inbox creation time, user/category/channel preference, user/device status, event/couple/entity cancellation scope, and provider receipt key. Provider tokens MUST be encrypted or protected as destination secrets, never returned by queries or written to logs. Fingerprints support dedupe without exposing tokens.

## Event and delivery state machines

| Event state | Trigger | Result |
|---|---|---|
| `active` | Domain transition commits | Planner may create inbox and delivery plans |
| `active` | Entity cancelled or expires | `cancelled` or `expired`; unsent plans cancelled |
| `active` | Unlink/revoke/account disable | Recipient eligibility removed; unsent plans cancelled |
| terminal | Late planner/worker | No provider call; preserve terminal state |

| Plan state | Trigger | Next |
|---|---|---|
| `planned` | Quiet hours or pause active | `deferred` with indexed `nextAttemptAt` |
| `planned`/`deferred` | Worker claims after recheck | `claimed` with expiring lease |
| `claimed` | Provider definitively accepts | `delivered` or receipt-pending accepted state |
| `claimed` | Definitive transient failure within budget | `deferred` |
| `claimed` | Permanent failure | `failed`; invalidate destination when applicable |
| `claimed` | Ambiguous outcome without provider idempotency | `unknown`; no automatic retry |
| any unsent | Consent/auth/entity/device recheck fails | `suppressed` or `cancelled` |
| `claimed` | Lease expires before provider contact is proven | Reclaim only when attempt evidence permits |

## Category and channel matrix

| Category | In-app default | External v0.2.0 | Quiet-hours bypass | Preview |
|---|---:|---:|---:|---|
| Care request available | On for eligible recipient | Off unless explicit opt-in; never Discord legacy | No | Generic only |
| Care request changed/cancelled | Update/invalidate existing item | Off | No | No external detail |
| Direct message | Existing chat surface; inbox optional | Not in v0.2.0 | No | Future generic only |
| Partner-assisted update | On for primary | Off by default | No | Generic only if later enabled |
| Cycle/prediction reminder | On for owner | Discord legacy only during migration and explicit opt-in | No | Generic reminder; no date/phase |
| High-pain legacy alert | On for owner | Disable external in v0.2.0 pending safety decision | No | Never include score/date |
| Account/security action | On for owner when safe | Future verified channel | Product decision | Generic account notice |
| Safety reset | Initiator confirmation only | None to counterpart | N/A | No counterpart event |

An inbox item can be required for product state without granting an external channel. Channel preferences never broaden the underlying relationship or sharing authorization.

## Quiet hours, timezone, and time

1. Quiet hours use a validated IANA timezone and local minute-of-day boundaries; fixed UTC offsets are not sufficient.
2. Ranges crossing midnight MUST work. Daylight-saving changes are evaluated from the IANA zone each time the worker calculates `nextAttemptAt`.
3. If a valid user timezone is absent, non-security external delivery MUST remain deferred or in-app only; the server MUST NOT guess from IP or browser headers.
4. The v0.2.0 recommended default is external delivery off. If enabled, default quiet hours are 21:00–08:00 local until the user changes them.
5. Event expiry wins over quiet-hour deferral. If the next allowed send time is after expiry, cancel the plan.
6. All persisted instants are epoch milliseconds. User-facing calendar dates remain separate domain values and MUST NOT be inferred from delivery timestamps.

## Retry, receipt, and cancellation policy

- Maximum three provider attempts within event expiry: approximately 1 minute, 5 minutes, and 30 minutes, with bounded jitter and provider `Retry-After` respected.
- Authentication, consent, revocation, expiry, invalid destination, and malformed payload failures are permanent; they are never retried.
- Rate limits, provider unavailability, and network failure before provider acceptance are retryable.
- Timeout or connection loss after a request may have reached a provider is `unknown` unless a provider idempotency key or receipt query resolves it.
- A provider callback MUST be authenticated, deduplicated by provider receipt key, and applied through an internal mutation.
- Unlink/revoke/cancel flows SHOULD cancel plans by indexed event/entity/couple scope immediately. The mandatory send-time recheck remains the final race-safe guard.

## Public and internal surface

Public functions derive the recipient from authenticated identity and return client-safe DTOs:

- `notifications.listInbox` with cursor pagination;
- `notifications.getInboxSummary` with a maintained unread projection, not `.collect().length`;
- `notifications.markRead`, `archive`, and `updatePreference`;
- future `notifications.registerDevice` and `unregisterDevice`, with tokens accepted only for the authenticated user and never returned.

Internal functions own `recordEvent`, `planEvent`, `cancelForEntity`, `claimDuePlans`, `sendClaimed`, `recordAttempt`, `applyReceipt`, and stale-lease recovery. All functions MUST have validators. Provider network calls live in channel-specific internal actions; database claims and results live in internal mutations.

## Migration

1. Add new tables and indexes without changing current reads. Introduce a typed event-category registry defining preview key, expiry, eligible recipient, cancellation scope, and retention.
2. Convert one producer at a time to commit a stable event and schedule its internal planner in the same transaction. Start with Care Loop, then partner-assisted updates and prediction reminders.
3. Shadow-plan deliveries with provider sending disabled. Repeated cron/action runs must converge on one event, inbox item, and plan.
4. Enable the in-app inbox and migrate settings history to read it. Do not blindly backfill arbitrary `notificationLog.payload`; legacy rows remain a short-lived, read-only archive because their content is untyped.
5. Replace the unbounded primary-user scan with an indexed, bounded scheduled producer. Use supported `crons.cron` or `crons.interval` registration and stable per-window keys.
6. Move Discord behind `discord_legacy`. It may consume only eligible generic plans, never be called by a domain mutation, and never receive Care Loop, DM, safety, or raw health content.
7. Dual-write a minimal legacy outcome only if rollback observation requires it; stop all legacy writes once the new pipeline is reconciled.
8. Add retention cleanup for expired inbox content, operational attempts/receipts, invalid devices, and legacy logs using bounded internal jobs.

## Acceptance criteria

- [ ] Repeating a domain mutation, cron window, planner, or worker creates one logical event, inbox item, and channel plan per stable key.
- [ ] Event publication and its source domain transition commit or fail together.
- [ ] Inbox queries are authenticated, paginated, recipient-safe, and maintain correct unread state without unbounded counts.
- [ ] No external call occurs after cancellation, expiry, unlink, revoke, safety reset, account disablement, preference withdrawal, or device revocation.
- [ ] External previews and deep links reveal no health, care, message, partner, or safety detail before authenticated authorization.
- [ ] Quiet hours, timezone absence, daylight-saving changes, pause, and expiry produce deterministic defer/cancel outcomes.
- [ ] Definite failures retry within budget; permanent failures do not; ambiguous non-idempotent outcomes do not duplicate automatically.
- [ ] Provider receipts are authenticated, deduplicated, and cannot mutate another provider's plan.
- [ ] Legacy Discord is optional, generic, isolated, and not the Care Loop product surface.
- [ ] Issue #9 closes with repeated-schedule and ambiguous-side-effect regression evidence.

## Test plan

1. **Event transaction:** source success/failure; duplicate key; revision transition; cancellation after publication.
2. **Inbox:** recipient isolation; unread/read/archive; pagination; event invalidation; no raw event document leakage.
3. **Authorization race:** revoke consent, unlink, safety reset, disable account, cancel/expire entity, or revoke device between plan and send; assert zero provider calls.
4. **Dedupe/concurrency:** repeated cron, concurrent planners, lease contention, worker retry, stale lease, and receipt replay.
5. **Retries:** definitive pre-accept failure, rate limit with `Retry-After`, permanent token failure, ambiguous timeout, provider idempotency success, and max-attempt exhaustion.
6. **Privacy:** snapshot every external payload and deep link; reject health values, custom text, dates, partner identity, tokens, and safety reason.
7. **Time:** overnight quiet range, timezone missing/changed, spring-forward gap, fall-back repetition, pause expiry, and event expiry during quiet hours.
8. **Migration:** legacy untyped rows remain isolated; shadow mode emits no network call; dual-run converges; Discord disabled/config missing.
9. **Production smoke:** publish a test care event, observe one inbox item, enable a safe test adapter, send once, then cancel/unlink and prove no later retry.

Use `convex-test` with Vitest for functions and fake provider adapters/clock control. Never call a real external provider from unit tests.

## Telemetry and operations

Measure event-to-inbox latency; planned/suppressed/deferred/cancelled counts by category/channel/reason; claim latency; attempts; accepted/failed/unknown outcomes; receipt latency; stale leases; retries exhausted; invalid-device rate; duplicate suppression; and attempted send after revocation.

Telemetry MUST NOT contain event safe arguments if they can identify a relationship, provider tokens, destination, payload body, deep-link entity ID, user name/email, health values, message text, or safety reason. Logs use event/plan IDs, category, channel, state, safe reason code, attempt number, and latency. Alert on any provider call after failed recheck, dedupe collision with mismatched facts, stuck claimed plans, and receipt authentication failures.

## Rollout and rollback

Roll out behind category/channel flags: schema and registry; event shadow writes; inbox; shadow plans; fake adapter; selected generic legacy Discord; then later push canary. Reconcile source transitions, events, inbox items, plans, and attempts at every phase. External channels default off.

Rollback disables planning and provider adapters while preserving events, inbox items, preferences, and operational evidence. It MUST NOT restore direct domain-to-Discord calls, resend `unknown` plans, reactivate cancelled plans, or weaken send-time authorization. Pending plans may be cancelled or resumed after repair using their existing stable keys; never recreate them with new keys.

## Open decisions

1. Which v0.2.0 categories, if any, may use `discord_legacy` before it is removed?
2. What retention periods apply separately to events, inbox items, plans, attempts, receipts, device tokens, and legacy logs?
3. Which provider will be the first real push adapter, and does it support idempotency keys plus authenticated delivery receipts?
4. Is one preference row per category/channel sufficient, or are self-versus-partner recipient preferences needed in v0.2.0?
5. What default quiet-hours window and timezone onboarding copy should ship?
6. Should account/security notices ever bypass quiet hours, and which verified channel can safely carry them?
7. Does the unread count need a per-user counter document in v0.2.0, or can the first inbox use a bounded recent-window projection?
8. Which event safe arguments are truly necessary, and can every preview be rendered from a fixed localization key with no arguments?
