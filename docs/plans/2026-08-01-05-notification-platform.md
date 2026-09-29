# Consent-Aware Notification Platform Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires an approved event/privacy contract and dated execution plan after Gate 3 evidence exists.

**Goal:** Deliver a private, auditable in-app notification inbox and channel-ready event pipeline without assuming consent or duplicating external effects.

**Architecture:** Domain transactions create versioned events in a durable outbox. Current policy creates one logical `notificationDelivery` per event/channel/destination identity; each delivery owns timing, frozen render identity, retry/claim state and normalized outcomes. In-app persistence is the first adapter and the canonical user surface. Later push/email providers implement the same small adapter contract with separate attempts, late destination resolution and honest acceptance/receipt/unknown semantics. Convex durable scheduling and bounded reconciliation provide execution; no additional queue infrastructure is required.

**Execution authority:** The [dated Gate 4 plan](2026-09-27-gate-4-event-privacy-retention-execution.md), revised 2026-09-30 after the owner architecture review, contains the proposed `G4-EVENT-V1` / `G4-DELIVERY-V1` freeze, task dependencies and failure matrix. Its approval is required before application work. This gate-level summary does not override its file ownership or lifecycle boundaries.

**Tech Stack:** Convex tables/mutations/actions/crons, TypeScript, Next.js, Vitest/convex-test, Playwright.

---

**Depends on:** [Personalized prediction](2026-08-01-04-personalized-prediction-and-evaluation.md)

