# Production Reliability Gate 0 Detailed Execution Plan

> **Codex/Shipyard execution:** Use the native `shipyard:shipyard-executing-plans` skill in a dedicated Gate 0 worktree. Execute tasks in dependency order and review each commit for spec compliance, then quality.

**Goal:** Turn the Gate 0 reliability work packages into bounded, auditable changes that produce an identifiable, qualified, reversible frontend/Convex release.

**Architecture:** `/api/health` remains process liveness. A separate `/api/ready` endpoint checks immutable frontend metadata against a non-sensitive Convex compatibility query with a bounded timeout. CI qualifies one standalone Next.js artifact and an explicit Convex deployment before serialized PM2 promotion; post-deploy checks and rollback/recovery rehearsals produce evidence rather than relying on build success.

**Tech Stack:** Next.js 15, TypeScript, Convex, Clerk, Vitest/convex-test, Playwright, GitHub Actions, PM2, defensive Bash.

---

**Parent gate:** [Production Reliability Foundation](2026-08-01-01-production-reliability-foundation.md)

**Program:** [Major-release program](2026-08-01-cb-connect-major-release-program.md)

**Decisions:** [Decision register](../decisions/major-release-decision-register.md)

**Status:** Approved and implementation-ready as of 2026-08-05. The planning batch is integrated, D-002 through D-007 are resolved, the dedicated worktree is current, and an isolated Convex dev deployment is configured. PR #8's production deployment failure remains evidence Gate 0 must remediate, not an entry blocker.

## Execution workspace and continuity contract

- Execute the whole Gate 0 plan in `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-0` on `gate-0/reliability-2026-08-04`. Use additional packet branches only when the user explicitly authorizes them; do not create overlapping implementations.
- The worktree is configured with an ignored `.env.local` for the isolated CB Connect Convex development deployment. Local implementation and Convex pushes target that dev deployment only unless a later task explicitly authorizes a named preview/test or production target.
- Every agent must read and append `docs/execution/gate-0-agent-log.md` according to the contract in `AGENTS.md`. The log is continuity evidence, not a substitute for task commits, tests, decision approvals, or Gate 0 release evidence.
- Never record secrets, environment values, Clerk user identifiers, personal data, or health data in the log.

### First implementation packet

The first agent starts with **I1, I3 and O1**, in that order, on the existing Gate 0 branch. P1-P4 are satisfied by the recorded baseline and owner-approved decisions. I1 and I3 form the local release/liveness contract; O1 hardens PM2 configuration without deploying production. After each task, run its focused test, `npm run typecheck`, `npm run test:unit` and `git diff --check`, then commit separately and append the execution log. Do not start I2 until I1 passes; I2 must be pushed only to the isolated dev deployment during implementation.

## Locked scope and contracts

### Endpoint separation

- `GET /api/health` is liveness only. It returns HTTP 200 when the Next.js process can serve requests and contains only `status`, `service` and `timestamp`.
- `GET /api/ready` is compatibility readiness. It returns HTTP 200 only when required frontend metadata exists, Convex responds before the timeout, and frontend/backend compatibility versions match. It returns HTTP 503 with bounded reason codes otherwise.
- Neither endpoint returns secrets, user data, health data, Clerk identifiers, raw upstream errors or environment values beyond approved non-sensitive release identity.

```ts
type ReleaseIdentity = {
  commitSha: string;
  buildId: string;
  compatibilityVersion: string;
  builtAt: string;
};

type BackendIdentity = {
  deployment: string;
  compatibilityVersion: string;
  deployedAt: string;
};

type ReadinessResponse = {
  status: "ready" | "not_ready";
  service: "cb-connect";
  frontend: ReleaseIdentity | null;
  backend: BackendIdentity | null;
  checks: {
    metadata: "pass" | "fail";
    backend: "pass" | "timeout" | "unavailable";
    compatibility: "pass" | "mismatch" | "unknown";
  };
};
```

### Metadata inputs

The build/deploy jobs supply server-side `CB_CONNECT_COMMIT_SHA`, `CB_CONNECT_BUILD_ID`, `CB_CONNECT_COMPATIBILITY_VERSION` and `CB_CONNECT_BUILT_AT`. Convex supplies `CB_CONNECT_BACKEND_DEPLOYMENT`, `CB_CONNECT_BACKEND_COMPATIBILITY_VERSION` and `CB_CONNECT_BACKEND_DEPLOYED_AT`. Exact values and the production selector are resolved under D-003; code must fail closed when they are absent or malformed.

