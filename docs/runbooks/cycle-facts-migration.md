# Cycle facts migration runbook

This runner is an internal, resumable compatibility tool for ambiguous legacy
`periodEvents` rows. It adds certainty/provenance metadata only; it never
changes `startDate` or `endDate`, deletes rows, or creates inferred endings.

## Safety contract

- The default mode is `dry_run`; it reports aggregate progress and performs no
  row writes.
- Annotation mode requires the server-attested
  `CB_CONNECT_MIGRATION_ATTESTED_ENVIRONMENT` (`dev`, `preview` or `staging`),
  `CB_CONNECT_MIGRATION_ATTESTED_DEPLOYMENT` and
  `CB_CONNECT_MIGRATION_ANNOTATION_CAPABILITY` must be the exact string `true`.
  The attested deployment must
  equal server `CB_CONNECT_BACKEND_DEPLOYMENT`; caller `targetDeployment` is a
  metadata/typo check only and never grants authorization.
- A production server identity, missing capability, identity mismatch or
  mismatched caller label fails closed. The run persists its attested identity
  and resume fails closed on attested identity drift. Do not run annotation
  against production until D-012 is approved, the target and recovery boundary
  are explicitly approved, and the separate exposure decision is recorded.
- Every discovery and user scan page is capped at 100 rows and stores opaque
  continuation state. Conflict work is indexed by end date against the current
  start: closed intervals that end earlier cannot remain overlap candidates,
  while open intervals use the far-future sentinel and remain candidates.
- Reusing a run ID resumes the same mode/target and attested identity; changing
  any of them is rejected. Persisted work rows make page-boundary replay
  idempotent, and final aggregate counts are read from the persisted run state.
- Outputs contain aggregate counts and progress only. Do not add identifiers,
  dates, notes, or row payloads to logs or evidence.

## Execution shape

1. Start a run with only its run ID to create a dry run.
2. Process batches with the returned opaque cursor. Keep `scheduleNext` false
   for an operator-controlled rehearsal, or set it true to request internal
   scheduler continuation after each bounded page.
3. Review aggregate reason counts and completion state.
4. For an approved non-production rehearsal, start a separate run with
   `mode: "annotate"` and the exact approved non-production selector.
5. Re-run the audit and compare aggregate reason counts. Preserve the original
   rows and dates as the compatibility boundary.

The implementation is private under `convex/internal/cycleFactsMigration.ts`;
it is not a browser or public API. There is no production promotion or
destructive cleanup step in this runbook.

## Authority baseline

- D-008: date-bearing writes use the validated device-local IANA timezone; the
  migration does not reinterpret stored date-only values through server UTC.
- D-009: approximate and `legacy_unknown` facts never become exact implicitly;
  primary correction or tombstone authority remains final.
- D-012: additive/default-off deployment is separate from blocked destructive
  migration, hard deletion, final retention behavior and production feature
  exposure.

## Latest local verification

The deterministic implementation checks were run at branch head
`dc838e1df382687e52c79941b7484b085159db3c`: unit, typecheck, inert-URL build,
policy, CI/deploy workflow, standalone runtime, PM2, release verification,
rollback rehearsal and bounded audit/migration tests passed. Convex codegen
was not run to completion because no deployment identity was configured.
