# CB Connect mobile MASVS checklist

**Scope:** M1–M3 foundation and SHIELD M8.1 work at frozen base `b39f7fa416233d69bce1edad765c8419e3a5defd`.
**Verdict:** partial source review only. No MASVS level, profile, certification, device test, M8.2 closure, or release qualification is claimed.

Status meanings: **PASS (source)** means the reviewed source/config supports the narrow statement; **PARTIAL** means a control exists but is incomplete or not integrated; **NOT RUN** means native/manual verification remains.

| MASVS group | Status | Current evidence | Required M8.2 / M9 follow-up |
|---|---|---|---|
| MASVS-STORAGE | PARTIAL | Clerk's minimal token cache uses Expo SecureStore; no AsyncStorage, file, or persistent Convex domain cache is configured. Android SecureStore backup exclusion is the Expo plugin default. | Inspect built Android backup rules and iOS entitlements/data protection; test backup/restore, uninstall/reinstall, and on-device token removal; verify no M4–M7 domain persistence. |
| MASVS-CRYPTO | NOT RUN | TLS endpoints and OS SecureStore are used by platform/SDK defaults. No app-owned cryptographic protocol exists. | Inspect actual TLS destinations and platform configuration; do not add custom cryptography or claim pinning. |
| MASVS-AUTH | PARTIAL | Clerk identity is paired with Convex authentication and server-derived access gating; client instance lifecycle is account-keyed. | Exercise live synthetic auth, token refresh/revocation, logout/account switch, and authorization after revoke on both platforms. |
| MASVS-NETWORK | PARTIAL | Auth and Convex use their SDK transport; current source does not introduce arbitrary destinations or logging. | Inspect runtime requests on device, redirects/deep links, certificate behavior, and error payload redaction. Verify only approved synthetic endpoints are embedded in test builds. |
| MASVS-PLATFORM | PARTIAL | Unknown routes show generic copy; the frozen foundation has no clipboard feature. The separate [M6 candidate](https://github.com/Zburgers/cb-connect/pull/73) uses selectable text for chat bodies and pairing codes. `AppPrivacyShield` implements a fail-closed capture/switcher guard but is not mounted. | ATLAS mounts the shield at the root; review chat-copy and pairing-code clipboard behavior, then verify screenshots, recording, recents/app switcher, backgrounding, interruptions, keyboard/autofill and deep links on current Android and iOS devices. |
| MASVS-CODE | PARTIAL | Separate mobile lockfile and typecheck/unit suite exist. No first-party analytics/crash SDK or console logging appears in mobile runtime source. | Recheck current npm audit and dependency reachability, generated native code, release bundle, production diagnostics, and secret/artifact handling. |
| MASVS-RESILIENCE | NOT RUN | No root/jailbreak detection, anti-tamper, or device attestation is claimed. | Record rooted/jailbroken device assumptions and any observed behavior; do not present these as prevented unless a verified control is introduced. Server authorization remains authoritative. |
| MASVS-PRIVACY | PARTIAL | Synthetic-only mobile environment; generic not-found/error copy; no app analytics/advertising SDK found in direct dependencies or source. | Audit integrated M4–M7 collection/sharing, notification previews, selectable chat content and pairing-code clipboard residue, screenshots, logs/crash metadata, test artifacts, SDK transitive/native data flows, and user privacy controls. |

## Automated privacy checks

- `apps/mobile/src/security/appPrivacy.test.ts` checks Android screen-capture blocking and iOS switcher protection setup, cleanup, and fail-closed setup errors.
- These unit tests mock the native module. They prove call ordering and failure handling only; they do not prove OS behavior.
- App-root mounting is intentionally left to ATLAS, the owner of shared route/layout integration.

## Device checklist — NOT RUN

| Platform | Check | Result |
|---|---|---|
| Android | Signed synthetic build shows a blank Recents preview and blocks screenshots/recording while the shield is mounted. | NOT RUN |
| Android | Restore from device backup does not restore the Clerk token or any domain cache. | NOT RUN |
| Android | App switch, screen lock, notification shade, autofill picker and process restart reveal no previous account data before authorization. | NOT RUN |
| iOS | App switcher preview is blurred and screenshot/recording behavior matches the selected policy. | NOT RUN |
| iOS | Keychain persistence across uninstall/reinstall is understood; logout/revocation removes or invalidates the session before account reuse. | NOT RUN |
| iOS | Backgrounding, Control Center, calls, lock screen, keyboard/autofill and process restart do not show sensitive screens or values. | NOT RUN |
| Both | Deep links use generic failures, validate parameters, never carry credentials/health values, and still require backend authorization. | NOT RUN for integrated M4–M7 routes |
| Both | Two-user and three-user sign-in, logout, forced revoke, account switch, and relink never show stale prior-user data. | NOT RUN until M4–M7 integration |
| Both | Logs, crash metadata, native diagnostics, screenshots and CI artifacts contain no tokens, identities or health values. | NOT RUN on native release candidate |

## Evidence references

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASVS storage](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
- [OWASP MASVS privacy](https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Screen Capture](https://docs.expo.dev/versions/latest/sdk/screen-capture/)
- [React Native AppState](https://reactnative.dev/docs/appstate)
