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
  'CB_CONNECT_RELEASE_RUN_ID="${base_run_id}-${project}" npx playwright test --config=playwright.release.config.ts e2e/release-smoke.spec.ts --project="$project"'
  'browser_path="$(command -v google-chrome)"'
  "printf 'PLAYWRIGHT_EXECUTABLE_PATH=%s\\n' \"\$browser_path\" >> \"\$GITHUB_ENV\""
  "grep -Eq '[1-9][0-9]* skipped'"
  'bash scripts/redact-release-artifacts.sh'
  'retention-days: 7'
)

for pattern in "${required_patterns[@]}"; do
  if ! grep -Fq "$pattern" "$workflow"; then
    echo "authenticated smoke workflow is missing required policy: $pattern" >&2
    exit 1
  fi
done

if grep -Fq 'playwright install --with-deps chromium' "$workflow"; then
  echo "authenticated smoke must use the runner image browser instead of downloading Chromium" >&2
  exit 1
fi

if grep -Eq -- '--project=release-desktop --project=release-mobile' "$workflow"; then
  echo "authenticated smoke must provision and tear down a distinct fixture run per browser project" >&2
  exit 1
fi

if ! grep -Fq 'await clerkSetup({' e2e/auth.global.teardown.ts; then
  echo "authenticated teardown must initialize the approved Clerk testing handshake" >&2
  exit 1
fi

if ! grep -Fq 'await clerk.signIn({' e2e/auth.global.teardown.ts ||
   ! grep -Fq 'cb-connect-e2e+${pair.runId}-primary@example.com' e2e/auth.global.teardown.ts; then
  echo "authenticated teardown must reauthenticate the exact deterministic primary fixture" >&2
  exit 1
fi

if grep -En 'continue-on-error:[[:space:]]*true|--pass-with-no-tests|test\.skip' "$workflow"; then
  echo "authenticated smoke must fail closed; skips and pass-with-no-tests are not allowed" >&2
  exit 1
fi

if ! test -x scripts/redact-release-artifacts.sh; then
  echo "missing executable redaction helper" >&2
  exit 1
fi

if grep -En 'test\.(skip|fixme|fail)' e2e/release-smoke.spec.ts; then
  echo "release smoke must contain no skipped, fixme or expected-failure tests" >&2
  exit 1
fi

if grep -En -A 8 'uses: actions/upload-artifact@' "$workflow" | grep -En 'e2e/\.auth|test-results|playwright-report'; then
  echo "authenticated smoke must not upload raw browser artifacts" >&2
  exit 1
fi

if grep -Fq 'apt-get install --yes ripgrep' "$workflow"; then
  echo "authenticated smoke must not install a package for policy checks" >&2
  exit 1
fi

echo "authenticated release-smoke workflow policy: PASS"
