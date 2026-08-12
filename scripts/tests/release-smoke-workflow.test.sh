#!/usr/bin/env bash
set -euo pipefail

workflow=".github/workflows/ci.yml"

if [[ ! -f "$workflow" ]]; then
  echo "missing CI workflow: $workflow" >&2
  exit 1
fi

required_patterns=(
  'authenticated-smoke:'
  'needs: qualify'
  'environment: cb-connect-auth-test'
  'CLERK_TEST_ENVIRONMENT_NAME: ${{ secrets.CLERK_TEST_ENVIRONMENT_NAME }}'
  'CLERK_TEST_SECRET_KEY: ${{ secrets.CLERK_TEST_SECRET_KEY }}'
  'NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY }}'
  'CLERK_TEST_FRONTEND_API_URL: ${{ secrets.CLERK_TEST_FRONTEND_API_URL }}'
  'CONVEX_TEST_DEPLOYMENT: ${{ secrets.CONVEX_TEST_DEPLOYMENT }}'
  'NEXT_PUBLIC_TEST_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_TEST_CONVEX_URL }}'
  'for project in release-desktop release-mobile'
  'CB_CONNECT_RELEASE_RUN_ID="${base_run_id}-${project}" npx playwright test e2e/release-smoke.spec.ts --project="$project"'
  'sudo apt-get update && sudo apt-get install --yes ripgrep'
  'bash scripts/redact-release-artifacts.sh'
  'retention-days: 7'
)

for pattern in "${required_patterns[@]}"; do
  if ! rg -Fq "$pattern" "$workflow"; then
    echo "authenticated smoke workflow is missing required policy: $pattern" >&2
    exit 1
  fi
done

if rg -q -- '--project=release-desktop --project=release-mobile' "$workflow"; then
  echo "authenticated smoke must provision and tear down a distinct fixture run per browser project" >&2
  exit 1
fi

if ! rg -Fq 'await clerkSetup({' e2e/auth.global.teardown.ts; then
  echo "authenticated teardown must initialize the approved Clerk testing handshake" >&2
  exit 1
fi

if ! rg -Fq 'await clerk.signIn({' e2e/auth.global.teardown.ts ||
   ! rg -Fq 'cb-connect-e2e+${pair.runId}-primary@example.com' e2e/auth.global.teardown.ts; then
  echo "authenticated teardown must reauthenticate the exact deterministic primary fixture" >&2
  exit 1
fi

if rg -n 'continue-on-error:[[:space:]]*true|--pass-with-no-tests|test\.skip' "$workflow"; then
  echo "authenticated smoke must fail closed; skips and pass-with-no-tests are not allowed" >&2
  exit 1
fi

if ! test -x scripts/redact-release-artifacts.sh; then
  echo "missing executable redaction helper" >&2
  exit 1
fi

if rg -n 'test\.(skip|fixme|fail)' e2e/release-smoke.spec.ts; then
  echo "release smoke must contain no skipped, fixme or expected-failure tests" >&2
  exit 1
fi

if rg -n -A 8 'uses: actions/upload-artifact@' "$workflow" | rg -n 'e2e/\.auth|test-results|playwright-report'; then
  echo "authenticated smoke must not upload raw browser artifacts" >&2
  exit 1
fi

echo "authenticated release-smoke workflow policy: PASS"
