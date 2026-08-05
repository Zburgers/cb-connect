# X1 isolated-development rollback and restore proof

- Recorded: 2026-08-06
- Deployment class: synthetic-only isolated development
- Approved target: `dev:hallowed-hummingbird-284`
- Focused test: `bash scripts/tests/rehearse-rollback.test.sh` — PASS
- Positive coverage: checksum-verified standalone artifact, matching `v1`
  frontend/backend compatibility pair, D-007 RPO/RTO fields, timestamps and
  explicit no-mutation evidence fields
- Negative coverage: production selector, unresolved target, compatibility
  mismatch and destructive action input — all rejected
- Restore status: dry-run only; no Convex export/import, production access or
  user data was used
- Qualification status: X1 implementation/policy PASS; measured restore RPO,
  RTO and integrity evidence remain unrecorded
