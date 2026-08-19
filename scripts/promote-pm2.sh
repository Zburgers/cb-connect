#!/usr/bin/env bash
set -euo pipefail

process_name="${PM2_PROCESS_NAME:-cb-connect}"
release_dir="${CB_CONNECT_RELEASE_DIR:?CB_CONNECT_RELEASE_DIR is required}"
expected_script="$release_dir/server.js"

if [[ ! -f "$expected_script" ]]; then
  echo "immutable release server is missing: $expected_script" >&2
  exit 1
fi

current_script="$(
  pm2 jlist | node -e '
    const processName = process.argv[1];
    const entries = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    const entry = entries.find((candidate) => candidate && candidate.name === processName);
    process.stdout.write(entry?.pm2_env?.pm_exec_path || "");
  ' "$process_name"
)"

if [[ -n "$current_script" && "$current_script" == "$expected_script" ]]; then
  pm2 startOrReload pm2.config.js --update-env
else
  # PM2 does not replace an existing process definition when startOrReload is
  # pointed at a changed ecosystem script. Remove only the named app so a
  # legacy `npm run start` process cannot survive the immutable promotion.
  if [[ -n "$current_script" ]]; then
    pm2 delete "$process_name"
  fi
  pm2 start pm2.config.js --update-env
fi

pm2 jlist | node -e '
  const processName = process.argv[1];
  const expectedScript = process.argv[2];
  const entries = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  const entry = entries.find((candidate) => candidate && candidate.name === processName);
  if (
    !entry ||
    entry.pm2_env?.status !== "online" ||
    entry.pm2_env?.pm_exec_path !== expectedScript
  ) {
    throw new Error("PM2 did not start the expected immutable release");
  }
' "$process_name" "$expected_script"
