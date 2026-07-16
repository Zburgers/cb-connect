# Care Loop v1 Domain and State Machine

| Field | Value |
|---|---|
| Status | Proposed — implementation not started |
| Owner | CB Connect product/backend |
| Milestone | `v0.2.0` Gate 1 — lean Care Loop validation candidate |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | [01-trust-boundaries-and-auth-identity.md](./01-trust-boundaries-and-auth-identity.md); [02-relationship-lifecycle-data-rights-and-safety-reset.md](./02-relationship-lifecycle-data-rights-and-safety-reset.md); [03-consent-sharing-and-care-loop-privacy.md](./03-consent-sharing-and-care-loop-privacy.md); [architecture.md](../architecture.md) |

## Purpose

Define the smallest useful Care Loop: an owner publishes one temporary, request-only Care Card to their active partner, the partner acknowledges it or says they cannot help, and the owner can cancel or revoke it at any time.

This release validates whether explicit, bounded care requests are more useful than generic phase advice. It does not expand partner access to health data.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.

## v0.2.0 product contract

The owner can select:

- up to three helpful actions;
- up to three actions to avoid;
- an expiry time.

The partner receives only the resulting request card. They can respond with:

- `acknowledged`;
- `cannot_help`.

The owner can:

- revise the active card, producing a new immutable share snapshot;
- cancel the request;
- revoke the share immediately.

Only one request can be active for an owner at a time. The card expires automatically and is also treated as expired by every read and mutation once its deadline passes.

## Explicit non-goals

The following are not part of `v0.2.0` Care Loop v1:

- sharing pain scores, symptoms, cycle phase, energy, bandwidth, notes, or any selected health details;
- `accepted`, `done`, completion, progress, or task ownership states;
- outcome pulses or “did this help?” feedback;
- unbounded free-text requests, clarification questions, supportive notes, or chat; v1 permits only one bounded custom helpful/avoid label per category;
- learned preferences, recommendations, care scores, streaks, or partner performance;
- recurring requests, automation rules, multiple active cards, or multiple recipients;
- push/email delivery or lock-screen content;
- generic sharing grants or a universal policy engine.

The existing couple DM remains separate. Care Loop does not write to it or imply that a message is a Care Card response.

## Product vocabulary

- **Owner:** the active couple's authoritative primary member who creates the request.
- **Recipient:** the owner's one active linked partner.
- **Request:** the mutable lifecycle record that points to the current revision.
- **Private source:** the owner's private action selection and revision; it is never returned to the partner.
- **Share snapshot:** an immutable, recipient-specific copy of exactly what the owner shared for one revision.
- **Response:** the recipient's bounded response to one exact revision.
- **Cancel:** end the current request as a normal product action.
- **Revoke:** immediately withdraw recipient access, using privacy-first language and audit semantics.

“No active card” deliberately does not reveal whether the owner created nothing, cancelled, revoked, or allowed a card to expire.

## Action catalogs

v0.2.0 uses curated identifiers rather than free text.

Helpful action identifiers:

```text
check_in_later
bring_water_or_tea
handle_food
take_over_one_task
offer_warmth
quiet_company
physical_affection
give_me_space
listen_no_advice
custom_helpful
```

Avoid action identifiers:

```text
no_advice
do_not_ask_repeatedly
no_physical_touch
do_not_mention_cycle
do_not_try_to_fix
do_not_share_outside_app
custom_avoid
```

The server accepts identifiers, not display copy, except for the two explicit custom variants. Web and future mobile clients map preset identifiers to approved localized labels. Unknown identifiers fail validation. Duplicate identifiers are rejected rather than silently collapsed.

At least one helpful action is required. Avoid actions are optional. Each list has a maximum length of three. A list may contain its custom identifier at most once. Its matching custom text is then required, whitespace-normalized, non-empty, and at most 80 Unicode code points. Custom text is rejected when the matching identifier is absent.

## Authorization and privacy invariants

