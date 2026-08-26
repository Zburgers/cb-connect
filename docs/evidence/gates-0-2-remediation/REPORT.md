# Gates 0–2 remediation incident preservation

## I0 status

**I0 remains open.** This file preserves the invalidated remediation incident
as evidence. It is not QA Run 2 evidence and does not authorize merge,
deployment, rollback, feature exposure, or production repair.

The fuller invalidated remediation report remains preserved at Git commit
`2fc028d9246cd958d60b59480245d810f8f81ecd`.

## Incident record

- Invalidated campaign commit: `2fc028d9246cd958d60b59480245d810f8f81ecd`.
- Command: `npx convex deploy --yes`, after a local check of
  `CONVEX_DEPLOYMENT=dev:hallowed-hummingbird-284`.
- Recorded time: `2026-08-21T15:25:55.414Z`.
- Convex CLI: `1.43.0` (the command reported an update from `1.43.0` to
  `1.45.0`).
- Sanitized result: the CLI selected
  `prod:festive-malamute-715`, uploaded functions, ran schema validation,
  finalized the push, and reported deployment complete.
- Blast-radius classification: **B — production backend received the
  unintended code push**, based on the retained CLI output. No owner-approved
  production deployment-history or backend-state inspection is retained here;
  this record does not claim the production state is safe.
- Selector-related environment names present in the command context:
  `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`.
- Local configuration file name present: `.env.local`.

No secret values, keys, tokens, cookies, storage state, user data, raw health
payloads, or raw cycle records are retained.

## Root cause boundary

The semantic precheck inspected an environment variable in an earlier shell
command. The subsequent Convex CLI invocation used stored/credential-selected
target state and selected production. Therefore the earlier precheck was not
an effective-target verification for the mutating command.

I0 requires all stateful Convex operations to use the repository-owned
`scripts/convex-safe-exec` wrapper, which binds mode, selector, credential
class, and immediate identity verification in one process.
