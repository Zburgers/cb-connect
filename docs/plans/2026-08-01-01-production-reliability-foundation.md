# Production Reliability Foundation Implementation Plan

> **Codex/Shipyard execution:** Use the native `shipyard:shipyard-executing-plans` skill with the linked detailed execution plan.

**Goal:** Make every CB Connect release identifiable, test-gated, observable, reversible and governed by measured reliability evidence.

**Architecture:** GitHub Actions qualifies immutable frontend and Convex versions before progressive deployment. Readiness verifies both services and exposes non-sensitive version identity. Deterministic authenticated fixtures, operational runbooks and an approved SLO/error-budget policy replace build-only confidence.

**Tech Stack:** GitHub Actions, Next.js route handlers, Convex, Clerk test users, Playwright, Vitest, PM2.

---

**Program:** [Major-release roadmap](2026-08-01-cb-connect-major-release-program.md)

**Research:** [Reliability findings](../research/2026-08-01-major-release-cycle-trust-research.md#52-reliability-program-research)

**Next gate:** [Trustworthy cycle facts](2026-08-01-02-trustworthy-cycle-facts.md)

**Detailed execution plan:** [2026-08-04 Gate 0 execution plan](2026-08-04-00-production-reliability-execution.md)

**Planning status:** Historical gate-level work packages. The task-sized
implementation packet is closed and its current outcome is the explicit
**[BLOCKED Gate 0 report](../evidence/reliability-gate-0/REPORT.md)**. Do not
execute R1-R7 directly or reopen them as a local queue. Gate 0 can progress
only through the missing direct authenticated-CI, production, recovery and
28-day baseline evidence, followed by an approved report. Gate 1 is blocked
until that approval exists.

## Entry criteria

- Production host, `main` branch, PM2 process and Convex deployment are read-only verified.
- Existing user changes in the checkout are preserved.
- Active deployment/E2E/dependency issues in `issues.md` are linked to this gate.
- A release operator is named before production rollout.

## Implementation tasks

<task id="R1" name="Expose immutable frontend and backend release identity">
  <description>Add typed build metadata and readiness output that identifies the frontend commit, build, Convex deployment/version and timestamp without exposing secrets.</description>
  <files>
    <create>lib/releaseInfo.ts</create>
    <create>convex/queries/system.ts</create>
    <create>app/api/health/route.test.ts</create>
    <create>app/api/ready/route.ts</create>
    <create>app/api/ready/route.test.ts</create>
    <modify>app/api/health/route.ts</modify>
    <modify>.github/workflows/deploy.yml</modify>
  </files>
  <steps>
    <step>Write failing tests for missing, malformed and complete build metadata.</step>
    <step>Implement a public non-sensitive Convex version query and readiness aggregation with a bounded timeout.</step>
    <step>Inject immutable commit/build/backend-version values during build and deploy.</step>
    <step>Keep `/api/health` as independent liveness; return non-200 from `/api/ready` when frontend/backend compatibility cannot be established.</step>
  </steps>
  <verification>
    <command>npx vitest run app/api/health/route.test.ts app/api/ready/route.test.ts</command>
    <expected>All metadata/readiness cases pass; no secret values appear in snapshots.</expected>
  </verification>
</task>

<task id="R2" name="Create deterministic authenticated two-user fixtures">
  <description>Replace optional/skipped authentication paths and committed credentials with environment-provisioned primary/partner states and deterministic cleanup.</description>
  <files>
    <create>e2e/auth.global.setup.ts</create>
    <create>e2e/auth.global.teardown.ts</create>
    <create>e2e/release-smoke.spec.ts</create>
    <modify>e2e/fixtures.ts</modify>
    <modify>e2e/signup-repro.spec.ts</modify>
    <modify>playwright.config.ts</modify>
    <modify>.gitignore</modify>
  </files>
  <steps>
    <step>Write a release-smoke test that fails when either authenticated role state is unavailable.</step>
    <step>Provision isolated test users through approved Clerk test mechanisms; never commit credentials or storage state.</step>
    <step>Seed/link an isolated couple and clean it up idempotently.</step>
    <step>Exercise login persistence, onboarding, linking, sharing/revocation, period logging and chat at desktop and mobile widths.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/release-smoke.spec.ts --project=chromium</command>
    <expected>Both roles complete the smoke journey with zero conditional skips.</expected>
  </verification>
</task>

<task id="R3" name="Split qualification from deployment">
  <description>Require typecheck, unit, authenticated smoke, production-dependency audit and build artifacts before any process restart or Convex deployment.</description>
  <files>
    <create>.github/workflows/ci.yml</create>
    <modify>.github/workflows/deploy.yml</modify>
    <modify>package.json</modify>
  </files>
  <steps>
    <step>Add a failing branch-protection check proving deploy cannot run without qualification success.</step>
    <step>Run build before typecheck where generated Next types require it, then unit and authenticated smoke suites.</step>
    <step>Build once and promote the immutable artifact; do not rebuild different code on the host.</step>
    <step>Make the production job an explicitly protected environment with serialized concurrency.</step>
  </steps>
  <verification>
    <command>npm run build &amp;&amp; npm run typecheck &amp;&amp; npm run test:unit</command>
    <expected>Exit 0, followed by a required green authenticated-smoke check in GitHub Actions.</expected>
  </verification>
</task>

<task id="R4" name="Remediate production dependency advisories">
  <description>Upgrade reachable vulnerable dependencies through compatible releases and document any exceptional time-bounded risk acceptance.</description>
  <files>
    <modify>package.json</modify>
    <modify>package-lock.json</modify>
    <modify>issues.md</modify>
  </files>
  <steps>
    <step>Capture the advisory tree and identify direct versus transitive reachability.</step>
    <step>Upgrade one dependency family at a time and run its focused regression tests.</step>
    <step>Record compensating control, owner and expiry for any advisory that cannot be removed.</step>
    <step>Add the production audit as a CI policy with an explicitly documented threshold.</step>
  </steps>
  <verification>
    <command>npm audit --omit=dev</command>
    <expected>No unaccepted high/critical production advisory; every exception has owner and expiry.</expected>
  </verification>
</task>

<task id="R5" name="Deploy Convex and frontend as one compatibility release">
  <description>Deploy/version-check Convex explicitly, use a non-destructive PM2 reload strategy and verify readiness before traffic promotion.</description>
  <files>
    <create>scripts/verify-release.sh</create>
    <modify>.github/workflows/deploy.yml</modify>
    <modify>pm2.config.js</modify>
    <modify>DEPLOYMENT.md</modify>
  </files>
  <steps>
    <step>Write shell-level failing checks for wrong commit, wrong backend version, missing listener and non-ready health.</step>
    <step>Deploy the intended Convex functions and record the backend compatibility version.</step>
    <step>Use PM2 reload/start-or-reload rather than unconditional delete.</step>
    <step>Verify listener, liveness, readiness, public TLS, versions and PM2 startup persistence.</step>
  </steps>
  <verification>
    <command>bash scripts/verify-release.sh --expected-commit "$GITHUB_SHA" --expected-backend "$CB_CONNECT_BACKEND_VERSION"</command>
    <expected>All identity, listener, TLS, readiness and persistence checks pass.</expected>
  </verification>
</task>

<task id="R6" name="Create rollback and data-recovery rehearsals">
  <description>Document and rehearse frontend, Convex-compatible and data restore procedures using explicit non-production targets.</description>
  <files>
    <create>docs/runbooks/release-rollback.md</create>
    <create>docs/runbooks/backup-restore.md</create>
    <create>scripts/rehearse-rollback.sh</create>
    <modify>DEPLOYMENT.md</modify>
  </files>
  <steps>
    <step>Define immutable rollback targets and compatibility constraints.</step>
    <step>Export a non-production Convex backup and restore it into an explicit temporary/test deployment.</step>
    <step>Rehearse rollback without deleting production data or resetting the workspace.</step>
    <step>Record detection, decision and restoration timestamps in an evidence report.</step>
  </steps>
  <verification>
    <command>bash scripts/rehearse-rollback.sh --deployment test</command>
    <expected>Prior compatible frontend/backend is ready and test data integrity checks pass within approved recovery objectives.</expected>
  </verification>
</task>

<task id="R7" name="Define critical-journey SLIs and enforceable error budget">
  <description>Instrument availability, mutation success, scheduled effects, latency and release identity before approving targets.</description>
  <files>
    <create>docs/reliability/slo.md</create>
    <create>docs/reliability/error-budget-policy.md</create>
    <create>docs/reliability/incident-response.md</create>
    <modify>app/(dashboard)/layout.tsx</modify>
    <modify>convex/schema.ts</modify>
  </files>
  <steps>
    <step>Define numerators, denominators, exclusions and ownership for each critical-journey SLI.</step>
    <step>Add redacted instrumentation that never contains dates, notes, pain values or period history.</step>
    <step>Measure a baseline before replacing proposed targets with approved targets.</step>
    <step>Approve a policy that pauses non-critical rollout when the error budget is exhausted.</step>
  </steps>
  <verification>
    <command>npm run test:unit</command>
    <expected>Telemetry redaction/cardinality tests pass and the SLO document names operator, approvers and review date.</expected>
  </verification>
</task>

## Hard success criteria

- 100% of deployed releases expose matching frontend commit and Convex compatibility version.
- Required CI includes build, typecheck, unit, authenticated two-user smoke and dependency policy; zero auth-dependent static skips in the release suite.
- No unresolved/unaccepted high or critical reachable production advisory.
- Post-deploy identity, listener, TLS, readiness and PM2 persistence checks pass automatically.
- Rollback detection/decision/restoration rehearsal meets the owner-approved objectives; proposed target is decision within 5 minutes and readiness within 15 minutes.
- Critical journeys have measured SLIs and an approved error-budget policy; proposed initial availability is 99.5% monthly and accepted critical-mutation success 99.9%, finalized only after baseline.
- Logs and telemetry contain zero sensitive health values in automated redaction tests.

## Rollout and rollback

Deploy reliability changes to a preview/test deployment, then production with serialized jobs. Stop on version mismatch, readiness failure, smoke failure, unexplained SLI burn or data-integrity mismatch. Roll back to the last identified compatible frontend/backend pair; feature work remains frozen until the incident is resolved and `issues.md` updated.

## Exit evidence

Save the qualification run, authenticated smoke report, dependency report, readiness output, rollback rehearsal, SLO baseline and approvals under `docs/evidence/reliability-gate-0/`. Gate 1 cannot expose migrated cycle semantics until this evidence is approved.
