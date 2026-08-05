#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 MANIFEST BASE_URL EXPECTED_BACKEND_DEPLOYMENT EXPECTED_COMPATIBILITY" >&2
  exit 2
}

[[ $# -eq 4 ]] || usage
manifest_path="$1"
base_url="${2%/}"
expected_backend_deployment="$3"
expected_compatibility="$4"

if [[ ! "$base_url" =~ ^https?://[^/]+(/[^/]*)?$ ]]; then
  echo "release verification base URL is invalid" >&2
  exit 1
fi
if [[ "${RELEASE_REQUIRE_TLS:-false}" == "true" && "$base_url" != https://* ]]; then
  echo "release verification requires HTTPS" >&2
  exit 1
fi
if [[ -z "$expected_backend_deployment" || ! "$expected_compatibility" =~ ^v[0-9]+$ ]]; then
  echo "release verification target contract is invalid" >&2
  exit 1
fi

bash scripts/package-release.sh --verify "$manifest_path" >/dev/null

timeout_seconds="${RELEASE_VERIFY_TIMEOUT_SECONDS:-5}"
if [[ ! "$timeout_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "release verification timeout is invalid" >&2
  exit 1
fi

evidence_dir="$(mktemp -d "${TMPDIR:-/tmp}/cb-connect-release-verify.XXXXXX")"
health_file="$evidence_dir/health.json"
ready_file="$evidence_dir/ready.json"

if ! curl -fsS --max-time "$timeout_seconds" "$base_url/api/health" >"$health_file" 2>/dev/null; then
  echo "release health check failed" >&2
  exit 1
fi
if ! node - "$health_file" >/dev/null 2>&1 <<'NODE'
const fs = require('node:fs');
const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (value.status !== 'ok' || value.service !== 'cb-connect' || typeof value.timestamp !== 'string') {
  throw new Error('health contract mismatch');
}
if (Number.isNaN(Date.parse(value.timestamp))) throw new Error('health timestamp invalid');
NODE
then
  echo "release health contract failed" >&2
  exit 1
fi

if ! curl -fsS --max-time "$timeout_seconds" "$base_url/api/ready" >"$ready_file" 2>/dev/null; then
  echo "release readiness check failed" >&2
  exit 1
fi
if ! node - "$ready_file" "$manifest_path" "$expected_backend_deployment" "$expected_compatibility" >/dev/null 2>&1 <<'NODE'
const fs = require('node:fs');
const ready = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const manifest = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const expectedDeployment = process.argv[4];
const expectedCompatibility = process.argv[5];
if (ready.status !== 'ready' || ready.service !== 'cb-connect') throw new Error('readiness status mismatch');
const frontend = ready.frontend || {};
if (frontend.commitSha !== manifest.commitSha || frontend.buildId !== manifest.buildId || frontend.compatibilityVersion !== manifest.compatibilityVersion || frontend.compatibilityVersion !== expectedCompatibility) {
  throw new Error('frontend release metadata mismatch');
}
const backend = ready.backend || {};
if (backend.deployment !== expectedDeployment || backend.compatibilityVersion !== expectedCompatibility) {
  throw new Error('backend identity mismatch');
}
const checks = ready.checks || {};
if (checks.metadata !== 'pass' || checks.backend !== 'pass' || checks.compatibility !== 'pass') {
  throw new Error('readiness checks did not pass');
}
NODE
then
  echo "release readiness contract failed" >&2
  exit 1
fi

if [[ -n "${PM2_PROCESS_NAME:-}" ]]; then
  dump_path="${PM2_DUMP_PATH:-${HOME:-}/.pm2/dump.pm2}"
  if [[ ! -f "$dump_path" ]]; then
    echo "PM2 persistence evidence is missing" >&2
    exit 1
  fi
  if ! node - "$dump_path" "$PM2_PROCESS_NAME" >/dev/null 2>&1 <<'NODE'
const fs = require('node:fs');
const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const processName = process.argv[3];
if (!Array.isArray(dump) || !dump.some((entry) => entry && entry.name === processName && entry.pm2_env && entry.pm2_env.status === 'online')) {
  throw new Error('PM2 process is not online and persisted');
}
NODE
  then
    echo "PM2 persistence contract failed" >&2
    exit 1
  fi
fi

echo "release verification: PASS"
