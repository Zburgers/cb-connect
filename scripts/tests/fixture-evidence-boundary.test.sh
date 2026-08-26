#!/usr/bin/env bash
set -euo pipefail

teardown="e2e/auth.global.teardown.ts"

if ! grep -Fq 'CB_CONNECT_RELEASE_EVIDENCE_DIR' "$teardown"; then
  echo 'authenticated fixture teardown must support an external evidence directory' >&2
  exit 1
fi

if grep -Fq 'docs/evidence/reliability-gate-0' "$teardown"; then
  echo 'authenticated fixture teardown must not mutate tracked repository evidence during qualification' >&2
  exit 1
fi

if ! grep -Fq '/e2e/.evidence/' .gitignore; then
  echo 'default local authenticated QA evidence directory must remain untracked' >&2
  exit 1
fi

echo 'authenticated fixture evidence boundary: PASS'
