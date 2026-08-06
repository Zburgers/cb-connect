# Compatible release rollback runbook

## Scope

This runbook rolls the frontend back only to a previously recorded immutable
artifact whose backend compatibility version is still supported. It does not
change source history, delete the healthy process before a replacement is
ready, or restore production data. The rehearsal script is intentionally
limited to the approved synthetic target `dev:hallowed-hummingbird-284`.

## Release record

Every candidate release is represented by `release-manifest.json` next to its
checksum-verified tarball. The recorded pair is:

- frontend commit SHA, build ID and artifact checksum;
- frontend compatibility version;
- backend deployment selector and compatibility version;
- health/readiness result, listener/TLS result and persisted PM2 process state.

The pair is invalid if the frontend and backend compatibility versions differ,
if the artifact checksum fails, or if the backend selector is not the approved
target for the operation.

## Dry-run rehearsal

Run the bounded rehearsal with an explicit manifest and evidence path:

```bash
bash scripts/rehearse-rollback.sh \
  --dry-run \
  --deployment dev:hallowed-hummingbird-284 \
  --restore-target dev:hallowed-hummingbird-284 \
  --frontend-manifest /path/to/release-manifest.json \
  --backend-compatibility v1 \
  --output /path/to/rehearsal-evidence.json
```

The command verifies the artifact checksum and compatibility pair, then emits
timestamps and the D-007 objective fields. It does not contact Convex, PM2 or
the production host. The generated evidence must remain classified as
synthetic-only until a separately authorized fixture rehearsal executes the
provider-supported restore and integrity checks.

## Promotion rollback procedure

1. Stop promotion and record the failing release manifest, readiness response,
   listener state and PM2 persistence result without copying secrets.
2. Select a prior manifest whose frontend/backend compatibility pair is
   recorded and approved for the same environment.
3. Verify the prior tarball checksum with `scripts/package-release.sh --verify`.
4. Use the retained immutable candidate under
   `$CB_CONNECT_RELEASE_ROOT/releases/<commit>-<build-id>/extracted`; do not
   rebuild from a checkout or use `RUNNER_TEMP`. Point
   `CB_CONNECT_RELEASE_DIR` at that durable directory for
   `pm2 startOrReload pm2.config.js --update-env`.
5. Run `scripts/verify-release.sh` with the environment’s base URL, backend
   selector and compatibility version. Require HTTPS and PM2 persistence for
   production verification.
6. Update `$CB_CONNECT_RELEASE_ROOT/current` only after the restored candidate
   passes verification. Preserve the failed and restored manifest identities
   and open the incident response path if readiness, authenticated behavior or
   persistence remains unhealthy.

Rollback is complete only when the compatible pair is verified and the
operator records the result. A successful process restart alone is not
rollback evidence.
