#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
plan_file="$repo_root/docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md"
plan_index="$repo_root/docs/plans/README.md"
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

contains "$plan_file" '**Status:** Implemented and locally qualified on 2026-08-20'
contains "$plan_file" '`CB_CONNECT_CYCLE_FACTS_V1` is Convex-only.'
contains "$plan_file" 'Unset or any value other than the'
contains "$plan_file" 'exact string `true` is disabled.'
contains "$plan_file" 'D-012 blocks hard deletion, destructive migration, final retention-duration'
contains "$plan_file" 'It does not block an'
contains "$plan_file" 'additive tombstone, compatibility reads, dry runs, or synthetic migration'
contains "$plan_file" 'absence of active Gate 0 approval requirements'

contains "$plan_index" 'Gate 1 additive implementation is locally'
not_contains "$plan_index" 'Gate 1 remains blocked'
not_contains "$plan_index" 'Gate 1 is blocked'

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
