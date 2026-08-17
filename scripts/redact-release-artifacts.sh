#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:?output directory is required}"
exit_status="${2:?smoke exit status is required}"

if [[ ! "$exit_status" =~ ^[0-9]+$ ]]; then
  echo "invalid smoke exit status" >&2
  exit 1
fi

umask 077
mkdir -p "$output_dir"
printf '%s\n' \
  "CB Connect authenticated release smoke failed" \
  "exit_status: $exit_status" \
  "raw browser artifacts withheld by redaction policy" \
  "storage state, cookies, headers, identifiers, message text, dates and health values omitted" \
  > "$output_dir/summary.txt"
