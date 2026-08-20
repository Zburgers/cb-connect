# Cycle facts migration runbook

This runner is an internal, resumable compatibility tool for ambiguous legacy
`periodEvents` rows. It adds certainty/provenance metadata only; it never
changes `startDate` or `endDate`, deletes rows, or creates inferred endings.

## Safety contract

- The default mode is `dry_run`; it reports aggregate progress and performs no
  row writes.
- Annotation mode requires an explicit non-production Convex deployment
  selector such as `dev:<deployment>`, `preview:<deployment>`, or
  `staging:<deployment>`.
- A `prod:` selector is rejected. Do not run annotation against production
  until the owner approves the target, recovery boundary, and retention
  decision under D-012.
- Every batch is capped at 100 rows and stores an opaque continuation cursor.
- Reusing a run ID resumes the same mode/target; changing either is rejected.
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
