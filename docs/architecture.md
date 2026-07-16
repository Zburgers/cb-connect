# CB Connect Architecture

| Field | Value |
|---|---|
| Status | Canonical architecture baseline; target v0.2.0 behavior not implemented |
| Owner | CB Connect Engineering and Privacy/Security |
| Milestone | `v0.2.0`, trust-first Care Loop pilot |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | [PRD v2](./product/cb-connect-prd-v2.md), specs 01-05, and refreshed live issue/PR state |
| Authority | Canonical current/target system boundary; supersedes architecture claims in the legacy technical PRD |
| Scope | Current web/Convex implementation and the approved target architecture for a consent-first Care Loop release |

This document separates the system that exists today from the target architecture. A statement under **CURRENT** describes checked-in behavior. A statement under **TARGET v0.2.0** is a design requirement and must not be treated as implemented until its migration step and tests are complete.

## 1. System context

CB Connect is a private couples cycle-tracking and care-coordination application. One user records cycle and body context; a linked partner sees only the information that the owner has allowed and may perform narrowly authorized actions.

### CURRENT

```text
Browser
  -> Next.js App Router
     -> Clerk session and route protection
     -> ConvexProviderWithClerk
        -> public Convex queries and mutations

Clerk webhook
  -> Next.js /api/webhook/clerk
     -> Convex user-sync mutation

Convex crons
  -> internal prediction/period functions
     -> optional Discord webhook
```

The product is a single Next.js application. Convex owns application state and real-time subscriptions. Clerk owns authentication. The browser calls Convex directly with a Clerk-issued Convex JWT.

### TARGET v0.2.0

The Next.js client remains the only shipped client for `v0.2.0`. The backend is reorganized around explicit domain contracts that a later Expo client can reuse without importing React web components or raw database documents.

```text
Web now; native later
  -> stable, role-specific DTO contracts
     -> authenticated Convex domain functions
        -> ownership and effective-consent evaluator
        -> transactional domain state and audit event
        -> outbox planner
           -> in-app inbox
           -> external delivery adapter
```

## 2. Application routes and providers

### CURRENT

| Route | Responsibility | Protection |
|---|---|---|
| `/` | Public landing page | Public |
| `/sign-in/*` | Clerk sign-in | Public |
| `/sign-up/*` | Clerk sign-up | Public |
| `/onboarding` | Role selection and initial cycle setup | Clerk middleware |
| `/dashboard` | Role-aware home dashboard | Clerk middleware plus Convex auth checks |
| `/dashboard/log` | Period/pain history, correction, partner assistance, CSV export | Clerk middleware plus Convex authorization |
| `/dashboard/partner` | Pairing, sharing settings, relationship details, revocation | Clerk middleware plus Convex authorization |
| `/dashboard/settings` | Cycle, profile, notification consent, privacy snapshot | Clerk middleware plus Convex authorization |
| `/api/health` | Process health response | Public HTTP route |
| `/api/webhook/clerk` | Clerk user create/update synchronization | Svix signature verification |

The root provider order is:

1. `ClerkProvider`
2. `ThemeProvider`
3. `ConvexProviderWithClerk`

`middleware.ts` protects `/dashboard(.*)` and `/onboarding`. The dashboard layout ensures a Convex user exists, redirects users without an onboarding role, publishes presence heartbeats, and mounts the couple DM for active links.

### TARGET v0.2.0

- Route middleware is a first gate, never the authorization boundary.
- Every sensitive query and mutation derives identity and ownership in Convex.
- Home routes consume explicit `PrimaryHomeDto` or `PartnerHomeDto` results.
- Care Loop is added to the existing App Router structure rather than through a parallel router.
- Pairing, care cards, and inbox items are deep-link-ready, but links contain no reusable health payload.

## 3. Convex domains

### CURRENT

