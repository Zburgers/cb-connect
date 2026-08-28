#!/usr/bin/env bash

set -euo pipefail

fail() {
  echo "cycle-state copy policy: $1" >&2
  exit 1
}

helper="components/dashboard/cycleStateCopy.ts"
source_paths=(
  "$helper"
  "components/dashboard/TipsCard.tsx"
  "components/dashboard/NutritionSuggestions.tsx"
  "convex/seed.ts"
)

dashboard_page="app/(dashboard)/dashboard/page.tsx"

[[ -f "$helper" ]] || fail "missing copy contract: $helper"

for path in "${source_paths[@]}"; do
  [[ -f "$path" ]] || fail "missing scoped source: $path"
done
[[ -f "$dashboard_page" ]] || fail "missing dashboard source: $dashboard_page"

if rg -n 'explicitReport[[:space:]]*=' "$dashboard_page"; then
  fail "phase-selected dashboard tips must not receive an explicit-report override"
fi

approval="$(sed -n 's/.*CYCLE_STATE_COPY_APPROVAL[^=]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$helper" | head -1)"
exposure="$(sed -n 's/.*CYCLE_STATE_COPY_EXPOSURE[^=]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$helper" | head -1)"

[[ -n "$approval" ]] || fail "copy approval status is not explicit"
[[ -n "$exposure" ]] || fail "copy exposure policy is not explicit"

if [[ "$exposure" == "ordinary_users" && "$approval" != "approved" ]]; then
  fail "ordinary-user exposure is enabled while copy approval is $approval"
fi

if rg -n -i -e 'NEXT_PUBLIC[^[:space:]]*CYCLE_STATE_COPY|process\.env[^[:space:]]*CYCLE_STATE_COPY' "${source_paths[@]}"; then
  fail "copy approval must not use a public environment flag"
fi

if rg -n -i -e 'mood|hormone|libido|fertil|pregnan|(^|[^[:alnum:]])pcos([^[:alnum:]]|$)|diagnos|confirmed[[:space:]-]+ovulation|ovulation[[:space:]-]+confirmed|partner[[:space:]]+(may|will|should|needs)' "${source_paths[@]}"; then
  fail "scoped copy contains a deterministic health or partner-behavior claim"
fi

for key in recorded calendarEstimate late unknown paused estimatedOvulationDisclaimer genericCheckIn; do
  rg -q "^[[:space:]]*$key:" "$helper" || fail "missing explicit copy key: $key"
done

echo "Gate 2 copy policy: PASS"