### Artifact and process policy

- Build once in qualification using Next.js standalone output; deploy the qualified artifact and checksum rather than rebuilding on the host.
- `pm2.config.js` contains no secret placeholders or environment-specific URLs/keys. The protected deployment environment supplies runtime values.
- Use `pm2 startOrReload`/`start-or-reload`; do not delete the healthy process before readiness succeeds.
- Convex deployment and frontend promotion are one compatibility release, but rollback may use only a previously recorded compatible pair.

## Dependency order

```text
P1 -> P2/P3/P4
P2 -> I1 -> I2 -> I3 -> I4
P3 -> E1 -> E2 -> E3
I4 + E3 -> C1 -> C2 -> C3
P4 -> O1 -> O2
C3 + O2 -> V1 -> V2 -> X1
C1 -> G1
O2 + V2 -> G2
X1 + G1 + G2 -> G3
```

Tasks that modify `.github/workflows/deploy.yml`, `pm2.config.js`, `package.json`, `DEPLOYMENT.md` or `convex/schema.ts` are sequential even when other work can proceed independently.

## Preflight decisions and evidence

<task id="P1" name="Record the verified Gate 0 baseline">
  <depends_on>None</depends_on>
  <description>Capture branch/remote identity, production host/process/listener, public liveness, current production Convex selector/function identity, open P0/P1 issues and the merged PR #8 deployment failure without mutating production.</description>
  <files>
    <create>docs/evidence/reliability-gate-0/baseline.md</create>
  </files>
  <steps>
    <step>Write the evidence template with separate observed, inferred and unknown fields.</step>
    <step>Run read-only Git, GitHub, listener, PM2, TLS/HTTP and Convex identity checks.</step>
    <step>Populate only directly observed values and link raw/redacted command artifacts.</step>
    <step>Review for secrets, credentials, user identifiers and health values; redact them.</step>
    <step>Commit as `docs(reliability): record Gate 0 baseline`.</step>
  </steps>
  <verification>
    <command>rg -n "Observed|Unknown|origin/main|PM2|Convex|PR #8|30852430655|P0|P1" docs/evidence/reliability-gate-0/baseline.md</command>
    <expected>Every required identity/boundary is observed or explicitly unknown; no readiness claim is made.</expected>
  </verification>
</task>

<task id="P2" name="Resolve release ownership and compatibility decisions">
  <depends_on>P1</depends_on>
  <description>Resolve D-002 and D-003 with named authority, exact selector, compatibility-version semantics and review date.</description>
  <files>
    <modify>docs/decisions/major-release-decision-register.md</modify>
  </files>
  <steps>
    <step>Draft the compatibility-version proposal and alternatives.</step>
    <step>Verify the intended production selector independently.</step>
    <step>Obtain release-operator/incident-owner and engineering/operator approval.</step>
    <step>Record decision, approvers, date, evidence and expiry/review date.</step>
    <step>Commit as `docs(reliability): resolve release identity ownership`.</step>
  </steps>
  <verification>
    <command>rg -n "D-002|D-003|Resolved|Approver|Applies from|Review/expiry" docs/decisions/major-release-decision-register.md</command>
    <expected>D-002 and D-003 are resolved with no blank authority or deployment target.</expected>
  </verification>
</task>

<task id="P3" name="Resolve authenticated test-environment and fixture decisions">
  <depends_on>P1</depends_on>
  <description>Resolve D-004 and D-005 before writing fixture code, including isolated Clerk/Convex ownership, cleanup, rate limits and restricted artifact handling.</description>
  <files>
    <modify>docs/decisions/major-release-decision-register.md</modify>
    <create>docs/testing/authenticated-release-fixtures.md</create>
  </files>
  <steps>
    <step>Document accepted fixture strategies and reject production-account mutation.</step>
    <step>Choose the isolated environment, provisioning interface and idempotent cleanup path.</step>
    <step>Define secret names without recording values and define artifact redaction/retention.</step>
    <step>Obtain environment-owner and engineering approval.</step>
    <step>Commit as `docs(testing): approve authenticated release fixtures`.</step>
  </steps>
  <verification>
    <command>rg -n "environment|provision|cleanup|rate limit|redact|retention|production" docs/testing/authenticated-release-fixtures.md</command>
    <expected>D-004/D-005 are resolved and the design explicitly forbids production-user fixtures.</expected>
  </verification>