1. Every public function MUST resolve the caller through the canonical identity helper from spec 01.
2. Every operation MUST revalidate one active relationship and authoritative membership roles from spec 02.
3. The server derives owner, recipient, and couple IDs. No client-provided identifier grants authority.
4. Only the owner can create, revise, cancel, or revoke their request.
5. Only the exact snapshot recipient can read or respond to a card.
6. A snapshot MUST contain request action identifiers only. It MUST NOT contain health values, inferred health context, private notes, or a reason for the request.
7. Share snapshots are immutable after insertion. Cancellation, revocation, expiry, and response are represented on lifecycle/audit records, never by rewriting snapshot content.
8. Partner reads MUST return the same empty result for absent, cancelled, revoked, expired, and unauthorized cards.
9. A non-active couple, closed membership, account disablement, safety reset, or account deletion immediately denies reads and transitions regardless of cached client state.
10. Care Loop permission is independent of `sharingPain`, `sharingPhase`, and `sharingPeriodWrite`. Those flags never authorize Care Loop and Care Loop never broadens them.
11. A recipient response applies to one revision only. Revising the card makes the new revision unanswered.
12. Telemetry and notification plumbing MUST NOT record action identifiers or infer health context.
13. Publication MUST be disabled unless the server-side pilot gate is enabled for the owner/couple and the owner explicitly confirms the recipient, request content, and expiry.
14. Saving or changing private source content alone MUST NOT publish or revise a partner-visible snapshot.

## State model

The request lifecycle and partner response are separate dimensions.

### Request lifecycle

```text
none -> active -> cancelled
               -> revoked
               -> expired
```

`cancelled`, `revoked`, and `expired` are terminal. A later request creates a new request ID; terminal records are never reopened.

### Response state for the current revision

```text
unanswered -> acknowledged
           -> cannot_help
```

A response is terminal for that revision. The recipient cannot switch between response values. An owner revision increments the revision and returns the effective response to `unanswered` without deleting the old response audit event.

## Actor transition matrix

| Current lifecycle | Current-revision response | Actor | Command | Result |
|---|---|---|---|---|
| none | — | Eligible owner | Create | New `active` request at revision 1; immutable snapshot inserted; expiry scheduled |
| active, not expired | any | Owner | Revise | Revision increments; new snapshot inserted; current response becomes unanswered; expiry rescheduled |
| active, not expired | any | Owner | Cancel | Lifecycle becomes `cancelled`; recipient reads return empty |
| active, not expired | any | Owner | Revoke | Lifecycle becomes `revoked`; recipient reads return empty |
| active, not expired | unanswered | Recipient | Acknowledge | Response for current revision becomes `acknowledged` |
| active, not expired | unanswered | Recipient | Cannot help | Response for current revision becomes `cannot_help` |
| active, expired by clock | any | Owner, recipient, or worker | Any command/read | Materialize or treat as `expired`; no other transition |
| terminal | any | Any client | Transition | Rejected; duplicate idempotent command may return its original result |
| any | already answered | Recipient | Different response | Rejected |
| any | any | Unrelated, inactive, disabled, or wrong-role user | Any | Rejected without revealing request existence |

Owner cancellation and revocation remain allowed after the partner responds, provided the request has not already expired. They are privacy/access transitions, not a response to the partner.

## Convex validator sketch

```ts
import { v } from "convex/values";

export const helpfulActionValidator = v.union(
  v.literal("check_in_later"),
  v.literal("bring_water_or_tea"),
  v.literal("handle_food"),
  v.literal("take_over_one_task"),
  v.literal("offer_warmth"),
  v.literal("quiet_company"),
  v.literal("physical_affection"),
  v.literal("give_me_space"),
  v.literal("listen_no_advice"),
  v.literal("custom_helpful"),
);

export const avoidActionValidator = v.union(
  v.literal("no_advice"),
  v.literal("do_not_ask_repeatedly"),
  v.literal("no_physical_touch"),
  v.literal("do_not_mention_cycle"),
  v.literal("do_not_try_to_fix"),
  v.literal("do_not_share_outside_app"),
  v.literal("custom_avoid"),
);

export const requestLifecycleValidator = v.union(
  v.literal("active"),
  v.literal("cancelled"),
  v.literal("revoked"),
  v.literal("expired"),
);

export const partnerResponseValidator = v.union(
  v.literal("acknowledged"),
  v.literal("cannot_help"),
);
```

Arrays still require explicit handler checks for length, non-empty helpful actions, duplicates, and custom-text correspondence/bounds. Validators alone do not enforce those constraints.

## Convex table and index sketch

Names may change during implementation, but all represented concepts and invariants are required.

