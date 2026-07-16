# Consent, Sharing, and Care Loop Privacy

| Field | Value |
|---|---|
| Status | Proposed — implementation not started |
| Owner | CB Connect product, backend, and privacy |
| Milestone | `v0.2.0` Gate 1 — lean Care Loop pilot |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Depends on | [CB Connect PRD v2](../product/cb-connect-prd-v2.md), [architecture baseline](../architecture.md), [01 trust boundaries](./01-trust-boundaries-and-auth-identity.md), and [02 relationship lifecycle](./02-relationship-lifecycle-data-rights-and-safety-reset.md) |
| Blocks | [04 Care Loop domain and state machine](./04-care-loop-v1-domain-and-state-machine.md) and [05 events, inbox, and notifications](./05-care-event-outbox-inbox-and-notifications.md) |

## Purpose

Define the consent decision that governs every Care Loop publication, partner
read, partner response, inbox item, and external notification. The design lets a
primary user share a bounded request without sharing the private check-in or
revealing whether other private data exists.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.

## Scope

In scope:

- the current category-level consent baseline;
- explicit Care Loop publication consent;
- effective-consent evaluation for reads, actions, and delivery;
- immutable recipient-specific share snapshots;
- request-only sharing, expiry, cancellation, and revocation;
- partner non-inference, threat controls, audit, and privacy-safe telemetry.

Out of scope:

- selected-detail or health-derived summary sharing;
- partner accept/complete states, outcomes, learned preferences, and recaps;
- general relationship lifecycle and erasure mechanics from spec 02;
- delivery retry/provider mechanics beyond the consent boundary from spec 05;
- mobile, push launch, HealthKit, and Health Connect.

## Current consent model

The reviewed implementation has three primary-owned membership controls in
`convex/schema.ts`:

- `sharingPhase` controls partner cycle/phase visibility;
- `sharingPain` controls partner pain visibility;
- `sharingPeriodWrite` separately authorizes partner-assisted period logging.

`sharingPeriodWrite` defaults false, depends on phase sharing, and is turned off
when phase sharing is disabled in `convex/mutations/couples.ts`. Partner reads in
`convex/queries/dashboard.ts` filter phase and pain server-side. Partner-assisted
period writes preserve the primary owner and actor attribution.

Current limitations:

1. Settings are persistent category booleans, not time-bounded consent receipts.
2. There is no Care Loop-specific enablement, explicit recipient, source
   revision, expiry, or per-share revocation.
3. Consent changes have no immutable event record or policy version.
4. `externalNotificationConsent` is one coarse user boolean.
5. `notificationLog.payload` is untyped and combines product events with
   delivery logging.
6. Cached partner UI state is not an authorization boundary.

The current absence behavior is worth preserving: a partner cannot distinguish
"not recorded" from "not shared."

## Privacy principles

1. **No implicit publication.** Logging private data never publishes a Care
   Card.
2. **Minimum disclosure.** v0.2.0 shares only the requested care and boundary.
3. **Recipient specificity.** Consent to one active partner is not reusable for
   a later relationship or another account.
4. **Finite access.** Every share expires; indefinite Care Cards are invalid.
5. **Revocation wins.** Current authorization overrides cached state, scheduled
   work, user preferences, and delivery retries.
6. **No existence inference.** Denied and absent private states are
   intentionally indistinguishable to a partner.
7. **No relationship scoring.** Consent and response events describe workflow
   state, not care quality or partner worth.

## v0.2.0 sharing mode

`request_only` is the default and only valid Care Loop mode in v0.2.0.

A request-only snapshot MAY contain:

- up to three allowlisted helpful action identifiers;
- up to three allowlisted avoid action identifiers;
- bounded custom helpful or avoid text where the selected item explicitly uses
  the custom variant;
- owner display label needed to understand the request;
- publication and expiry times;
- safe lifecycle status needed by the recipient UI.

It MUST NOT contain or derive:

- pain score, pain tag, symptom, flow, cycle date, phase, or prediction;
- energy, mood, bandwidth, medication, sleep, or temperature;
- a private note or evidence that a private note exists;
- an unselected field, raw private document, or database metadata;
- inferred severity, diagnosis, urgency, or recommended medical action.

The existing phase, pain, and assisted-write settings neither enable nor disable
a request-only card because the card contains none of those categories. A
separate Care Loop pilot enablement plus explicit publication is required.
Future modes that include health data must add the relevant category permission
as an upper bound and require a new approved specification.

## Effective consent intersection

Consent is a server-side decision evaluated for each operation. It is never a
stored boolean copied into client state.

