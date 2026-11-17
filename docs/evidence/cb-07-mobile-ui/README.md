# CB-07 native Bloom implementation evidence

Date: 2026-11-17. Issue: NAK-149. PR: [#86](https://github.com/Zburgers/cb-connect/pull/86).
Base: accepted CB-06 `8371af42b50e0b046bbdd148844cc9891c317ae4`.
Implementation identity: the `feat(UI): implement native Bloom redesign and reflective glass dock`
commit in this PR; later documentation-only commits do not change its app source.
The PR's exact head and GitHub checks provide the final immutable check identity.

## Implemented scope

The owner selected Bloom Glass + subtle sage with Bloom Liquid's border
distinction, then requested a smoother, less opaque, Apple-like bottom bar.
The native app now has shared screen/panel/notice/text primitives, bundled
licensed DM fonts, existing web phase/locket artwork, and presentation changes
across Home, Onboarding, Log, Partner, Chat, Inbox and Settings.

The dock is rendered outside the `BlurTargetView` that contains navigator
scenes, so the blur samples actual scrolling content. Its theme tint is 18%
alpha, with ultra-thin native material, reflective inner/outer edges, a small
reflection gradient and a translucent selected capsule. Selection uses a
native-driver spring. Native tab events remain cancellable. Protected routes
and hidden inbox/status destinations retain their existing access behavior.
Older Android and iOS reduced-transparency settings get an opaque fallback;
reduced motion disables the spring. Keyboard visibility removes the dock and
its Chat inset. Enlarged labels reflow instead of truncating.

Existing role/sharing/health copy, auth and account-switch isolation, server
projections, mutation arguments, offline truth, chat pagination/receipts,
reminder timezone and feature flags are retained. No backend, public API,
dependency/lockfile, production flag or deployment change is introduced here.

## Local deterministic qualification

Web toolchain: Node 20.19.1 / npm 10.8.2. Mobile toolchain: Node 22.23.1 /
npm 11.21.1, isolated clean installs. Font/art files are local and licensed;
there is no runtime network font dependency.

| Check | Result | Evidence and limits |
|---|---|---|
| Root `npm run typecheck` | PASS | Existing web TypeScript boundary remains clean |
| Root `npm run mobile:typecheck` | PASS | Native TypeScript plus strict public API/server contract parity |
| `npm --prefix apps/mobile test` | PASS | 33 files / 278 tests, including inventory, negative compile, server-import boundaries and existing feature interactions |
| Native semantic snapshots | PASS | Home public phase/paused/uncertain states, Onboarding roles/loading/partial save, Log hierarchy/actions, Partner primary-vs-partner controls, Chat empty composer, Inbox read/actions, Settings roles/appearance/pending/failure |
| Dock component tests | PASS | Guarded routes, hidden destinations, selected state, cancel/long-press events, sibling scene blur target, native-driver spring, reduced motion/transparency, old Android fallback, keyboard hide and compact/large-font geometry |
| `npm --prefix apps/mobile run doctor` | PASS | 21/21 checks |
| `npm --prefix apps/mobile run bundle:android` | PASS | Configured synthetic Hermes export, 1,611 modules, local fonts and all phase/locket artwork |
| Android `./gradlew assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon --console=plain` | PASS | Android SDK 36 compile / JDK 17 / NDK 27.1, debug APK; not release or runtime qualification |
| `git diff --check` | PASS | Scoped source/docs/assets only |

The initial unrestricted multi-architecture debug build was stopped in favor
of the emulator's x86_64 target. The target build completed successfully in
5m 22s. Debug APK SHA-256:
`8c7a5773df3953a3b8160bcd8bfa08a4daa7a711885dd63efc546623154f9499`.
The debug native binary requires its development JS runtime; its build does
not prove JS launch or contain a qualified production release.

Solid semantic text/background pairs were checked numerically: normal text
and action/consent copy exceed 4.5:1; light/dark input outlines are 3.86:1 and
4.82:1 against their surfaces. Actual native composited dock contrast and
frame timing remain unmeasured.

The updated self-contained HTML report separately passes 52 state selections,
90 browser layout cases, four role/navigation cases, three visual directions,
zero HTTP requests offline, no console errors and no measured horizontal
overflow. These are mockup-artifact checks, not native screenshots.

## Source review

A GPT-6 Luna read-only integration review inspected the native diff and
installed Expo Router/Blur definitions. It found no P0/P1 or clear guard/API
regression. A duplicate partner-support sentence was removed. The review did
not independently exercise Android, TalkBack, keyboard or privacy behavior.
Final PR review and CI remain separately visible on the exact PR head.

## Consolidated live Android / web QA

The resumed run uses the canonical [final-stack QA checklist](../../testing/2026-11-17-cb-07-final-stack-qa.md).
The owner has now started Pixel 7 successfully. The startup failure below is
historical; resumed results and final APK identity are recorded in that runbook.
The approved synthetic backend was refreshed through the target-bound executor
to source `026249a` for this consolidated run. Readback confirms all 50 public
mobile names/kinds/visibility and CB-06's `expectedCurrent` cycle argument.
Production remains unchanged; see [production readiness](production-readiness.md).

The later packaging changes pass 33 files / 285 mobile tests, mobile TypeScript
plus strict parity, root TypeScript, Expo Doctor 21/21 and a 1,612-module Android
Hermes export. Valid production Expo configuration and mixed-target rejection
were checked without relying on Node's TypeScript stripping. A real Gradle
release-task dry run refuses missing owner credentials as expected; this is a
signing-guard test, not a successful signed build.

**Historical first attempt — BLOCKED before native launch.** Inventory identified a Pixel 7 Android 17
emulator, not a physical device. The Device panel's `device_open` failed:

> The emulator process for "Pixel_7" was killed by SIGSEGV before coming online.

The tool's suggested manual boot recovery was attempted once. The Device
panel retry returned the same SIGSEGV failure. Device instructions require
stopping there; no alternate input/screenshot driver was used.

The approved synthetic test configuration was validated and retained only in
an ignored mode-600 local file. No account was created/deleted, no new pair
was provisioned and no live health/chat data was changed. Production was not
used. No credentials, account IDs, pairing codes or authenticated screenshots
are included in this evidence.

| Final-stack scenario group | Status |
|---|---|
| Native launch and visual readback | BLOCKED — emulator startup |
| Onboarding, partial-save/resume and period/pain/CSV journeys | BLOCKED — native launch prerequisite |
| Pairing, nickname/date, sharing, revocation and account switch | BLOCKED — native launch prerequisite |
| Chat quick compose/reactions/receipts/clear and inbox/reminder | BLOCKED — native launch prerequisite |
| Settings and web↔Android cross-client readback/concurrency | BLOCKED — native launch prerequisite |
| Compact/large device, dynamic type, TalkBack, keyboard and composited glass | BLOCKED — native launch prerequisite |
| Screenshots/Recents, clipboard and physical-device privacy | NOT RUN — requires functioning native runtime; physical-device claims remain separate |

Resume the **single consolidated final-stack QA checklist** in the PR/report
when device control is available. File feature failures under their owning
CB-01–CB-06 ticket/PR, fix there and rerun targeted checks. Keep #67 draft,
retain the stack and do not accept/merge or deploy based on these local
deterministic/build results alone.


## Current integrated QA checkpoint

Integrated app source: `1662a3e8e4052bbda16fb314aac7e1d0a9c1cb33`, stacked on
CB-06 `a12cb3a625d4b7341e86370c57ee1c6d69d5663b`. Mobile tests **33 files / 293
PASS**, native TypeScript/strict parity PASS and exact-head deterministic/mobile
CI PASS. Source review by the same GPT-6 Luna agent found no actionable P0/P1/P2
regressions; it did not substitute source review for device acceptance.

The resumed [manual results](manual-qa-results.md) contain actual primary and
partner Clerk journeys, initial period/pain writes with independent web readback,
profile restore, appearance persistence, inbox gating and partner privacy. Live
QA exposed the accidental dock row/Send interception (fixed and retested) and
legacy certainty mismatch (fixed in CB-01/CB-02; native retest pending). See the
[canonical checklist](../../testing/2026-11-17-cb-07-final-stack-qa.md) for remaining
steps and exact artifact/hash/signing evidence.

A signed standalone synthetic APK was built from the integrated source. Static
APK checks pass; standalone install/runtime is **NOT RUN**. Pixel 7 went offline
and bounded recovery remained unsuccessful after clearing only task-generated
caches and stale panel state. The owner must restart the same AVD; no user/AVD
data was deleted. No production setting was changed and no APK was emailed or
uploaded. Full QA and production delivery remain incomplete.
