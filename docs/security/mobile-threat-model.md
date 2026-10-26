# CB Connect mobile threat model

**Review scope:** SHIELD M8.1 baseline on the M1–M3 mobile foundation at `b39f7fa416233d69bce1edad765c8419e3a5defd`.
**Status:** early design and source review; M4–M7 are not integrated on this base. This is not M8.2 closure, a MASVS verification, or release approval.
**Data boundary:** synthetic Clerk and Convex only. No real-user data or production configuration was accessed.

## Product and execution boundary

The current native client is an Expo/React Native app with Expo Router. Clerk authenticates the user and persists its minimal session token through its SecureStore token cache. A Convex client obtains the Clerk token and reads the backend's current access state. The backend remains authoritative for identity, role, relationship, sharing, cycle data, prediction, and write permission. The native foundation is currently limited to authentication, an access-gated shell, and generic status/error routes; the M4–M7 data screens and flows are future integration inputs, not reviewed surfaces here.

The app targets Android and iOS. A signed Android APK is the planned release artifact. iOS personal sideloading remains a separate feasibility experiment. The current build configuration identifies an isolated development environment and uses a test Clerk issuer and synthetic Convex deployment. It is not production-ready.

## Assets and security invariants

- Clerk session credentials: only the minimum token required for authentication may persist, using SecureStore; never include it in logs, URLs, clipboard content, crash metadata, or screenshots.
- Cycle, pain, relationship, chat, notification and profile information: keep native domain responses in memory for the beta; never persist them to AsyncStorage, a file, a local database, or backup.
- User and partner boundaries: Convex verifies current identity and relationship permissions. A local route, cached UI, partner role, or deep link cannot grant access.
- Session and account transitions: dispose the old Convex client/query cache before showing a different account; revoked or unresolved access fails closed.
- Diagnostics and evidence: use generic errors and synthetic fixtures. Logs, crash metadata, screenshots and CI artifacts contain no token, identity, or health values.
- Device-local privacy: hide protected UI in recents/app-switcher previews and block screenshots/recording where the platform API supports it. These controls reduce casual exposure; they do not protect a compromised OS.

## Actors, boundaries, and data flows

| Boundary | Data or authority crossing it | Current control and remaining evidence |
|---|---|---|
| User ↔ app | Credentials, authentication redirects, cycle/relationship data in future feature screens | Clerk's native flow; generic not-found and error-boundary copy. M4–M7 route and state behavior remains unreviewed. |
| App ↔ Clerk | Publishable key, auth requests, Clerk-issued session tokens | Publishable key and synthetic issuer are validated before client creation. Clerk token cache is SecureStore-backed. Hosted Native API lifecycle/revocation and token storage must be retested on both platforms after integration. |
| App ↔ Convex | Clerk JWT over TLS/WebSocket; server-derived access state and future domain DTOs | Convex `useAuth` provider; a separate client is keyed to user/session/org and closed on replacement. No persistent Convex cache is configured. Backend authorization remains mandatory. No certificate pinning is implemented or claimed. |
| App ↔ OS secure storage | Minimal Clerk token | Expo SecureStore via Clerk's token-cache package. Android data is not preserved on uninstall; iOS Keychain entries may persist across reinstall with the same bundle ID. Default iOS accessibility is `WHEN_UNLOCKED`; do not claim this key is device-only or erased on uninstall. |
| App ↔ OS backup/restore | SecureStore token and app-private files | Expo SecureStore's config plugin is present with its default Android backup configuration, which excludes SecureStore entries from Android Auto Backup. No app-owned domain cache exists to restore. Validate generated native backup rules and device restore behavior in M8.2; iOS restore behavior is not established by source review. |
| App ↔ other apps / OS UI | Deep links, app-switcher snapshots, screenshots, keyboard/autofill and clipboard | Unknown paths render generic “Link unavailable” copy; no clipboard API or sensitive-data sharing integration exists in the reviewed source. A fail-closed screenshot/app-switcher shield is implemented in `apps/mobile/src/security/appPrivacy.tsx`, but is not mounted because ATLAS owns the shared root layout. |
| Source/build/vendor chain | npm packages, Expo native modules, CI, build artifacts and signing configuration | Mobile dependencies are isolated under `apps/mobile`. No analytics or crash-reporting SDK appears in the app's direct dependency list. Recheck lockfile audit and built APK/IPA contents before release; M8.2/M9 must inspect generated native manifests and artifacts. |

## Threat scenarios

These are plausible scenarios for verification, not confirmed vulnerabilities.