```text
effective consent =
  authenticated actor
  AND active, non-disabled actor account
  AND server-derived active couple membership
  AND expected relationship role for the operation
  AND Care Loop pilot enabled for the owner/couple
  AND explicit owner publication
  AND immutable snapshot recipient == current partner
  AND snapshot couple == current active couple
  AND snapshot mode == request_only
  AND snapshot lifecycle is active
  AND server time < expiresAt
  AND no owner cancellation or revocation
  AND no relationship closure, safety reset, or account deletion
  AND requested operation is allowed for this actor/state
```

If any term is false, partner reads and actions MUST fail closed. The response
MUST be the same privacy-safe unavailable result for unknown, wrong-recipient,
expired, cancelled, revoked, closed-relationship, and deleted-owner cases.

### Publication decision

Publication additionally requires:

- authenticated primary owner derived server-side;
- no other active Care Card, unless the owner explicitly replaces it;
- a current private source revision owned by that caller;
- valid helpful/avoid item counts and bounded custom text;
- an expiry inside the approved minimum/maximum window;
- an explicit confirmation showing recipient, shared content, and expiry;
- an idempotency key unique to owner and publication intent.

Draft creation, draft editing, and existing category sharing MUST NOT satisfy
publication consent.

### Partner response decision

A partner response additionally requires an active share and an allowed
`acknowledged` or `cannot_help` transition. A duplicate idempotency key returns
the committed result. A different second response is rejected unless spec 04
defines an explicit correction transition.

## Immutable recipient share snapshot

Publishing MUST create a new `careShareSnapshots` record in the same transaction
as its consent/audit event. The owner-private source record is never exposed
through a partner query.

The snapshot records, at minimum:

- `ownerUserId`, `recipientUserId`, and `coupleId` derived server-side;
- `sourceCheckInId` and immutable `sourceRevision`;
- `mode: "request_only"` and `policyVersion`;
- normalized helpful and avoid items after validation;
- `consentedAt`, `publishedAt`, and required `expiresAt`;
- publication idempotency key or stable digest;
- creator actor and creation source.

Snapshot payload, recipient, couple, source revision, mode, policy version, and
times MUST NOT be patched. Editing a private check-in creates a new revision but
does not change a published share. Replacing a card terminates the old share and
publishes a new snapshot with a new identity.

Cancellation/revocation state SHOULD be represented in a separate indexed
access/lifecycle record. If implementation stores lifecycle fields beside the
snapshot, only those lifecycle fields may change; snapshot content remains
immutable. Every lifecycle transition emits an append-only audit event.

Partner queries MUST return a purpose-built DTO from the snapshot allowlist.
They MUST NOT return `careCheckIns`, spread a database document, or conditionally
attach private fields.

## Non-inference contract

Before a partner has seen a card:

- no card, private draft, withheld draft, invalid recipient, and revoked access
  all return the same empty/unavailable shape;
- counts, timestamps, error codes, loading states, and notification badges MUST
  NOT reveal that an owner has private data;
- the partner cannot request access or trigger repeated owner prompts.

After a partner has seen a card:

- expiry, cancellation, revocation, unlink, and safety reset render a generic
  "This Care Card is no longer available" state;
- the UI MUST NOT disclose which terminal reason occurred unless the owner
  explicitly chose a future, separately specified disclosure;
- notification and audit metadata visible to the partner MUST NOT reveal a
  safety-reset reason, new relationship, or private owner activity.

Server latency and response codes SHOULD be normalized for denied/absent paths
where practical. Authorization failures may be distinguished in internal audit
records, never in the partner payload.

## Revocation and expiry

### Owner cancellation

The owner can cancel an active share without partner approval. The transaction
MUST mark access unavailable, reject later partner actions, create an audit
event, and schedule cancellation of pending deliveries. Retrying is idempotent.

### Relationship and account revocation

Normal unlink, safety reset, relationship closure, account disablement, and
account deletion immediately override share state. The lifecycle boundary from
spec 02 MUST deny reads/actions synchronously and enqueue bounded cleanup. A
closed share MUST never become visible after relinking; a new couple requires a
new snapshot and explicit consent.

### Expiry

Partner reads and actions compare `expiresAt` with trusted server time. This is
the authoritative expiry control. A scheduled internal mutation SHOULD mark the
share expired so Convex subscriptions update promptly, but scheduler delay
cannot extend access. Expiry processing and retries are idempotent.

No cancellation, revocation, or expiry event sends detailed partner content by
default.

## Notification consent intersection

Creating a Care Card domain event does not authorize external delivery.

```text
external delivery allowed =
  effective consent still true immediately before send
  AND event recipient == snapshot recipient
  AND event/share not cancelled, revoked, expired, or superseded
  AND recipient enabled the Care Card category
  AND recipient enabled the selected channel
  AND recipient is not paused and channel route is current
  AND quiet-hour policy permits send now
  AND delivery dedupe key has no terminal success
  AND preview is generic and policy-approved
```