```ts
careCheckIns: defineTable({
  ownerUserId: v.id("users"),
  revision: v.number(),
  helpfulActions: v.array(helpfulActionValidator),
  avoidActions: v.array(avoidActionValidator),
  customHelpfulText: v.optional(v.string()),
  customAvoidText: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_owner_user_id", ["ownerUserId"]),

careRequests: defineTable({
  coupleId: v.id("couples"),
  ownerUserId: v.id("users"),
  recipientUserId: v.id("users"),
  lifecycle: requestLifecycleValidator,
  currentRevision: v.number(),
  // Temporarily absent only between request insertion and snapshot insertion
  // inside the same create transaction. Public reads fail closed if absent.
  currentSnapshotId: v.optional(v.id("careShareSnapshots")),
  expiresAt: v.number(),
  partnerResponse: v.optional(partnerResponseValidator),
  partnerResponseRevision: v.optional(v.number()),
  partnerRespondedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  terminalAt: v.optional(v.number()),
})
  .index("by_owner_user_id_and_lifecycle", ["ownerUserId", "lifecycle"])
  .index("by_couple_id_and_lifecycle", ["coupleId", "lifecycle"])
  .index("by_lifecycle_and_expires_at", ["lifecycle", "expiresAt"]),

careShareSnapshots: defineTable({
  requestId: v.id("careRequests"),
  sourceCheckInId: v.id("careCheckIns"),
  sourceRevision: v.number(),
  coupleId: v.id("couples"),
  ownerUserId: v.id("users"),
  recipientUserId: v.id("users"),
  revision: v.number(),
  visibilityMode: v.literal("request_only"),
  helpfulActions: v.array(helpfulActionValidator),
  avoidActions: v.array(avoidActionValidator),
  customHelpfulText: v.optional(v.string()),
  customAvoidText: v.optional(v.string()),
  policyVersion: v.string(),
  sharedAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_request_id_and_revision", ["requestId", "revision"])
  .index("by_recipient_user_id_and_shared_at", ["recipientUserId", "sharedAt"]),

careRequestEvents: defineTable({
  requestId: v.id("careRequests"),
  coupleId: v.id("couples"),
  actorUserId: v.optional(v.id("users")),
  eventType: v.union(
    v.literal("created"),
    v.literal("revised"),
    v.literal("acknowledged"),
    v.literal("cannot_help"),
    v.literal("cancelled"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
  revision: v.number(),
  clientMutationId: v.optional(v.string()),
  resultingLifecycle: requestLifecycleValidator,
  occurredAt: v.number(),
})
  .index("by_request_id_and_occurred_at", ["requestId", "occurredAt"])
  .index("by_actor_user_id_and_client_mutation_id", [
    "actorUserId",
    "clientMutationId",
  ]),
```

`careRequestEvents` contains transition metadata only. It does not duplicate action identifiers from the snapshot.

`careCheckIns` is owner-private and contains no health fields in v0.2.0. Create/revise updates it only after explicit publication confirmation, increments its revision, and copies that exact revision into a new immutable recipient snapshot. Partner functions never read or return this table directly.

Convex indexes do not enforce uniqueness. Create/revise/respond mutations MUST query the relevant index and establish one-active-request, one-snapshot-per-revision, and one-idempotency-result invariants transactionally. Integrity conflicts fail closed.

## API and DTO contracts

### Public mutations

```text
care.createRequest
care.reviseRequest
care.cancelRequest
care.revokeShare
care.acknowledge
care.cannotHelp
```

All public mutations require `clientMutationId`. Create and revise accept action identifier arrays and `expiresAt`. Commands that target an existing record accept `requestId`, `expectedRevision`, and `clientMutationId`; the server still derives and verifies all actor and relationship identities.

### Public queries

```text
care.getActiveRequestForOwner
care.getActiveCardForPartner
```

No public history query is required for v0.2.0. Audit records are not client-readable.

### Internal mutations

```text
internal.care.expireRequest
internal.care.expireDueRequests
```

`expireRequest` handles one scheduled request. `expireDueRequests` is a bounded reconciliation job for missed schedules and migration repair.

### Owner DTO

```ts
type CareOwnerRequestDto = {
  requestId: Id<"careRequests">;
  revision: number;
  lifecycle: "active";
  helpfulActions: HelpfulAction[];
  avoidActions: AvoidAction[];
  customHelpfulText?: string;
  customAvoidText?: string;
  expiresAt: number;
  partnerResponse: "unanswered" | "acknowledged" | "cannot_help";
};
```

Terminal or absent requests return `null`. Owner UI may show a local success confirmation after cancellation/revocation, but the active-request query does not expose terminal history.

### Partner DTO

