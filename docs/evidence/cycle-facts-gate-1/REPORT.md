# Gate 1 trustworthy cycle facts — engineering qualification report

**Status:** implementation complete; deterministic qualification passed;
authenticated qualification pending; Gate 1 not qualified and production
exposure blocked

**Pull request:** [#35](https://github.com/Zburgers/cb-connect/pull/35) — draft
review and protected qualification pending

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

- `npm run test:cycle-facts-plan` — pass
- focused Convex fact semantics, invariants, mutations, migration, reads and
  capability tests — pass
- `npm run typecheck` — pass against the committed generated definitions
- `npx convex codegen` — blocked in this local shell because
  `CONVEX_DEPLOYMENT` is unset; no deployment or secret was supplied
- `bash scripts/tests/deploy-workflow.test.sh` — pass
- `git diff --check` — required before handoff
- Protected CI run `32394057909` deterministic qualification — pass (build,
  post-build typecheck, unit tests and dependency policy).
- The same run's authenticated release smoke stopped fail-closed during
  `auth.global.setup.ts` link fixture setup with
  `authenticated_fixture_setup_failed`; no authenticated product journey is
  claimed from that run and no zero-skip desktop/mobile evidence exists.

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
