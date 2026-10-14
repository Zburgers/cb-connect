#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
safe_home="$root/safe"
mkdir -p "$safe_home/.pm2/logs"
chmod 0770 "$safe_home/.pm2/logs"
touch "$safe_home/.pm2/logs/cb-connect-out.log" "$safe_home/.pm2/logs/cb-connect-error.log"
chmod 0664 "$safe_home/.pm2/logs/cb-connect-out.log" "$safe_home/.pm2/logs/cb-connect-error.log"
HOME="$safe_home" bash scripts/secure-pm2-logs.sh
[[ "$(stat -c '%a' "$safe_home/.pm2/logs")" == "750" ]]
[[ "$(stat -c '%a' "$safe_home/.pm2/logs/cb-connect-out.log")" == "644" ]]
[[ "$(stat -c '%a' "$safe_home/.pm2/logs/cb-connect-error.log")" == "644" ]]

unsafe_home="$root/unsafe"
mkdir -p "$unsafe_home/.pm2/logs"
chmod 0770 "$unsafe_home/.pm2/logs"
outside="$root/outside.log"
touch "$outside"
chmod 0664 "$outside"
ln -s "$outside" "$unsafe_home/.pm2/logs/cb-connect-out.log"
if HOME="$unsafe_home" bash scripts/secure-pm2-logs.sh >/dev/null 2>&1; then
  echo "unsafe symlink log source was accepted" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$outside")" == "664" ]]
echo "PM2 log ownership and mode contract: PASS"
