# CB-07 — owner-led mobile UI redesign

Status: **native implementation complete; consolidated live QA resumed on the owner-started Pixel 7; production delivery prerequisites recorded separately**.
This document does not mark NAK-149 complete or qualify native behavior.

Issue: [NAK-149](https://linear.app/nakii/issue/NAK-149/cb-07-complete-mobile-ui-redesign-after-functional-parity).
Interactive artifact: [CB-07 design review](../design/cb-07-mobile-design-review.html).
The HTML is self-contained: fonts, font licenses, phase artwork, styles and
scripts are embedded. Open it directly; no server, credentials or network are
required. Every displayed account, date and conversation is illustrative.

## Stack and prerequisite evidence

Branch `feat/NAK-149-mobile-ui-redesign` was created from CB-06 head
`899e9f2b3d0f7d59153c679f04f610fca9c4a8ba`, then fast-forwarded to its new
head `8a71780c5756065fb64b616cecacdb1725171cae`, then the additional
regression-test head `ca01eda57e7305766c7960ec3ab948087d6e7206` during preparation.
Native implementation is rebased onto accepted CB-06 head
`8371af42b50e0b046bbdd148844cc9891c317ae4`. Its PR base
is `ekagra7865/nak-148-cb-06-cycle-settings-and-account`, never `main`.
All preceding stack commits are inherited. PR #67 remains draft.

Read the complete Linear issue descriptions and comments for NAK-143–149,
and GitHub descriptions, checks, reviews and review threads for #79 and
#81–85. The Linear issues had no comments at inspection. Snapshot on
2026-11-17:

| Ticket | PR | Exact head | Focused review | Deterministic / mobile CI |
|---|---|---|---|---|
| CB-01 | [#79](https://github.com/Zburgers/cb-connect/pull/79) | `8e1faa457e54efc7c82d53b5c284846aaaf87fc2` | Accepted for stacked development | PASS / PASS |
| CB-02 | [#81](https://github.com/Zburgers/cb-connect/pull/81) | `0d324a15defcd0404b7cbf990d65e47b025e9db9` | Accepted for stacked development | PASS / PASS |
| CB-03 | [#82](https://github.com/Zburgers/cb-connect/pull/82) | `7f09aebde8854910775c0d029ea839816f2c01c2` | Accepted for stacked development | PASS / PASS |
| CB-04 | [#83](https://github.com/Zburgers/cb-connect/pull/83) | `a9c3355317f281f5022ffc7638aafb762478ed53` | Accepted for stacked development | PASS / PASS |
| CB-05 | [#84](https://github.com/Zburgers/cb-connect/pull/84) | `a322ba73f1c363d2ed9af1bdbc9fd6b881a76dfb` | Accepted; outdated inbox thread remains open | PASS / PASS |
| CB-06 | [#85](https://github.com/Zburgers/cb-connect/pull/85) | `8371af42b50e0b046bbdd148844cc9891c317ae4` | Accepted for stacked development | PASS / PASS |

The [final CB-06 acceptance](https://github.com/Zburgers/cb-connect/pull/85#pullrequestreview-5940208482)
verifies account-keyed drafts, protected pending profile edits, server-side
conditional cycle writes and typed stale-cycle error recovery at `8371af4`.
The owner then explicitly authorized CB-07 implementation. Profile concurrent
writes still use the accepted best-effort warning, not atomic profile CAS.
CB-07 retains these contracts and makes no backend change.

**Implementation entry gate: PASS.** CB-01–CB-06 focused acceptance and exact-head
checks are recorded. Final native runtime qualification remains separate.
Skipped production release jobs are not release evidence.

## Design sources and choices

There is no root `design.md` at this base. Existing sources are
`docs/cb-connect-design-guidelines.md`, `docs/cb-connect-design-audit.md`,
`docs/plans/2026-05-18-cb-connect-design-overhaul.md`, `app/globals.css`,
the web dashboard components, and `apps/mobile/src/theme/tokens.ts`.
They already establish Bloom, editorial serif headings, warm coral/amber,
cream paper, dark ink, lavender support and phase-aware surfaces.

The report retains three treatments as references. The owner selected the first
and requested the border distinction of the third:

1. **Bloom Glass — selected, refined:** phase artwork is the emotional anchor;
   prediction and supporting sections are quieter. A detached glass dock
   has icons, labels and a sliding active capsule. Closest to the web.
2. **Bloom Editorial:** paper-led sections, more typographic hierarchy,
   fewer raised surfaces. Glass is concentrated in navigation.
3. **Bloom Liquid:** richer light fields, more pronounced rounded glass
   edges and depth. Requires more native contrast/performance scrutiny.

The selected supporting sage tone is `#4C6753` on `#E4EBDF` in light mode,
`#C4D4BB` on `#28382F` in dark mode. Coral remains the action color; amber
remains atmospheric. Sage does not grant consent or replace phase semantics.
The report also previews existing coral-only and lavender alternatives.
The selected blend retains Bloom Glass composition and surface opacity while
adding Bloom Liquid’s brighter inner rim and a fine outer keyline on the phase
anchor, supporting panels and dock. Warm shadows stay shallow; do not copy
Liquid’s richer whole-screen glass treatment.

Typography: DM Serif Display headings, DM Sans UI and tabular numeric text.
The report embeds licensed Google Fonts. The native app bundles the same fonts
locally, with a non-sensitive loading view and platform fallback on failure. Do not create a
second design system or rename settled tokens just for this proposal.

## Owner selection — 2026-11-17

The owner selected **Bloom Glass + subtle sage**, then clarified: “first felt
better,” while the third direction’s “borders” and “distinction” stood out.
This settles the design direction; no further selection approval is needed.

Keep the first direction’s layout, serif/UI type pairing, phase artwork,
spacing, restrained supporting panels, coral/amber palette and selected sage.
Borrow only the third direction’s material edge treatment: brighter inner
rims, a fine warm outer keyline, clearer panel boundaries and a distinct dock
silhouette in both appearances. Retain solid text backing and opaque fallback.

## Shared native presentation foundation

Owner selection and the CB-06 entry gate are complete. The implementation:

- Extend the existing semantic light/dark tokens with spacing, type, radii,
  on-accent foregrounds and explicit opaque fallback surfaces. Never apply
  light text over a hardcoded white glass surface.
- Add reusable screen heading, section, field, action, consent/status and
  loading/empty/error presentation components. Keep state ownership and
  existing public DTO/mutation behavior in their owning features.
- Retain guarded Expo Router routes. Build the detached dock around the
  existing route access rules, icon/label semantics and native tab events.
  It is navigation, not a continuous range slider. Unlinked primary has no
  Chat destination; unlinked partner remains in connection flow.
- Keep scrolling content above dock/safe-area space. Keyboard-aware forms
  keep their focused field, validation and Save reachable. Chat gives the
  composer space above the keyboard and hides the dock if appropriate.
- Restrict blur to the dock/transient surfaces; use opaque text backing.
  Preserve a solid fallback for older Android/reduced transparency. Current
  Expo SDK 57 [blur documentation](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/)
  confirms `BlurTargetView`/`blurTarget` and the Android 12+ method fallback.
  Visual resemblance to Apple glass is not a claim to use Apple's material.
- Animate selected navigation with transform/opacity, around 260ms.
  Keep press feedback short; no decorative loops. Reduced motion removes
  movement. Never delay access/privacy state changes for animation.

Implementation file order after the gate:

| Order | Files | Focused acceptance |
|---|---|---|
| 1 | `apps/mobile/src/theme/tokens.ts`, new `theme/typography.ts`, `src/app/_layout.tsx` | Semantic light/dark rim, outline, on-accent and sage tokens; bundled fonts with fallback |
| 2 | New `apps/mobile/src/components/BloomPanel.tsx`, `BloomScreen.tsx` and presentation tests | Consistent selected borders, section hierarchy, status semantics, readable opaque fallback |
| 3 | New `apps/mobile/src/components/BloomTabBar.tsx`, existing `src/app/(app)/_layout.tsx` | Detached dock and selected capsule preserve guarded routes, tab events, safe area and enlarged labels |
| 4 | Existing `features/cycle/`, `home/`, `onboarding/`, `logging/`, `partner/`, `chat/`, `notifications/`, `settings/` views and their tests | Roll out the selected primitives in the screen order below; retain existing data/state ownership |
| 5 | Presentation fixtures/snapshots beside affected views, existing `src/convex/api.inventory.test.ts` and parity/boundary suites | Stable roles/states, mobile typecheck/contracts, then exact-head CI; no standalone live QA |

These native components are implemented. The custom dock wraps navigator
scenes in a `BlurTargetView` and renders the dock as its sibling, so actual
scrolling content is sampled. Both theme tints are 18% alpha, with an ultra-thin
blur material, reflective gradient/rim, translucent active capsule and a
native-driver spring. Below Android API 31 or under iOS reduced transparency,
it uses the opaque surface. Reduced motion disables the spring. Keyboard
visibility hides the dock and removes its reserved inset from Chat. Enlarged
labels reflow into rows, with padding derived from the same geometry.

All feature behavior and concurrency/error contracts remain with their
existing owners. No public API, backend, lockfile or production configuration
is changed by this implementation.

## Screen-by-screen implementation inventory

| Screen / source | Before | Implemented presentation | Behavior that must survive |
|---|---|---|---|
| Home / `CycleDashboard`, `HomeSupport`, `HomeNudges`, `HomePainCheckIn` | Repeated state/prediction cards and similar-weight actions | Phase anchor; separate quiet estimate; existing support and body check-in below | Role/consent, health copy, reason/quality/basis, all model states and feature flags; no local cycle inference |
| Onboarding / `OnboardingScreen` | Long utility form | Clear role/setup sections, visible certainty, bounded steppers and partial-save status | Saved settings loading, timezone, primary/partner asymmetry, exact/approximate dates, partial writes/resume |
| Log / `LoggingScreen`, `DateField` | Dense form and timeline | Distinct entry sections and provenance timeline with reachable correction/export actions | Period/pain history, open/end, certainty, permitted delete confirmation, partner calendar, private notes, consent-aware CSV and cleanup |
| Partner / `PartnerControls` | Flat connection/detail controls | Locket anchor, private nickname/date groups, explicit sharing scope | 6/12-character code validation, expiry/copy/share cleanup, date/nickname conflict handling, sharing/revocation/current generation |
| Chat / `CoupleChat` | Utility list/composer | Conversation-led bubbles, separate quick-compose tray and deliberate clear action | Pagination/SplitRequired, reactions, unread, focus-gated receipts, online truth, current relationship and clear semantics |
| Inbox / `Inbox` | Many similarly weighted buttons per card | Quiet rows with text unread labels and separated actions | Availability-before-subscription, static safe templates, destination, read/dismiss failure and bounded pagination; no push promise |
| Settings / `Settings` | Long equal-weight sections | Appearance/profile/timezone/notifications/cycle/privacy groups, nearby Save/errors | Existing enums and lengths, primary-only controls, reminder account timezone, pause/private context/sharing, account-keyed drafts and conditional cycle writes |

The report exposes representative ready/loading/empty/error/offline states,
primary/partner/unlinked viewers, all four phase presentations, paused and
withheld predictions, partial onboarding, pairing expiry, clear/delete/revoke
confirmation, settings saving/conflict and identity transition. It is a visual
specimen, not a model or exhaustive proof of all state combinations.

## Ordered execution and acceptance

1. **DONE — scope and stack inspection:** read all issues, reviews and existing
   design source. Record exact base and qualification limits above.
2. **DONE — owner decision artifact:** create the self-contained HTML report
   with three treatments, all seven screen areas, semantic sample states and
   light/dark/compact/large/text/material controls.
3. **DONE — owner decision and prerequisite closure:** Bloom Glass + sage and
   Liquid borders selected; owner additionally requested a less opaque, more
   reflective and smooth dock. CB-06 accepted at `8371af4`; branch rebased.
4. **DONE — shared tokens and primitives:** native Bloom panels, notices, text,
   keyboard-aware screen, dock layout/inset, typography and local licensed fonts.
   Tests cover guarded destinations, cancellable presses, selected state, native
   spring/reduced motion, keyboard hide and older-Android/transparency fallback.
5. **DONE — screen rollout:** Home/cycle, Onboarding, Log, Partner, Chat, Inbox
   and Settings use the selected presentation. Existing handlers, model copy
   and guard/query boundaries are preserved. Stable semantic fixtures and
   snapshots are checked in; they are not native pixel screenshots.
6. **PASS — deterministic validation:** use the documented Node 22/npm 11
   mobile toolchain. Focused presentation/interaction tests, the mobile suite,
   `npm run mobile:typecheck` (strict parity), inventory, negative fixtures and
   server-only-import checks pass locally. GitHub exact-head CI is separate.
   Backend/functional gaps go back to CB-01–CB-06, not into this PR.
7. **IN PROGRESS — one final stack live QA:** follow the canonical
   [QA runbook](../testing/2026-11-17-cb-07-final-stack-qa.md), on the final integrated exact
   source/APK head, using the approved persistent synthetic pair. No standalone
   native live QA for this design PR. Record failures under the owning feature;
   rerun targeted checks after fixes. The former emulator SIGSEGV blocker is
   superseded by the owner's successful boot. One resumed GPT-6 Luna agent
   operates the emulator; results remain case-specific in the runbook.
8. **PENDING — final acceptance:** owner reviews screen inventory, role/state
   coverage, snapshots and consolidated QA results. Only then accept/merge
   bottom-up into `gate5/atlas-foundation`, holding #67 draft. No production
   deployment or new product feature is in scope. The owner's subsequent
   request adds production-compatible APK packaging and private email delivery
   after QA. Its [production preflight](../evidence/cb-07-mobile-ui/production-readiness.md)
   records missing deployed mobile contracts and disabled native Clerk auth.

## Consolidated QA fixes and restack — 2026-11-17

The first live pass exposed a dock layout defect: fractional item widths let
Settings wrap onto an unplanned second row, covering Chat Send. Explicit rows
now keep rendered height aligned with the reserved inset. Pixel 7 retest at
Large text confirmed five tabs on one row, Send above the dock, successful send
and cleared composer. Native and independent web partner readback agreed.

The same run found certainty choices offered while the legacy backend flag was
off. The fix belongs to CB-01/CB-02: authoritative capability loading, truthful
legacy-date copy, and certainty/promotion controls only when supported. Backend
flags remain unchanged. Their new source heads passed deterministic/mobile CI;
CB-03–CB-06 were rebased with identical lane patches (`git range-diff` equality).

| Lane | Current head after remediation |
|---|---|
| CB-01 #79 | `1c48a37` |
| CB-02 #81 | `8e64a97` |
| CB-03 #82 | `c26ee67` |
| CB-04 #83 | `c263886` |
| CB-05 #84 | `b88cb5e` |
| CB-06 #85 | `a12cb3a` |
| CB-07 #86 | `1662a3e` integrated source; later evidence-only commits may follow |

The original acceptance table above is historical; it does not claim focused
review of the new certainty changes. The consolidated runbook records targeted
native retests. Integrated source passed 33 files / 293 mobile tests, native
TypeScript and strict public API parity. No new backend function or dependency
was introduced by these remediations. #67 remains draft.

A newer local `design-for-ai` skill became available during QA. Its checker
principles were applied to type, hierarchy, interaction states, targets and
responsive layout. The owner-selected glass material/palette remains the
explicit design choice; browser-only SEO guidance does not apply to native UI.

## Accessibility and responsive acceptance

Use at least 48dp interactive targets, labels and selected/disabled states,
natural screen-reader order, sensible focus after errors/confirmation and
polite status announcements. Hide decorative artwork from accessibility.
Keep 4.5:1 normal text and 3:1 large text/component boundaries, checking actual
composited light/dark backgrounds rather than color names alone. Status,
phase, selection and unread state need text/shape in addition to color.

At compact/large Android widths and 100/130/200% text, fields, headings, dock
labels, error copy and destructive confirmations must reflow and scroll.
The browser report approximates enlarged text; native font metrics, TalkBack,
safe areas, reduced transparency and keyboard behavior require final QA.

## Skills applied

Relevant installed design guidance was consulted: brainstorming,
redesign-existing-projects, Hallmark, design-taste-frontend,
high-end-visual-design, gpt-taste, visual-design-foundations,
minimalist-ui, interaction-design, responsive-design,
design-system-patterns, web-component-design, tailwind-design-system,
react-native-design, mobile-ios-design, mobile-android-design and
accessibility-compliance. The project-listed `design-for-ai` entry was not
present in the inspected project/global skill directories.

Use their applicable hierarchy, type, material, state and accessibility
guidance. Generic landing-page funnels, forced font/palette replacement,
scroll spectacle, new frameworks and SwiftUI/Compose rewrites conflict with
this task. Existing product/native constraints take precedence. The selected
blend is recorded in this existing plan; no competing root `design.md` is
introduced.

## Verification and limits

See [CB-07 implementation evidence](../evidence/cb-07-mobile-ui/README.md)
for commands, exact qualification identity and result boundaries. Mobile
TypeScript plus strict public contract parity, native tests, root typecheck,
Expo Doctor and Android Hermes export have passed locally. Android compilation
is recorded separately; compilation does not establish JS launch or journeys.

A GPT-6 Luna read-only integration review found no P0/P1 or clear API/guard
regression in the reviewed source. Its duplicate partner-support-copy finding
was fixed. It inspected installed Expo Router/Blur API definitions; it did not
exercise a device. Independent source review is not final live qualification.

The self-contained HTML report remains illustrative. Its 52 state selections,
90 layout cases, four role/navigation cases, three directions, offline assets
and no-overflow checks are browser-artifact evidence only. Native glass
performance, actual composited contrast, keyboard, TalkBack, privacy and
paired-account cross-client journeys are recorded only when actually exercised
in the resumed QA runbook. Secure native capture prevents pixel inspection;
source/mockup evidence does not establish composited native glass quality.


## Current stack after consolidated QA remediation

The accepted CB-06 identity above is historical acceptance evidence. Current
CB-06 base is `7b07bf2f6dc41c9e845c76356789c5cbf20631c8`; current CB-07 app
source is `384762ecf8d2861e9cdb8c013b3efe3e1eec5cc9`. CB-01 capability handling
and CB-02 selected-date retention, native modal protection and legacy-delete
guards are inherited from their owning lanes. CB-03–CB-06 patches are unchanged
by range-diff; all target branches retain the original stack. PR #67 stays draft.
The integrated suite now passes 35 files / 300 tests, native/strict-contract and
root TypeScript. Signed final-stack manual qualification remains partial;
production delivery is blocked by the separately recorded deployed contracts
and native-auth prerequisites. No production deployment is included in CB-07.
