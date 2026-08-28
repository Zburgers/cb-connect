#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
plan_file="$repo_root/docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md"
plan_index="$repo_root/docs/plans/README.md"
decision_register="$repo_root/docs/decisions/major-release-decision-register.md"
evidence_report="$repo_root/docs/evidence/cycle-facts-gate-1/REPORT.md"
runbook="$repo_root/docs/runbooks/cycle-facts-migration.md"
release_config="$repo_root/playwright.release.config.ts"
package_file="$repo_root/package.json"

fail() {
  echo "Gate 1 plan policy: FAIL: $1" >&2
  exit 1
}

contains() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" || fail "missing expected text in ${file#"$repo_root/"}: $text"
}

not_contains() {
  local file="$1"
  local text="$2"
  ! grep -Fq -- "$text" "$file" || fail "forbidden text in ${file#"$repo_root/"}: $text"
}

[[ -f "$plan_file" ]] || fail "current implementation plan is missing"
[[ -f "$release_config" ]] || fail "release Playwright configuration is missing"

not_contains "$repo_root/convex/internal/cycleDataAudit.ts" '.filter('
not_contains "$repo_root/convex/internal/cycleFactsMigration.ts" '.filter('
not_contains "$repo_root/convex/internal/cycleDataAudit.ts" '.collect('
not_contains "$repo_root/convex/internal/cycleFactsMigration.ts" '.collect('

contains "$plan_file" '`CB_CONNECT_CYCLE_FACTS_V1` is Convex-only.'
contains "$plan_file" 'Unset or any value other than the'
contains "$plan_file" 'exact string `true` is disabled.'
contains "$plan_file" 'D-012 blocks destructive deletion/migration'
contains "$plan_file" 'production exposure'
contains "$plan_file" 'No production target'
contains "$plan_file" 'additive'

contains "$plan_index" 'D-012 blocks production exposure'
contains "$plan_index" 'D-008'
contains "$plan_index" 'D-009'

# These are durable release and authority invariants. Qualification status is
# intentionally kept out of the assertions so a truthful pending result cannot
# be mistaken for a policy failure or a green journey claim.
contains "$decision_register" 'Additive/default-off deployment is allowed; destructive migration, hard deletion, final retention behavior and production feature exposure remain blocked until D-012 is approved and the separate exposure decision is recorded.'
contains "$plan_file" 'Server-attested non-production identity is required for annotation;'
contains "$plan_file" 'caller targetDeployment is metadata/typo validation only.'
contains "$evidence_report" 'D-012 blocks destructive migration, hard deletion, final retention behavior'
contains "$evidence_report" 'additive/default-off deployment remains'
contains "$evidence_report" 'D-008: validated device-local IANA timezone is authoritative'
contains "$evidence_report" 'D-009: certainty remains explicit'
contains "$runbook" 'CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT'
contains "$runbook" 'D-008: date-bearing writes use the validated device-local IANA timezone'
contains "$runbook" 'D-009: approximate and `legacy_unknown` facts never become exact implicitly'
contains "$runbook" 'CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY` must be the exact string `true`'
contains "$runbook" 'resume fails closed on attested identity drift'
contains "$repo_root/convex/internal/cycleFactsMigration.ts" 'backendDeployment !== attestedDeployment'
contains "$repo_root/convex/internal/cycleFactsMigration.ts" 'environment.CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY !== "true"'
contains "$repo_root/convex/queries/history.ts" 'selectPredictionAnchor('
contains "$repo_root/convex/queries/history.ts" 'isCycleFactsV1Enabled() ? "cycle_facts_v1" : "legacy"'
contains "$repo_root/convex/_helpers/cycleFactEligibility.ts" 'isStartAnchorEligible'
not_contains "$repo_root/convex/internal/cycleFactsMigration.ts" 'ctx.db.delete("periodEvents"'

contains "$release_config" 'testMatch: "**/*.spec.ts"'
not_contains "$release_config" 'testMatch: "**/*.test.ts"'

if rg -n 'PROMOTE_PRODUCTION|DEPLOY_CONVEX|ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK' \
  "$repo_root/README.md" "$repo_root/DEPLOYMENT.md" "$repo_root/.github/workflows" 2>/dev/null; then
  fail 'active documentation still contains retired Gate 0 promotion switches'
fi

if rg -n 'NEXT_PUBLIC_CB_CONNECT_CYCLE_FACTS_V1' \
  "$repo_root/app" "$repo_root/convex" "$repo_root/lib" "$repo_root/.github" 2>/dev/null; then
  fail 'the cycle-facts flag is exposed through a public/client environment variable'
fi

contains "$package_file" '"test:cycle-facts-plan": "bash scripts/tests/cycle-facts-plan.test.sh"'

echo 'Gate 1 plan policy: PASS'
