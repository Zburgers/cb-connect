# Gate 5 M2 Android session evidence — 2026-10-26

**Status: M2 test compromise accepted; M3 may proceed, foundation is not freeze-ready.** At the owner's direction, qualification uses only the approved `holy-clam-29` Clerk development instance and `dev:hallowed-hummingbird-284` Convex test deployment. The first-instance lifecycle is live-tested; app configuration rejects other Clerk issuers in deterministic tests. Production was not queried or changed.

## Verified

- Pixel 7 / Android 17 debug app completed Clerk hosted sign-in for a run-scoped synthetic primary account. Clerk's active session issued a Convex JWT whose issuer and subject matched the approved test issuer and fixture account.
- Convex accepted that JWT for `ensureUser`, `getMe`, and `getCapabilities`. A newly issued JWT for the same active session was also accepted.
- The app's sign-out action returned to the sign-in screen. Clerk reported the primary session revoked; signing in as the second synthetic fixture account created a different active session. That account received no primary `getMe` or guard data, and `getCapabilities` failed closed.
- Convex fixture cleanup reported no remaining scoped records. Both Clerk fixture users were deleted, and both sessions were inactive.
- Local checks after the sign-out and Expo patch updates: mobile tests 12 files / 55 tests passed; mobile typecheck and contracts parity passed; `expo-doctor` passed 21/21 checks.
- The mobile auth environment test rejects a second development issuer and the production issuer `clerk.cb.builtbynaki.tech`; these are publishable-key/configuration boundary tests, not signed foreign-JWT integration tests.
- The approved test deployment's `CLERK_FRONTEND_API_URL` was read through the target-bound test credential wrapper and returned only `https://holy-clam-29.clerk.accounts.dev`. Convex identity resolution now also requires the legacy or synthetic issuer to appear in the active deployment's configured provider list; a regression test proves the production issuer is denied under the approved test issuer configuration.
- A separate short-lived backend-created session in the same Clerk development instance minted a JWT with the expected `iss`, `sub`, `aud`, and expiration. Convex accepted it under the approved provider configuration. The session and synthetic Clerk user were deleted after the check.
- A one-instance provider mismatch attempt changed the configured URL only by adding a trailing slash. Convex still accepted the JWT, so this did **not** prove issuer rejection. The exact provider URL was restored, the temporary diagnostic query was removed from the deployment, and no application data was created.

The screenshot records the app after the second fixture signed out. It contains no fixture email, password, token, or verification code.

![Android app returned to sign-in after sign-out](./android-signed-out.png)

## Issuer proof limit

Clerk's `iss` is the instance Frontend API URL and cannot be overridden by a JWT template. Using only `holy-clam-29` cannot mint a token from another live Clerk issuer; Convex also canonicalized a trailing-slash variant and accepted the same-instance token. No production issuer was used.

Per the owner's 2026-10-26 approval, the one-instance compromise uses an ephemeral RSA key generated in memory to sign a short-lived JWT with a synthetic `https://gate5-foreign-issuer.invalid` issuer. The script verifies that signature locally, sends the token to `queries/capabilities:getCapabilities` on `https://hallowed-hummingbird-284.convex.cloud`, and expects Convex `NoAuthProvider`. It creates no users or app data, persists neither key nor token, and refuses any other deployment URL. Run `scripts/test-foreign-issuer-jwt.mjs` through the existing target-bound `scripts/with-auth-test-env.ts` wrapper in the primary checkout, with the worktree's installed `tsx` loader and the worktree script's absolute path.

Observed result: **PASS** — local signature self-check passed and the approved test deployment rejected the token with `NoAuthProvider`; its effective provider list was read as only `https://holy-clam-29.clerk.accounts.dev`. This verifies rejection of a signed token whose issuer is not configured. It does **not** exercise a second hosted Clerk instance's JWKS/signing behavior; that live second-issuer check remains intentionally outside this owner-approved compromise.

## M3 route-shell implementation and local evidence — 2026-10-26

- Backend `mobileAccess.getGuardState` now has a focused Convex test covering primary and partner role responses, then partner access changing to `isLinked: false` after the primary revokes the relationship.
- Route-state tests cover signed-out, auth pending/rejected, offline, stale backend state, incomplete onboarding, unlinked/revoked relationships, role mismatch, and backend-confirmed primary/partner access. The shell/error/offline tests assert generic accessible copy and prevent sensitive data from reaching the fallback.
- Pixel 7 / Android 17 completed hosted Clerk sign-in with a run-scoped synthetic fixture and reached the protected status shell after Convex auth; without an app profile, it showed only generic onboarding-incomplete copy. Sign-out returned to the signed-out Clerk screen. Screenshots: [authenticated setup gate](./android-m3-authenticated-setup-gate.png) and [signed-out gate](./android-m3-signed-out-gate.png). They contain no fixture email, password, verification code, token, or health data.
- Both run-scoped Clerk fixture users were deleted and verified absent by readback; no Convex app records were created and the temporary credential file was removed.
- Local validation after these changes: root unit tests 79 files / 905 tests; mobile tests 12 files / 57 tests; mobile and root typechecks; contract parity; Expo Doctor 21/21; Android Metro export (1,497 modules); CI workflow, fixture boundary and Convex command policy checks; root production build with the repository's inert qualification environment; root `npm audit --omit=dev` reports zero vulnerabilities.
- Primary/partner role resolution, revocation, offline/stale-state denial, dynamic dark-mode contrast, and generic accessible error/offline copy pass focused tests. These states were not all exercised on-device; an iOS simulator is unavailable on this host.
- Mobile `npm audit --omit=dev` still reports six high findings in `node-forge` and `zod` in the installed Expo/Clerk dependency graph; npm reports no available compatible fix. An Android export with external source maps contained 1,484 modules and no `node_modules/zod/` or `node-forge` source, so these findings are not in the shipped Android JavaScript bundle. They remain a local tooling/dependency-graph risk and are recorded below rather than suppressed with an override.

**M3 status: implementation, local checks, authenticated Android onboarding gate, and the approved one-instance issuer-rejection compromise pass. Exact-head architecture review passes; privacy review is conditional on documenting the compromise and resolving the mobile audit findings. Exact-head CI and final reviews are still required. Foundation is not freeze-ready.**

## Audit findings

- Root `npm audit --omit=dev` initially found critical/high Next.js advisories at 15.5.27. The web dependency is now pinned by the lockfile to patched Next.js 15.5.28; local audit reports zero vulnerabilities.
- Mobile `npm audit --omit=dev` still reports high-severity `node-forge` and `zod` advisories through Expo tooling, with no fix available in the current dependency tree.
- After the Next.js patch, local root validation passed: `npm run typecheck`, `npm run test:unit -- --run` (78 files / 903 tests), and the CI-style `npm run build`. These ran on Node 22.23.1; PR CI remains the required check under pinned Node 20.19.1 / npm 10.8.2.

Mobile `npm audit --omit=dev` still reports six high findings: `node-forge@1.4.0` under Expo CLI and `zod@3.25.76` under Expo CLI / Clerk transitive packages. The registry reports `node-forge@1.4.0` as latest and has no `1.4.1`; Zod 4.6.6 is patched, but the current Expo CLI dependency range is Zod 3 and npm reports no compatible fix. External Android source-map inspection found neither affected package among 1,484 bundled modules. This disposes the shipped-app reachability question for this Android bundle while retaining a developer-tooling risk; no overrides or broad `npm audit fix` were applied.