</task>

<task id="P4" name="Resolve recovery objectives and SLI approval process">
  <depends_on>P1</depends_on>
  <description>Resolve D-006 and D-007 for baseline ownership, proposed targets, backup/restore target, and recovery objectives.</description>
  <files>
    <modify>docs/decisions/major-release-decision-register.md</modify>
    <create>docs/reliability/gate-0-measurement-plan.md</create>
  </files>
  <steps>
    <step>Draft critical-journey numerators, denominators and exclusions.</step>
    <step>Document the baseline window and approval process without presenting proposed targets as achieved.</step>
    <step>Document backup owner, explicit non-production restore target and proposed RPO/RTO.</step>
    <step>Obtain operator/product approval for the rehearsal objectives.</step>
    <step>Commit as `docs(reliability): approve measurement and recovery plan`.</step>
  </steps>
  <verification>
    <command>rg -n "numerator|denominator|exclusion|baseline|RPO|RTO|restore target|approver" docs/reliability/gate-0-measurement-plan.md</command>
    <expected>D-006/D-007 are resolved or affected execution remains explicitly blocked.</expected>
  </verification>
</task>

## Release identity and readiness

<task id="I1" name="Parse immutable frontend release metadata">
  <depends_on>P2</depends_on>
  <description>Add a pure fail-closed parser for approved server-side release metadata.</description>
  <files>
    <create>lib/releaseInfo.ts</create>
    <create>lib/releaseInfo.test.ts</create>
  </files>
  <steps>
    <step>Write tests for complete, missing, malformed timestamp, invalid SHA and extra-sensitive inputs.</step>
    <step>Run `npx vitest run lib/releaseInfo.test.ts` and confirm the missing implementation fails.</step>
    <step>Implement the minimal typed parser and bounded public serializer.</step>
    <step>Run the focused tests and `npm run typecheck`; confirm both exit 0.</step>
    <step>Commit as `feat(release): parse immutable frontend identity`.</step>
  </steps>
  <verification>
    <command>npx vitest run lib/releaseInfo.test.ts</command>
    <expected>All metadata validity/redaction cases pass.</expected>
  </verification>
</task>

<task id="I2" name="Expose non-sensitive Convex backend identity">
  <depends_on>I1</depends_on>
  <description>Add an argument-validated public query returning only the approved backend identity, with no user/auth/data access.</description>
  <files>
    <create>convex/queries/system.ts</create>
    <create>convex/queries/system.test.ts</create>
  </files>
  <steps>
    <step>Write convex-test cases for complete/missing metadata and forbidden environment serialization.</step>
    <step>Run the focused test and confirm it fails because the query is absent.</step>
    <step>Implement `query` with `args: {}` and an exact return validator.</step>
    <step>Run the focused tests and typecheck; confirm no auth/user tables are read.</step>
    <step>Commit as `feat(release): expose Convex compatibility identity`.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/queries/system.test.ts</command>
    <expected>Return shape is exact, fail-closed and contains no secret/user values.</expected>
  </verification>
</task>

<task id="I3" name="Keep liveness contract independent">
  <depends_on>I1</depends_on>
  <description>Lock `/api/health` as process liveness so a backend outage does not change its meaning.</description>
  <files>
    <create>app/api/health/route.test.ts</create>
    <modify>app/api/health/route.ts</modify>
  </files>
  <steps>
    <step>Write a route test for exact status/service/timestamp shape and absence of release/backend data.</step>
    <step>Run the focused test and confirm current behavior fails any newly locked shape rule.</step>
    <step>Make the minimal route adjustment.</step>
    <step>Run the focused test and typecheck; confirm exit 0.</step>
    <step>Commit as `test(health): lock process liveness contract`.</step>
  </steps>
  <verification>
    <command>npx vitest run app/api/health/route.test.ts</command>
    <expected>Liveness remains HTTP 200 and independent of Convex readiness.</expected>
  </verification>
</task>

