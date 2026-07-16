# Health Import Provenance and Deletion

| Field | Value |
|---|---|
| Status | Deferred discovery/specification; not approved for implementation |
| Owner | CB Connect product, mobile, backend, privacy, and health-content review |
| Earliest milestone | Mobile beta after the mobile decision record is promoted |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | Approved native client; spec 07 promotion; import job evidence; privacy and health-content review |
| Platforms considered | Apple HealthKit and Android Health Connect |

## Decision

If product evidence later justifies health-platform integration, begin with a
small read-only import. Never auto-share imported records, never write back in
the first release, and never treat imported data as more accurate merely because
it came from a platform or wearable.

This document records minimum safety architecture. It does not authorize SDK
installation, permission prompts, background sync, or collection.

## Promotion prerequisites

- A native mobile client is approved and passes its security/privacy gates.
- Users demonstrate a job that manual tracking cannot reasonably satisfy.
- Product names the minimum record types and retention purpose.
- Data inventory, privacy policy, app-store disclosures, processor inventory,
  export, deletion, and incident response include imported health data.
- Cycle-confidence logic can distinguish manual, assisted, imported,
  confirmed, and estimated records.
- Health-content and legal/privacy review approve the supported jurisdictions
  and copy.

## Candidate read-only scope

Start with menstruation period/flow only. Add one record type at a time after
measuring usefulness and permission comprehension. Sleep duration, resting
heart rate/HRV, basal body temperature, spotting, and ovulation tests are
separate opt-ins, not one bundled permission.

Do not import sexual activity, free-form medical notes, diagnoses, medication,
location, contacts, or unrelated workout data as implementation convenience.

## Provenance contract

Each normalized record requires:

```ts
type ImportedRecordIdentity = {
  ownerUserId: Id<"users">;
  sourcePlatform: "healthkit" | "health_connect";
  sourceRecordId: string;
  sourceRecordVersion?: string;
  sourceAppId?: string;
  recordedAt: number;
  startZoneOffsetMinutes?: number;
  endZoneOffsetMinutes?: number;
  importedAt: number;
  syncRunId: Id<"healthImportRuns">;
};
```

The unique identity is owner plus platform plus source record ID. A newer source
version may update the normalized copy while preserving an audit-safe version
transition. Provider identifiers and raw payloads must not enter analytics.

## Proposed storage boundaries

- `healthConnections`: owner, platform, permission scopes, connected/revoked
  times, last successful sync, and deletion status;
- `healthImportRuns`: connection, cursor/checkpoint, counts by result, status,
  start/end, and bounded error codes;
- `healthImportedRecords`: normalized minimum fields plus provenance identity;
- `healthImportTombstones`: source identity and deletion observation needed to
  prevent a deleted record from reappearing;
- derived projections store source revision, never an untraceable copy.

Tokens and platform credentials use secure device/platform storage or an
approved server secret boundary. They are never stored in general Convex
documents without an explicit reviewed need.

## Import and conflict rules

1. Request the narrowest permission immediately before the user starts the
   feature; denial leaves the rest of CB Connect usable.
2. Sync in bounded pages with a durable cursor/checkpoint and idempotent upsert.
3. Manual and partner-assisted records are never overwritten by import.
4. A possible duplicate is shown for owner review; source attribution remains
   visible.
5. Source deletion or permission revocation removes the imported copy according
   to the selected disconnect policy and invalidates derived projections.
6. Partial failure resumes from the last committed checkpoint.
7. Background sync stops immediately after disconnect, account deletion, or
   platform authorization loss.

## Sharing and consent

Imported data is owner-private by default. Existing phase, pain, assisted-write,
or Care Loop permissions do not authorize it. A later derived insight may be
shared only through a new explicit, recipient-specific consent snapshot that
names what is shared and for how long.

Partners cannot see whether an import connection, private record, sync failure,
or deletion exists. Notification previews never name a record type or value.

## Disconnect, export, and deletion

The owner can choose:

- stop future sync and keep imported copies;
- disconnect and delete imported copies;
- delete one imported record where platform rules permit;
- delete the CB Connect account and all imported copies.

The UI must state that deleting a CB Connect copy does not delete the source
platform record. Because the first release is read-only, CB Connect never claims
to have changed the platform source.

Deletion is an indexed, bounded, resumable job. Completion reconciles imported
records, tombstones, derived projections, queued events, notification payloads,
exports, and cached mobile data.

## Acceptance criteria for promotion

- [ ] Every record is attributable to owner, source, source ID/version, time,
  zone offset where available, and sync run.
- [ ] Repeated and resumed sync creates no duplicates.
- [ ] Manual records are never silently replaced.
- [ ] Imported records remain private until a separate explicit share.
- [ ] Disconnect immediately stops sync and offers understandable copy deletion.
- [ ] Account deletion removes imported copies and derived data with
  reconciliation evidence.
- [ ] Permission denial, partial permission, source deletion, cursor expiry,
  travel/timezone, and offline retry cases pass.
- [ ] App-store disclosures and in-product permission copy match actual access.

## Test strategy

Use platform adapter fixtures for create/update/delete, duplicate pages, version
conflicts, cursor reset, partial permissions, revoked permission, zone offsets,
and large histories. Run on-device tests for permission prompts, background
limits, reconnect, secure token storage, disconnect, export, and erasure. Server
tests prove partner queries and analytics never contain imported data.

## Rollout and rollback

Start with internal accounts and one record type per platform. Use connection-
level and record-type server flags. Monitor duplicate/conflict rates, deletion
reconciliation, permission abandonment, sync failures, and privacy reports.

Rollback disables new connections and sync, preserves owner access to existing
copies long enough to export/delete, and runs the approved cleanup policy. It
must not orphan credentials, restore deleted copies, or share imported data.

## Open decisions

1. Which single record type demonstrates enough value for the first discovery?
2. Are imported copies retained by default on disconnect or deleted by default?
3. Which platform metadata may be stored under Apple/Google terms at promotion
   time?
4. How are manual/import duplicates presented and resolved without claiming one
   source is correct?
5. Which jurisdictions and age groups are supported?

## Platform references

- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Android Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [Android Health Connect synchronize data](https://developer.android.com/health-and-fitness/health-connect/sync-data)
