#!/usr/bin/env bash
set -euo pipefail

: "${CONVEX_DEPLOY_KEY:?missing CONVEX_DEPLOY_KEY}"
: "${CONVEX_TEST_DEPLOYMENT:?missing CONVEX_TEST_DEPLOYMENT}"
: "${NEXT_PUBLIC_TEST_CONVEX_URL:?missing NEXT_PUBLIC_TEST_CONVEX_URL}"
: "${CLERK_TEST_ENVIRONMENT_NAME:?missing CLERK_TEST_ENVIRONMENT_NAME}"
: "${CLERK_TEST_SECRET_KEY:?missing CLERK_TEST_SECRET_KEY}"
: "${NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY:?missing NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY}"
: "${CLERK_TEST_FRONTEND_API_URL:?missing CLERK_TEST_FRONTEND_API_URL}"

if [[ -n "${CB_CONNECT_CONVEX_CREDENTIAL_CLASS:-}" && "${CB_CONNECT_CONVEX_CREDENTIAL_CLASS}" != "test" ]]; then
  echo "refusing Gates 0-3 QA with a non-test Convex credential class" >&2
  exit 65
fi
export CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test

if [[ "${CONVEX_TEST_DEPLOYMENT}" != "dev:hallowed-hummingbird-284" ]]; then
  echo "refusing Gates 0-3 QA against an unapproved Convex deployment" >&2
  exit 65
fi
if [[ "${CLERK_TEST_ENVIRONMENT_NAME}" != "holy clerk" ]]; then
  echo "refusing Gates 0-3 QA against an unapproved Clerk environment" >&2
  exit 65
fi
if [[ -n "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "CONVEX_DEPLOYMENT must be unset for guarded QA execution" >&2
  exit 65
fi

qa_root="${CB_CONNECT_QA_EVIDENCE_DIR:-${RUNNER_TEMP:-/tmp}/cb-connect-gates-0-3-qa}"
mkdir -p "$qa_root"
summary_file="$qa_root/summary.tsv"
printf 'lane\tresult\texit_code\n' > "$summary_file"

base_run_id="${CB_CONNECT_QA_RUN_ID:-qa-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
if [[ ! "$base_run_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,34}$ ]]; then
  echo "CB_CONNECT_QA_RUN_ID is not a safe run id" >&2
  exit 64
fi

set_mode() {
  local facts="$1"
  local state="$2"
  local prediction="$3"
  local partner="$4"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_FACTS_V1 "$facts"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_CYCLE_STATE_V1 "$state"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_PERIOD_PREDICTION_V2 "$prediction"
  bash scripts/convex-safe-exec test -- env set CB_CONNECT_PARTNER_PREDICTION_V2 "$partner"
  bash scripts/convex-safe-exec test -- run queries/system:getBackendIdentity '{}'
}

flags_restored=0
restore_flags() {
  local failed=0
  for flag in \
    CB_CONNECT_PARTNER_PREDICTION_V2 \
    CB_CONNECT_PERIOD_PREDICTION_V2 \
    CB_CONNECT_CYCLE_STATE_V1 \
    CB_CONNECT_CYCLE_FACTS_V1; do
    if ! bash scripts/convex-safe-exec test -- env set "$flag" false >/dev/null 2>&1; then
      printf 'failed to restore %s to false\n' "$flag" >&2
      failed=1
    fi
  done
  if (( failed == 0 )); then flags_restored=1; fi
  return "$failed"
}

finish() {
  local status=$?
  trap - EXIT
  if (( flags_restored == 0 )) && ! restore_flags; then
    echo "Gate 3 test flags may not be fully restored" >&2
    status=1
  fi
  exit "$status"
}
trap finish EXIT

run_lane() {
  local lane="$1"
  local project="$2"
  local expected="$3"
  local lane_root="$qa_root/$lane"
  local run_id="${base_run_id}-${lane}"
  local browser="${PLAYWRIGHT_EXECUTABLE_PATH:-/opt/google/chrome/chrome}"

  if [[ ! -x "$browser" ]]; then
    echo "approved Playwright browser executable is unavailable" >&2
    return 65
  fi

  mkdir -p "$lane_root"
  printf '%s\n' \
    "lane=$lane" \
    "project=$project" \
    "period_prediction_expected=$expected" \
    "partner_prediction_expected=$expected" \
    > "$lane_root/lane.env"

  echo "=== Gates 0-3 QA lane: $lane ==="
  set +e
  CI=true \
  PLAYWRIGHT_EXECUTABLE_PATH="$browser" \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  CB_CONNECT_RELEASE_RUN_ID="$run_id" \
  CB_CONNECT_RELEASE_AUTH_DIR="$lane_root/auth" \
  CB_CONNECT_RELEASE_EVIDENCE_DIR="$lane_root/evidence" \
  CB_CONNECT_PERIOD_PREDICTION_EXPECTED="$expected" \
  CB_CONNECT_PARTNER_PREDICTION_EXPECTED="$expected" \
  npx playwright test --reporter=list --retries=0 \
    --config=playwright.release.config.ts \
    e2e/prediction-v2.spec.ts \
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

# The off lane preserves Gate 1 and Gate 2 while disabling both Gate 3 surfaces.
set_mode true true false false
run_lane prediction-v2-off-desktop release-desktop disabled
run_lane prediction-v2-off-mobile release-mobile disabled

# Every project invocation gets a new Clerk pair and isolated auth/evidence dirs.
set_mode true true true true
run_lane prediction-v2-on-desktop release-desktop enabled
run_lane prediction-v2-on-mobile release-mobile enabled

if ! restore_flags; then
  echo "Gate 3 test flags could not be restored" >&2
  exit 1
fi

echo "Gates 0-3 isolated authenticated matrix: PASS"
