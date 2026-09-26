#!/usr/bin/env bash
set -euo pipefail

runner="scripts/run-gates-0-3-qa.sh"
temp_root="$(mktemp -d)"
trap 'rm -rf "$temp_root"' EXIT
fake_bin="$temp_root/bin"
mkdir -p "$fake_bin"

cat > "$fake_bin/npx" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "convex run queries/system:getBackendIdentity {}" ]]; then
  printf '%s\n' "${FAKE_CONVEX_IDENTITY:?}"
elif [[ "${1:-}" == "convex" ]]; then
  printf '%s\n' "$*" >> "${FAKE_CONVEX_OPERATIONS:?}"
  if [[ "${FAKE_FAIL_RESTORE_FLAG:-}" == "${4:-}" &&
        "${5:-}" == "false" &&
        -f "${FAKE_PLAYWRIGHT_LANES:?}" ]] &&
      [[ "$(wc -l < "$FAKE_PLAYWRIGHT_LANES")" -eq 4 ]]; then
    exit 71
  fi
elif [[ "${1:-}" == "playwright" ]]; then
  printf '%s|%s|%s|%s|%s|%s|%s|%s\n' \
    "${CB_CONNECT_RELEASE_RUN_ID:?}" \
    "${CB_CONNECT_RELEASE_AUTH_DIR:?}" \
    "${CB_CONNECT_RELEASE_EVIDENCE_DIR:?}" \
    "${CB_CONNECT_PERIOD_PREDICTION_EXPECTED:?}" \
    "${CB_CONNECT_PARTNER_PREDICTION_EXPECTED:?}" \
    "${CI:?}" \
    "${PLAYWRIGHT_BASE_URL:?}" \
    "$*" >> "${FAKE_PLAYWRIGHT_LANES:?}"
else
  echo "unexpected npx command" >&2
  exit 1
fi
MOCK
chmod +x "$fake_bin/npx"

run_qa() {
  local scenario="$1"
  local fail_flag="${2:-}"
  env -i \
    PATH="$fake_bin:$PATH" \
    CONVEX_DEPLOY_KEY='dev:hallowed-hummingbird-284|test-only' \
    CONVEX_TEST_DEPLOYMENT='dev:hallowed-hummingbird-284' \
    NEXT_PUBLIC_TEST_CONVEX_URL='https://hallowed-hummingbird-284.convex.cloud' \
    CLERK_TEST_ENVIRONMENT_NAME='holy clerk' \
    CLERK_TEST_SECRET_KEY='sk_test_placeholder' \
    NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY='pk_test_placeholder' \
    CLERK_TEST_FRONTEND_API_URL='https://holy-clam-29.clerk.accounts.dev' \
    FAKE_CONVEX_IDENTITY='{"deployment":"dev:hallowed-hummingbird-284"}' \
    FAKE_CONVEX_OPERATIONS="$temp_root/$scenario.convex.log" \
    FAKE_PLAYWRIGHT_LANES="$temp_root/$scenario.lanes.log" \
    FAKE_FAIL_RESTORE_FLAG="$fail_flag" \
    CB_CONNECT_QA_EVIDENCE_DIR="$temp_root/$scenario.evidence" \
    CB_CONNECT_QA_RUN_ID="policy-g3-$scenario" \
    bash "$runner"
}

run_qa success

convex_log="$temp_root/success.convex.log"
lanes_log="$temp_root/success.lanes.log"

if [[ "$(wc -l < "$lanes_log")" -ne 4 ]]; then
  echo "Gate 3 QA must run four isolated desktop/mobile feature lanes" >&2
  exit 1
fi

# Use the POSIX utility explicitly; hosted runners do not guarantee ripgrep.
if ! command grep -Fq -- "--reporter=list" "$runner"; then
  echo "Gate 3 prediction runs must avoid HTML reports that could retain health dates" >&2
  exit 1
fi

if [[ "$(cut -d '|' -f 1 "$lanes_log" | sort -u | wc -l)" -ne 4 ||
      "$(cut -d '|' -f 2 "$lanes_log" | sort -u | wc -l)" -ne 4 ||
      "$(cut -d '|' -f 3 "$lanes_log" | sort -u | wc -l)" -ne 4 ]]; then
  echo "Gate 3 lanes must not reuse fixture run ids, auth dirs, or evidence dirs" >&2
  exit 1
fi

for lane in \
  'prediction-v2-off-desktop|release-desktop|disabled|disabled' \
  'prediction-v2-off-mobile|release-mobile|disabled|disabled' \
  'prediction-v2-on-desktop|release-desktop|enabled|enabled' \
  'prediction-v2-on-mobile|release-mobile|enabled|enabled'; do
  lane_name="${lane%%|*}"
  project="${lane#*|}"
  project="${project%%|*}"
  expected="${lane##*|}"
  if ! awk -F '|' -v lane="$lane_name" -v project="$project" \
      -v expected="$expected" \
      '$1 ~ lane && $8 ~ ("--project=" project) && $4 == expected && $5 == expected && $6 == "true" && $7 == "http://127.0.0.1:3000" { found=1 } END { exit !found }' \
      "$lanes_log"; then
    echo "missing isolated Gate 3 QA lane: $lane_name" >&2
    exit 1
  fi
done

for flag in \
  CB_CONNECT_CYCLE_FACTS_V1 \
  CB_CONNECT_CYCLE_STATE_V1 \
  CB_CONNECT_PERIOD_PREDICTION_V2 \
  CB_CONNECT_PARTNER_PREDICTION_V2; do
  if ! awk -v flag="$flag" \
      '$1 == "convex" && $2 == "env" && $3 == "set" && $4 == flag { last=$5 } END { exit !(last == "false") }' \
      "$convex_log"; then
    echo "Gate 3 QA must restore $flag to false" >&2
    exit 1
  fi
done

if command grep -En 'test\.skip|\.skip\(' e2e/prediction-v2.spec.ts; then
  echo "Gate 3 authenticated prediction qualification must not silently skip cases" >&2
  exit 1
fi

if command grep -En 'npx[[:space:]]+convex[[:space:]]+env[[:space:]]+set|--prod|production' "$runner"; then
  echo "Gate 3 QA must use the guarded test target and never select production" >&2
  exit 1
fi

if run_qa restore-failure CB_CONNECT_PERIOD_PREDICTION_V2 \
    > "$temp_root/restore-failure.log" 2>&1; then
  echo "Gate 3 QA must fail when any flag restoration fails" >&2
  exit 1
fi

if ! command grep -Eq 'failed to restore CB_CONNECT_PERIOD_PREDICTION_V2 to false' \
    "$temp_root/restore-failure.log" ||
    ! tail -n 4 "$temp_root/restore-failure.convex.log" | awk '
      $1 == "convex" && $2 == "env" && $3 == "set" && $5 == "false" {
        order[++count] = $4
      }
      END {
        exit !(count == 4 &&
          order[1] == "CB_CONNECT_PARTNER_PREDICTION_V2" &&
          order[2] == "CB_CONNECT_PERIOD_PREDICTION_V2" &&
          order[3] == "CB_CONNECT_CYCLE_STATE_V1" &&
          order[4] == "CB_CONNECT_CYCLE_FACTS_V1")
      }'; then
  echo "Gate 3 QA must attempt every flag restoration and report failures" >&2
  exit 1
fi

echo "Gate 3 isolated QA runner policy: PASS"
