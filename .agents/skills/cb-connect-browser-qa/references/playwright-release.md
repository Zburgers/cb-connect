# Authenticated Playwright release track

Use this reference for authenticated CB Connect validation. It is a
non-production release-smoke workflow, not a substitute for deployment or
production qualification.

## Approved target and required variables

For local authenticated work, use the repo-root ignored file
`.env.auth-test.local`. It must contain the approved synthetic test credentials
and target configuration listed below. `.gitignore` excludes this file. Never
copy its values into a report, command transcript, workflow file, or committed
file. Keep the test deploy key named `CONVEX_TEST_DEPLOY_KEY`; for the guarded
Convex CLI invocation, map it in memory to `CONVEX_DEPLOY_KEY` and set
`CB_CONNECT_CONVEX_CREDENTIAL_CLASS=test`.

The fixture harness validates all of these values before provisioning users:

```text
CLERK_TEST_ENVIRONMENT_NAME=holy clerk
CLERK_TEST_SECRET_KEY=<secret test key; never print>
NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY=<public test key>
CLERK_TEST_FRONTEND_API_URL=https://holy-clam-29.clerk.accounts.dev
CONVEX_TEST_DEPLOY_KEY=<target-bound test key; never print>
CONVEX_TEST_DEPLOYMENT=dev:hallowed-hummingbird-284
NEXT_PUBLIC_TEST_CONVEX_URL=https://hallowed-hummingbird-284.convex.cloud
NEXT_PUBLIC_TEST_CONVEX_SITE_URL=<approved test site URL>
CB_CONNECT_RELEASE_RUN_ID=<safe unique id>
```

Optional:

```text
CB_CONNECT_RELEASE_AUTH_DIR=<restricted ignored artifact directory>
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome
```

The source of truth for the exact contract is
`docs/testing/authenticated-release-fixtures.md` and
`e2e/support/authEnvironment.ts`. Never map production variables into these
names. The approved fixture uses synthetic run-scoped users only.

## Secret-safe environment loading

Do not `cat`, source, or print `.env.auth-test.local`: the deploy key contains
shell metacharacters and must be parsed as dotenv data. Use the repo-local
wrapper, which validates the approved Clerk/Convex identity, maps the test key
in memory, unsets `CONVEX_DEPLOYMENT`, and passes variables only to its child:

```bash
npx tsx scripts/with-auth-test-env.ts -- <command> [args...]
```

The wrapper resolves the repo-root `.env.auth-test.local`, validates all
required fixture inputs and the exact approved target before spawning the
command, allowlists its dotenv keys, strips generic Clerk/Convex credentials
from the inherited environment, and never prints credential values. It is a
credential-safe loader, not a sandbox for untrusted commands. Use it around
guarded deploys and authenticated browser commands, not ordinary builds or
tests.

## Run commands

Install the locked dependencies and run one project at a time for clear
evidence:

```bash
npm ci --no-audit --no-fund

PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npx tsx scripts/with-auth-test-env.ts -- npx playwright test \
  --config=playwright.release.config.ts e2e/release-smoke.spec.ts \
  --project=release-desktop --retries=0

PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npx tsx scripts/with-auth-test-env.ts -- npx playwright test \
  --config=playwright.release.config.ts e2e/release-smoke.spec.ts \
  --project=release-mobile --retries=0
```

To inspect the release project declarations without starting a test:

```bash
sed -n '/^      name:/p' playwright.release.config.ts
```

Do not use release `--list` as a no-environment preflight. This repository has
`e2e/signup-repro.spec.ts` and `e2e/release-smoke.spec.ts` top-level fixture
lookups; Playwright loads those files while listing and they require generated
`CB_CONNECT_RELEASE_PRIMARY_STORAGE_STATE` and
`CB_CONNECT_RELEASE_PARTNER_STORAGE_STATE` paths. The normal release run gets
those paths from global setup before executing tests.

The release config starts `npm run dev` on the port derived from
`PLAYWRIGHT_BASE_URL`, passes test-safe Clerk/Convex runtime values to the
server, runs `e2e/auth.global.setup.ts`, and guarantees cleanup through
`e2e/auth.global.teardown.ts`. It has `release-desktop` and
`release-mobile`; mobile still uses Chromium deliberately.

