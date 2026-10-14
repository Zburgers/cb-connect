#!/usr/bin/env bash
set -euo pipefail

home="${HOME:?HOME is required}"
pm2_home="${PM2_HOME:-$home/.pm2}"
if [[ "$pm2_home" != "$home/.pm2" || -L "$pm2_home" || ! -d "$pm2_home" ]]; then
  echo "PM2 home does not match the approved user log root" >&2
  exit 1
fi

log_dir="$pm2_home/logs"
owner="$(id -u)"
if [[ -L "$log_dir" || ! -d "$log_dir" ]] || [[ "$(stat -c '%u' -- "$pm2_home")" != "$owner" || "$(stat -c '%u' -- "$log_dir")" != "$owner" ]]; then
  echo "PM2 log directory has an unsafe type or owner" >&2
  exit 1
fi
chmod go-w -- "$log_dir"

for log_file in "$log_dir/cb-connect-out.log" "$log_dir/cb-connect-error.log"; do
  if [[ -e "$log_file" || -L "$log_file" ]]; then
    if [[ -L "$log_file" || ! -f "$log_file" ]] || [[ "$(stat -c '%u' -- "$log_file")" != "$owner" ]]; then
      echo "CB Connect log file has an unsafe type or owner" >&2
      exit 1
    fi
    chmod go-w -- "$log_file"
  fi
done