```ts
type CareCardDto = {
  requestId: Id<"careRequests">;
  revision: number;
  visibilityMode: "request_only";
  helpfulActions: HelpfulAction[];
  avoidActions: AvoidAction[];
  customHelpfulText?: string;
  customAvoidText?: string;
  sharedAt: number;
  expiresAt: number;
  response: "unanswered" | "acknowledged" | "cannot_help";
};
```

The partner DTO contains no owner health state, reason, private note, lifecycle explanation, or historical snapshot. An unavailable card returns `null`.

## Mutation semantics

### Create

1. Resolve the eligible owner and active recipient.
2. Require the server pilot gate and the confirmed consent policy version.
3. Check for a prior event with the actor and `clientMutationId`; return its recorded result if compatible.
4. Validate action list sizes, uniqueness, custom-text correspondence/bounds, and expiry range.
5. Query `by_owner_user_id_and_lifecycle` for an active request.
6. If it is expired by the clock, terminalize it in the same transaction; otherwise reject creation.
7. Insert or update the owner-private source revision, insert request revision 1, insert immutable snapshot revision 1, patch the request's current snapshot pointer, and insert the `created` event transactionally. No client can observe the temporary missing pointer because the mutation is atomic.
8. Schedule `internal.care.expireRequest` for the exact expiry.

### Revise

1. Recheck owner, active couple, lifecycle, clock expiry, and `expectedRevision`.
2. Require a new explicit publication confirmation, update the private source revision, and insert the next immutable snapshot from that exact source revision.
3. Update only the request pointer, revision, expiry, and update time.
4. Record `revised`; the prior response remains in audit but is not the current revision's response.
5. Schedule a new expiry call containing the new expected revision.

### Respond

1. Recheck recipient, active couple, current snapshot recipient, lifecycle, clock expiry, and expected revision.
2. Reject if the current revision already has a response.
3. Patch the bounded response fields on the request and append a metadata-only event.
4. Do not create chat, notification, completion, or outcome records.

### Cancel and revoke

Both operations immediately make partner reads return `null`. They differ only in lifecycle/audit meaning. Neither deletes immutable snapshots synchronously. Retention and account erasure follow spec 02.

## Expiry and scheduling

Every active request schedules:

```ts
await ctx.scheduler.runAt(expiresAt, internal.care.expireRequest, {
  requestId,
  expectedRevision,
});
```

The scheduled mutation MUST:

1. load the request by ID;
2. no-op if terminal, missing, or no longer at `expectedRevision`;
3. if the request is still active but the clock is before its current expiry, schedule the current revision at the current expiry;
4. otherwise mark it expired, set `terminalAt`, and append one `expired` event.

Scheduling is a materialization mechanism, not the security boundary. Owner and partner queries return `null` when `expiresAt <= Date.now()` even if the scheduled mutation is delayed. Every mutation checks the same condition before transitioning.

The reconciliation mutation queries `by_lifecycle_and_expires_at`, takes a bounded batch, expires eligible rows, and schedules continuation when more rows remain. It never uses unbounded `.collect()`.

## Revisions and idempotency

- Revisions are positive integers beginning at 1.
- `expectedRevision` is mandatory on revise, response, cancel, and revoke commands.
- A revision mismatch returns a stable conflict error and does not reveal snapshot content.
- `clientMutationId` is a client-generated opaque string, validated for a conservative length and character set.
- Its uniqueness scope is actor plus mutation ID. Reusing one for a different event type is an integrity error.
- The first committed event is the receipt. A compatible retry returns its request ID, revision, lifecycle, and response result without repeating writes or schedules.
- A scheduled expiry has no client mutation ID and is deduplicated by request lifecycle plus revision.
- An owner revision does not mutate or delete an older snapshot. It only changes the current pointer.

## Acceptance criteria

- [ ] An eligible owner can publish one request-only card with one to three helpful actions, zero to three avoid actions, and a valid expiry.
- [ ] Creating a second active request is rejected; a new request is allowed after the first is terminal.
- [ ] The partner sees only the current immutable snapshot and no health reason or unselected data.
- [ ] Unknown, duplicate, empty, or over-limit action lists fail server validation.
- [ ] A partner can acknowledge or say they cannot help exactly once per revision.
- [ ] No accept, done, outcome, chat, unbounded free text, health detail, learned preference, or external-notification side effect exists.
- [ ] Revising creates a new snapshot and makes the new revision unanswered without changing the prior snapshot.
- [ ] Cancel and revoke remove partner access immediately, including from stale clients.
- [ ] Expiry denies reads and writes by clock even when the scheduled mutation has not run.
- [ ] Closed relationships, wrong roles, unrelated users, disabled accounts, and stale memberships cannot read or transition a request.
- [ ] Mutation retries are idempotent and stale revisions cannot overwrite newer content or consent.
- [ ] Terminal records cannot be reopened and rollback cannot restore access.

