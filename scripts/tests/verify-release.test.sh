#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
fixture="$root/fixture"
output="$root/output"
mkdir -p "$fixture/.next/standalone" "$fixture/.next/static"
printf '%s\n' 'standalone server' > "$fixture/.next/standalone/server.js"
printf '%s\n' 'static asset' > "$fixture/.next/static/app.js"
(
  cd "$fixture"
  CB_CONNECT_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
  CB_CONNECT_BUILD_ID=verify-fixture \
  CB_CONNECT_COMPATIBILITY_VERSION=v1 \
  CB_CONNECT_BUILT_AT=2026-08-06T00:00:00Z \
  bash "$OLDPWD/scripts/package-release.sh" "$output"
)
manifest="$output/release-manifest.json"

cat > "$root/server.cjs" <<'NODE'
const fs = require("node:fs");
const http = require("node:http");
const mode = process.argv[2];
const port = Number(process.argv[3]);
const manifest = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const frontend = {
  commitSha: mode === "wrong-commit" ? "fedcba9876543210fedcba9876543210fedcba98" : manifest.commitSha,
  buildId: manifest.buildId,
  compatibilityVersion: mode === "mismatch" ? "v2" : manifest.compatibilityVersion,
  builtAt: manifest.builtAt,
};
const server = http.createServer((request, response) => {
  if (mode === "timeout" && request.url === "/api/ready") {
    setTimeout(() => response.end("late"), 10000);
    return;
  }
  response.setHeader("content-type", "application/json");
  if (request.url === "/api/health") {
    response.end(JSON.stringify({ status: "ok", service: "cb-connect", timestamp: manifest.builtAt }));
    return;
  }
  if (request.url === "/api/ready") {
    response.end(JSON.stringify({
      status: "ready",
      service: "cb-connect",
      frontend,
      backend: { deployment: "dev:hallowed-hummingbird-284", compatibilityVersion: "v1", deployedAt: manifest.builtAt },
      checks: { metadata: "pass", backend: "pass", compatibility: "pass" },
    }));
    return;
  }
  response.statusCode = 404;
  response.end("not found");
});
server.listen(port, "127.0.0.1");
NODE

port=6321
node "$root/server.cjs" valid "$port" "$manifest" >"$root/server.log" 2>&1 &
server_pid=$!
sleep 1

dump="$root/pm2-dump.json"
printf '%s\n' '[{"name":"cb-connect","pm2_env":{"status":"online"}}]' > "$dump"
PM2_PROCESS_NAME=cb-connect PM2_DUMP_PATH="$dump" bash scripts/verify-release.sh "$manifest" "http://127.0.0.1:$port" dev:hallowed-hummingbird-284 v1

run_expect_fail() {
  if "$@" >"$root/failure.log" 2>&1; then
    echo "expected verification failure did not occur: $*" >&2
    exit 1
  fi
}

for mode in wrong-commit mismatch; do
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  node "$root/server.cjs" "$mode" "$port" "$manifest" >"$root/server.log" 2>&1 &
  server_pid=$!
  sleep 1
  run_expect_fail bash scripts/verify-release.sh "$manifest" "http://127.0.0.1:$port" dev:hallowed-hummingbird-284 v1
done

kill "$server_pid" 2>/dev/null || true
wait "$server_pid" 2>/dev/null || true
node "$root/server.cjs" timeout "$port" "$manifest" >"$root/server.log" 2>&1 &
server_pid=$!
sleep 1
run_expect_fail env RELEASE_VERIFY_TIMEOUT_SECONDS=1 bash scripts/verify-release.sh "$manifest" "http://127.0.0.1:$port" dev:hallowed-hummingbird-284 v1

kill "$server_pid" 2>/dev/null || true
wait "$server_pid" 2>/dev/null || true
run_expect_fail bash scripts/verify-release.sh "$manifest" "http://127.0.0.1:6399" dev:hallowed-hummingbird-284 v1
run_expect_fail bash scripts/verify-release.sh "$manifest" "https://127.0.0.1:$port" dev:hallowed-hummingbird-284 v1

kill "$server_pid" 2>/dev/null || true
wait "$server_pid" 2>/dev/null || true
node "$root/server.cjs" valid "$port" "$manifest" >"$root/server.log" 2>&1 &
server_pid=$!
sleep 1
printf '%s\n' '[{"name":"other-process","pm2_env":{"status":"online"}}]' > "$dump"
run_expect_fail env PM2_PROCESS_NAME=cb-connect PM2_DUMP_PATH="$dump" bash scripts/verify-release.sh "$manifest" "http://127.0.0.1:$port" dev:hallowed-hummingbird-284 v1

kill "$server_pid" 2>/dev/null || true
wait "$server_pid" 2>/dev/null || true
echo "release verification policy: PASS"
