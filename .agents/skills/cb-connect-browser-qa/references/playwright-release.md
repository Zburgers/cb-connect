# Authenticated Playwright release track

Use this reference for authenticated CB Connect validation. It is a
non-production release-smoke workflow, not a substitute for deployment or
production qualification.

## Approved target and required variables

The fixture harness validates all of these values before provisioning users:

```text
CLERK_TEST_ENVIRONMENT_NAME=holy clerk
CLERK_TEST_SECRET_KEY=<secret test key; never print>
NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY=<public test key>
CLERK_TEST_FRONTEND_API_URL=https://holy-clam-29.clerk.accounts.dev
CONVEX_TEST_DEPLOYMENT=dev:hallowed-hummingbird-284
NEXT_PUBLIC_TEST_CONVEX_URL=https://hallowed-hummingbird-284.convex.cloud
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

Load an existing protected environment in the shell without printing it:

```bash
set -a
source .env.local
set +a

required=(
  CLERK_TEST_ENVIRONMENT_NAME
  CLERK_TEST_SECRET_KEY
  NEXT_PUBLIC_CLERK_TEST_PUBLISHABLE_KEY
  CLERK_TEST_FRONTEND_API_URL
  CONVEX_TEST_DEPLOYMENT
  NEXT_PUBLIC_TEST_CONVEX_URL
)
for name in "${required[@]}"; do
  test -n "${(P)name-}" || { echo "missing $name" >&2; exit 1; }
done
export CB_CONNECT_RELEASE_RUN_ID="manual-$(date -u +%Y%m%dT%H%M%SZ)-$$"
export CB_CONNECT_RELEASE_AUTH_DIR="${TMPDIR:-/tmp}/cb-connect-release-auth"
umask 077
mkdir -p "$CB_CONNECT_RELEASE_AUTH_DIR"
```

The `${(P)name-}` expansion is zsh syntax. In Bash, use an indirect expansion
such as `${!name-}`. Do not use `env`, `set`, `printenv`, or shell tracing while
secret variables are loaded.

## Run commands

Install the locked dependencies and run one project at a time for clear
evidence:

```bash
npm ci --no-audit --no-fund

PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npm exec -- playwright test --config=playwright.release.config.ts \
  e2e/release-smoke.spec.ts --project=release-desktop

PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npm exec -- playwright test --config=playwright.release.config.ts \
  e2e/release-smoke.spec.ts --project=release-mobile
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