1. **Lost or borrowed unlocked device:** another person may view a sensitive screen in recents or capture it. The `AppPrivacyShield` prevents capture and enables app-switcher protection before rendering its children; its integration into the app root is pending ATLAS. Verify actual behavior on Android and iOS because OS/version differences matter.
2. **Rooted/jailbroken or instrumented device:** an attacker with OS-level control may inspect process memory, hook JavaScript/native APIs, read a live session, or bypass client-side screen controls. Assume the client cannot defend its secrets against a fully compromised device. Revoke sessions and rely on server authorization; do not claim root detection, jailbreak detection, device attestation, or anti-tamper protection.
3. **Backup or reinstall moves credentials:** iOS Keychain persistence can outlive app removal. Android SecureStore is excluded from backup by the plugin's default configuration and is removed on uninstall. Confirm the generated iOS/Android artifacts and test restores; require authentication and backend authorization after restore.
4. **Malicious or malformed deep link:** an attacker may send an unsupported route or crafted parameters. Current unknown routes produce generic copy and no data view. M4–M7 must validate each accepted parameter, avoid putting health values or credentials in URLs, and require server-authorized reads after navigation.
5. **Account switch or revocation leaves stale UI:** an old in-memory query result may remain visible if provider teardown is delayed. Current provider keys the Convex client by user/session/org, returns a generic loading state while replacing it, and closes the old client. Verify cross-account and forced-revocation behavior against the integrated feature screens.
6. **Logs or crash metadata capture sensitive values:** accidental `console` calls, SDK breadcrumbs, exception messages, or screenshots can expose health data and tokens. The reviewed mobile runtime source has no first-party logging, analytics, or crash SDK. Keep diagnostics allowlisted and generic; inspect native and CI diagnostics in M8.2/M9.
7. **Compromised dependency or build supply chain:** an Expo/Clerk/transitive package or CI artifact could expose tokens or data. Pin via the mobile lockfile, review audit reachability and package changes, restrict release artifacts, and inspect built bundles. A clean source grep does not establish a clean dependency graph.
8. **Clipboard and keyboard residue:** copying sensitive content or entering credentials into an untrusted keyboard can expose data. The current source has no clipboard feature. Keep health values out of clipboard actions and avoid custom keyboard integrations; verify real-device behavior in M8.2.

## Root and jailbreak assumptions

Rooted Android and jailbroken iOS devices are in the threat model. The beta does not claim that Expo SecureStore, screenshot blocking, JavaScript memory handling, or Convex authorization can withstand a compromised kernel, debugger, instrumentation framework, or modified app. Root/jailbreak detection and attestation are not implemented and are not represented as controls. After compromise, rely on backend authorization; session lifetime and revocation behavior remain to be verified on the integrated candidate.

## SDK and vendor data-flow inventory

| SDK/vendor | Purpose and data it receives | Evidence / control |
|---|---|---|
| Clerk (`@clerk/expo`, hosted auth) | Authentication request data and account/session identifiers; issues the session token | Native auth provider and token cache in `apps/mobile/src/providers/AppProviders.tsx` and `apps/mobile/src/auth/tokenCache.ts`. Current configuration is synthetic-only. Review Clerk dashboard/native callback settings before release. |
| Convex (`convex`) | Authenticated identity plus backend DTOs and permitted mutations | `ConvexProviderWithClerk`; backend is the domain authority. Do not place sensitive values in URL query parameters or client logs. |
| Expo / React Native and Expo Router | Native app runtime, platform APIs, navigation and generated native projects | Direct dependencies in `apps/mobile/package.json`. Expo development tooling may emit diagnostics; production telemetry behavior must be checked in built artifacts. |
| Expo SecureStore | Clerk token persisted in Android Keystore-backed storage and iOS Keychain | Used through Clerk's token cache. No domain values are intentionally stored there. Platform persistence differs as described above. |
| Expo Screen Capture | Local OS APIs to block capture and protect app-switcher previews | Added for SHIELD's `AppPrivacyShield`; no network/data recipient. Root integration and physical-device verification remain pending. |
| GitHub Actions / npm registry | Build/test package downloads and CI artifacts; may hold synthetic test credentials in protected workflows | No private health data belongs in CI. Review lockfile, workflow secret isolation, bundle outputs, and artifact retention before M9. |
| Analytics / advertising / crash vendors | None found in the reviewed mobile direct dependencies or app source | Transitive package and native build inventory still requires release-candidate verification. Do not infer zero collection from this source-only review. |

Current `npm audit --omit=dev` reports six high-severity findings through Expo CLI tooling dependencies (`node-forge` and `zod`); npm reports no available fix. Earlier foundation evidence says neither package appeared in its inspected Android Metro bundle, but this does not make the dependency audit clean. Recheck reachability and advisories against the final integrated release artifact before any release decision.

## MASVS-aligned baseline

Use the OWASP MASVS control groups as a review map, not as a certification claim. The standard is a living document; the checklist records implementation evidence and gaps for this exact app state. See [MASVS control groups](https://mas.owasp.org/MASVS/03-Using_the_MASVS/) and [MASVS privacy](https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/).

The M8.1 source review found no P0/P1 issue in the current foundation, but it does not close the app-switcher integration, device testing, dependency reachability, M4–M7 data flows, or final independent review. Do not mark M8 complete until those are checked on the integrated candidate on both platforms.
