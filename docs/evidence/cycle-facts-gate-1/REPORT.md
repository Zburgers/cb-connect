# Gate 1 trustworthy cycle facts — engineering qualification report

**Status:** implementation complete; deterministic qualification passed;
authenticated qualification pending; Gate 1 not qualified and production
exposure blocked

**Pull request:** [#35](https://github.com/Zburgers/cb-connect/pull/35) — draft
review and protected qualification pending

**Local qualification implementation SHA:** `8ee068eb8bae7509a0da513a522f28262e156347`

This SHA is the exact code head used for the deterministic checks below. The
current branch head is later because it adds only the local Clerk keyless
artifact ignore rule; that change does not alter application behavior.

**Scope:** Convex-only `CB_CONNECT_CYCLE_FACTS_V1`, default-off behavior,
certainty-aware reads, bounded legacy metadata, partner authority and
authenticated release journeys.

## Implementation boundary

- New schema fields are optional and backward-compatible with existing rows.
- Legacy rows are read as `legacy_unknown`; no production destructive migration
  or hard deletion is part of this release.
- The capability is evaluated only in Convex. No public frontend environment
  mirror is permitted.
- Flag-off behavior keeps the existing UI and read paths available.
- Flag-off rollback is the approved reversible action; it does not delete or
  reverse cycle data.
- D-012 blocks destructive migration, hard deletion, final retention behavior
  and production feature exposure; additive/default-off deployment remains
  separate.
- D-008: validated device-local IANA timezone is authoritative for date-bearing
  writes; no silent UTC fallback is allowed for an identified user.
- D-009: certainty remains explicit, approximate values are not implicitly
  promoted, and primary correction or tombstone authority is final.

## Local evidence

The following evidence is retained on branch
`gate-1/trustworthy-cycle-facts`:

- `npm run test:unit -- --run` — pass, 29 files and 207 tests
- `npm run typecheck` — pass
- inert-URL `npm run build` — pass
- `npm run test:cycle-facts-plan` — pass
- `bash scripts/tests/ci-workflow.test.sh` — pass
- `bash scripts/tests/deploy-workflow.test.sh` — pass
- `bash scripts/tests/standalone-runtime.test.sh` — pass
- `bash scripts/tests/pm2-config.test.sh` — pass
- `bash scripts/tests/verify-release.test.sh` — pass
- `bash scripts/tests/rehearse-rollback.test.sh` — pass
- `npx playwright test e2e/cycle-facts.spec.ts --config=playwright.release.config.ts --list` — pass, 2 collected tests across desktop/mobile
- `git diff --check` — pass
- `npx convex codegen` — blocked because `CONVEX_DEPLOYMENT` is unset; no
  deployment or secret was supplied
- local server health smoke — pass; readiness could not establish backend
  connectivity with inert qualification URLs; the server was stopped cleanly

The two release E2E journeys collect successfully, but the approved fixture
inputs are unavailable in this shell (`CLERK_TEST_ENVIRONMENT_NAME`, Clerk
credentials, Convex deployment and expected flag mode are unset). Authenticated
qualification therefore remains fixture-stage blocked; no desktop/mobile
journey or zero-skip qualification claim is made.

The exact command for authenticated release qualification is:

```text
npm run test:e2e:release -- e2e/cycle-facts.spec.ts --project=release-desktop --project=release-mobile
```

The spec fails closed unless `CB_CONNECT_CYCLE_FACTS_EXPECTED` is explicitly
set to `enabled` or `disabled`. The approved isolated Clerk/Convex fixture
environment is required; missing credentials, fixture state or target
identity are failures, never skips. Run the enabled and flag-off modes against
the approved non-production deployment as separately retained qualification
artifacts.

## Release and rollout decision

This report does not qualify Gate 1 or authorize production enablement.
Production remains flag-off until authenticated desktop/mobile evidence is
retained, D-012 is approved, and the separate exposure decision is recorded.
The automatic qualified-main workflow may deploy the additive,
backward-compatible code path; it must not enable a production capability
value or execute a destructive cycle-data migration.

## Required handoff artifacts

Retain redacted desktop and mobile Playwright results with zero skips, the
deployment-policy result, generated Convex API state, and the exact qualified
commit SHA. Do not retain storage states, tokens, user identifiers, dates,
health values or raw provider responses in this report.

## Gate 2 handoff

The stacked Gate 2 PR #36 head is `96357af` over the current Gate 1 branch
head `0a5fc10`. It remains provisional until PR #35 is approved/merged and
the resulting final base is verified and fully requalified; this report does
not qualify the Gate 2 stack.