| Domain | Tables | Public functions | Internal functions |
|---|---|---|---|
| Identity/profile | `users` | `users.getMe`, `users.ensureUser`, `users.updateUserRole`, `users.updateUserPreferences`, webhook sync | `users.syncUser`, `users.getAllPrimaryUsers` |
| Couple lifecycle | `couples`, `coupleMembers`, `pairingCodes`, `pairingCodeAttempts` | generate/redeem code, status, sharing, nickname/date, revoke | None |
| Period/cycle | `periodEvents`, `cycleSettings` | log/end/correct/delete periods, assisted logging, settings/history | `periods.autoEndPeriods`, prediction inputs |
| Pain | `painLogs` | create/update pain log, history through dashboard/timeline | None |
| Guidance content | `painTips`, `nutritionTips`, `hiddenNutrition` | dashboard reads, hide nutrition tip | None |
| Couple communication | `coupleMessages`, `coupleMessageReactions`, `nudges` | send/list/react/clear chat, send/see nudge | None |
| Presence | `presence` | heartbeat, offline, partner presence | None |
| Notifications | `notificationLog` | user notification history | log mutation, prediction action, Discord action |

`dashboard.getDashboardData` currently composes user resolution, partner targeting, sharing checks, cycle calculation, pain, pain guidance, and nutrition guidance into one response.

### TARGET v0.2.0

The backend is divided by domain behavior rather than by screens:

- `identity`: canonical Clerk identity mapping and user lifecycle.
- `relationships`: active membership, invitation, leave/revoke, and shared-data lifecycle.
- `sharing`: defaults, per-entry consent, immutable consent snapshots, and effective visibility.
- `cycle`: observed period records and current deterministic calculation;
  confidence-aware projections remain a post-v0.2.0 candidate.
- `checkIns`: owner-private Care Loop request/avoid draft source.
- `care`: partner-safe Care Cards, the lean response state machine, and audit trail.
- `events`: durable domain event creation.
- `notifications`: inbox, preferences, devices, delivery planning, retry, and receipts.
- `privacy`: export, account deletion, partner revocation, and safety reset.
- `home`: typed composition only; it does not own domain rules.

Public functions expose client-safe DTOs. Internal functions perform scheduled expiry, projection, outbox, and migration work. Database documents remain internal to Convex.

## 4. Data ownership and sharing

### CURRENT

- `periodEvents`, `painLogs`, `cycleSettings`, and hidden nutrition preferences are owned by `userId`.
- A partner-assisted period record is stored under the primary owner's `userId` and preserves creator/updater attribution.
- The primary member's `sharingPhase` and `sharingPain` flags control partner reads.
- `sharingPeriodWrite` is separate, defaults to false, requires phase sharing, and is disabled when phase sharing is disabled.
- Couple messages, reactions, nudges, relationship metadata, and presence belong to a couple space.
- The primary user is the only user allowed to correct or delete their period records.
- Partner absence responses intentionally do not distinguish between "not logged" and "not shared."

Authorization is split between `users.role` and `coupleMembers.role`. Most relationship lookups use the first membership returned by `by_user`.

### TARGET v0.2.0

Ownership and authorization follow these rules:

1. Health and check-in records have one immutable owner.
2. `coupleMembers.role` is authoritative inside a relationship; a profile/onboarding role cannot grant relationship permissions.
3. A user has at most one active relationship membership. Historical memberships remain addressable but never satisfy active authorization.
4. Partner-visible data is a server-produced projection, never the owner's raw record.
5. Persistent sharing settings are defaults and upper bounds. Per-entry consent can narrow them; it cannot silently broaden disabled health categories.
6. A request-only Care Card has an explicit Care Loop permission independent of pain and phase visibility.
7. Every partner-visible Care Card identifies its recipient, source revision, shared fields, consent time, and expiry.
8. Revocation takes effect on reads, mutations, scheduled work, and external deliveries immediately.
9. Private data existence remains ambiguous to the partner.

The target separates:

