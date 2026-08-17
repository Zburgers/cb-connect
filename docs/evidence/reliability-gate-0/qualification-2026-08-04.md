# Gate 0 qualification baseline

**Captured:** 2026-08-04
**Scope:** Local qualification and static release-gate inspection in the dedicated Gate 0 worktree. This is not production or authenticated evidence.

## Results

| Check | Result | Evidence boundary |
|---|---|---|
| `npm ci` | Pass | Installed the lockfile dependency set. npm reported pending install scripts and vulnerabilities; no package files were changed. |
| `npm run build` without runtime env | Fail | Expected fail-closed error: `No address provided to ConvexReactClient`. This proves the workflow must provide required build environment. |
| `npm run build` with fake local-only env | Pass | Next.js 15.5.12 compiled, type-checked and generated all 12 static pages. No real endpoint, token or deployment was used. |
| `npm run typecheck` | Pass | Exit 0 after the successful build. |
| `npm run test:unit -- --run` | Pass | 10 test files, 39 tests passed. |
| `npm audit --omit=dev` | Fail | 9 reachable production advisories: 6 high and 3 moderate, across `js-cookie`, `next`, `postcss`, `sharp`, `uuid` and `ws` paths. No exception authority or expiry is recorded. |
| `npx playwright test --list` | Informational fail for release-gate use | 39 tests in 4 files; 32 skip paths remain and 3 fixed credential literals are present. No authenticated smoke was run. |

## Authenticated-suite inspection

- `e2e/signup-repro.spec.ts` contains a fixed password literal.
- `e2e/fixtures.ts` contains fixed password literals.
- Onboarding and partner-linking coverage uses `test.skip()` for auth-dependent cases.
- Chat coverage conditionally skips unless `CB_CONNECT_AUTH_STATE` is supplied.
- No `e2e/release-smoke.spec.ts`, global fixture setup/teardown, or approved isolated environment adapter exists yet.

## Safety review

The fake values used for the local build were placeholders only. This report stores no credentials, storage state, tokens, user/couple identifiers, health values or message content.

## Gate impact

The local application baseline is buildable and unit-testable when required environment variables are present. Gate 0 remains blocked by the dependency policy, missing immutable release/readiness controls, missing deterministic authenticated fixtures, unresolved decision authorities D-002 through D-007, and absent production rollback/recovery evidence.
