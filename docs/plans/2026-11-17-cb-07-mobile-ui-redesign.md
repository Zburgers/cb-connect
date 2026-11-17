# CB-07 — owner-led mobile UI redesign

Status: **design proposal, awaiting owner selection and CB-06 acceptance**.
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
regression-test head `ca01eda57e7305766c7960ec3ab948087d6e7206` during preparation. Its PR base
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
| CB-06 | [#85](https://github.com/Zburgers/cb-connect/pull/85) | `ca01eda57e7305766c7960ec3ab948087d6e7206` | Changes required: stale-error recovery P2 | PASS / PASS |

The [preceding CB-06 review](https://github.com/Zburgers/cb-connect/pull/85#pullrequestreview-5938446480)
required account-keyed draft isolation, in-flight profile editing protection,
and resolution of stale-write guarantees. The new CB-06 commit adds an
identity-keyed settings subtree, protected name editing, conditional cycle
writes and regression tests. Those changes belong to CB-06 and are inherited,
not authored by CB-07. The [exact-head re-review](https://github.com/Zburgers/cb-connect/pull/85#pullrequestreview-5939281005)
verified those fixes but requires one P2 correction: use a stable stale-error
discriminator compatible with client-wrapped Convex rejections, and prove
the reload action appears while retaining the draft. CB-07 does not fix or
accept that feature defect.
Profile conflict warnings must not be described as atomic concurrency guards.

**Implementation entry gate: BLOCKED** until all six focused reviews and
exact-head deterministic checks pass (CB-06 CI is green; stale-error recovery
still requires correction). Refresh this snapshot and the base
before native work. Local test claims in earlier PRs were read as reported
evidence; this design pass did not independently rerun feature qualification.
Skipped production release jobs are not release evidence.

## Design sources and choices

There is no root `design.md` at this base. Existing sources are
`docs/cb-connect-design-guidelines.md`, `docs/cb-connect-design-audit.md`,
`docs/plans/2026-05-18-cb-connect-design-overhaul.md`, `app/globals.css`,
the web dashboard components, and `apps/mobile/src/theme/tokens.ts`.
They already establish Bloom, editorial serif headings, warm coral/amber,
cream paper, dark ink, lavender support and phase-aware surfaces.

The report proposes three treatments of that system:

1. **Bloom Glass — recommended:** phase artwork is the emotional anchor;
   prediction and supporting sections are quieter. A detached glass dock
   has icons, labels and a sliding active capsule. Closest to the web.
2. **Bloom Editorial:** paper-led sections, more typographic hierarchy,
   fewer raised surfaces. Glass is concentrated in navigation.
3. **Bloom Liquid:** richer light fields, more pronounced rounded glass
   edges and depth. Requires more native contrast/performance scrutiny.

The optional supporting sage tone is `#4C6753` on `#E4EBDF` in light mode,
`#C4D4BB` on `#28382F` in dark mode. Coral remains the action color; amber
remains atmospheric. Sage does not grant consent or replace phase semantics.
The report also previews existing coral-only and lavender alternatives.
The owner can mix the chosen surface treatment with the supporting tone.

Typography: DM Serif Display headings, DM Sans UI and tabular numeric text.
The report embeds licensed Google Fonts. Native font bundling follows owner
selection and must have a readable loading/failure fallback. Do not create a
second design system or rename settled tokens just for this proposal.

## Shared native presentation foundation

After the entry gate and owner selection:

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

## Screen-by-screen proposed inventory

| Screen / source | Before | Proposed presentation | Behavior that must survive |
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
3. **PENDING — owner decision and prerequisite closure:** owner picks the
   visual direction/tone; CB-06 receives focused acceptance and deterministic
   checks. Rebase onto its accepted exact head. Do not start native work sooner.
4. **NOT STARTED — shared tokens and primitives:** implement the selected
   presentation and navigation in the existing native stack. Focused UI tests
   cover labels, selection, opaque/dark contrast tokens and layout behavior.
5. **NOT STARTED — screen rollout:** Home/cycle → Onboarding → Log → Partner
   → Chat → Inbox → Settings. Preserve handlers, model copy and guard/query
   boundaries. Add stable role/state presentation fixtures and snapshots.
6. **NOT RUN — deterministic validation:** use the documented Node 22/npm 11
   mobile toolchain. Run focused presentation/interaction tests, the mobile
   suite and `npm run mobile:typecheck` (including strict API parity), inventory,
   negative fixtures and server-only-import checks. Review exact-head CI.
   Backend/functional gaps go back to CB-01–CB-06, not into this PR.
7. **NOT RUN — one final stack live QA:** follow the consolidated checklist
   inside the HTML report and PR description, on the final integrated exact
   source/APK head, using the approved persistent synthetic pair. No standalone
   native live QA for this design PR. Record failures under the owning feature;
   rerun targeted checks after fixes. Maintain emulator/physical-device limits.
8. **PENDING — final acceptance:** owner reviews screen inventory, role/state
   coverage, snapshots and consolidated QA results. Only then accept/merge
   bottom-up into `gate5/atlas-foundation`, holding #67 draft. No production
   deployment, flag change, signing/release or new product feature is in scope.

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
this task. Existing product/native constraints take precedence. No root
`design.md` is locked before the owner selects the design.

## Verification of this proposal

Only artifact validation is appropriate at this stage. JavaScript syntax,
local mockup interactions, layout stress and offline asset loading can be
verified without a native run. Record those separately from mobile parity,
live accounts and final Android qualification. See the PR description for
the measured report checks. Native tests, builds and live QA are NOT RUN by
this design proposal.

Artifact validation: **PASS** — 52 screen/state selections, 90 layout cases
(5 screens × 3 requested widths × 3 text sizes × 2 appearances), 4 role/nav
cases and 3 directions. No measured inner horizontal overflow, no JavaScript
console errors and no HTTP requests with the browser offline. Pending-save
editor protection, bounded steppers and 360px outer-report reflow passed.
Ten solid semantic text/background pairs also exceed 4.5:1 (minimum 4.90:1);
this does not certify every composited native glass surface. These are local
HTML artifact checks in headless Chrome, not live app QA.
