#!/usr/bin/env bash
set -euo pipefail

script="scripts/convex-safe-exec"
chmod +x "$script"
chmod +x scripts/tests/fixtures/npx

run_rejected() {
  if env "$@" "$script" test --dry-run -- run queries/system:getBackendIdentity '{}'; then
    echo "expected rejection: $*" >&2
    exit 1
  fi
}

env CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 \
  "$script" test --dry-run -- run queries/system:getBackendIdentity '{}'

run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=prod:festive-malamute-715
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=production CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 CB_CONNECT_PRODUCTION_DEPLOYMENT=prod:festive-malamute-715
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 CONVEX_TEST_DEPLOYMENT=dev:other
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=malformed
run_rejected CB_CONNECT_CONVEX_CREDENTIAL_CLASS=production CONVEX_DEPLOY_KEY=redacted CONVEX_DEPLOYMENT=prod:festive-malamute-715
if env CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 \
  "$script" test --dry-run -- run --prod; then
  echo 'expected explicit production argument rejection' >&2
  exit 1
fi

env CB_CONNECT_CONVEX_CREDENTIAL_CLASS=production CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=prod:festive-malamute-715 CB_CONNECT_PROTECTED_EXECUTION=1 \
  "$script" production --dry-run -- run queries/system:getBackendIdentity '{}'

if env CB_CONNECT_CONVEX_CREDENTIAL_CLASS=production CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=prod:festive-malamute-715 "$script" production --dry-run -- run queries/system:getBackendIdentity '{}'; then
  echo 'expected protected production boundary rejection' >&2
  exit 1
fi

fake_operation_file="$(mktemp)"
if env PATH="$PWD/scripts/tests/fixtures:$PATH" \
  FAKE_CONVEX_IDENTITY='{"deployment":"prod:festive-malamute-715"}' \
  FAKE_CONVEX_OPERATION_FILE="$fake_operation_file" \
  FAKE_CONVEX_OPERATION_LOG=unexpected \
  CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 \
  "$script" test -- deploy; then
  echo 'expected effective production identity rejection' >&2
  exit 1
fi
if [[ -s "$fake_operation_file" ]]; then
  echo 'mutating command ran after effective identity mismatch' >&2
  exit 1
fi

env PATH="$PWD/scripts/tests/fixtures:$PATH" \
  FAKE_CONVEX_IDENTITY='{"deployment":"dev:hallowed-hummingbird-284"}' \
  FAKE_CONVEX_OPERATION_FILE="$fake_operation_file" \
  FAKE_CONVEX_OPERATION_LOG=approved \
  CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test CONVEX_DEPLOY_KEY=redacted \
  CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284 \
  "$script" test -- deploy
test "$(<"$fake_operation_file")" = approved

echo 'convex-safe-exec policy: PASS'
