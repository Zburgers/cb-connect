# CLI and local-runtime testing

Use this track for fast, reproducible evidence that does not require a visible
browser. Keep local deterministic checks separate from authenticated or
deployed checks.

## Install and static checks

Run from the repository root:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm run test:unit -- --run
npm run build
npm run test:ci-workflow
git diff --check
```

`npm run lint` is currently an alias for `npm run typecheck`; report the actual
command and do not describe it as ESLint unless the project script changes.
`npm run test:e2e` uses the default local config and bundled Chromium. It is
not the authenticated release matrix.

Useful Playwright CLI inspection commands:

```bash
npm exec -- playwright --version
npm exec -- playwright test --list
npm exec -- playwright test --config=playwright.config.ts --list
```

Prefer `npm exec -- playwright` so the project’s installed version is used;
avoid accidentally using a different global Playwright binary.

## Local server health and readiness

Start the dev server on a known port in a separate terminal:

```bash
PORT=3000 npm run dev -- --port 3000
```

Probe the repository’s explicit liveness/readiness contracts:

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --silent --show-error --write-out '\nHTTP %{http_code}\n' \
  http://127.0.0.1:3000/api/ready
```

`/api/health` should be treated as process liveness. `/api/ready` can return
HTTP 503 while reporting `not_ready`; inspect the JSON and classify that as an
environment/backend readiness result, not as a browser assertion. For the
canonical validation logic, run:

```bash
bash scripts/tests/standalone-runtime.test.sh
```

The script starts its own standalone server and validates both endpoints. Stop
only the server started for this QA run.

## E2E from the CLI

Run a narrow deterministic spec first, then expand only when needed:

```bash
npm exec -- playwright test --config=playwright.config.ts \
  e2e/onboarding.spec.ts --project=chromium

npm exec -- playwright test --config=playwright.config.ts \
  --project=chromium
```

On failure, use the generated report/trace locally and remove or redact it
before sharing:

```bash
npm exec -- playwright show-report playwright-report
npm exec -- playwright show-trace path/to/trace.zip
```

Do not claim authenticated coverage from an unauthenticated default-config
run.

## CI and authenticated CLI boundaries

For CI-policy validation use `npm run test:ci-workflow`. For the authenticated
dev fixture use the release reference and its exact environment contract. For
Convex deployment or readback commands, use only the approved dev deployment,
the project’s documented deploy key handoff, and an explicit user-authorized
deployment step. Never run a broad `npx convex deploy` against an unresolved
target.

## Evidence table

Record results in this shape:

| Track | Command/config | Target | Result | Evidence |
| --- | --- | --- | --- | --- |
| Static | `npm run typecheck` | checkout SHA | PASS/FAIL | command output |
| Unit | `npm run test:unit -- --run` | checkout SHA | PASS/FAIL | test summary |
| Runtime | `standalone-runtime.test.sh` | local server | PASS/FAIL | health/readiness output |
| Browser | Playwright config/project | local or approved dev | PASS/FAIL/BLOCKED | report/trace |

Include duration only when measured. Token usage belongs to the agent’s final
reporting layer; this skill should report command/runtime evidence and not
invent token counts.
