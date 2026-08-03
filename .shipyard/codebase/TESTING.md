# CB Connect testing map

## Current evidence

- Vitest/Convex unit suite: 5 files and 27 tests passed in the baseline run on 2026-08-01.
- `npm run build` passed and generated all listed App Router routes on 2026-08-01.
- `npm run typecheck` must be run after the build when `.next/types` is absent or being regenerated; the first parallel baseline run raced that generated directory and failed with TS6053 missing `.next/types` files.

## Test layers

- Pure/shared behavior is covered by `lib/*.test.mjs` and `convex/_helpers/*test.ts`.
- Convex public behavior is exercised with `convex-test` in `convex/**/*.test.ts`.
- Critical browser journeys are represented by Playwright specs in `e2e/`: onboarding, partner linking, signup reproduction, and authenticated couple chat.
- Authenticated two-user browser and production Convex verification require Clerk/Convex credentials and are not proven by the local unauthenticated checks.

## Required flow gates

For changes affecting auth, onboarding, linking, sharing, logging, or chat, run unit tests, typecheck, build, then the relevant Playwright spec with configured auth state. Confirm both users' authorization and real-time state transitions; do not infer them from a green build.

## Known gaps

- The checked-in E2E suite depends on external Clerk state and fixtures (`e2e/fixtures.ts`, `playwright.config.ts`).
- The tracker records pending authenticated two-user production smoke coverage for the chat state path (`issues.md`).
- Cron prediction behavior has implementation coverage gaps and needs a dedicated test/manual verification path (`issues.md`, `convex/actions/notifications.ts`).
