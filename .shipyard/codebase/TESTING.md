# CB Connect testing map

## Current evidence

- Gates 1 and 2 are merged on `main` at `2f8dae22b6b2673c75e94d66985e749a303b92df`; the Gate 2 merge was qualified with the isolated authenticated Gates 0–2 matrix before merge.
- The older Gate 1 local qualification below is retained as historical context, not current branch status: `npm run test:unit -- --run` passed 27 files and 181 tests on 2026-08-20.
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
- Gate 2 now owns non-wrapping Recorded/Calendar estimate/Late/Unknown/Paused semantics. Gate 3 still needs personalized estimator, calibration, snapshot, segmentation, and shared serving-contract coverage.

## Gate 3 required test layers

- Pure interval derivation: eligibility, segmentation, partner-assisted starts, corrections, possible-missing-log reasons.
- Deterministic estimators: configured, all-history mean/median, last-three mean/median, recency half-life candidate.
- Benchmark harness: stable 60/20/20 user split, chronological walk-forward folds, future-leakage trap, subgroup metrics and manifest fail-closed behavior.
- Calibration/quality: point containment, 50/80 interval nesting, asymmetric residuals, variability-to-width monotonicity, insufficient-calibration fallback, internal score monotonicity.
- Persistence: immutable prediction snapshots plus append-only outcome/supersession assessments.
- Contract integration: V2 PredictionBounds through the existing Gate 2 reducer; flag-off must preserve Gate 2 V1 behavior.
- Privacy: reduced partner projection, segment/model diagnostic exclusion, share-off/revocation.
- Browser: isolated fresh primary/partner fixture per destructive desktop/mobile lane; no static skip.

Real benchmark outcome viewing is not a test prerequisite until D-013 is fully authorized. Synthetic/golden qualification must be runnable without production or real-user data.
