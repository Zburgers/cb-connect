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