<task id="I4" name="Add bounded compatibility readiness endpoint">
  <depends_on>I2,I3</depends_on>
  <description>Add `/api/ready` with mocked complete, missing, timeout, unavailable and mismatch cases.</description>
  <files>
    <create>app/api/ready/route.ts</create>
    <create>app/api/ready/route.test.ts</create>
  </files>
  <steps>
    <step>Write route tests for every `ReadinessResponse` branch and a strict timeout.</step>
    <step>Run the focused tests and confirm failure because the route is absent.</step>
    <step>Implement the Convex call, bounded timeout, reason mapping and redacted response.</step>
    <step>Run focused tests, typecheck and a secret-token scan; confirm all pass.</step>
    <step>Commit as `feat(health): add release compatibility readiness`.</step>
  </steps>
  <verification>
    <command>npx vitest run app/api/ready/route.test.ts</command>
    <expected>Ready returns 200; metadata, timeout, unavailable and mismatch return 503 with bounded reasons.</expected>
  </verification>
</task>

## Deterministic authenticated release suite

<task id="E1" name="Remove committed and mock authentication credentials">
  <depends_on>P3</depends_on>
  <description>Delete fixed passwords/account values and make release tests fail closed when approved fixture secrets are absent.</description>
  <files>
    <modify>e2e/signup-repro.spec.ts</modify>
    <modify>e2e/fixtures.ts</modify>
    <modify>.gitignore</modify>
  </files>
  <steps>
    <step>Write a static test/scan that fails on fixed password literals and tracked storage state.</step>
    <step>Run the scan and confirm it detects the current literals.</step>
    <step>Replace literals with the approved fixture interface and ignore generated auth artifacts.</step>
    <step>Run the scan, Playwright listing and typecheck; confirm no conditional release skip remains.</step>
    <step>Commit as `test(auth): remove committed fixture credentials`.</step>
  </steps>
  <verification>
    <command>if rg -n '123maleaccount|Test123!@#' e2e; then exit 1; fi</command>
    <expected>Exit 0 and no generated auth-state file is tracked.</expected>
  </verification>
</task>

<task id="E2" name="Provision and clean two isolated authenticated roles">
  <depends_on>E1</depends_on>
  <description>Implement the approved D-005 adapter for one primary and one partner, storage states, linking and idempotent cleanup.</description>
  <files>
    <create>e2e/auth.global.setup.ts</create>
    <create>e2e/auth.global.teardown.ts</create>
    <create>e2e/support/authEnvironment.ts</create>
    <create>e2e/support/authEnvironment.test.ts</create>
    <modify>playwright.config.ts</modify>
  </files>
  <steps>
    <step>Write mocked adapter tests for provision, partial failure, retry, cleanup and redaction.</step>
    <step>Run focused tests and confirm failure because the adapter is absent.</step>
    <step>Implement only the approved environment-specific adapter and two Playwright setup projects.</step>
    <step>Run adapter tests and setup against the isolated environment; confirm two restricted storage states.</step>
    <step>Commit as `test(auth): provision deterministic couple fixtures`.</step>
  </steps>
  <verification>
    <command>npx vitest run e2e/support/authEnvironment.test.ts</command>
    <expected>Provision/retry/cleanup/redaction pass; missing environment fails closed.</expected>
  </verification>
</task>

<task id="E3" name="Create zero-skip two-user release smoke journeys">
  <depends_on>E2</depends_on>
  <description>Cover authentication persistence, onboarding, linking, sharing/revocation, factual period logging and chat at desktop/mobile widths.</description>
  <files>
    <create>e2e/release-smoke.spec.ts</create>
    <modify>playwright.config.ts</modify>
  </files>
  <steps>
    <step>Write the primary/partner journey using explicit role storage-state projects and deterministic IDs.</step>
    <step>Run with one deliberately missing role state and confirm a hard failure, not a skip.</step>
    <step>Complete the minimum assertions for both roles and revocation cleanup.</step>
    <step>Run desktop and mobile projects against the isolated environment with zero skips.</step>
    <step>Commit as `test(e2e): add authenticated release smoke`.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/release-smoke.spec.ts</command>
    <expected>Both roles and widths pass with zero skipped tests and redacted artifacts.</expected>
  </verification>
</task>

## Qualification and immutable artifact