## System Chrome and visible mode

The release config honors `PLAYWRIGHT_EXECUTABLE_PATH`. For visible desktop
QA, also ensure the Fedora display variables are present and use the same
approved executable:

```bash
export PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome
export DISPLAY="${DISPLAY:?a graphical DISPLAY is required for visible QA}"
npm exec -- playwright test --config=playwright.release.config.ts \
  e2e/release-smoke.spec.ts --project=release-desktop --headed
```

Headed mode is a local/manual option; do not make it the default for CI.

## What the smoke test proves

`e2e/release-smoke.spec.ts` uses the two run-scoped storage states and checks
the release flow across primary and partner roles, including linking, sharing,
period logging, chat, revocation, and relinking. A passing setup alone is not a
passing product result; inspect the test assertions and teardown outcome.

## Artifacts and failure handling

Expected outputs are under `CB_CONNECT_RELEASE_AUTH_DIR`, including restricted
storage state, `test-results`, `playwright-report`, and cleanup evidence. Never
commit or paste those files. On failure, preserve only redacted traces,
screenshots, or videos. Common classifications:

- Missing/invalid variables: **BLOCKED**, before account mutation.
- Wrong Clerk/Convex identity: **BLOCKED**, fail closed.
- Fixture setup failure: **FAIL** or **BLOCKED** depending on whether the
  environment was reachable and valid.
- Assertion failure after valid setup: **FAIL**.
- Desktop pass but mobile failure: **PARTIAL**, not PASS.
- Browser pass without teardown evidence: **PARTIAL** until cleanup is proven.

The CI equivalent is the protected `authenticated-smoke` job in
`.github/workflows/ci.yml`; it serializes the shared dev deployment and injects
the deploy key only into the deployment step.

## Local-first qualification before push

When an auth or test environment is involved, run the checks against the
current code before pushing. Use `scripts/with-auth-test-env.ts` to parse
`.env.auth-test.local`; never source it or run with shell tracing. The wrapper
confirms the approved Clerk and Convex target identity, unsets
`CONVEX_DEPLOYMENT`, and uses `scripts/convex-safe-exec test` for every
stateful Convex operation.

For Gate 0–3 changes, run these tracks before pushing:

```bash
npm run build
npm run typecheck
npm run test:unit -- --run
npm run benchmark:cycle:golden
npm run test:convex-safe-exec
npm run test:convex-command-policy
npm run test:fixture-evidence-boundary
npm run test:ci-workflow
npm run test:cycle-facts-plan
bash scripts/tests/prediction-runner-policy.test.sh
bash scripts/tests/deploy-workflow.test.sh
npx tsx scripts/with-auth-test-env.ts -- bash scripts/convex-safe-exec test -- \
  deploy --typecheck disable --codegen enable \
  --message "cb-connect-auth-test local-qualification"
npx tsx scripts/with-auth-test-env.ts -- bash scripts/run-gates-0-3-qa.sh
```

Then run both full authenticated release-smoke projects separately, with retries
disabled so one attempt gives unambiguous evidence:

```bash
PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npx tsx scripts/with-auth-test-env.ts -- npx playwright test \
  --config=playwright.release.config.ts \
  e2e/release-smoke.spec.ts --project=release-desktop --retries=0
PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npx tsx scripts/with-auth-test-env.ts -- npx playwright test \
  --config=playwright.release.config.ts \
  e2e/release-smoke.spec.ts --project=release-mobile --retries=0
```

Require all four Gate 0–3 lanes and both smoke projects to pass. Verify each
Playwright `.last-run.json` says `passed`, teardown proves no fixtures remain,
and all four feature flags are restored to `false`. Preserve only sanitized
evidence; do not commit auth state, traces, screenshots, or raw logs. If a local
lane fails, diagnose and rerun the affected lane after fixing it before pushing.
After push, still monitor exact-head CI; local proof cannot qualify another
SHA or replace protected-environment approval.
