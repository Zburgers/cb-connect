#!/usr/bin/env bash
set -euo pipefail

# Qualification invariant: every destructive spec/project lane gets a fresh
# synthetic fixture pair and isolated storage state.

: "${CONVEX_DEPLOY_KEY:?missing CONVEX_DEPLOY_KEY}"
: "${CONVEX_TEST_DEPLOYMENT:?missing CONVEX_TEST_DEPLOYMENT}"
: "${NEXT_PUBLIC_TEST_CONVEX_URL:?missing NEXT_PUBLIC_TEST_CONVEX_URL}"
: "${CLERK_TEST_ENVIRONMENT_NAME:?missing CLERK_TEST_ENVIRONMENT_NAME}"
: "${CLERK_TEST_SECRET_KEY:?missing CLERK_TEST_SECRET_KEY}"
: "${NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY:?missing NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY}"
: "${CLERK_TEST_FRONTEND_API_URL:?missing CLERK_TEST_FRONTEND_API_URL}"

if [[ -n "${CB_CONNECT_CONVEX_CREDENTIAL_CLASS:-}" && "${CB_CONNECT_CONVEX_CREDENTIAL_CLASS}" != "test" ]]; then
  echo "refusing Gates 0-2 QA with a non-test Convex credential class" >&2
  exit 65
fi
export CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test

if [[ "${CONVEX_TEST_DEPLOYMENT}" != "dev:hallowed-hummingbird-284" ]]; then
  echo "refusing Gates 0-2 QA against an unapproved Convex deployment" >&2
  exit 65
fi
if [[ "${CLERK_TEST_ENVIRONMENT_NAME}" != "holy clerk" ]]; then
  echo "refusing Gates 0-2 QA against an unapproved Clerk environment" >&2
  exit 65
fi
if [[ -n "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "CONVEX_DEPLOYMENT must be unset for guarded QA execution" >&2
  exit 65
fi

qa_root="${CB_CONNECT_QA_EVIDENCE_DIR:-${RUNNER_TEMP:-/tmp}/cb-connect-gates-0-2-qa}"
mkdir -p "$qa_root"
summary_file="$qa_root/summary.tsv"
printf 'lane\tresult\texit_code\n' > "$summary_file"

base_run_id="${CB_CONNECT_QA_RUN_ID:-qa-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
if [[ ! "$base_run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$ ]]; then
  echo "CB_CONNECT_QA_RUN_ID is not a safe run id" >&2
  exit 64
fi

set_mode() {
  local facts="$1"
  local state="$2"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_FACTS_V1 "$facts"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_STATE_V1 "$state"
  bash scripts/convex-safe-exec test -- run queries/system:getBackendIdentity '{}'
}

restore_flags() {
  set +e
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_STATE_V1 false >/dev/null 2>&1
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_FACTS_V1 false >/dev/null 2>&1
}
trap restore_flags EXIT

run_lane() {
  local lane="$1"
  local spec="$2"
  local project="$3"
  local facts_expected="$4"
  local state_expected="$5"
  local lane_root="$qa_root/$lane"
  local run_id="${base_run_id}-${lane}"

  mkdir -p "$lane_root"
  printf '%s\n' \
    "lane=$lane" \
    "spec=$spec" \
    "project=$project" \
    "cycle_facts_expected=$facts_expected" \
    "cycle_state_expected=$state_expected" \
    > "$lane_root/lane.env"

  echo "=== Gates 0-2 QA lane: $lane ==="
  set +e
  CI= \
  CB_CONNECT_RELEASE_RUN_ID="$run_id" \
  CB_CONNECT_RELEASE_AUTH_DIR="$lane_root/auth" \
  CB_CONNECT_RELEASE_EVIDENCE_DIR="$lane_root/evidence" \
  CB_CONNECT_CYCLE_FACTS_EXPECTED="$facts_expected" \
  CB_CONNECT_CYCLE_STATE_EXPECTED="$state_expected" \
  npx playwright test \
    --config=playwright.release.config.ts \
    "$spec" \
    --project="$project"
  local status=$?
  set -e

  if (( status == 0 )); then
    printf '%s\tPASS\t0\n' "$lane" >> "$summary_file"
    return 0
  fi

  printf '%s\tFAIL\t%s\n' "$lane" "$status" >> "$summary_file"
  return "$status"
}

# Gate 0 and default-off compatibility. Every lane receives a fresh synthetic
# Clerk/Convex fixture so destructive journeys cannot contaminate later lanes.
set_mode false false
run_lane gate0-desktop e2e/release-smoke.spec.ts release-desktop disabled disabled
run_lane gate0-mobile e2e/release-smoke.spec.ts release-mobile disabled disabled
run_lane gate1-off-desktop e2e/cycle-facts.spec.ts release-desktop disabled disabled
run_lane gate1-off-mobile e2e/cycle-facts.spec.ts release-mobile disabled disabled
run_lane gate2-off-desktop e2e/cycle-state.spec.ts release-desktop disabled disabled
run_lane gate2-off-mobile e2e/cycle-state.spec.ts release-mobile disabled disabled

# Enabled Gate 1 + Gate 2 qualification. Again, each destructive suite/project
# gets a fresh fixture pair and independent storage state.
set_mode true true
run_lane gate1-on-desktop e2e/cycle-facts.spec.ts release-desktop enabled enabled
run_lane gate1-on-mobile e2e/cycle-facts.spec.ts release-mobile enabled enabled
run_lane gate2-on-desktop e2e/cycle-state.spec.ts release-desktop enabled enabled
run_lane gate2-on-mobile e2e/cycle-state.spec.ts release-mobile enabled enabled

echo "Gates 0-2 isolated authenticated matrix: PASS"
