# Gate 5 M2 Android session evidence — 2026-10-26

**Status: BLOCKED; not M2-qualified and not freeze-ready.** This run used only synthetic accounts in the approved `holy-clam-29` Clerk development instance and the `dev:hallowed-hummingbird-284` Convex test deployment. Production was not queried or changed.

## Verified

- Pixel 7 / Android 17 debug app completed Clerk hosted sign-in for a run-scoped synthetic primary account. Clerk's active session issued a Convex JWT whose issuer and subject matched the approved test issuer and fixture account.
- Convex accepted that JWT for `ensureUser`, `getMe`, and `getCapabilities`. A newly issued JWT for the same active session was also accepted.
- The app's sign-out action returned to the sign-in screen. Clerk reported the primary session revoked; signing in as the second synthetic fixture account created a different active session. That account received no primary `getMe` or guard data, and `getCapabilities` failed closed.
- Convex fixture cleanup reported no remaining scoped records. Both Clerk fixture users were deleted, and both sessions were inactive.
- Local checks after the sign-out and Expo patch updates: mobile tests 12 files / 55 tests passed; mobile typecheck and contracts parity passed; `expo-doctor` passed 21/21 checks.

The screenshot records the app after the second fixture signed out. It contains no fixture email, password, token, or verification code.

![Android app returned to sign-in after sign-out](./android-signed-out.png)

## Remaining M2 blocker

The negative token check changed the `iss` claim without re-signing the JWT. Convex rejected that tampered token, which does not prove rejection of a valid JWT signed by a foreign issuer. The approved test deployment's effective provider list contains only `holy-clam-29.clerk.accounts.dev`, but the plan requires an actual cross-issuer synthetic integration check as well. The local worktree scan found no second test Clerk issuer; the only other configured issuer belongs to production and was not used. M2.3 remains blocked. No M3 implementation has started, and no M3 qualification is claimed.

## Audit findings

- Root `npm audit --omit=dev` failed on a critical Next.js advisory; the locked web dependency was not changed in this M2 run.
- Mobile `npm audit --omit=dev` reported high-severity `node-forge` and `zod` advisories through Expo tooling, with no fix available in the current dependency tree.

These audit failures require disposition before a foundation freeze. No `npm audit fix` was run.
