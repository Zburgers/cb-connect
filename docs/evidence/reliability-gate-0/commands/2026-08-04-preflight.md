# Gate 0 redacted preflight checks

**Captured:** 2026-08-04
**Purpose:** Redacted evidence index for the Gate 0 baseline refresh. This file intentionally stores results, not raw headers, cookies, environment values or command transcripts.

| Check | Command/evidence | Redacted result |
|---|---|---|
| Remote branch | `git ls-remote origin refs/heads/main` | `origin/main` resolved to `8c83406`. |
| Local checkout | `git status --short --branch`, `git show -s` | Dedicated branch `gate-0/reliability-2026-08-04` is clean at `8c83406`. |
| PR #8 | `gh pr view 8`, `gh run view 30852430557`, `gh run view 30852430655` | PR merged at `d3ef5a7`; CI passed; original deploy failed. |
| Recovery deployment | `gh run list --workflow deploy.yml`, `gh run view 30860139400` | Run succeeded for `c47211f`; no claim of coordinated Convex promotion. |
| Public TLS/liveness | `curl -I https://cb.nakshatraneuratech.dev/`, `curl .../api/health` | TLS and homepage returned 200; liveness returned 200 and the expected non-sensitive shape. |
| Public readiness | `curl .../api/ready` | Returned 404; endpoint is not deployed. |
| Host/process | SSH to `razor-crest`; PM2 list/show; `ss` | `cb-connect` online under PM2; listener `*:6050` owned by Next; PM2 startup enabled/active and dump present. No reboot performed. |
| Host-local endpoints | `curl http://127.0.0.1:6050/api/health` and `/api/ready` | Health 200; readiness 404. |
| Convex candidate | `npx convex function-spec --deployment festive-malamute-715` | Existing public functions are present; no release-identity query is present. Selector remains a candidate pending D-003 authority. |

## Safety review

No credentials, tokens, Clerk identifiers, user/couple identifiers, health values, message content or raw upstream response headers are stored here.