- owner-private `careCheckIns`;
- immutable, recipient-specific `careShareSnapshots`;
- bounded response state on `careRequests` for the current revision;
- append-only consent and action audit events.

`careOutcomes`, learned preferences, selected-detail sharing, and completion
states are deliberately deferred until the request-only pilot produces evidence.

## 5. Authentication and identity

### CURRENT

Clerk authenticates the browser and provides a JWT to Convex through `ConvexProviderWithClerk`. `convex/auth.config.ts` supports one or more configured Clerk issuer domains with the `convex` application ID.

User lookup currently maps `identity.subject` to `users.clerkId`. The webhook verifies Svix headers after parsing and reserializing JSON, then calls a public mutation protected by a shared secret argument. It synchronizes `user.created` and `user.updated`; account deletion is not synchronized.

### TARGET v0.2.0

- `identity.tokenIdentifier` is the canonical Convex identity key.
- Migration retains legacy `clerkId` lookup only while existing rows are backfilled and verified.
- No public function accepts a user identifier for authorization.
- Clerk webhook verification uses the exact raw request body.
- Webhook-to-Convex synchronization has a server-only boundary and replay/idempotency handling.
- `user.deleted` begins the defined deletion workflow.
- Role changes cannot mutate an active relationship's authorization semantics.
- Authentication tests cover missing identity, wrong relationship, revoked membership, stale invitation, and deleted account states.

## 6. Relationship lifecycle

### CURRENT

Pairing uses a six-digit, 24-hour code. Generation and authenticated redemption have rate limits and attempt records. Revocation currently:

- is available only to a primary user;
- marks the couple revoked;
- deletes all couple messages and reactions;
- deletes the partner membership;
- preserves the primary membership and owner health history.

It does not define retention for pairing attempts, notifications, nudges, presence, or shared metadata. The shared chat also has a separate mutation that either member can use to delete the entire conversation for both people.

### TARGET v0.2.0

Relationship lifecycle is explicit:

```text
invited -> active -> ended
                 -> safety_revoked
```

- Either member can leave without the other member's approval.
- Safety revocation is immediate and cannot be blocked by the partner.
- Active invitations are invalidated on relationship activation, leave, revocation, and account deletion.
- Per-user chat hiding is distinct from destructive shared deletion.
- Shared-data ownership and retention choices are recorded before destructive cleanup.
- Cleanup is bounded and resumable; it cannot rely on unbounded `.collect()` operations in one transaction.
- Old memberships cannot shadow a new active membership.

## 7. Notifications and events

### CURRENT

`notificationLog` serves several incompatible purposes:

- in-app activity rows;
- external Discord attempt logs;
- partner message previews;
- assisted-period and relationship-change records.

`externalNotificationConsent` is one user-level boolean. A daily cron finds primary users, calculates predictions, and may call the Discord adapter. Delivery has no durable event identity, dedupe key, preference matrix, device model, inbox read state, retry plan, or provider receipt.

### TARGET v0.2.0

Domain writes do not call an external provider directly.

```text
transactional domain mutation
  -> careEvent with stable dedupe key
  -> current consent and recipient-preference evaluation
  -> inbox item and/or notificationDelivery
  -> channel adapter
  -> provider receipt or bounded retry
```

Required concepts:

- `careEvents`: immutable event identity and safe preview metadata;
- `notificationPreferences`: category, channel, recipient, sensitivity, quiet hours, pause state;
- `notificationInbox`: per-recipient actionable/read state;
- `notificationDevices`: provider token, platform, last-seen and revocation state;
- `notificationDeliveries`: event/channel/destination status, attempts, next attempt, receipt, and failure code.

Each delivery is authorized again immediately before sending. Expired or revoked care shares cannot produce meaningful notifications. Lock-screen text is generic by default. The Discord path becomes an isolated legacy adapter and is not the product notification surface.

## 8. Time, cycle calculations, and offline writes

