# Relationship Lifecycle, Data Rights, and Safety Reset

| Field | Value |
|---|---|
| Status | Proposed — implementation not started |
| Owner | CB Connect backend/privacy |
| Milestone | `v0.2.0` Gate 0 — trust and correctness |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | [01-trust-boundaries-and-auth-identity.md](./01-trust-boundaries-and-auth-identity.md); [GitHub issue #5](https://github.com/Zburgers/cb-connect/issues/5); notification/outbox design before push launch |

## Purpose

Define what happens to access and data when a couple is pending, active, unlinked, or safety-reset; when one user hides shared content; and when a user exports or deletes an account. The design preserves the primary user's ownership of health data while giving both people symmetric power to leave without letting either person erase the other's records.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.

## Scope

In scope:

- couple activation, normal unlink, and safety reset;
- immediate revocation of sharing and partner-assisted write access;
- per-user chat hiding and sender-directed deletion;
- export, correction, deletion, retention, and account-erasure workflows;
- bounded Convex lifecycle jobs, audit events, rollout, and rollback.

Out of scope:

- Clerk authentication mechanics and secure invitation design from spec 01;
- legal conclusions for a specific jurisdiction;
- moderation, emergency services, or evidence-preservation guarantees;
- Care Loop-specific records, which MUST adopt this lifecycle contract later;
- health-platform imported-data rules beyond requiring source-aware deletion.

## Product principles

1. **Access revocation is immediate.** Retention is never continued authorization.
2. **Leaving is symmetric.** Primary and partner can independently unlink or safety-reset.
3. **Health data stays with its owner.** A partner cannot delete, export, or retain access to the primary user's period, pain, or cycle records.
4. **Shared deletion is not unilateral.** Clearing a view cannot destroy the other person's copy or shared source records.
5. **Safety beats engagement.** A safety reset requires no partner approval, sends no relationship notification by default, and exposes no reason.
6. **Deletion is observable and bounded.** Large cascades run as idempotent internal jobs with progress and failure states.

## Current gaps

The following are verified on the reviewed `main` snapshot:

1. `couples.status` supports only `pending`, `active`, and `revoked`; there is no initiator, closure mode, effective time, recovery window, retention deadline, or lifecycle audit.
2. Only a primary user can call `revokePartnerAccess`. A partner has no equivalent leave/safety action.
3. Revocation marks the couple revoked, globally deletes all messages and reactions with unbounded `.collect()` loops, deletes the partner membership, and leaves the primary membership. This combines access revocation, shared deletion, and membership cleanup in one transaction.
4. `messages.clear` lets either active member permanently delete every shared message and reaction for both users. Issue #5 tracks this confirmed data-loss boundary.
5. No account deletion, export package, per-user chat visibility, retention schedule, legal hold, or lifecycle-job model exists.
6. Notification records contain free-form `payload: v.any()`, with no lifecycle deletion classification. Future device tokens and outbox rows also need explicit revocation behavior.
7. Ownership is explicit for health records but optional attribution on legacy period events and shared records requires a migration policy.

## Data classes and rights

| Class | Examples | Controller in product | Unlink effect | Erasure default |
|---|---|---|---|---|
| Account identity | name, email, image, Clerk/provider IDs | Individual user | Remains with user | Disable, then delete or tombstone provider linkage |
| Owned health | period events, pain logs, cycle settings | Primary/record owner | Never shared after effective unlink | Owner can export/correct/delete; purge on owner erasure |
| Personal preferences | preferred name, hidden tips, notification consent | Individual user | Remains with user | Purge on owner erasure |
| Relationship metadata | couple, memberships, nicknames, connected date, consent history | Both, with per-field actor attribution | Freeze and hide from live couple UI | Retain minimal closure/audit record; purge display fields on schedule |
| Shared communications | messages, reactions, nudges, future Care Cards | Both participants | Freeze; no new read/write through couple APIs | Per retention policy; one user cannot erase the other's view |
| Delivery/operations | notification log, outbox, device registrations, webhook dedupe | System on user's behalf | Cancel future delivery and revoke target routes | Purge payloads; retain minimal delivery/security outcome if required |
| Security audit | auth, consent, unlink, deletion events | System | Remains access-controlled | Minimize and retain for approved security period |

No export may include the other person's private health data, hidden records, notification destination, auth identifiers, or internal security metadata.

## Normative invariants

### Relationship access

1. Both active members MUST be allowed to request normal unlink or safety reset without the other's approval.
2. The initiating mutation MUST atomically make the relationship non-active, revoke sharing and assisted-write permission, expire invitations, and prevent new shared writes.
3. Every couple-scoped query and mutation MUST require an active relationship at read/write time. Cached UI state does not preserve access.
4. Unlink MUST NOT delete either user's account or owned health data.
5. Re-linking MUST create a new relationship identity. A closed couple MUST never be reactivated in place.
6. The system MUST preserve actor and source attribution on retained records; it MUST NOT rewrite partner-authored data as self-authored.

### Chat and shared records

1. “Clear chat” MUST update only the caller's view boundary, such as `clearedBeforeAt`; it MUST NOT delete shared source records.
2. A sender MAY delete an individual message under product policy. The default implementation SHOULD leave a content-free tombstone with `deletedAt` and `deletedByUserId` so reactions and timelines remain consistent.
3. Reactions MUST disappear when their parent message is globally purged or tombstoned, but per-user hiding MUST NOT mutate reactions for the other user.
4. Global shared-record purge MUST be performed only by an authorized retention/erasure job, never a general client mutation.

### Data rights and deletion

1. Each user MUST be able to export their owned data in a documented, machine-readable format plus a human-readable manifest.
2. The export manifest MUST state generation time, schema version, included classes, excluded classes, and source/provenance where available.
3. Account deletion MUST immediately disable product access, close active relationships, cancel pending invitations/deliveries, and start an idempotent lifecycle job.
4. Erasure jobs MUST use indexed, bounded batches and scheduled continuation. They MUST be restartable and MUST NOT rely on unbounded `.collect()` deletes.
5. A deletion request MUST expose status to the requesting user: `requested`, `grace_period`, `purging`, `completed`, or `failed`.
6. Any recovery/grace period MUST NOT restore partner access. Cancelling deletion restores only the requesting account after reauthentication and policy checks.
7. Security/audit tombstones MAY survive content erasure only with an approved purpose, minimal fields, and fixed retention.
8. Email or provider identifiers MUST NOT remain in anonymous analytics after erasure.

### Safety reset

1. Safety reset MUST be available to either member from an authenticated settings surface and SHOULD be reachable with minimal navigation.
2. It MUST immediately close the relationship, revoke every sharing flag and partner-assisted permission, expire invites, cancel queued relationship notifications, and unregister future partner-targeted delivery.
3. It MUST NOT require partner confirmation, send a partner alert by default, reveal the selected reason, or show the initiator's current activity/presence after completion.
4. The initiator MUST be offered local sign-out and device/session guidance. Actual Clerk session revocation is a separate provider operation and MUST be explicit.
5. Safety reset MUST be safe to retry and produce the same terminal access state.

## Relationship state machine

| Current | Event/actor | Next | Immediate effects |
|---|---|---|---|
| none | Primary creates invite | `pending` | Primary membership exists; no partner data access |
| `pending` | Eligible partner redeems invite | `active` | Partner membership added; consent defaults applied |
| `pending` | Creator cancels, invite expires, or account deletion begins | `closed` | Invites terminal; no shared access |
| `active` | Either member requests normal unlink | `closing` | Access and writes stop atomically; retention job scheduled |
| `active` | Either member requests safety reset | `safety_locked` | Access, delivery, invites, sharing, and presence stop atomically |
| `closing` | Closure transaction completes | `closed` | Live relationship unavailable; retained data follows deadlines |
| `safety_locked` | Safety transaction completes | `closed` | No counterpart notification by default; retained data hidden |
| `closed` | Any re-link attempt | unchanged | New couple/invite required; old relationship never reopens |

`closing` and `safety_locked` are short-lived operational states. Authorization MUST treat every state except `active` as denied.

## Account deletion state machine

| Current | Event | Next | Required behavior |
|---|---|---|---|
| `active` | User confirms deletion | `requested` | Reauthenticate; record request and policy version |
| `requested` | Boundary mutation commits | `grace_period` or `purging` | Disable access; close relationships; cancel deliveries |
| `grace_period` | User cancels before deadline | `active` | Restore account only; never restore old relationship |
| `grace_period` | Deadline passes | `purging` | Start/resume bounded deletion jobs |
| `purging` | All classified jobs complete | `completed` | Remove provider link; retain only approved tombstone |
| `purging` | Retry budget exhausted | `failed` | Keep access disabled; alert operations; permit safe resume |
| `completed` | Any request | unchanged | Terminal |

## Actor and data-action matrix

| Action | Record owner | Other active member | Either member | Internal lifecycle worker |
|---|---:|---:|---:|---:|
| View/export owned health | Yes | Only current consent-scoped view; never export | — | Job-scoped only |
| Correct/delete owned health | Yes | No, except explicit assisted writes while active | — | Erasure/repair only |
| Hide own chat view | Yes | No effect on owner | Yes, own view only | No |
| Delete own authored message | Policy-permitted | No | Own messages only | Purge/tombstone only |
| Globally clear shared chat | No | No | No | Retention/erasure policy only |
| Normal unlink | — | — | Yes | Finalize only |
| Safety reset | — | — | Yes | Finalize only |
| Export account package | Yes | Cannot request for owner | Own account only | Generate scoped package |
| Delete account | Yes | Cannot request for owner | Own account only | Execute bounded purge |
| Override retention/hold | No | No | No | Explicit audited operator policy only |

## Target records

The exact names may change, but the implementation MUST represent these concepts:

- `relationshipClosures`: couple, initiator, mode (`normal` or `safety`), requested/effective times, retention deadline, policy version, status;
- `coupleMemberViews`: couple, user, `chatClearedBeforeAt`, `hiddenAt`, and export checkpoint, indexed by couple and user;
- `consentEvents`: append-only actor, couple, permission, old/new value, source, timestamp;
- `dataLifecycleRequests`: user, kind (`export` or `erasure`), state, policy version, deadlines, progress/error metadata;
- `dataLifecycleJobs`: request, data class, cursor/checkpoint, attempt count, state, and timestamps;
- message tombstone fields or a separate deletion record with actor and timestamp.

High-churn job progress MUST be separate from stable user/couple documents. Unbounded child histories MUST use separate indexed tables, not arrays.

## Migration and backfill

1. Add lifecycle, member-view, consent-event, and job records additively. Do not reinterpret current `revoked` as successful erasure.
2. Scan for duplicate memberships and multiple non-terminal couples per user before enabling new transitions; resolve conflicts manually.
3. Create default member-view rows for current memberships. Backfill legacy revoked couples as `closed` with `closureMode: "legacy_unknown"`; use migration time when no reliable effective timestamp exists and preserve provenance.
4. Deploy read authorization that denies all non-active relationships and applies per-user chat boundaries before replacing write paths.
5. Replace `messages.clear` with a per-user view update. Remove the client-callable global delete path and add issue #5 regression tests.
6. Replace `revokePartnerAccess` with a symmetric closure boundary mutation plus scheduled bounded cleanup. Do not delete membership rows in the boundary transaction; mark them terminal so authorization and audit remain explainable.
7. Backfill optional period attribution with existing documented legacy defaults only; do not invent a partner actor.
8. Classify every current table and future storage object in an executable retention registry before enabling account erasure.
9. Dry-run export and erasure jobs in test, compare expected/actual counts by data class, then canary with internal accounts.

## Acceptance criteria

- [ ] Either member can normal-unlink or safety-reset, and every partner read/write fails immediately afterward.
- [ ] Unlink preserves each account and the primary user's owned health records.
- [ ] Safety reset revokes sharing, assisted period writes, invitations, presence, and queued partner delivery without exposing a reason.
- [ ] Clearing chat for one user leaves the other user's view and shared source records intact; issue #5 is closed.
- [ ] Closed relationships cannot be reactivated; re-linking creates a new couple identity.
- [ ] Export contains all documented owned classes, provenance, and a manifest, with no unauthorized counterpart-private data.
- [ ] Account erasure is authenticated, status-visible, idempotent, bounded, resumable, and proven to remove all classified content.
- [ ] One member cannot request export or account deletion for the other.
- [ ] Retention and security tombstones contain no message bodies, health content, invitation secrets, or notification destinations.
- [ ] All lifecycle transitions have actor, authorization, race, retry, and legacy-row tests.

## Test plan

1. **Authorization:** both roles can close; unauthenticated/non-member callers fail; stale membership and guessed IDs fail.
2. **Concurrency:** simultaneous unlink, safety reset, message send, invite redeem, and assisted write leave one terminal relationship and no post-close writes.
3. **Chat:** per-user clear boundaries; partner view unaffected; sender tombstone; reaction behavior; pagination around clear timestamp.
4. **Safety:** repeated reset; no queued partner alert; presence disappears; sharing and write permissions are false; no reason leaks through queries, logs, or telemetry.
5. **Export:** class-by-class fixtures, authorization, manifest/schema version, large paginated histories, expired download, and counterpart-private exclusions.
6. **Erasure:** grace cancel; no relationship restoration; bounded continuation; retry after injected failure; provider deletion ordering; completion reconciliation reports zero unapproved records.
7. **Migration:** active/pending/revoked legacy couples, missing attribution, duplicate membership detection, and `legacy_unknown` provenance.
8. **Production smoke:** two test accounts link, share, chat, clear one view, unlink, and confirm immediate bilateral denial plus retained owner health history.

## Telemetry and audit

Emit counts and latency for `relationship_closed`, `safety_reset_completed`, denied post-close access, per-user chat clear, export requested/completed/failed, erasure state changes, job retries, and residual-record reconciliation.

Telemetry MUST NOT contain health values, message bodies, safety reasons, partner names, email, invite material, exported content, or notification destinations. Alerts should fire on post-close authorization success, stuck erasure jobs, non-zero residual records, and delivery attempted after safety reset.

## Rollout and rollback

Roll out additively: schema and classification registry; authorization reads; per-user chat views; symmetric closure; safety reset; export; erasure. Canary each destructive workflow with internal accounts and require reconciliation evidence before wider availability.

Rollback MUST never restore a closed relationship, sharing permission, invitation, notification route, or deleted content. Safe rollback disables new lifecycle requests while keeping closure authorization and workers able to resume. Because the schema is additive, older clients must interpret non-active states as unlinked. If a purge worker fails, pause and resume from its checkpoint; do not rerun an unbounded cascade.

## Open decisions

1. What are the normal-unlink recovery and shared-data retention durations? Safety reset must still revoke access immediately.
2. May either user export the full shared conversation after unlink, only their authored messages, or only exports created before unlink?
3. Should individual sent-message deletion be available, and what tombstone/recovery window is appropriate?
4. Which minimal audit fields and retention period are approved for security and abuse investigation?
5. Does account deletion include a grace period by default, and can the user request immediate purge?
6. How should Clerk account deletion be ordered relative to the Convex purge so progress remains authenticated and recoverable?
7. What product language distinguishes normal unlink, hide chat, delete account, and safety reset without implying partner notification?