<task id="C1" name="Add deterministic CI qualification workflow">
  <depends_on>I4,E3</depends_on>
  <description>Extend the existing typecheck/unit workflow to qualify install, build, post-build typecheck, unit tests and dependency policy before deployment.</description>
  <files>
    <modify>.github/workflows/ci.yml</modify>
    <modify>package.json</modify>
  </files>
  <steps>
    <step>Write a workflow-policy test that requires ordered build/typecheck/unit/audit jobs.</step>
    <step>Run the policy test and confirm the existing CI fails the required ordering/coverage policy.</step>
    <step>Add pinned Node/npm install and ordered required checks; keep build before generated-type-dependent typecheck.</step>
    <step>Run a local equivalent and validate workflow syntax.</step>
    <step>Commit as `ci: add required qualification workflow`.</step>
  </steps>
  <verification>
    <command>npm ci &amp;&amp; npm run build &amp;&amp; npm run typecheck &amp;&amp; npm run test:unit</command>
    <expected>Exit 0 in the documented order; audit policy result is explicit.</expected>
  </verification>
</task>

<task id="C2" name="Require authenticated smoke in CI">
  <depends_on>C1</depends_on>
  <description>Add the isolated two-user suite as a required, fail-closed qualification job with restricted artifacts.</description>
  <files>
    <modify>.github/workflows/ci.yml</modify>
    <modify>playwright.config.ts</modify>
  </files>
  <steps>
    <step>Write a policy assertion requiring environment secrets, zero-skip smoke and restricted retention.</step>
    <step>Run the policy assertion and confirm failure.</step>
    <step>Add the protected smoke job and redacted failure-artifact handling.</step>
    <step>Run workflow syntax checks and the smoke command in the isolated environment.</step>
    <step>Commit as `ci: require authenticated release smoke`.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/release-smoke.spec.ts</command>
    <expected>Missing fixtures fail the job; configured fixtures pass with zero skips.</expected>
  </verification>
</task>

<task id="C3" name="Produce checksummed standalone frontend artifact">
  <depends_on>C2</depends_on>
  <description>Enable Next.js standalone output and publish one artifact manifest containing commit/build/compatibility/checksum.</description>
  <files>
    <create>next.config.ts</create>
    <create>scripts/package-release.sh</create>
    <create>scripts/tests/package-release.test.sh</create>
    <modify>.github/workflows/ci.yml</modify>
  </files>
  <steps>
    <step>Write shell tests for missing standalone output, wrong metadata and checksum mismatch.</step>
    <step>Run shell tests and confirm failure.</step>
    <step>Enable standalone output and implement deterministic packaging/manifest creation.</step>
    <step>Build, package, verify checksum and smoke-start the extracted artifact on a non-production port.</step>
    <step>Commit as `build: package immutable standalone release`.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/package-release.test.sh</command>
    <expected>All negative cases fail correctly and a valid extracted artifact starts without rebuilding.</expected>
  </verification>
</task>

## Deployment, recovery and measurement

<task id="O1" name="Remove mutable PM2 secret injection">
  <depends_on>P2</depends_on>
  <description>Make PM2 consume protected runtime environment without hardcoded deployment URLs/keys or workflow `sed` edits.</description>
  <files>
    <modify>pm2.config.js</modify>
    <create>scripts/tests/pm2-config.test.sh</create>
    <modify>.github/workflows/deploy.yml</modify>
  </files>
  <steps>
    <step>Write a static shell test rejecting keys, URLs, blank secret placeholders, `sed -i` and `pm2 delete`.</step>
    <step>Run it and confirm it detects the current config/workflow.</step>
    <step>Make PM2 configuration environment-neutral and switch to non-destructive reload semantics.</step>
    <step>Run static tests and a non-production PM2 start/reload smoke.</step>
    <step>Commit as `ops(pm2): remove mutable secret injection`.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/pm2-config.test.sh</command>
    <expected>No secret/key/URL literal, mutable source edit, process delete or wrong port/cwd behavior remains.</expected>
  </verification>
</task>