### CURRENT

Cycle calculations use the latest period start, configured average lengths, and deterministic calendar arithmetic. The web client supplies a local calendar date to the dashboard. Users do not have a persisted IANA timezone or locale. Period mutations validate date shape; pain logging does not apply the same calendar-date validator.

### TARGET v0.2.0

- Persist user `timeZone` and `locale`.
- Store local calendar date separately from occurrence timestamp and server receipt time where both matter.
- Apply one server-side calendar-date validator across all domains.
- Care and mobile-capable mutations accept a client-generated idempotency key.
- Mutable workflows use a revision or expected-state guard to prevent stale offline clients overwriting newer consent.
- Expiry is checked on every server operation and is also materialized by a scheduled internal transition so subscribed clients update.
- Cycle projections expose confidence, source count, variability, algorithm version, and computed time rather than exact-looking certainty.

## 9. Tests and verification

### CURRENT

- `convex-test` with Vitest covers assisted-period permissions, attribution, correction, and history visibility.
- Unit tests cover timeline phase helpers plus selected client helper modules.
- Playwright contains onboarding and partner-linking flows, but authenticated setup is not yet a reliable release gate.
- `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, and `npm run build` are the documented local commands.

### TARGET v0.2.0

Every sensitive domain ships with a permission matrix covering owner, linked partner, unrelated user, revoked member, stale role, expired share, and unauthenticated caller.

Care Loop tests cover:

- request-only views and the absence of all health context;
- private-note and private check-in non-disclosure;
- immutable consent snapshot and immediate revocation;
- every allowed and rejected action transition;
- expiry and scheduled cleanup;
- idempotent retry and stale revision conflicts;
- ambiguous empty/private partner responses;
- notification redaction and deduplication.

Lifecycle tests cover relinking after revocation, partner-initiated leave, account deletion, invitation invalidation, per-user chat hiding, and bounded cleanup. Authenticated two-role E2E is required before the feature branch is merge-ready.

## 10. Known current gaps

The following are current-state risks, not target behavior:

1. Auth-linked lookup uses `identity.subject` rather than the canonical token identifier.
2. User and membership roles can disagree.
3. A retained revoked membership can interfere with later membership lookup.
4. Unpairing is primary-only and destructively clears shared chat.
5. Either member can globally clear chat.
6. Account deletion and `user.deleted` synchronization are absent.
7. Consent changes have no immutable audit receipt or expiry.
8. Notification event, inbox, and delivery concerns are conflated.
9. Sensitive notification payloads have no documented retention period.
10. Scheduled notifications are not durably idempotent.
11. Several reads and cleanup mutations use unbounded collection patterns.
12. Dashboard and partner frontend contracts are not explicit; `PartnerDashboard` accepts `any`.
13. Timezone, travel, and offline retry semantics are undefined.
14. Clinical guidance content has no governance metadata.

## 11. Architecture invariants

These invariants apply to all `v0.2.0` implementation work:

1. Authentication identifies a caller; it never proves ownership by itself.
2. Authorization derives user and active relationship server-side.
3. Clients never supply an authorization `userId`, owner ID, or recipient ID that the server trusts.
4. Owner-private and partner-safe DTOs are different contracts.
5. Private notes, unselected health fields, and imported records never cross the partner boundary.
6. Existing sharing flags and explicit Care Loop consent are enforced in Convex, not only in UI state.
7. Revocation wins over cached state, queued work, notification preferences, and retries.
8. The primary owner remains the source of truth for their health record; partner edits are attributed and correctable.
9. No partner score, care streak, or hidden-data inference is created.
10. Domain state and its audit/outbox event commit transactionally.
11. All externally retried work is idempotent and bounded.
12. High-churn presence/device state remains separate from stable profile and relationship state.
13. Historical and operational reads are bounded or paginated.
14. Health-platform imports remain private until an explicit later share action.

## 12. Migration sequence

1. **Document and test current behavior.** Freeze the authorization matrix and add regression coverage for current assisted logging.
2. **Repair identity.** Add canonical token identity fields, backfill, dual-read temporarily, verify, then remove subject-only authorization lookup.
3. **Repair relationship lifecycle.** Make active membership explicit, constrain roles, add symmetric leave/safety reset, invalidate invitations, and replace destructive chat clear.
4. **Add data rights.** Define export, retention, account deletion, shared-data handling, and bounded cleanup jobs.
5. **Add consent primitives.** Introduce default-disabled Care Loop pilot eligibility, explicit per-publication consent, immutable per-share snapshots, audit records, expiry, and effective visibility helpers.
6. **Add Care Loop state.** Introduce private check-ins, recipient shares, acknowledge/cannot-help transitions, and role-safe DTOs without external push.
7. **Add events and inbox.** Write domain events transactionally and expose a safe in-app feed.
8. **Add notification delivery.** Introduce preferences, devices, dedupe, retry, receipts, redaction, and consent rechecks; then deprecate direct Discord side effects.
9. **Extract stable contracts.** Split home composition and publish typed web/mobile-safe DTOs and pure domain validation.
10. **Record later foundations.** Persist timezone and standardize
   dates/idempotency where Gate 0 or Care Loop requires them. Confidence-aware
   projections, native mobile, and health import remain later candidates.

Every schema step is additive first, supports legacy rows explicitly, updates fixtures and tests with the schema, and removes legacy fields only in a later verified migration.

## 13. Decision log

| Decision | Status | Rationale |
|---|---|---|
| Keep Next.js App Router and one Convex backend | Accepted | The current structure is working and already supports both roles. |
| Test Care Loop as the `v0.2.0` product candidate | Accepted | It fits existing consent and partner primitives, but the request-only pilot must validate usefulness and safety. |
| Stabilize trust and lifecycle before collecting more sensitive data | Accepted | Current unlink, identity, notification, and deletion gaps would compound with Care Loop. |
| Keep owner-private check-ins separate from partner share snapshots | Accepted | This minimizes accidental field disclosure and preserves an auditable consent boundary. |
| Use explicit domain DTOs instead of raw Convex documents | Accepted | Web and future native clients need stable, versionable contracts. |
| Avoid a generic policy engine in `v0.2.0` | Accepted | Direct domain rules are easier to audit while there is one relationship recipient. |
| Add a durable event/outbox boundary before push | Accepted | Event creation, consent, and provider delivery have different lifecycle and retry rules. |
| Keep Discord only as a legacy adapter | Accepted | A shared webhook is not a suitable product surface for intimate data. |
| Defer Expo workspace migration until domain seams exist | Accepted | Moving directories does not create correct contracts or permissions. |
| Defer health write-back, AI coaching, social features, and multi-partner support | Accepted | They expand privacy, medical, moderation, or permission risk before the core loop is validated. |

## 14. Runtime and service dependencies

### CURRENT

- Next.js 15.2 and React 19
- TypeScript and Tailwind CSS
- Convex backend and generated client API
- Clerk Next.js authentication and Convex JWT template
- Svix webhook verification
- Framer Motion, Radix UI, and Lucide React
- Vitest, `convex-test`, and Playwright
- Optional Discord webhook

Required configuration includes the public Convex URL, Clerk browser/server keys, the Clerk frontend issuer domain list for Convex, and the Clerk webhook secret. Discord configuration is optional.

### TARGET v0.2.0

No new delivery provider or mobile framework is required to implement the Care Loop domain itself. Provider push, Expo, HealthKit, and Health Connect remain later adapters behind the contracts defined here.

Any new dependency must have a named architectural purpose, data-flow entry, deletion behavior, and privacy disclosure impact. Core ownership, consent, transition, redaction, and idempotency rules remain application-owned and cannot be delegated to a client or notification provider.