## Test plan

Use `convex-test` with Vitest for domain and authorization coverage, then authenticated Playwright for the two-role flow.

1. **Validation:** each allowed action; unknown values; no helpful action; duplicate values; 4+ values; custom identifier/text correspondence and 80-code-point bound; invalid/too-soon/too-late expiry; malformed mutation ID.
2. **Authorization:** owner create/revise/cancel/revoke; recipient read/respond; swapped role, unrelated user, guessed request ID, pending/revoked couple, disabled account, stale membership, unauthenticated caller.
3. **Privacy DTO:** assert exact partner object keys; fixture private health data and prove it is absent; identical `null` for absent/cancelled/revoked/expired/unauthorized reads.
4. **State transitions:** every allowed matrix row and every rejected edge; second response; terminal mutation; cancel/revoke after response.
5. **Revisions:** immutable snapshot comparison; stale owner revision; stale partner response; revision response reset; old expiry callback no-op.
6. **Idempotency:** replay each client command; same ID with different command; concurrent duplicate create/respond; response race leaves one response.
7. **Expiry:** exact boundary; delayed scheduler; revised expiry; reconciliation batch and continuation; no post-expiry response.
8. **Relationship races:** respond versus unlink/safety reset; revise versus revoke; expiry versus cancel. Final state must deny partner access whenever the relationship or request is terminal.
9. **E2E:** owner creates in under 30 seconds; partner receives card in real time; acknowledges or cannot help; owner revises/cancels/revokes; card disappears at expiry.

## Telemetry and audit

Emit privacy-minimized counters and latency for:

- request create, revise, cancel, revoke, and expire;
- partner acknowledge and cannot-help responses;
- validation rejection by reason code;
- authorization denial by boundary type;
- revision conflict;
- idempotent replay;
- scheduled expiry lag and reconciliation count;
- card time-to-first-response.

Telemetry MUST NOT contain action identifiers, owner/partner names, health information, custom text, snapshot contents, relationship safety reasons, or notification destinations. Product analytics should use rotating/pseudonymous couple or request cohort identifiers only if approved by the data-retention policy.

Audit events retain internal record IDs, actor when applicable, transition type, revision, result, and server time. Their retention and erasure classification is governed by spec 02.

## Rollout

1. Land validators and additive tables with no client entry point.
2. Add domain helpers, mutation/query authorization tests, and bounded expiry reconciliation.
3. Backfill nothing: Care Loop starts with new records only.
4. Enable creation for internal two-account fixtures behind a server-controlled feature flag.
5. Verify real-time DTO updates, expiry lag, idempotency, and relationship closure races in dev and test deployments.
6. Canary with a small cohort, monitoring denial, conflict, scheduler, and response metrics without content telemetry.
7. Expand only after authenticated two-role E2E and all Gate 0 identity/lifecycle dependencies pass.

No external push or Discord delivery is enabled as part of this rollout.

## Rollback

Safe rollback disables create, revise, and partner-response entry points while keeping owner cancel/revoke, partner read denial, scheduled expiry, and reconciliation operational.

Rollback MUST NOT:

- reactivate a cancelled, revoked, expired, or relationship-inaccessible card;
- point a request back to an older snapshot;
- delete audit evidence or snapshots outside the approved retention workflow;
- restore partner access from a cached client;
- reintroduce direct Discord side effects.

The additive tables remain deployed until retention jobs safely remove eligible data. If scheduling fails, disable new creation and run bounded reconciliation; do not weaken read-time expiry checks.

## Open decisions

1. Which expiry presets should the first UI offer within the server-approved minimum and maximum window?
2. After a partner responds, should the owner still see “Revise,” or should the UI encourage a new request while preserving the server's revision capability?
3. Is `physical_affection` appropriate in the initial helpful-action catalog, or should it wait for a separate consent-copy review?
4. What exact user-facing distinction between “Cancel request” and “Revoke sharing” is clearest without implying that the partner is notified?
5. What fixed retention period applies to terminal snapshots and transition audit events before account erasure?