Missing granular preference data fails closed for external delivery. The legacy
`externalNotificationConsent` flag MUST NOT alone authorize Care Loop delivery.
An in-app item may be created only for the intended recipient and remains
subject to the same current share authorization when opened.

Default external text is content-free, for example: "A Care request is waiting
in CB Connect." Helpful/avoid content, custom text, owner health context, expiry
reason, and safety status MUST remain inside the authorized app view.

Quiet hours delay rather than disclose. A delayed delivery that would execute
after share expiry is cancelled. Provider adapters receive only the minimum
destination, generic template identifier, event identity, and dedupe context.

## Actor authorization matrix

| Operation | Primary owner | Intended active partner | Other user/stale partner | Lifecycle worker | Delivery worker |
|---|---:|---:|---:|---:|---:|
| Create/edit private check-in | Yes | No | No | No | No |
| Publish request-only snapshot | Yes, explicit | No | No | No | No |
| Read owner-private source | Yes | No | No | Erasure/repair scope only | No |
| Read active partner DTO | Owner preview | Yes | No | No | Recheck only; no content |
| Acknowledge/cannot help | No | Yes | No | No | No |
| Cancel active share | Yes | No | No | Lifecycle override only | No |
| Expire share | No | No | No | Yes, idempotent | No |
| Revoke through unlink/reset | Either member through spec 02 | Either member through spec 02 | No | Finalize only | No |
| Create inbox/delivery plan | No | No | No | Internal event worker | No |
| Send generic notification | No | No | No | No | Yes, after full recheck |
| Read audit content | Own user-facing receipt only | Own action receipt only | No | Job-scoped | No |

No administrative client role receives default access to private check-ins or
Care Card content. Recovery access requires a separately approved, audited
operator policy.

## Threat model

| Threat | Likelihood / impact | Required mitigation and verification |
|---|---|---|
| Guessed share ID or client-supplied recipient | Medium / High | Derive actor, couple, owner, and recipient server-side; test cross-user and cross-couple IDs. |
| Stale browser cache after revocation | High / High | Recheck every server read/action; clear reactive state; E2E revoke while partner view is open. |
| Delivery races cancellation or unlink | Medium / High | Recheck immediately before send; atomically mark terminal attempts; inject race tests. |
| Private edit mutates published content | Medium / High | Immutable source revision and snapshot; test edit after publish and explicit replace. |
| Duplicate offline publication/response | High / Medium | Scoped idempotency keys and transactional uniqueness; concurrency tests. |
| Raw private document leaks through DTO | Medium / High | Explicit output validators/allowlist; negative fixture and serialization tests. |
| Logs, analytics, or provider payload capture text | Medium / High | Bounded event schema, no content fields, redaction tests, production payload sampling. |
| Partner infers withheld data from errors/badges | Medium / Medium | Uniform unavailable shape/copy; no private counts; snapshot privacy tests. |
| Nagging or coercive access prompts | Medium / High | No partner-triggered consent request; owner-only publication; safety-reset usability test. |
| Sensitive lock-screen preview | Medium / High | Generic template only; snapshot tests for every channel/locale. |
| Closed relationship revived or share reused after relink | Low / High | Closed couple terminal; recipient/couple bound snapshot; relink regression test. |
| Internal maintenance function bypasses policy | Low / High | Internal-only functions, explicit job scope, audit, and authorization-focused code review. |

Any confirmed cross-couple, post-revocation, or private-field disclosure is a
pilot stop condition.

## Acceptance criteria

- [ ] Care Loop is separately disabled by default and requires explicit owner
  publication.
- [ ] `request_only` is the only accepted v0.2.0 share mode.
- [ ] Publishing succeeds with zero health fields and rejects any health or
  private-note field in the snapshot input/output.
- [ ] The persisted recipient, couple, owner, and source revision are derived or
  verified server-side and cannot be redirected by the client.
- [ ] Snapshot payload and consent receipt are immutable; private edits cannot
  alter a published card.
- [ ] Partner reads return only the validated DTO and uniformly hide absent,
  withheld, wrong-recipient, expired, cancelled, revoked, and closed states.
- [ ] Owner cancellation, expiry, unlink, safety reset, and deletion immediately
  deny reads/actions and cancel pending disclosure.
- [ ] Duplicate publication, response, cancellation, and expiry operations are
  idempotent; stale revisions fail safely.
- [ ] Care Card external delivery requires granular preference plus a current
  authorization recheck; legacy global consent alone is insufficient.
- [ ] External previews contain no request, health, lifecycle, or safety detail.
- [ ] No partner-triggered prompt can pressure the owner to share.
- [ ] Audit and telemetry contain no private content.

## Test plan

1. **Effective consent unit table:** vary authentication, account state,
   membership, role, pilot flag, recipient, couple, mode, lifecycle, expiry, and
   operation; only the full intersection allows access.
