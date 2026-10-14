#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
safe_home="$root/safe"
mkdir -p "$safe_home/.pm2/logs"
chmod 0770 "$safe_home/.pm2"
chmod 0770 "$safe_home/.pm2/logs"
touch "$safe_home/.pm2/logs/cb-connect-out.log" "$safe_home/.pm2/logs/cb-connect-error.log"
chmod 0664 "$safe_home/.pm2/logs/cb-connect-out.log" "$safe_home/.pm2/logs/cb-connect-error.log"
HOME="$safe_home" python3 scripts/secure-pm2-logs.py
[[ "$(stat -c '%a' "$safe_home/.pm2")" == "750" ]]
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
if HOME="$unsafe_home" python3 scripts/secure-pm2-logs.py >/dev/null 2>&1; then
  echo "unsafe symlink log source was accepted" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$outside")" == "664" ]]

dangling_home="$root/dangling"
mkdir -p "$dangling_home/.pm2/logs"
ln -s "$root/missing.log" "$dangling_home/.pm2/logs/cb-connect-out.log"
if HOME="$dangling_home" python3 scripts/secure-pm2-logs.py >/dev/null 2>&1; then
  echo "dangling PM2 log symlink was accepted" >&2
  exit 1
fi

hardlink_home="$root/hardlink"
mkdir -p "$hardlink_home/.pm2/logs"
chmod 0770 "$hardlink_home/.pm2" "$hardlink_home/.pm2/logs"
hardlink_outside="$root/hardlink-outside.log"
touch "$hardlink_outside"
chmod 0664 "$hardlink_outside"
ln "$hardlink_outside" "$hardlink_home/.pm2/logs/cb-connect-out.log"
touch "$hardlink_home/.pm2/logs/cb-connect-error.log"
if HOME="$hardlink_home" python3 scripts/secure-pm2-logs.py >/dev/null 2>&1; then
  echo "hard-linked CB Connect log source was accepted" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$hardlink_outside")" == "664" ]]

fresh_home="$root/fresh"
mkdir -p "$fresh_home"
HOME="$fresh_home" python3 scripts/secure-pm2-logs.py
[[ "$(stat -c '%a' "$fresh_home/.pm2")" == "750" ]]
[[ "$(stat -c '%a' "$fresh_home/.pm2/logs")" == "750" ]]

symlink_home="$root/symlink-home"
outside_logs="$root/outside-logs"
mkdir -p "$symlink_home/.pm2" "$outside_logs"
chmod 0770 "$symlink_home/.pm2" "$outside_logs"
ln -s "$outside_logs" "$symlink_home/.pm2/logs"
if HOME="$symlink_home" python3 scripts/secure-pm2-logs.py >/dev/null 2>&1; then
  echo "unsafe PM2 logs directory symlink was accepted" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$outside_logs")" == "770" ]]

pm2_symlink_home="$root/pm2-symlink-home"
outside_pm2="$root/outside-pm2"
mkdir -p "$pm2_symlink_home" "$outside_pm2"
chmod 0770 "$outside_pm2"
ln -s "$outside_pm2" "$pm2_symlink_home/.pm2"
if HOME="$pm2_symlink_home" python3 scripts/secure-pm2-logs.py >/dev/null 2>&1; then
  echo "unsafe PM2 home symlink was accepted" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$outside_pm2")" == "770" ]]
echo "PM2 log ownership and mode contract: PASS"
