# CB Connect testing map

## Current evidence

- Gate 1 branch qualification: `npm run test:unit -- --run` passed 27 files and
  181 tests on 2026-08-20.
- `npm run build` passed with non-secret process-only Convex/Clerk placeholders
  and generated all listed App Router routes; an isolated checkout without
  `NEXT_PUBLIC_CONVEX_URL` fails closed during prerender.
- `npm run typecheck` passed after the build. Run build before typecheck when
  `.next/types` is absent or being regenerated.
- `npm run test:cycle-facts-plan`, `npm run test:ci-workflow`, and
  `bash scripts/tests/deploy-workflow.test.sh` passed. `npm audit --omit=dev`
  reported zero vulnerabilities.
- `npx convex codegen` requires an authenticated/configured
  `CONVEX_DEPLOYMENT`; the checked-in generated API is retained and must be
  refreshed in a configured Convex environment before deployment.

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
- Gate 1 covers derived-ending separation and exact-fact eligibility; the
  broader rollover/late-state prediction model remains a Gate 2 concern
  (`issues.md`, `convex/_helpers/cycleCalculations.ts`).
