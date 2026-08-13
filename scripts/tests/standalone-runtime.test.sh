#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f .next/standalone/server.js || ! -d .next/static ]]; then
  echo "standalone build output is missing" >&2
  exit 1
fi

runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/cb-connect-standalone-runtime.XXXXXX")"
log_path="$runtime_dir/server.log"
health_path="$runtime_dir/health.json"
ready_path="$runtime_dir/ready.json"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

cp -R .next/standalone/. "$runtime_dir/"
mkdir -p "$runtime_dir/.next"
cp -R .next/static "$runtime_dir/.next/static"
if [[ -d public ]]; then
  cp -R public "$runtime_dir/public"
fi

port="$(node -e 'const net=require("node:net"); const s=net.createServer(); s.listen(0,"127.0.0.1",()=>{console.log(s.address().port); s.close();});')"
(
  cd "$runtime_dir"
  env \
    NODE_ENV=production \
    HOSTNAME=127.0.0.1 \
    PORT="$port" \
    NEXT_PUBLIC_CONVEX_URL=https://127.0.0.1:1 \
    CB_CONNECT_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
    CB_CONNECT_BUILD_ID=standalone-runtime-test \
    CB_CONNECT_COMPATIBILITY_VERSION=v1 \
    CB_CONNECT_BUILT_AT=2026-08-13T00:00:00.000Z \
    node server.js >"$log_path" 2>&1
) &
server_pid=$!

ready_to_probe=false
for _ in {1..30}; do
  if curl -fsS --max-time 1 "http://127.0.0.1:$port/api/health" >"$health_path" 2>/dev/null; then
    ready_to_probe=true
    break
  fi
  sleep 1
done

if [[ "$ready_to_probe" != true ]]; then
  echo "standalone server did not expose health" >&2
  sed -n '1,120p' "$log_path" >&2 || true
  exit 1
fi

node - "$health_path" <<'NODE'
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (body.status !== "ok" || body.service !== "cb-connect" || typeof body.timestamp !== "string") {
  throw new Error("standalone health contract failed");
}
NODE

ready_status="$(curl -sS --max-time 3 -o "$ready_path" -w '%{http_code}' "http://127.0.0.1:$port/api/ready")"
test "$ready_status" = "200" || test "$ready_status" = "503"
node - "$ready_path" "$ready_status" <<'NODE'
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const status = process.argv[3];
if (body.service !== "cb-connect" || !body.checks) {
  throw new Error("standalone readiness response contract failed");
}
if (status === "200") {
  if (body.status !== "ready" || body.checks.metadata !== "pass" || body.checks.backend !== "pass" || body.checks.compatibility !== "pass") {
    throw new Error("standalone readiness success contract failed");
  }
} else if (body.status !== "not_ready") {
  throw new Error("standalone readiness failure contract failed");
}
NODE

echo "standalone runtime health/readiness smoke: PASS"
