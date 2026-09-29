# Push Notification and Store Qualification Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires real-device beta evidence and a dated execution plan after Gate 5 exits.

**Goal:** Add an explicitly consented, privacy-safe mobile push channel and qualify CB Connect for staged App Store and Play Store release.

**Architecture:** Mobile registers per-installation tokens after contextual permission. The Gate 4 core owns events, policy, logical deliveries, immutable rendering, claims/retries and reconciliation. The Expo adapter resolves active installation versions, rechecks current eligibility immediately before dispatch, sends generic previews, normalizes tickets/receipts and invalidates tokens. It does not create a second notification lifecycle or retry queue. Deep links open authenticated in-app destinations without carrying health data. Store builds are immutable and progressively released with server-side channel kill switches.

**Tech Stack:** Expo Notifications, EAS Build/Submit/Update, Convex actions/crons, Expo Router links, App Store Connect, Google Play Console, Maestro.

---

**Depends on:** [Mobile internal beta](2026-08-01-06-mobile-internal-beta.md)

**Notification contract:** [Notification platform](2026-08-01-05-notification-platform.md) and proposed [G4-DELIVERY-V1](2026-09-27-gate-4-event-privacy-retention-execution.md#n1n2-delivery-contract-freeze-g4-delivery-v1). Inherit the approved Gate 4 contract when writing this gate's dated execution plan; these provider work packages do not authorize push now.

**Research:** [Expo delivery limitations](../research/2026-08-01-major-release-cycle-trust-research.md#51-cross-client-and-notification-architecture-research)

**Planning status:** Gate-level work packages only. Resolve applicable D-001, D-012, D-014 and D-015 after Gate 5 real-device evidence; recheck provider/store rules when writing the dated execution plan.

**Required task order:** PUSH1 installation/token lifecycle -> PUSH2 idempotent provider adapter -> PUSH3 ticket/receipt outcomes -> PUSH4 authorized opaque deep links -> PUSH5 physical-device qualification -> PUSH6 reviewed store declarations/binaries -> PUSH7 staged rollout and kill-switch rehearsal.

## Entry criteria

- Gate 5 internal beta meets crash/privacy/auth/error-budget criteria.
- Apple/Google/EAS account, bundle/package IDs, signing and release authority are owned and recoverable.
- Notification templates/purposes and store privacy/data-safety declarations have privacy/legal approval.
- Push is not required for critical health or account safety; the in-app inbox remains authoritative.

## Implementation tasks

<task id="PUSH1" name="Register installations and rotate tokens safely">
  <description>Associate Expo push tokens with an authenticated user, installation, platform, environment and lifecycle without treating a token as identity.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/mutations/pushDevices.ts</create>
    <create>convex/mutations/pushDevices.test.ts</create>
    <create>apps/mobile/src/notifications/deviceRegistration.ts</create>
    <create>apps/mobile/src/notifications/deviceRegistration.test.ts</create>
  </files>
  <steps>
    <step>Write failing register/rotate/sign-out/revoked/duplicate/environment-mismatch tests.</step>
    <step>Request permission only from a contextual user action and only after push-purpose preference is enabled.</step>
    <step>Upsert tokens by installation/environment and deactivate them on sign-out, account deletion or provider invalidation.</step>
    <step>Never expose tokens to another user or store them in analytics/crash metadata.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/mutations/pushDevices.test.ts &amp;&amp; npm run mobile:test -- deviceRegistration.test.ts</command>
    <expected>Token lifecycle and authorization tests pass with redacted output.</expected>
  </verification>
</task>

<task id="PUSH2" name="Add idempotent Expo push adapter">
  <description>Consume claimed Gate 4 logical deliveries; create a separate attempt per dispatch, batch/send safely and normalize provider ticket IDs without marking device delivery.</description>
  <files>
    <create>convex/actions/push.ts</create>
    <create>convex/actions/push.test.ts</create>
    <modify>convex/internal/notificationDelivery.ts</modify>
    <modify>convex/schema.ts</modify>
  </files>
  <steps>
    <step>Write retry, timeout, partial-batch, duplicate and invalid-token tests.</step>
    <step>Recheck current preference, membership, sharing, event expiry and installation status immediately before send.</step>
    <step>Send only approved generic external preview plus opaque notification/destination IDs.</step>
    <step>Persist ticket acceptance separately from provider-defined receipt/device/open states. Use Gate 4 stable delivery/provider keys and immutable payload; map ambiguous acceptance to unknown and never blindly retry. Declare the actual provider idempotency/receipt capabilities before claiming safe recovery.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/actions/push.test.ts</command>
    <expected>Retries reuse one logical delivery key with distinct attempts; no unsupported physical exactly-once claim. Partial failures recover independently and ambiguous/accepted results are not blindly resent.</expected>
  </verification>
</task>

<task id="PUSH3" name="Process push receipts and invalid tokens">
  <description>Use the Gate 4 receipt reducer/correlation and indexed reconciliation to fetch Expo receipts after the recommended delay, retain provider-defined outcomes and deactivate DeviceNotRegistered tokens; an Expo receipt is not proof of device display ([provider delivery semantics](https://docs.expo.dev/push-notifications/sending-notifications/#delivery-guarantees)).</description>
  <files>
    <create>convex/actions/pushReceipts.ts</create>
    <create>convex/actions/pushReceipts.test.ts</create>
    <modify>convex/crons.ts</modify>
  </files>
  <steps>
    <step>Write pending/success/provider-error/DeviceNotRegistered/expired-receipt tests.</step>
    <step>Fetch receipts approximately 15 minutes after ticket creation and before Expo's retention window expires.</step>
    <step>Deactivate invalid tokens until the installation registers a new one.</step>
    <step>Expose aggregate delivery health without health-content dimensions.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/actions/pushReceipts.test.ts</command>
    <expected>Duplicate/out-of-order receipts do not regress outcomes or restore cancelled eligibility; missing receipts remain explicitly unresolved/expired and invalid tokens stop receiving attempts.</expected>
  </verification>
</task>

<task id="PUSH4" name="Handle privacy-safe notification deep links">
  <description>Open only allowlisted authenticated routes, fetch private content after authorization and reject replayed/foreign destinations.</description>
  <files>
    <create>apps/mobile/src/notifications/notificationLinks.ts</create>
    <create>apps/mobile/src/notifications/notificationLinks.test.ts</create>
    <modify>apps/mobile/src/app/_layout.tsx</modify>
    <modify>apps/mobile/app.config.ts</modify>
  </files>
  <steps>
    <step>Write foreground/background/terminated/signed-out/revoked/foreign-ID tests.</step>
    <step>Carry only opaque IDs in URLs; fetch content after Clerk/Convex authorization.</step>
    <step>Allowlist destinations and fall back to inbox on stale/invalid links.</step>
    <step>Clear notification badge/state after the authorized inbox transition, not merely tap receipt.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- notificationLinks.test.ts</command>
    <expected>All lifecycle/deep-link cases pass and URLs contain no health values.</expected>
  </verification>
</task>

<task id="PUSH5" name="Qualify real-device notification behavior">
  <description>Test permissions, channels, focus modes, previews, badges, foreground/background/terminated launch and token invalidation on supported devices.</description>
  <files>
    <create>apps/mobile/.maestro/push-inbox.yaml</create>
    <create>docs/testing/push-device-matrix.md</create>
    <modify>apps/mobile/eas.json</modify>
  </files>
  <steps>
    <step>Build development and release-mode variants because Expo Go cannot qualify remote push.</step>
    <step>Test at least the Gate 5 physical-device/OS matrix and Android notification-channel controls.</step>
    <step>Verify generic lock-screen content when unlocked/locked and with preview settings.</step>
    <step>Test denied/revoked permission, uninstall/reinstall, token rotation and provider outage simulation.</step>
  </steps>
  <verification>
    <command>cd apps/mobile &amp;&amp; maestro test .maestro/push-inbox.yaml</command>
    <expected>Automatable flow passes; all manual matrix cells have evidence or an owned blocker.</expected>
  </verification>
</task>

<task id="PUSH6" name="Complete store privacy and release qualification">
  <description>Align product copy, policies, SDK inventory, data declarations, screenshots and support/account-deletion flows with actual behavior.</description>
  <files>
    <create>docs/release/store-readiness.md</create>
    <create>docs/privacy/mobile-data-flow.md</create>
    <create>docs/privacy/vendor-register.md</create>
    <modify>README.md</modify>
    <modify>apps/mobile/app.config.ts</modify>
  </files>
  <steps>
    <step>Inventory every SDK/vendor and data purpose; reconcile App Privacy and Play Data Safety declarations.</step>
    <step>Verify account export/deletion, couple revocation, support, privacy policy and general-wellness/fertility boundaries.</step>
    <step>Produce accessible truthful screenshots and review metadata without medical/prediction overclaims.</step>
    <step>Build immutable production binaries and retain checksums, commit, runtime and backend compatibility versions.</step>
  </steps>
  <verification>
    <command>npm run mobile:doctor &amp;&amp; npm run mobile:typecheck &amp;&amp; npm run mobile:test</command>
    <expected>Exit 0 and both store declaration checklists are approved against the vendor/data-flow inventory.</expected>
  </verification>
</task>

<task id="PUSH7" name="Stage store rollout with operational kill switches">
  <description>Progress from external beta to small production percentages while monitoring crashes, auth/privacy, push processing and backend error budget.</description>
  <files>
    <create>docs/runbooks/mobile-rollout.md</create>
    <create>docs/runbooks/push-disable.md</create>
    <modify>docs/reliability/error-budget-policy.md</modify>
  </files>
  <steps>
    <step>Release to external TestFlight/closed Play testing before production.</step>
    <step>Advance through approved staged percentages only after a full observation window meets criteria.</step>
    <step>Provide server-side kill switches by event purpose/channel and a procedure to stop EAS updates/build rollout.</step>
    <step>Run a push-disable and prior-build compatibility rehearsal.</step>
  </steps>
  <verification>
    <command>bash scripts/verify-release.sh --mobile --push</command>
    <expected>Build/backend identities, channel flags, readiness and kill-switch rehearsal all pass.</expected>
  </verification>
</task>

## Hard success criteria

- Push permission requested before contextual explanation and user action: 0.
- Push attempt after channel/purpose opt-out, sign-out, expiry, pause or applicable share revocation: 0.
- Duplicate provider attempt/delivery for one idempotency key: 0.
- Generic lock-screen preview containing sensitive health/cycle/pain/date data: 0.
- Push URL containing sensitive values or bypassing authenticated authorization: 0.
- Ticket IDs lacking receipt polling outcome within the operational window: under 0.1%; each remainder is explicit provider unavailable/expired, never silently `sent`.
- `DeviceNotRegistered` token receiving a subsequent attempt before re-registration: 0.
- Push pipeline processing success excluding provider outage remains at least 99.9% monthly after baseline; Expo/APNs/FCM delivery is reported separately because no provider SLA is promised.
- Crash-free production sessions at least 99.8% and critical journeys inside Gate 0 error budget before each staged increase.
- Store privacy/data-safety declarations match the approved SDK/vendor/data-flow inventory: 100% reviewed fields.

## Rollout and rollback

Enable push for staff, invited beta, external beta and then staged production. Any cross-user deep link, sensitive preview, duplicate delivery or compromised credential is stop-ship/disable-channel. Pause increases on crash/SLO/receipt threshold misses. Disable event/channel server-side, revoke invalid credentials if needed, halt staged rollout/EAS updates and retain in-app inbox access.

## Exit evidence

Store token lifecycle tests, provider ticket/receipt metrics, deep-link security report, physical-device matrix, store declarations/approvals, binary checksums/identities, staged rollout metrics and kill-switch rehearsal under `docs/evidence/push-store-gate-6/`.
