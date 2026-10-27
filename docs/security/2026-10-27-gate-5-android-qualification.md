# Gate 5 Android qualification — 2026-10-27

**Reviewed integration source:** `f20409c2761b22962fef7062c1230f97e5a5bf6f`. The integration PR advanced during this run to `12616accbcba1a9336ea1757a4d9c6edfa0997ed`; its delta from the reviewed source is limited to `AGENTS.md`. This is a partial qualification record, not integration or release acceptance. No production deployment, release artifact, feature flag, or real-user fixture was changed.

## Native and authenticated matrix

| Check | Status | Evidence or blocker |
| --- | --- | --- |
| Pixel 7 Android 17 emulator | PASS | The existing emulator was booted and used with the owner's permission. It was not a physical device. |
| Second Android emulator | FAIL | `Medium_Phone_API_37.0` failed to boot: the device service reported SIGSEGV before coming online. |
| Metro host listener | PASS | With Node 22 and `NODE_OPTIONS=--dns-result-order=ipv4first`, Expo listened on `127.0.0.1:8081` and `/status` returned `packager-status:running`. |
| Android debug build | PASS | `:app:assembleDebug --no-daemon -PreactNativeArchitectures=x86_64` completed using the existing generated native tree, JDK 17 and Android SDK. It was incremental, not a clean native regeneration. The automation install command reported a device-session ownership conflict; the already-installed APK's identity and hash were not verified against this build. |
| Native JavaScript launch | PASS | Expo initially bound only to IPv6 `::1`, while the existing reverse mapping targets port 8081. With IPv4-first resolution, Metro bound `127.0.0.1`, served JavaScript from the isolated checkout, React Native logged its entry point, and the Pixel 7 displayed the sign-in screen. The installed native binary's provenance remains unverified, so the device observations do not qualify the newly built APK or its exact native source. |
| Synthetic endpoint identity | PASS | The mobile public settings were checked against the approved Clerk test issuer `holy-clam-29.clerk.accounts.dev` and Convex test URL `https://hallowed-hummingbird-284.convex.cloud`; the existing test credential wrapper validated the deployment-bound configuration. No credential values are recorded. |
| Integrated test-backend API | FAIL | Read-only function metadata on the approved Convex test deployment contained 42 of 44 inventoried mobile references. `queries/notifications.js:getMyInboxAvailability` and `queries/messages.js:listPageForMobile` were absent. No deployment was performed. |
| Synthetic sign-in and primary role | PASS | Two run-scoped synthetic primary accounts each signed in through hosted Clerk and saved the primary role. A scoped fixture run was begun before application writes; both runs were cleaned. The second pair's Clerk deletion was verified by readback. No health records were created. |
| Pairing, dashboard, period and pain logging | BLOCKED | Fixture registration failed, first because the temporary harness used a different run ID and then with `fixture_cleanup_identity_mismatch` after correcting the harness. Both scoped cleanups completed; do not proceed with writes until the remaining mismatch is understood. The deployed backend also lacks two candidate functions. |
| Chat and default-off notifications | BLOCKED | Both required deployed public references listed above are absent. |
| Revocation, account switching, re-pairing and cache isolation | BLOCKED | Requires the authenticated multi-account journey; no absence of stale data is claimed. |
| Signed-out screen capture sample | PASS | With the signed-out screen accessible in the Android UI tree, device capture showed black app content; the [first extracted frame](../evidence/g5-android-2026-10-27/signed-out-recording-frame.png) of a 4.8-second device recording was also black in the app-content region. |
| Full screenshot and recording qualification | NOT RUN | The sampled signed-out screen does not qualify authenticated health/chat screens or the full recording. |
| Restart after account deletion | PASS | After deleting the first synthetic account and restarting the app, it returned to the signed-out screen. This does not prove multi-user cache or revocation isolation. |
| Recents, clipboard, interruption and explicit logout | NOT RUN | These flows were not independently exercised. |
| Android backup and restore | NOT RUN | Generated source manifest references Expo SecureStore backup rules; the module's XML excludes `SecureStore` shared preferences for backup and device transfer. This source inspection is not an artifact or restore test. |
| Physical Android and iOS privacy qualification | NOT RUN | No physical device or iOS simulator was available in this run. |

## Mobile dependency investigation

Focused Node 22 mobile tests for auth configuration, token cache, auth gate, account-scoped providers, access resolver and privacy shield passed: six files, 48 tests. These use mocks or source checks and are not native or authenticated isolation evidence.

A device accessibility snapshot exposed the first run's disposable synthetic password in local tool output. Its Clerk account was deleted by the scoped cleanup before another run. Raw temporary snapshots, credentials, and recordings were removed; the retained frame was visually inspected for sensitive content.

Node 22/npm 11 `npm audit --omit=dev` reported six high-severity dependency-graph entries. The two direct advisories are `node-forge@1.4.0` ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)) and `zod@3.25.76` ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)); the other four entries propagate through Expo CLI, its code-signing package, Expo, and Clerk Expo. The installed dependency tree also includes Zod through Clerk's `@base-org/account`/`viem`/`abitype` chain, so it is not correct to classify every installed Zod path as exclusively Expo CLI tooling.

An Android Hermes export without configured public authentication settings, with an external source map at the reviewed source revision, contained 1,505 sources and no source paths containing `zod` or `forge`; it did include Expo CLI's Metro runtime `metro-require/require.js`. This supports absence of the two affected packages from that exported JavaScript bundle only. It does not establish native binary, a configured bundle, other platform, release-build, or developer-tooling safety. No dependency override or audit suppression was applied.

## Acceptance

Gate 5 integration acceptance remains **BLOCKED**: the dated plan requires an actual authenticated two-/three-user relink and cache-swap journey and native privacy evidence with an independent exact-SHA privacy review. D-018 remains a separate owner decision before real-user replacement-partner sharing. Native release, physical-device qualification, signing, distribution, and production exposure remain separate and are not authorized by this record.
