# Synthetic backup and restore runbook

## Approved boundary

D-007 permits only synthetic data in the isolated Convex deployment
`dev:hallowed-hummingbird-284` for the initial rehearsal. The sole project
owner is the backup/restore owner and recovery approver. Production selectors,
production exports and real-user data are out of scope.

The initial objectives are RPO 24 hours and RTO four hours. These are approved
objectives, not achieved measurements.

## Before the rehearsal

Record the start time, source and target selectors classified by environment,
the compatible frontend/backend release pair, the synthetic fixture version,
and the provider-supported export/import procedure for the selected Convex
environment. Confirm that the target is disposable and access restricted.

Run the non-mutating policy rehearsal first:

```bash
bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:hallowed-hummingbird-284 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest /path/to/release-manifest.json \
  --backend-compatibility v1 \
  --output /path/to/rehearsal-evidence.json
```

The script is a guardrail and evidence formatter. It does not perform the
provider export or import. Any actual fixture restore requires an explicit
operator-approved execution, redacted command output and a new log entry.

## Integrity and timing checks

After a separately authorized synthetic restore, record:

- source snapshot time, restore start/end and measured RPO/RTO;
- expected synthetic users and couples are present;
- records are schema-readable;
- authorization boundaries prevent cross-couple access;
- no unexpected cross-couple data or notification content is present;
- the frontend/backend compatibility pair still passes readiness.

Do not record user IDs, tokens, message text, period history, notes, pain
values or notification content in the evidence. If any integrity check fails,
stop recovery promotion, retain only redacted evidence, and open the incident
response path.

## Exit

The rehearsal is complete only when the measured RPO/RTO are compared with 24
hours/four hours, every integrity check is recorded, the operator approves the
result, and the evidence identifies the exact environment and release pair.