<task id="O2" name="Add redacted critical-journey telemetry contract">
  <depends_on>P4</depends_on>
  <description>Define bounded reason/operation metrics before instrumentation and prove health values cannot serialize.</description>
  <files>
    <create>lib/telemetry.ts</create>
    <create>lib/telemetry.test.ts</create>
    <create>docs/reliability/telemetry-contract.md</create>
  </files>
  <steps>
    <step>Write tests rejecting dates, notes, pain values, message text, emails and high-cardinality identifiers.</step>
    <step>Run focused tests and confirm failure.</step>
    <step>Implement the minimal allowlisted event/reason/duration serializer.</step>
    <step>Run focused tests/typecheck and review the contract against D-006.</step>
    <step>Commit as `feat(reliability): add redacted telemetry contract`.</step>
  </steps>
  <verification>
    <command>npx vitest run lib/telemetry.test.ts</command>
    <expected>Allowed metrics serialize; every sensitive/high-cardinality fixture is rejected or redacted.</expected>
  </verification>
</task>

<task id="V1" name="Deploy explicit Convex compatibility release">
  <depends_on>C3,O1</depends_on>
  <description>Qualify and deploy the intended Convex functions to the protected selector, then record immutable backend identity before frontend promotion.</description>
  <files>
    <modify>.github/workflows/deploy.yml</modify>
    <create>docs/runbooks/convex-production-deploy.md</create>
  </files>
  <steps>
    <step>Add a workflow-policy test for explicit selector, protected environment and backend identity output.</step>
    <step>Run it and confirm current deploy fails the policy.</step>
    <step>Add explicit qualification/deployment using D-003 values and serialized concurrency.</step>
    <step>Deploy first to preview/test; verify identity and compatibility query.</step>
    <step>Commit as `ci(deploy): version explicit Convex release`.</step>
  </steps>
  <verification>
    <command>test -n "$CB_CONNECT_PRODUCTION_DEPLOYMENT" &amp;&amp; npx convex function-spec --deployment "$CB_CONNECT_PRODUCTION_DEPLOYMENT"</command>
    <expected>The explicitly selected deployment exposes the expected compatibility query/functions; selector evidence is recorded.</expected>
  </verification>
</task>

<task id="V2" name="Promote artifact and verify listener, TLS, identity and persistence">
  <depends_on>V1,O2</depends_on>
  <description>Promote the checksummed standalone artifact with start-or-reload, then verify liveness/readiness and process persistence.</description>
  <files>
    <create>scripts/verify-release.sh</create>
    <create>scripts/tests/verify-release.test.sh</create>
    <modify>.github/workflows/deploy.yml</modify>
    <modify>DEPLOYMENT.md</modify>
  </files>
  <steps>
    <step>Write fake-endpoint/process tests for wrong commit, mismatch, timeout, missing listener, TLS failure and non-persistent PM2 state.</step>
    <step>Run tests and confirm failure because verification is absent.</step>
    <step>Implement defensive explicit-argument verification and artifact promotion.</step>
    <step>Run in preview/test, then protected production; record raw redacted output.</step>
    <step>Commit as `ops(deploy): verify compatible release promotion`.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/verify-release.test.sh</command>
    <expected>Every negative fixture fails; matching commit/backend/listener/TLS/readiness/persistence passes.</expected>
  </verification>
</task>

<task id="X1" name="Rehearse compatible rollback and non-production restore">
  <depends_on>V2,P4</depends_on>
  <description>Rehearse frontend/backend rollback and data backup/restore against explicit non-production targets without resetting the workspace or deleting production data.</description>
  <files>
    <create>docs/runbooks/release-rollback.md</create>
    <create>docs/runbooks/backup-restore.md</create>
    <create>scripts/rehearse-rollback.sh</create>
    <create>scripts/tests/rehearse-rollback.test.sh</create>
    <modify>DEPLOYMENT.md</modify>
  </files>
  <steps>
    <step>Write tests rejecting production selectors, unresolved targets, unrecorded compatibility pairs and destructive Git commands.</step>
    <step>Run tests and confirm failure because the rehearsal is absent.</step>
    <step>Implement explicit-target dry-run/rehearsal plus timestamp/evidence capture.</step>
    <step>Rehearse against the D-007 target and reconcile synthetic integrity checks.</step>
    <step>Commit as `ops(recovery): rehearse rollback and restore`.</step>
  </steps>
  <verification>
    <command>bash scripts/tests/rehearse-rollback.test.sh</command>
    <expected>Production/destructive inputs fail closed; approved test rollback/restore records objective timings and integrity.</expected>
  </verification>
