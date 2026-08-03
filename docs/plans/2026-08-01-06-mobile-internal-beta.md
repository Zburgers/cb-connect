# Mobile Internal Beta Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires current native-runtime/account decisions and a dated execution plan after Gate 4 evidence exists.

**Goal:** Deliver an invited iOS and Android CB Connect beta that consumes the proven reliability, cycle and notification contracts without duplicating domain logic.

**Architecture:** Add an Expo Router workspace under `apps/mobile`. Clerk Expo authenticates and supplies Convex tokens; Convex remains the authorization, realtime and prediction source. A small contracts package shares pure validators/types/design tokens. Sensitive domain data is not persistently cached in the first beta, and health/chat writes fail truthfully offline rather than being ambiguously queued.

**Tech Stack:** Expo/React Native, Expo Router, TypeScript, Clerk Expo, Convex React client, Expo SecureStore, EAS Build, Maestro, React Native Testing Library.

---

**Depends on:** [Notification platform](2026-08-01-05-notification-platform.md)

**Research:** [Cross-client/mobile architecture](../research/2026-08-01-major-release-cycle-trust-research.md#51-cross-client-and-notification-architecture-research)

**Next gate:** [Push and stores](2026-08-01-07-push-and-store-qualification.md)

**Planning status:** Gate-level work packages only. Resolve D-014 runtime/account/device decisions and D-015 beta cohort/staffing after Gate 4 evidence; recheck current Expo, Clerk and Convex native support when writing the dated execution plan.

**Required task order:** M1 workspace/contracts -> M2 providers/auth -> M3 protected shell -> M4 backend-rendered dashboard -> M5 factual logging -> M6 couple/chat controls -> M7 inbox/settings -> M8 privacy/security closure -> M9 automated builds and physical-device beta. Native clients never introduce alternate domain authorization or prediction logic.

## Beta scope

Included: authentication, onboarding/roles, dashboard cycle read model, period logging/correction/confirmation, pain logging/history, partner linking/sharing/revocation, chat/reactions/receipts, in-app notifications and settings/pause/context.

Excluded: push, email/SMS, public stores, fertility/contraception claims, health-platform imports, offline queued health writes, ML display and feature divergence from the web backend.

## Entry criteria

- Gates 0–4 have approved versioned contracts and no unresolved applicable P0/P1.
- Apple and Google developer/EAS ownership is identified for internal builds.
- Clerk Native API/redirect/deep-link configuration and separate beta environment are approved.
- Mobile privacy threat model and local-storage policy are reviewed.

## Implementation tasks

<task id="M1" name="Create Expo workspace and shared contracts boundary">
  <description>Add a supported Expo Router application without moving the existing Next.js App Router or creating a second backend.</description>
  <files>
    <create>apps/mobile/package.json</create>
    <create>apps/mobile/app.config.ts</create>
    <create>apps/mobile/eas.json</create>
    <create>apps/mobile/tsconfig.json</create>
    <create>apps/mobile/src/app/_layout.tsx</create>
    <create>packages/contracts/package.json</create>
    <create>packages/contracts/src/index.ts</create>
    <modify>package.json</modify>
  </files>
  <steps>
    <step>Add a failing workspace typecheck importing the versioned cycle/notification contracts.</step>
    <step>Use the current supported Expo SDK chosen at implementation time through `create-expo-app`; pin versions and record the runtime policy.</step>
    <step>Export only pure types/validators/reason codes/tokens from `packages/contracts`; keep Convex business rules server-side.</step>
    <step>Add root scripts for mobile start, typecheck, test, doctor and EAS build.</step>
  </steps>
  <verification>
    <command>npm run mobile:doctor &amp;&amp; npm run mobile:typecheck</command>
    <expected>Expo Doctor and workspace TypeScript exit 0 with no duplicate React/runtime copy.</expected>
  </verification>
</task>

<task id="M2" name="Integrate Clerk and Convex securely">
  <description>Implement persistent native authentication with secure token storage and ConvexProviderWithClerk against a beta deployment.</description>
  <files>
    <create>apps/mobile/src/providers/AppProviders.tsx</create>
    <create>apps/mobile/src/auth/tokenCache.ts</create>
    <create>apps/mobile/src/auth/AuthGate.tsx</create>
    <create>apps/mobile/src/auth/AuthGate.test.tsx</create>
    <create>apps/mobile/src/app/(auth)/sign-in.tsx</create>
    <create>apps/mobile/src/app/(auth)/sign-up.tsx</create>
    <modify>apps/mobile/src/app/_layout.tsx</modify>
  </files>
  <steps>
    <step>Write failing loading/signed-out/signed-in/expired/revoked-session tests.</step>
    <step>Store auth tokens only through Expo SecureStore and clear them on sign-out/revocation.</step>
    <step>Pass Clerk's auth hook to `ConvexProviderWithClerk`; never use a supplied user ID as authorization.</step>
    <step>Implement branded custom auth flows; treat Clerk native prebuilt components as beta unless separately accepted.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- AuthGate.test.tsx</command>
    <expected>All auth lifecycle cases pass and no token appears in logs or insecure storage mocks.</expected>
  </verification>
</task>

<task id="M3" name="Build protected Expo Router shell">
  <description>Create role-aware tabs/stacks, typed routes, error boundaries, offline banner and accessible theme primitives.</description>
  <files>
    <create>apps/mobile/src/app/(app)/_layout.tsx</create>
    <create>apps/mobile/src/components/SanctuaryShell.tsx</create>
    <create>apps/mobile/src/components/ErrorBoundary.tsx</create>
    <create>apps/mobile/src/components/OfflineBanner.tsx</create>
    <create>apps/mobile/src/theme/tokens.ts</create>
    <create>apps/mobile/src/app/(app)/index.tsx</create>
  </files>
  <steps>
    <step>Write route-guard tests for unauthenticated, incomplete onboarding, primary, partner and revoked couple states.</step>
    <step>Use Expo Router typed routes and platform-native navigation patterns.</step>
    <step>Map approved theme tokens to native styles while preserving contrast, reduced motion, dynamic type and screen-reader order.</step>
    <step>Disable ambiguous writes offline and display a truthful retry action.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- SanctuaryShell</command>
    <expected>Route, error, accessibility and offline states pass.</expected>
  </verification>
</task>

<task id="M4" name="Implement onboarding and cycle dashboard">
  <description>Consume existing role/onboarding mutations and the versioned cycle read model with all Recorded/Calendar estimate/Late/prediction explanations intact.</description>
  <files>
    <create>apps/mobile/src/app/onboarding.tsx</create>
    <create>apps/mobile/src/features/cycle/CycleDashboard.tsx</create>
    <create>apps/mobile/src/features/cycle/CycleDashboard.test.tsx</create>
    <modify>apps/mobile/src/app/(app)/index.tsx</modify>
  </files>
  <steps>
    <step>Write snapshot/accessibility tests for both roles and every versioned state variant.</step>
    <step>Render backend-provided state/reasons; never recalculate phase or prediction in React Native.</step>
    <step>Keep four terms and show the same ovulation/fertility boundary as web.</step>
    <step>Verify responsive layouts on compact/large phones, dynamic type and dark/light themes.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- CycleDashboard.test.tsx</command>
    <expected>Contract/state/copy/accessibility snapshots pass without client-side prediction code.</expected>
  </verification>
</task>

<task id="M5" name="Implement factual logging and history">
  <description>Add period/pain input, approximate certainty, open/end confirmation, correction/deletion and pending partner-assist confirmation.</description>
  <files>
    <create>apps/mobile/src/app/(app)/log.tsx</create>
    <create>apps/mobile/src/features/logging/PeriodForm.tsx</create>
    <create>apps/mobile/src/features/logging/PainForm.tsx</create>
    <create>apps/mobile/src/features/logging/HistoryList.tsx</create>
    <create>apps/mobile/src/features/logging/logging.test.tsx</create>
  </files>
  <steps>
    <step>Write failing validation, duplicate/overlap/future error-code and offline tests.</step>
    <step>Call Convex mutations and render structured backend validation; do not weaken constraints locally.</step>
    <step>Show actor/certainty/confirmation and never place predicted end dates in history.</step>
    <step>Protect notes and history from screenshots/logging/test artifacts.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- logging.test.tsx</command>
    <expected>All logging/history/correction/offline/authorization cases pass.</expected>
  </verification>
</task>

<task id="M6" name="Implement couple controls and private communication">
  <description>Add pairing, enumerated sharing consent/revocation, partner projection, presence, nudges and bounded private chat.</description>
  <files>
    <create>apps/mobile/src/app/(app)/partner.tsx</create>
    <create>apps/mobile/src/features/partner/PartnerControls.tsx</create>
    <create>apps/mobile/src/features/chat/CoupleChat.tsx</create>
    <create>apps/mobile/src/features/partner/partner.test.tsx</create>
    <create>apps/mobile/src/features/chat/chat.test.tsx</create>
  </files>
  <steps>
    <step>Write primary/partner/unlinked/revoked/no-share tests and bounded chat pagination tests.</step>
    <step>Use server-derived membership/sharing; UI hiding is not authorization.</step>
    <step>Clear partner cycle/chat views immediately on revocation/sign-out.</step>
    <step>Handle app foreground/background presence honestly without claiming constant online state.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- partner.test.tsx chat.test.tsx</command>
    <expected>Role/privacy/revocation/chat/receipt tests pass.</expected>
  </verification>
</task>

<task id="M7" name="Implement in-app inbox and settings">
  <description>Expose the Gate 4 inbox/preferences plus timezone, pause/context, sharing, profile and account controls.</description>
  <files>
    <create>apps/mobile/src/app/(app)/notifications.tsx</create>
    <create>apps/mobile/src/app/(app)/settings.tsx</create>
    <create>apps/mobile/src/features/notifications/Inbox.tsx</create>
    <create>apps/mobile/src/features/settings/Settings.tsx</create>
    <create>apps/mobile/src/features/notifications/inbox.test.tsx</create>
  </files>
  <steps>
    <step>Write unread/read/dismiss/preference and primary-private/partner tests.</step>
    <step>Consume indexed bounded inbox queries and shared event labels.</step>
    <step>Explain that push is unavailable until separately enabled and permitted.</step>
    <step>Make pause/context controls private and sharing revocation immediate.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- inbox.test.tsx</command>
    <expected>Inbox/settings/privacy/preference cases pass.</expected>
  </verification>
</task>

<task id="M8" name="Apply mobile privacy and security controls">
  <description>Meet approved OWASP MASVS baseline for storage, authentication, network, platform and privacy risks.</description>
  <files>
    <create>docs/security/mobile-threat-model.md</create>
    <create>docs/security/mobile-masvs-checklist.md</create>
    <create>apps/mobile/src/security/appPrivacy.ts</create>
    <create>apps/mobile/src/security/appPrivacy.test.ts</create>
    <modify>apps/mobile/app.config.ts</modify>
  </files>
  <steps>
    <step>Test token/cache/log/clipboard/deep-link/app-switcher/screenshot/backup behaviors on both platforms.</step>
    <step>Persist only minimal credentials in SecureStore; keep sensitive Convex response caches memory-only in beta.</step>
    <step>Mask sensitive screens in the app switcher and use generic route/deep-link errors.</step>
    <step>Document rooted/jailbroken-device threat assumptions and SDK/vendor data flows.</step>
  </steps>
  <verification>
    <command>npm run mobile:test -- appPrivacy.test.ts</command>
    <expected>Automated privacy controls pass and manual MASVS checklist has no unowned high-risk finding.</expected>
  </verification>
</task>

<task id="M9" name="Automate builds and critical native journeys">
  <description>Create internal iOS/Android builds and Maestro flows for auth, dashboard, logging, linking/revocation, chat and inbox.</description>
  <files>
    <create>apps/mobile/.maestro/auth-dashboard.yaml</create>
    <create>apps/mobile/.maestro/cycle-logging.yaml</create>
    <create>apps/mobile/.maestro/couple-revocation.yaml</create>
    <create>apps/mobile/.eas/workflows/e2e-ios.yml</create>
    <create>apps/mobile/.eas/workflows/e2e-android.yml</create>
    <modify>apps/mobile/eas.json</modify>
  </files>
  <steps>
    <step>Build simulator/emulator profiles with isolated beta credentials.</step>
    <step>Run deterministic Maestro flows on both platforms and retain screenshots/recordings as restricted artifacts.</step>
    <step>Build internal physical-device variants with managed, owned signing credentials.</step>
    <step>Require build fingerprint, commit and backend compatibility version in beta diagnostics.</step>
  </steps>
  <verification>
    <command>cd apps/mobile &amp;&amp; eas workflow:run .eas/workflows/e2e-android.yml</command>
    <expected>Android workflow passes; equivalent iOS workflow passes before beta promotion.</expected>
  </verification>
</task>

## Hard success criteria

- Installable internal builds run on at least two physical iOS and two physical Android devices spanning one current and one prior supported OS major per platform.
- Auth survives app restart, expires safely and clears secure state on sign-out/revocation: 100% acceptance cases.
- Critical Maestro journeys pass on iOS and Android with zero conditional skips.
- Cross-couple/post-revocation disclosure: 0; stop-beta.
- Client-side cycle/prediction implementation outside pure display formatting: 0.
- Sensitive domain values in device logs, crash metadata, insecure storage, screenshots/artifacts or app-switcher preview: 0 in the approved test matrix.
- Offline health/chat writes presented as saved when server acknowledgement is absent: 0.
- Crash-free invited-beta sessions: at least 99.5% after a minimum 200 sessions; otherwise remain internal and investigate.
- Critical-journey success and latency stay inside Gate 0 error budget during the invited pilot.
- Accessibility acceptance passes screen reader, dynamic type, contrast, touch target and reduced-motion checks on both platforms.

## Rollout and rollback

Use a separate development build, then staff internal build, then invited beta. Server capabilities and each sensitive screen have remote kill switches. Stop on privacy/auth incident, crash-free threshold miss, contract mismatch, unbounded network use or error-budget exhaustion. Revoke the build/update channel and disable capabilities server-side; preserve web availability and backend compatibility.

## Exit evidence

Store build fingerprints, EAS/commit/backend identities, unit/Maestro reports, physical-device matrix, MASVS/privacy review, accessibility report, crash-free/session data, authorization/revocation smoke and pilot error-budget report under `docs/evidence/mobile-gate-5/`.