2. **Publication:** zero-health happy path; item bounds; custom-text bounds;
   invalid mode/field; explicit confirmation; active-card conflict; replace;
   stale revision; duplicate idempotency key.
3. **Snapshot privacy:** exact persisted/serialized field allowlist; private
   draft edit after publication; raw document and optional-field leak tests.
4. **Partner authorization:** intended recipient; guessed ID; other couple;
   stale membership; duplicate membership integrity failure; disabled account.
5. **Non-inference:** identical public result for absent, withheld,
   wrong-recipient, expired, cancelled, revoked, unlinked, and deleted states;
   no count/badge/timing-sensitive content.
6. **Concurrency:** publish versus replace; respond versus cancel; respond versus
   expiry; delivery versus revocation; unlink versus read/action.
7. **Notifications:** missing preference, disabled category/channel, quiet
   hours, invalid device, duplicate delivery, expiry while delayed, generic copy
   for every supported locale.
8. **Lifecycle:** normal unlink, safety reset, account disable/delete, relink to
   a new couple, repeated cancellation/expiry, and scheduler delay.
9. **E2E:** owner preview/confirm/publish, partner read/respond, cancellation
   while open, natural expiry, safety reset, and privacy-safe unavailable/error
   states at mobile and desktop widths.
10. **Production smoke:** synthetic couple publishes and responds, then owner
    revokes while a delivery is pending; partner access and delivery both stop.

## Telemetry and audit

Product telemetry MAY emit:

- `care_share_publish_attempted`, `published`, `rejected` with bounded reason;
- `care_share_viewed`, `response_recorded`, `cancelled`, `expired`;
- `care_share_access_denied` with internal reason class;
- `care_notification_planned`, `suppressed`, `delivered`, `failed`;
- latency, duplicate suppression, stale revision, and scheduler-delay metrics.

Telemetry MUST NOT include helpful/avoid identifiers if they can reveal intimate
context, custom text, health fields, private-note existence, partner name,
email, notification destination, safety reason, or relationship-quality score.
User-facing analytics aggregate by pilot cohort and workflow state only.

Append-only audit records MUST include actor where available, couple/share ID,
operation, old/new lifecycle state, policy version, outcome, bounded reason,
server timestamp, and idempotency reference. Audit retention and user-visible
consent receipts follow spec 02 and the approved retention policy.

Alert on any successful post-revocation access, unauthorized recipient/couple
mismatch, private-field serialization failure, delivery after terminal state,
or repeated expiry scheduler delay.

## Rollout

1. Complete Gate 0 identity and lifecycle work from specs 01 and 02.
2. Add optional Care Loop enablement, share, lifecycle, consent-event, and audit
   records plus fully named indexes. Do not alter existing category semantics.
3. Deploy effective-consent helpers and negative authorization tests before any
   partner Care Card query.
4. Enable synthetic/internal accounts behind a server feature flag; verify
   snapshot allowlists, non-inference, revocation, and delayed delivery.
5. Enable up to five invited couples, review every unwanted-sharing report, and
   expand only under the PRD pilot gates.
6. Keep `request_only` and two partner responses fixed through the measurement
   window unless a safety correction requires change.

Schema changes are additive first. Legacy clients and rows have Care Loop
disabled and cannot acquire access through missing fields or defaults.

## Rollback

The server kill switch MUST:

1. reject new publication;
2. deny all partner Care Card reads and actions;
3. suppress new inbox/delivery planning and cancel unsent deliveries;
4. preserve owner-private records and append-only audit evidence under the
   approved retention policy;
5. leave unrelated phase, pain, period, timeline, and messaging behavior
   unchanged unless the incident shares their trust boundary;
6. show a generic unavailable state without confirming a private request.

Rollback MUST NOT reactivate an expired/revoked share, restore an old
relationship, delete audit evidence, or require destructive schema reversal.
Any cleanup runs as bounded, resumable internal work.

## Open decisions

1. What are the default, minimum, and maximum Care Card expiry durations?
2. Which helpful/avoid identifiers ship in the pilot, and what are the maximum
   lengths and content rules for custom variants?
3. Is a user-visible consent receipt retained after card expiry, and for how
   long relative to the audit record?
4. Does replacing an active card require explicit cancellation confirmation, or
   can one confirmed publish transaction supersede it atomically?
5. Can a partner correct `cannot_help` to `acknowledged`, or is every first
   response terminal for v0.2.0?
6. Is the in-app inbox always enabled for the intended partner, or separately
   preference-controlled while direct active-card access remains available?
7. Which external channels, if any, participate in the pilot, and what locale
   review is required for generic preview templates?
8. What privacy-safe copy should distinguish "no active request" from "request
   no longer available" without revealing a cancellation or safety reset?
9. What audit and consent-receipt retention periods are approved?
10. Is any support recovery access allowed for Care Card content, or must
    support rely exclusively on metadata and user-provided screenshots?