</task>

## Gate closure

<task id="G1" name="Remediate or risk-accept production dependency advisories">
  <depends_on>C1</depends_on>
  <description>Use the current advisory tree to upgrade one dependency family per commit and document any owner/expiry exception.</description>
  <files>
    <modify>package.json</modify>
    <modify>package-lock.json</modify>
    <modify>issues.md</modify>
  </files>
  <steps>
    <step>Capture the current production advisory tree and reachability in restricted/redacted evidence.</step>
    <step>Write/update focused regression coverage for the first reachable dependency family.</step>
    <step>Upgrade only that family, run focused and standard gates, then repeat as separate commits.</step>
    <step>Record owner/expiry/controls for any accepted exception and enforce the policy in CI.</step>
    <step>Commit the final policy as `security: enforce production dependency policy`.</step>
  </steps>
  <verification>
    <command>npm audit --omit=dev</command>
    <expected>No unaccepted high/critical reachable advisory; every exception has authority and expiry.</expected>
  </verification>
</task>

<task id="G2" name="Approve SLO baseline and error-budget policy">
  <depends_on>O2,V2</depends_on>
  <description>Measure the approved baseline, then convert proposed targets into approved or explicitly deferred objectives.</description>
  <files>
    <create>docs/reliability/slo.md</create>
    <create>docs/reliability/error-budget-policy.md</create>
    <create>docs/reliability/incident-response.md</create>
    <modify>docs/decisions/major-release-decision-register.md</modify>
  </files>
  <steps>
    <step>Populate baseline evidence using only the allowlisted telemetry contract.</step>
    <step>Calculate each SLI from its documented numerator/denominator/exclusions.</step>
    <step>Draft targets, burn response and privacy/P0 exception behavior.</step>
    <step>Obtain named operator/product approval and record review date.</step>
    <step>Commit as `docs(reliability): approve SLO and error budget`.</step>
  </steps>
  <verification>
    <command>rg -n "Owner|Numerator|Denominator|Exclusions|Target|Baseline|Burn|Review date" docs/reliability/slo.md docs/reliability/error-budget-policy.md</command>
    <expected>Every SLI/target has evidence, owner and response; no proposed target is labeled achieved without data.</expected>
  </verification>
</task>

<task id="G3" name="Publish Gate 0 evidence report and promotion verdict">
  <depends_on>X1,G1,G2</depends_on>
  <description>Assemble traceable evidence for every parent-gate success criterion and issue a blocked or approved verdict without borrowing evidence.</description>
  <files>
    <create>docs/evidence/reliability-gate-0/REPORT.md</create>
    <modify>issues.md</modify>
    <modify>docs/plans/README.md</modify>
  </files>
  <steps>
    <step>Write a criterion-by-criterion report table with evidence kind and artifact links.</step>
    <step>Mark missing, synthetic-only and production-authenticated evidence distinctly.</step>
    <step>Recheck current P0/P1 issues, frontend/backend identity and rollback compatibility.</step>
    <step>Obtain required engineering/operator approvals or issue a blocked verdict.</step>
    <step>Commit as `docs(reliability): publish Gate 0 verdict`.</step>
  </steps>
  <verification>
    <command>rg -n "Criterion|Evidence kind|Artifact|P0|P1|Frontend|Backend|Rollback|Verdict|Approver" docs/evidence/reliability-gate-0/REPORT.md</command>
    <expected>Every Gate 0 criterion is approved with direct evidence or the gate is explicitly blocked; Gate 1 remains unexposed otherwise.</expected>
  </verification>
</task>

## Standard final verification

```bash
npm run build
npm run typecheck
npm run test:unit
npx playwright test e2e/release-smoke.spec.ts
npm audit --omit=dev
bash scripts/tests/package-release.test.sh
bash scripts/tests/pm2-config.test.sh
bash scripts/tests/verify-release.test.sh
bash scripts/tests/rehearse-rollback.test.sh
git diff --check
```

All commands must exit 0 except `npm audit --omit=dev` only where the approved policy explicitly records a time-bounded exception. Production promotion additionally requires matching `/api/ready` identities, listener/TLS/PM2 persistence evidence, successful authenticated two-user smoke and an approved Gate 0 report.
