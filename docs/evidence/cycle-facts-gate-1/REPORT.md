# Gate 1 trustworthy cycle facts — engineering qualification report

**Status:** additive implementation qualified locally; production exposure not
authorized

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

## Local evidence

The following evidence is retained on branch
`gate-1/trustworthy-cycle-facts`:

- `npm run test:cycle-facts-plan` — pass
- focused Convex fact semantics, invariants, mutations, migration, reads and
  capability tests — pass
- `npm run typecheck` — pass after generated API refresh
- `npx convex codegen` — pass
- `bash scripts/tests/deploy-workflow.test.sh` — pass
- `git diff --check` — required before handoff

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

This report does not authorize production enablement. Production remains
flag-off until authenticated desktop/mobile evidence is retained and the
separate exposure decision is approved. The automatic qualified-main workflow
may deploy the additive, backward-compatible code path; it must not enable a
production capability value or execute a destructive cycle-data migration.

## Required handoff artifacts

Retain redacted desktop and mobile Playwright results with zero skips, the
deployment-policy result, generated Convex API state, and the exact qualified
commit SHA. Do not retain storage states, tokens, user identifiers, dates,
health values or raw provider responses in this report.
