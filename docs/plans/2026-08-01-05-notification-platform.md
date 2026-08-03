# Consent-Aware Notification Platform Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires an approved event/privacy contract and dated execution plan after Gate 3 evidence exists.

**Goal:** Deliver a private, auditable in-app notification inbox and channel-ready event pipeline without assuming consent or duplicating external effects.

**Architecture:** Domain transactions create versioned notification events in a durable outbox. Recipient projection, consent, quiet time, template rendering and destination are resolved before separate delivery attempts. The in-app inbox is canonical; Discord is removed from health-event delivery and future push/email adapters consume the same idempotent contract.

**Tech Stack:** Convex tables/mutations/actions/crons, TypeScript, Next.js, Vitest/convex-test, Playwright.

---

**Depends on:** [Personalized prediction](2026-08-01-04-personalized-prediction-and-evaluation.md)

**Research:** [Cross-client/notification architecture](../research/2026-08-01-major-release-cycle-trust-research.md#51-cross-client-and-notification-architecture-research)

**Next gate:** [Mobile internal beta](2026-08-01-06-mobile-internal-beta.md)

**Planning status:** Gate-level work packages only. Resolve applicable D-012 retention/deletion rules and D-015 pilot input before exposure.

**Required task order:** N1 versioned event/privacy catalog -> N2 additive schema/preferences/inbox -> N3 transactional outbox -> N4 approved templates -> N5 timezone/snapshot scheduling -> N6 legacy Discord/log migration and shutdown -> N7 bounded inbox/preferences pilot. N6 may disable an unsafe legacy path earlier as a separately qualified remediation, but migration must not copy arbitrary payloads.

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
    <step>Start with assisted-record confirmation, period-window approaching, Late, explicit pain check-in, partner nudge/message and operational account events.</step>
    <step>Separate primary-private, partner-shareable and account/security classes.</step>
    <step>Prohibit diagnostic, deterministic mood/hormone and fertility template intents.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/notificationTypes.test.ts</command>
    <expected>Catalog is exhaustive and no event lacks privacy/recipient/idempotency policy.</expected>
  </verification>
</task>

<task id="N2" name="Add outbox, inbox, preferences and attempts">
  <description>Replace the overloaded log with stateful records that distinguish domain event, recipient inbox item and each channel attempt.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/mutations/notifications.ts</create>
    <create>convex/queries/notifications.ts</create>
    <create>convex/mutations/notifications.test.ts</create>
  </files>
  <steps>
    <step>Write failing tests for unique idempotency key, recipient authorization, unread/read/dismissed state and preference defaults.</step>
    <step>Add indexed/bounded `notificationEvents`, `notificationInbox`, `notificationPreferences` and `notificationDeliveryAttempts` tables.</step>
    <step>Default optional health/cycle and partner destinations off until expressly enabled; account-security notices remain separately governed.</step>
    <step>Store structured redacted template variables, not arbitrary `v.any()` payloads.</step>
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
    <step>Provide private in-app body content and a separate generic external preview such as “You have a private update in CB Connect.”</step>
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
    <modify>convex/actions/notifications.ts</modify>
    <modify>convex/crons.ts</modify>
  </files>
  <steps>
    <step>Write boundary tests for Asia/Kolkata, positive/negative offsets, DST, correction, deletion, new start, pause and revocation.</step>
    <step>Resolve due user-local dates from stored IANA timezone; cron only finds due work.</step>
    <step>Reference prediction snapshot/version rather than recomputing untraceable notification dates.</step>
    <step>Expire or supersede stale work before inbox projection/delivery.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/notificationScheduler.test.ts</command>
    <expected>Due-event timing is user-local and stale/corrected/revoked work is never delivered.</expected>
  </verification>
</task>

<task id="N6" name="Remove direct Discord health delivery">
  <description>Stop high-pain and cycle paths from sending health-adjacent details to Discord and migrate useful historical audit metadata conservatively.</description>
  <files>
    <modify>convex/mutations/painLog.ts</modify>
    <modify>convex/actions/discord.ts</modify>
    <create>convex/migrations/notificationLog.ts</create>
    <create>convex/migrations/notificationLog.test.ts</create>
    <modify>issues.md</modify>
  </files>
  <steps>
    <step>Write a failing test proving pain/period mutations schedule no Discord action.</step>
    <step>Route approved care events into the private in-app outbox only.</step>
    <step>Migrate only redacted delivery status/type/time metadata; do not copy arbitrary legacy payloads.</step>
    <step>Disable/remove webhook secrets after verifying no operational dependency remains.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/migrations/notificationLog.test.ts convex/mutations/periods.test.ts</command>
    <expected>No health mutation calls Discord and migration output excludes legacy sensitive payload.</expected>
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
- Corrected, deleted, paused, expired or revoked event delivered afterward: 0.
- Event-created, inbox-projected, attempted and delivered/provider states conflated as `sent`: 0.
- In-app critical event projection success: proposed 99.9% monthly after instrumentation baseline; duplicate rate remains exactly 0.
- Inbox queries are indexed/bounded and meet the Gate 0 approved latency SLO.

## Rollout and rollback

Dark-create events first and compare aggregate counts/reasons without user content. Enable inbox for staff/test users, then bounded pilot; channel adapters remain disabled. Stop on duplicate, privacy mismatch, unexpected volume, stale delivery or error-budget burn. Roll back inbox/event-generation flags; retain immutable redacted attempts for audit and do not reactivate Discord health delivery.

## Exit evidence

Store approved event catalog/templates, retry/concurrency report, timezone scheduler matrix, legacy migration report, authenticated inbox E2E, privacy review, latency/volume baseline and pilot metrics under `docs/evidence/notification-gate-4/`.
