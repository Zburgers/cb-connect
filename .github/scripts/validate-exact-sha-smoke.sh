#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ "${GITHUB_REPOSITORY,,}" == "zburgers/cb-connect" ]] || fail "Unexpected repository"
[[ "$GITHUB_REF" == "refs/heads/main" ]] || fail "Dispatch must run from main"
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Candidate SHA must be a full lowercase commit SHA"

case "$PR_NUMBER" in
  49)
    expected_head_ref="talon/issue-42"
    expected_base_ref="main"
    ;;
  50)
    expected_head_ref="rook/relationship-integrity-2026-09-27"
    expected_base_ref="main"
    ;;
  51)
    expected_head_ref="talon/issue-13"
    expected_base_ref="rook/relationship-integrity-2026-09-27"
    ;;
  *) fail "Only PRs 49, 50, and 51 are allowed" ;;
esac

pr="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}")"
[[ "$(jq -r '.state' <<<"$pr")" == "open" ]] || fail "Candidate PR must be open"
[[ "$(jq -r '.draft' <<<"$pr")" == "false" ]] || fail "Candidate PR must not be a draft"
[[ "$(jq -r '.merged' <<<"$pr")" == "false" ]] || fail "Candidate PR must not be merged"
[[ "$(jq -r '.head.repo.full_name | ascii_downcase' <<<"$pr")" == "zburgers/cb-connect" ]] || fail "Candidate must come from this repository"
[[ "$(jq -r '.base.repo.full_name | ascii_downcase' <<<"$pr")" == "zburgers/cb-connect" ]] || fail "Candidate base must come from this repository"
[[ "$(jq -r '.head.ref' <<<"$pr")" == "$expected_head_ref" ]] || fail "Candidate branch does not match the approved PR"
[[ "$(jq -r '.base.ref' <<<"$pr")" == "$expected_base_ref" ]] || fail "Candidate base branch does not match the approved merge order"
[[ "$(jq -r '.head.sha' <<<"$pr")" == "$CANDIDATE_SHA" ]] || fail "Candidate SHA is not the current PR head"

if [[ "$PR_NUMBER" == "51" ]]; then
  pr50="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/50")"
  [[ "$(jq -r '.state' <<<"$pr50")" == "open" ]] || fail "PR 50 must remain open while qualifying stacked PR 51"
  [[ "$(jq -r '.base.ref' <<<"$pr50")" == "main" ]] || fail "PR 50 must remain based on main"
  [[ "$(jq -r '.head.sha' <<<"$pr50")" == "$(jq -r '.base.sha' <<<"$pr")" ]] || fail "PR 51 must be based on the exact current PR 50 head"
fi

if [[ "$PR_NUMBER" == "50" ]]; then
  pr51="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/51")"
  [[ "$(jq -r '.state' <<<"$pr51")" == "open" ]] || fail "PR 51 must remain open while qualifying PR 50"
  [[ "$(jq -r '.base.sha' <<<"$pr51")" == "$CANDIDATE_SHA" ]] || fail "PR 51 must be based on the exact current PR 50 head"
fi

printf 'candidate_sha=%s\n' "$CANDIDATE_SHA" >> "$GITHUB_OUTPUT"
echo "Exact PR head and merge-order validation passed for #${PR_NUMBER} at ${CANDIDATE_SHA}."
