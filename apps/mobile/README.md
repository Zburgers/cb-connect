# Mobile foundation

This app uses its own npm lockfile, separate from the root Next.js install. CI pins
Node 22.16.0 and npm 11.6.2 here; the web build and production workflow stay on
Node 20.19.1 and npm 10.8.2. Expo SDK 57 resolves its compatible Router and
native module versions through `expo install` and `expo-doctor`.

From this directory, run `npm ci`, `npm run typecheck`, `npm run test`,
`npm run doctor`, and `npm run bundle:android`. The Android export is an
unsigned Metro bundle smoke check, not a distributable build. Public Convex
contract parity is checked separately with `npm run mobile:contracts:parity`
from the repository root so the native dependency tree does not load web/server
runtime code.

## Local Android Metro on this host

For the documented Node 22 toolchain and the approved synthetic-only mobile
environment, start Metro from `apps/mobile` with IPv4-first localhost resolution:

```sh
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --localhost --port 8081
```

For the selected emulator, forward its Metro port:

```sh
adb -s <serial> reverse tcp:8081 tcp:8081
```

The debug app can then load JavaScript from this checkout.
Keep Metro running while using the debug app. This is a local debug workflow,
not native release qualification.

## Standalone Android builds

The owner's CB-07 delivery request adds two explicit build profiles. Default
`synthetic` retains the approved test issuer/backend and `.beta` application.
`production` uses the live issuer/backend and `tech.builtbynaki.cbconnect`.
The public allowlist is in `src/auth/targets.json`; mixed identities fail
closed. There is no in-app environment switch.

After committing source, select the documented Node 22/JDK 17/SDK environment,
provide `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CONVEX_URL` from
the selected environment, and supply private signing credentials through:
`CB_ANDROID_RELEASE_KEYSTORE`, `CB_ANDROID_RELEASE_STORE_PASSWORD`,
`CB_ANDROID_RELEASE_ALIAS`, `CB_ANDROID_RELEASE_KEY_PASSWORD`. Keep the
owner-controlled keystore and recovery backup outside Git; never pass passwords
on the command line or store them in Gradle source.

Run `node scripts/build-android-release.mjs production` (or `synthetic`). It
ignores dotenv files, regenerates native configuration, bundles JS/assets,
builds arm64/x86_64 APKs with owner signing, verifies the signature and records
the source/hash under ignored `build/mobile/`. Release tasks fail without
owner signing; Expo's generated debug-signing default cannot qualify a release.

A successful build does not establish deployed backend compatibility, Clerk
Native API/callback readiness, standalone runtime or production acceptance.
Follow [the final-stack checklist](../../docs/testing/2026-11-17-cb-07-final-stack-qa.md)
before distribution. Never send the Metro-dependent debug artifact as a release.