**Research:** [Cross-client/notification architecture](../research/2026-08-01-major-release-cycle-trust-research.md#51-cross-client-and-notification-architecture-research)

**Next gate:** [Mobile internal beta](2026-08-01-06-mobile-internal-beta.md)

**Planning status:** Gate-level work packages only. Resolve applicable D-012 retention/deletion rules and D-015 pilot input before exposure.

**Work-package dependencies:** N1 event/delivery contracts -> N2 schema/policy freeze -> N3 domain outbox, N4 templates and N5 scheduling in the disjoint lanes defined by the dated plan. N4 precedes N2 runtime adapter completion; N7 requires the completed in-app adapter and templates. N6 shutdown precedes any exposure and may ship earlier as a separately qualified safety remediation. N8 integrates/qualifies the whole tree; migration/pilot tasks wait for their owner decisions. The dated ledger supplies the exact edges and shared-file serialization.

## Initial channel scope

Gate 4 ships **in-app only**. It makes channels extensible but does not silently enable push, email, SMS or Discord. Push is qualified in Gate 6 after the mobile beta. Every later destination requires separate opt-in, safe templates and delivery evidence.

## Entry criteria

- Stable cycle/prediction event versions and user-local timezone are approved.
- Notification purposes and recipients have product/privacy review.
- Existing `notificationLog` and Discord paths are inventoried for migration/removal.
- No “sent” status will conflate outbox creation, provider acceptance and device delivery.

## Implementation tasks

<task id="N1" name="Define notification event taxonomy and privacy classes">
  <description>Version event types, recipient rules, sensitivity, expiration, deduplication and allowed channels before implementing delivery.</description>
  <files>
    <create>convex/_helpers/notificationTypes.ts</create>
    <create>convex/_helpers/notificationTypes.test.ts</create>
    <create>docs/notifications/event-catalog.md</create>
  </files>
  <steps>
    <step>Write exhaustive tests requiring purpose, recipient, sensitivity, expiry, idempotency components and allowed destinations for every event.</step>
    <step>Start with assisted-record confirmation, period-window approaching, Late, explicit pain check-in, partner nudge/message; reserve operational account events until their separate producer/policy is approved.</step>
    <step>Separate primary-private, partner-shareable and account/security classes.</step>
    <step>Prohibit diagnostic, deterministic mood/hormone and fertility template intents.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/notificationTypes.test.ts</command>
    <expected>Catalog is exhaustive and no event lacks privacy/recipient/idempotency policy.</expected>
  </verification>
</task>

<task id="N2" name="Add outbox, inbox, preferences, logical deliveries and attempts">
  <description>Replace the overloaded log with stateful records that distinguish domain event, recipient inbox item, logical delivery and each attempt, with provider-neutral eligibility/outcome semantics.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/mutations/notifications.ts</create>
    <create>convex/queries/notifications.ts</create>
    <create>convex/mutations/notifications.test.ts</create>
  </files>
  <steps>
    <step>Write failing tests for unique idempotency key, recipient authorization, unread/read/dismissed state and preference defaults.</step>
    <step>Add indexed/bounded `notificationEvents`, `notificationInbox`, `notificationPreferences`, `notificationDeliveries` and `notificationDeliveryAttempts` tables plus bounded due work and protected controls.</step>
    <step>Default optional health/cycle and partner destinations off until expressly enabled; account-security notices remain separately governed.</step>
    <step>Store strict immutable render/version identity with safe static copy, not arbitrary `v.any()` payloads; freeze three idempotency scopes and explicit unknown outcome. Implement the in-app adapter and test future provider outcomes using injected fake adapters only.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/notifications.test.ts</command>
    <expected>Inbox/preferences/authorization/idempotency tests pass and payload validators reject sensitive extras.</expected>
  </verification>
</task>

<task id="N3" name="Create events transactionally with domain changes">
  <description>Emit an outbox event in the same Convex mutation as the underlying confirmed domain transition.</description>
  <files>
    <create>convex/_helpers/notificationOutbox.ts</create>
    <create>convex/_helpers/notificationOutbox.test.ts</create>
    <modify>convex/mutations/periods.ts</modify>
    <modify>convex/mutations/painLog.ts</modify>
    <modify>convex/mutations/messages.ts</modify>
    <modify>convex/mutations/nudges.ts</modify>
  </files>
  <steps>
    <step>Write retry/replay tests proving one domain transition creates one logical event.</step>
    <step>Derive stable idempotency keys from event version, domain object/version, recipient and purpose.</step>
    <step>Respect current couple status/sharing at recipient projection time.</step>
    <step>Never create a partner health event from pending/unconfirmed or private-only facts.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/notificationOutbox.test.ts convex/mutations/messages.test.ts convex/mutations/periods.test.ts</command>
    <expected>Retries and concurrent transitions produce no duplicate logical event or unauthorized recipient.</expected>
  </verification>
</task>

<task id="N4" name="Render reviewed privacy-safe templates">
  <description>Map event versions to in-app and future generic-preview templates without embedding sensitive values in titles/previews.</description>
  <files>
    <create>convex/_helpers/notificationTemplates.ts</create>
    <create>convex/_helpers/notificationTemplates.test.ts</create>
    <create>docs/notifications/template-review.md</create>
  </files>
  <steps>
    <step>Write snapshot tests and prohibited-token tests for dates, pain scores, tags, notes and diagnostic/fertility terms.</step>
    <step>Provide reviewed static in-app labels plus an authorized source link and a separate generic external preview such as “You have a private update in CB Connect.”</step>
    <step>Use role-aware but non-assumptive relationship wording.</step>
    <step>Require content/privacy approval per template version.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/notificationTemplates.test.ts</command>
    <expected>Snapshots pass; generic previews contain zero sensitive values or prohibited claims.</expected>
  </verification>
</task>

<task id="N5" name="Implement user-local scheduling and stale-event cancellation">
  <description>Schedule prediction-window and reminder events from immutable approved snapshots using timezone-aware dates, and cancel/supersede them after corrections.</description>
  <files>
    <create>convex/internal/notificationScheduler.ts</create>
    <create>convex/internal/notificationScheduler.test.ts</create>
    <modify>convex/internal/predictionSnapshots.ts</modify>
    <modify>convex/crons.ts</modify>
  </files>
  <steps>
    <step>Write boundary tests for Asia/Kolkata, positive/negative offsets, DST, correction, deletion, new start, pause and revocation.</step>
    <step>Resolve due user-local dates from stored IANA timezone; persisted due work plus transactional generation-guarded runAt wakeups; cron reconciles bounded indexed pending work and never scans all users.</step>
    <step>Reference the shared served prediction/snapshot contract plus G4-SOURCE-V1, independent of CycleState schema versions. Persist indexed Late day-boundary work for clock-only transitions; same-day source corrections must create distinct valid replacements.</step>
    <step>Expire or supersede stale work before inbox projection/delivery. VEGA integrates the real purpose/reminder-time preference mutation with CHRONOS's bounded scheduler helper in N5c; enable/time edits/disable take effect without an unrelated refresh. N7b/N8 qualify that API/UI path.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/notificationScheduler.test.ts</command>
    <expected>Due-event timing is user-local and stale/corrected/revoked work is never delivered.</expected>
  </verification>
</task>

<task id="N6" name="Remove direct Discord health delivery">
  <description>Stop direct Discord delivery, minimize compatibility reads and inventory legacy metadata. Historical migration/deletion requires D-012 approval; no migration is part of safe default-off implementation.</description>
  <files>
    <modify>convex/mutations/painLog.ts</modify>
    <modify>convex/actions/discord.ts</modify>
    <modify>convex/actions/notifications.ts</modify>
    <modify>convex/queries/users.ts</modify>
    <modify>convex/queries/users.test.ts</modify>
    <modify>issues.md</modify>
  </files>
  <steps>
    <step>Write a failing test proving pain/period mutations schedule no Discord action.</step>
    <step>Route approved care events into the private in-app outbox only.</step>
    <step>Stop new legacy writes and redact compatibility queries; do not backfill arbitrary payloads. Any metadata migration is a separate D-012-approved task.</step>
    <step>Disable/remove webhook secrets after verifying no operational dependency remains.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/actions/notifications.test.ts convex/mutations/painLog.test.ts convex/queries/users.test.ts</command>
    <expected>No caller can dispatch Discord, even with a stale secret, and compatibility output excludes legacy sensitive payload/error.</expected>
  </verification>
</task>

<task id="N7" name="Build in-app inbox and preference center">
  <description>Add accessible bounded inbox/history and granular purpose/channel controls to the existing dashboard shell.</description>
  <files>
    <create>app/(dashboard)/dashboard/notifications/page.tsx</create>
    <create>components/notifications/NotificationInbox.tsx</create>
    <create>components/notifications/NotificationPreferences.tsx</create>
    <modify>app/(dashboard)/layout.tsx</modify>
    <modify>app/(dashboard)/dashboard/settings/page.tsx</modify>
    <create>e2e/notifications-in-app.spec.ts</create>
  </files>
  <steps>
    <step>Write failing primary/partner/no-consent/revoked/empty/populated/read/dismiss tests.</step>
    <step>Show purpose, recipient context, state and time without exposing operational payloads.</step>
    <step>Make preference changes immediate and explain that channel availability is separate from permission.</step>
    <step>Use indexed pagination/bounds, project theme variables and WCAG 2.2 AA.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/notifications-in-app.spec.ts --project=chromium</command>
    <expected>Inbox and consent/preference journeys pass for both roles with zero skips.</expected>
  </verification>
</task>

## Hard success criteria

- Duplicate logical inbox/destination delivery for one idempotency key: 0 under retry/concurrency tests and pilot telemetry.
- Partner/private event generated without active membership and sharing/recipient policy: 0.
- Optional health/cycle destination enabled without express consent: 0.
- Generic external preview containing date, phase, pain score/tag/note or condition inference: 0.
- User-local scheduled events outside the configured local-day/quiet-time policy: 0 in timezone fixtures.
- In-app projection/display after correction, pause, expiry or revocation: 0. Later external adapters must revalidate before dispatch and document the unavoidable already-in-flight/recall boundary.
- Event-created, inbox-projected, attempted and delivered/provider states conflated as `sent`: 0.
- In-app critical event projection success: proposed 99.9% monthly after instrumentation baseline; duplicate rate remains exactly 0.
- Inbox queries are indexed/bounded and meet the Gate 0 approved latency SLO.

## Rollout and rollback

Dark-create events first and compare aggregate counts/reasons without user content. Enable inbox for staff/test users, then bounded pilot; external channel adapters remain disabled. Stop on duplicate, privacy mismatch, unexpected volume, stale delivery or error-budget burn. Roll back scheduling/event/projection/delivery flags while preserving currently authorized inbox reads (except an explicit privacy read kill); retain rows without claiming final retention and do not reactivate Discord health delivery.

## Exit evidence

Store approved event catalog/templates, retry/concurrency report, timezone scheduler matrix, legacy shutdown/minimization report (migration only if separately approved), authenticated inbox E2E, privacy review, latency/volume baseline and pilot metrics under `docs/evidence/notification-gate-4/`.
