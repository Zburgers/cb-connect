# Trust Boundaries and Auth Identity

| Field | Value |
|---|---|
| Status | Proposed — implementation not started |
| Owner | CB Connect backend/auth |
| Milestone | `v0.2.0` Gate 0 — trust and correctness |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | Clerk JWT integration; Convex auth config; [#1](https://github.com/Zburgers/cb-connect/issues/1), [#2](https://github.com/Zburgers/cb-connect/issues/2), [#3](https://github.com/Zburgers/cb-connect/issues/3), [#6](https://github.com/Zburgers/cb-connect/issues/6); draft [PR #8](https://github.com/Zburgers/cb-connect/pull/8) |

## Purpose

Define one enforceable identity and authorization boundary for every Clerk-authenticated Convex operation, webhook-driven profile sync, onboarding role assignment, and couple invitation. This specification is a Gate 0 prerequisite for Care Loop and any broader sharing of health-adjacent data.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative.

## Scope

In scope:

- Clerk JWT identity resolution in Convex;
- Clerk webhook verification and idempotent profile sync;
- first-time role assignment and role locking;
- cryptographically strong, single-use couple invitations;
- uniqueness and authorization invariants at public Convex functions;
- audit-safe migration from the current schema.

Out of scope:

- session issuance, MFA, password recovery, and Clerk-hosted account UI;
- relationship unlink, account erasure, and retention policy, specified in [02-relationship-lifecycle-data-rights-and-safety-reset.md](./02-relationship-lifecycle-data-rights-and-safety-reset.md);
- health-event date validation tracked separately in issues #7 and #10;
- Care Loop permissions and notification delivery.

## Current gaps

The following are verified on the reviewed `main` snapshot:

1. `convex/_helpers/auth.ts` and user mutations resolve `users.clerkId` with `identity.subject`. Project Convex guidance requires `identity.tokenIdentifier` as the canonical auth-linked lookup key. This is especially important because `convex/auth.config.ts` accepts more than one Clerk issuer.
2. `users.clerkId` serves both as runtime auth identity and Clerk's provider object ID. Those are different responsibilities and cannot safely represent multiple issuers.
3. `syncUserFromWebhook` is a public mutation accepting a shared webhook secret. The Next.js route verifies a parsed-and-reserialized JSON body, then forwards that same secret. Draft PR #8 fixes raw-body verification but intentionally leaves the public mutation boundary unchanged.
4. Webhook event IDs are not persisted, so replay processing has no explicit dedupe record. `user.deleted` is not handled.
5. `updateUserRole` permits any authenticated user to switch between `primary` and `partner`, including after onboarding or relationship membership.
6. Pairing uses a six-digit `Math.random()` code valid for 24 hours. Per-user and per-entered-code throttles do not stop distributed enumeration, and failed attempts retain the raw entered code.
7. Several helpers use `.first()` where the domain assumes one membership. Convex indexes do not themselves enforce uniqueness, so duplicate user memberships or couple roles must be detected and prevented transactionally.

## Normative invariants

### Identity

1. Every protected public Convex query or mutation MUST call `ctx.auth.getUserIdentity()` through a shared helper and fail closed when identity is absent.
2. Runtime ownership and authorization MUST resolve by `identity.tokenIdentifier`; client-provided user IDs, Clerk IDs, roles, couple IDs, or emails MUST NOT establish authority.
3. Clerk's provider user ID MUST remain separate metadata for verified webhook reconciliation. Email MUST NOT be an identity key and MUST NOT trigger automatic account merging.
4. One token identifier MUST map to at most one CB Connect user, and one active CB Connect user MUST map to at most one token identifier.
5. Public functions MUST declare validators for every argument. Sensitive maintenance and migration functions MUST be `internalQuery`, `internalMutation`, or `internalAction`.
6. Authentication proves who the caller is; every resource operation MUST separately prove ownership, active couple membership, role, and applicable sharing permission.

### Webhooks

1. Clerk webhook signatures MUST be verified against the exact raw request body before parsing or mutation.
2. The target design MUST terminate Clerk webhooks in a Convex `httpAction` registered in `convex/http.ts`, then call an internal mutation. No webhook secret may be accepted by a public Convex function argument.
3. Only the verified event payload may supply provider identity fields. The primary email MUST be resolved from Clerk's declared primary email ID, not array position.
4. Provider plus webhook event ID MUST be idempotent. Duplicate delivery MUST return success without repeating state changes.
5. Unknown event types MUST be acknowledged without mutation. Invalid signatures MUST produce no database writes and a non-success response.
6. `user.deleted` MUST disable access immediately and enqueue the lifecycle policy in spec 02; a webhook MUST NOT synchronously perform an unbounded cascade.

### Roles and relationships

1. Role assignment MUST be a one-time onboarding transition while the user has no role, no couple membership, and no active invitation created or redeemed.
2. The ordinary client API MUST NOT support role switching. Any later correction requires a separately designed, audited reset or internal recovery operation.
3. A user MUST have at most one non-terminal couple membership. An active couple MUST have exactly one primary and at most one partner.
4. Every couple-scoped read/write MUST validate current membership and `couples.status === "active"`; a stale membership or guessed document ID grants no access.

### Invitations

1. New invitations MUST use a cryptographically secure random secret with at least 96 bits of entropy, be single-use, and expire within 30 minutes by default.
2. Only a keyed digest of the secret MAY be stored. Plaintext secrets and failed entered values MUST NOT be persisted or logged.
3. Creating a new invitation MUST revoke prior active invitations for that couple. Redemption MUST atomically consume the invitation and create the membership.
4. Redemption errors MUST not disclose whether a secret, couple, or account exists.
5. Durable throttles MUST cover actor and target-couple budgets. If an edge/API layer can observe network signals, it SHOULD add privacy-minimized network throttling; high entropy remains mandatory.

## Target identity and onboarding states

| State | Entry | Allowed action | Exit |
|---|---|---|---|
| `webhook_only` | Verified `user.created` before first app session | Profile sync only | First valid JWT binds token identifier |
| `authenticated_unonboarded` | JWT resolves; no role assigned | Read own profile; assign initial role | `role_locked` |
| `role_locked` | Initial role committed | Normal role-specific product actions | `disabled` or internal recovery |
| `disabled` | Clerk deletion, account erasure request, or security action | Data-rights status only; no product access | Erasure completes or audited recovery |
| `erased` | Retention workflow completed | None | Terminal |

Target additive user fields:

- `authProvider: "clerk"`;
- `authTokenIdentifier?: string` during migration, indexed by `by_auth_token_identifier`;
- `providerUserId` (renamed from or initially mirrored with `clerkId`), indexed with provider;
- `onboardingState: "unstarted" | "role_locked"`;
- `roleAssignedAt`, `disabledAt`, and `profileSyncVersion` as optional migration fields.

Do not synthesize `tokenIdentifier` from remembered formatting. Bind the exact value returned by a valid Convex identity.

## Invitation state machine

| Current | Actor/event | Next | Required effect |
|---|---|---|---|
| none | Eligible primary creates | `active` | Revoke older active invites; store digest and expiry |
| `active` | Eligible partner redeems | `redeemed` | Atomically create membership and consume invite |
| `active` | Primary revokes/regenerates | `revoked` | Reject all later redemption |
| `active` | Expiry observed/cleanup | `expired` | Reject redemption; retain minimal audit metadata |
| `active` | Attempt budget exceeded | `locked` | Reject redemption and require regeneration |
| terminal | Any caller retries | unchanged | Generic failure; no membership mutation |

## Actor authorization matrix

| Operation | Unauthenticated | Unonboarded user | Unlinked primary | Unlinked partner | Active primary | Active partner | Verified webhook/internal |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read/update own safe profile | No | Yes | Yes | Yes | Yes | Yes | Sync fields only |
| Assign initial role | No | Yes, once | No | No | No | No | Recovery only |
| Generate/revoke invite | No | No | Yes | No | Regenerate only if policy allows | No | Cleanup only |
| Redeem invite | No | No | No | Yes | No | No | No |
| Read couple resources | No | No | No | No | Yes, permission-scoped | Yes, permission-scoped | Explicit job scope only |
| Change role | No | Initial assignment only | No | No | No | No | Audited recovery only |
| Sync provider profile | No | No | No | No | No | No | Yes, verified and idempotent |

## Migration and backfill

1. Add optional identity/onboarding fields and indexes without changing current reads.
2. Scan for duplicate `clerkId`, duplicate memberships by user, and duplicate primary/partner roles by couple. Stop rollout and manually resolve conflicts; never merge users by email.
3. Mirror current `clerkId` into provider metadata and mark legacy rows as awaiting JWT binding.
4. Deploy a dual-read auth helper: exact token identifier first; then a bounded Clerk provider-ID fallback. On a valid fallback, atomically claim the unowned token identifier and record migration telemetry.
5. Route all protected functions through that helper; remove direct `identity.subject` lookups.
6. Merge the raw-body correction from PR #8 or equivalent, then move ingress to `convex/http.ts`, add event dedupe, and retire `syncUserFromWebhook`.
7. Deploy one-time role assignment and block later client role changes.
8. Introduce secure invitation records. Expire every legacy six-digit code at cutover; do not migrate plaintext codes.
9. Remove the provider-ID auth fallback only after active-user coverage and duplicate scans meet the release threshold. Dormant unbound accounts remain inaccessible until a verified sign-in binds them.

All backfills MUST be bounded internal mutations using indexed batches and scheduled continuation; no unbounded `.collect()` cascade is permitted.

## Acceptance criteria

- [ ] Every protected Convex function resolves the caller through one token-identifier helper and separately checks resource authorization.
- [ ] Two Clerk issuers with the same subject cannot resolve to the same user.
- [ ] A client cannot call profile sync, provide a user ID to impersonate another account, or change a locked role.
- [ ] Valid raw Clerk events sync once; missing, invalid, modified, and replayed events produce the specified outcomes.
- [ ] `user.deleted` immediately disables product access and schedules lifecycle processing.
- [ ] Invitation secrets meet the entropy/TTL/storage rules and are atomically single-use.
- [ ] Distributed attempts hit actor and target budgets without storing attempted secrets.
- [ ] Duplicate memberships/roles are prevented on every creation path and surfaced as integrity errors.
- [ ] Existing valid users can sign in throughout the staged migration with no email-based account merge.
- [ ] Issues #1, #2, #3, and #6 are closed with tests and deployment evidence before Gate 0 exits.

## Test plan

Use `convex-test` with Vitest for Convex functions and focused route/HTTP tests for webhook bytes.

1. **Identity:** unauthenticated rejection; exact token lookup; issuer collision; missing user; disabled user; attempted client-ID impersonation.
2. **Migration:** legacy fallback binding; token claim collision; duplicate provider rows; fallback removal; no merge on equal email.
3. **Roles:** first assignment succeeds; repeat/switch fails; membership and active-invite constraints fail; internal recovery is audited.
4. **Webhook:** valid raw bytes; whitespace/key-order preservation; missing/invalid headers; duplicate event; update before create; deleted user; primary-email selection.
5. **Invitation:** entropy/format; digest-only storage; expiry; revoke/regenerate; one-time redemption race; actor/target throttles; terminal-state retries.
6. **Authorization regression:** both roles can access only active-couple resources and only within current sharing permissions.
7. **Production smoke:** fresh Clerk sign-in reaches `useConvexAuth()` authenticated state and a protected query succeeds for each configured issuer.

## Telemetry and audit

Record structured, non-sensitive events:

- `auth_resolution_failed` by reason and issuer hash;
- `auth_legacy_identity_bound` and `auth_identity_collision`;
- `role_assignment_rejected` by reason;
- `clerk_webhook_received`, `verified`, `duplicate`, `failed`, and processing latency;
- `pairing_invite_created`, `redeemed`, `expired`, `revoked`, `locked`, and rejection reason.

Telemetry MUST NOT include JWTs, webhook bodies/secrets, invitation secrets/digests, raw attempted codes, email, health data, or message content. Security audit records MUST include actor user ID where available, operation, target type/ID, outcome, reason code, and server timestamp, with retention defined by spec 02.

## Rollout and rollback

Roll out in additive phases: schema and duplicate audit; dual-read identity binding; centralized authorization; webhook ingress; role lock; secure invitations; fallback removal. Gate each phase on error rate, collision count, and fresh-sign-in smoke tests in dev/test/production.

Rollback MUST preserve new identity bindings and audit records. Safe rollback means restoring bounded dual-read resolution or the previously verified webhook receiver, not deleting canonical fields or reactivating legacy invitations. Keep only one live webhook destination; event dedupe protects transition retries. If secure redemption fails, disable new redemption and regenerate invites after repair rather than restoring six-digit codes.

## Open decisions

1. Which configured Clerk issuer is authoritative for each deployment, and is sharing one Convex deployment across issuers still required?
2. Should a verified `user.created` event create a lightweight `webhook_only` user, or should user creation wait for first authenticated session?
3. Is role correction ever self-service after complete unlink and erasure, or always support-mediated?
4. Should invite redemption remain a Convex mutation or pass through an edge endpoint to add network-level throttling?
5. What audit retention period satisfies safety investigation needs without retaining relationship metadata longer than necessary?
