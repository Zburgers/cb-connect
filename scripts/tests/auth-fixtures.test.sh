#!/usr/bin/env bash

set -euo pipefail

approved_paths=(
  "e2e/fixtures.ts"
  "e2e/signup-repro.spec.ts"
)

for path in "${approved_paths[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "missing approved fixture path: $path" >&2
    exit 1
  fi
done

if rg -n '123maleaccount|Test123!@#|male@cbconnect\.com|test\.(primary|partner)\.' "${approved_paths[@]}"; then
  echo "approved release-fixture paths must not contain fixed account or password values" >&2
  exit 1
fi

if rg -n 'test\.skip|CB_CONNECT_AUTH_STATE' "${approved_paths[@]}"; then
  echo "approved release-fixture paths must fail closed, not conditionally skip" >&2
  exit 1
fi

if ! rg -q 'getApprovedReleaseFixture|CB_CONNECT_RELEASE_PRIMARY_STORAGE_STATE' e2e/fixtures.ts e2e/signup-repro.spec.ts; then
  echo "approved release-fixture paths must use the run-scoped storage-state interface" >&2
  exit 1
fi

if ! rg -q 'throw new Error' e2e/fixtures.ts; then
  echo "missing approved fixture state must fail closed" >&2
  exit 1
fi

if git ls-files 'e2e/**' | rg -n '(^|/)(\.auth|auth-state|storage-state)/|(^|/).*(auth|storage)[-_]state.*\.json$'; then
  echo "generated authentication state must not be tracked" >&2
  exit 1
fi

for ignored_path in "/e2e/.auth/" "/e2e/auth-state/" "/e2e/storage-state/"; do
  if ! rg -q "^\\${ignored_path}$" .gitignore; then
    echo "missing generated-auth ignore rule: $ignored_path" >&2
    exit 1
  fi
done

echo "approved release-fixture credential and skip policy: PASS"
