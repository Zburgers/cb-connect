---
name: cb-connect-browser-qa
description: >-
  Run safe CB Connect QA and test workflows across the browser and CLI
  environments. Use when the user says "QA", "go test it manually", "test it
  manually", "check the UI", "browser test", "smoke test", "run E2E", or asks
  to validate a CB Connect flow. Covers deterministic CLI checks, visible
  Playwright with Fedora system Chrome, authenticated release smoke tests, and
  evidence-based reporting. Do not use for unit-only coding questions unless
  test execution or QA is part of the request.
---

# CB Connect Browser QA

Use this skill as the repository workflow for any CB Connect manual QA or
test-execution request. It supports two complementary tracks:

- **Browser track:** Playwright against the real Fedora system Chrome for
  visible/manual interaction, or the release config for authenticated smoke
  qualification.
- **CLI track:** deterministic typecheck, unit, build, workflow-policy,
  health/readiness, and other shell-level checks.

## Trigger and routing

Implicit invocation is enabled in `agents/openai.yaml`. Apply this skill when a
request mentions QA, manual testing, browser checking, UI validation, smoke
testing, E2E, or the user asks to “go test it manually.” If the request clearly
needs both a browser and CLI evidence, run both tracks and keep their results
separate.

Read only the relevant reference before acting:

- [Browser and system Chrome](references/browser-system-chrome.md)
- [Authenticated Playwright release track](references/playwright-release.md)
- [CLI and local-runtime testing](references/cli-testing.md)

## Guardrails

1. Record the checkout, branch, commit, remote, runtime, target URL, and dirty
   state before testing. Never reset, clean, stash, or overwrite user work.
2. Treat `origin/main` and the current checkout as different identities. Do not
   call a dirty-branch result a main/release result.
3. Authenticated tests may use only the approved synthetic dev targets from
   `docs/testing/authenticated-release-fixtures.md`: Clerk environment `holy
   clerk` and Convex deployment `dev:hallowed-hummingbird-284`.
4. Never print, persist in reports, or commit credentials, cookies, storage
   state, authorization headers, pairing codes, or raw authenticated payloads.
5. Do not use production accounts, production Convex, a real person’s email, or
   a shared static password. Fail closed when the approved auth environment is
   incomplete or identity validation fails.
6. Keep generated traces, screenshots, videos, `.auth` state, and CLI logs out
   of commits. Inspect them for secrets before sharing.

## Standard workflow

### 1. Establish scope and identity

Run read-only preflight from the repository root:

```bash
pwd
git status --short --branch
git rev-parse HEAD
git remote -v
node --version
npm --version
```

Choose the smallest track that proves the requested behavior. If the user asks
for manual QA, do not substitute a green unit test for browser evidence. If the
user asks for release qualification, use the release config and its auth
contract rather than the default local config.

### 2. Run the CLI track

Follow [CLI and local-runtime testing](references/cli-testing.md). Start with
static and deterministic checks, then test a running local server’s
`/api/health` and `/api/ready` contracts. Report each command separately as
PASS, FAIL, or BLOCKED; do not collapse a partial matrix into one PASS.

### 3. Run the browser track

For visible/manual work, follow [Browser and system Chrome](references/browser-system-chrome.md). For authenticated release smoke, follow [Authenticated Playwright release track](references/playwright-release.md), which provisions
run-scoped synthetic users, uses the system Chrome executable when requested,
and cleans up in teardown.

For each browser flow, capture:

- entry URL and project/config used;
- visible UI result and expected state;
- console/network errors relevant to the failure;
- screenshot, trace, or video path only when safe to share;
- whether the result was manual, deterministic local, authenticated dev, CI,
  deployed, or production evidence.

### 4. Report the result

Use these result labels:

- **PASS:** the requested scope completed and the expected evidence exists.
- **FAIL:** the product or test assertion failed.
- **BLOCKED:** the environment, credentials, display, server, or target was
  unavailable, so the requested evidence could not be collected.
- **PARTIAL:** some requested tracks or flows passed, but another required
  scope failed or was blocked.

Always include the exact command, config/project, target identity, duration if
measured, artifact locations, failures, and the next safe action. Distinguish
“the test ran” from “the product behavior passed.”

## Quick command index

```bash
# Deterministic CLI checks
npm ci --no-audit --no-fund
npm run typecheck
npm run test:unit -- --run
npm run build
npm run test:ci-workflow

# Default local Playwright matrix (bundled Chromium; no authenticated fixture)
npm exec -- playwright test --config=playwright.config.ts

# Authenticated release matrix (approved dev fixture only; see reference)
PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  npm exec -- playwright test --config=playwright.release.config.ts \
  --project=release-desktop

# CLI browser session for visible manual QA (use a dedicated profile)
playwright-cli open http://127.0.0.1:3000 --browser=chrome --headed \
  --persistent --profile=cb-connect-qa
playwright-cli snapshot
playwright-cli close
```

Do not run the authenticated command until the required variables and target
identity in the release reference have been validated.
