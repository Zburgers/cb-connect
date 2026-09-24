# Gate 3 Qualification Report

**Qualified application source:** `8300805260bbd29311b3fc256f54d7cd2d163bd2` on `codex/gate3implementation`. Exact-head run `36010151243` passed on PR head `b1eacb2103bd9d70012b41aa30ea500612c6c07e`, including authenticated release smoke and Gates 0–3. The follow-up evidence/index commit changes documentation only. Gate 3 remains default-off and is not enabled in production.

## Source and remote status

- PR [#46](https://github.com/Zburgers/cb-connect/pull/46), base `main` at `2f8dae22b6b2673c75e94d66985e749a303b92df`; no branch or PR was created.
- Qualified application source: `8300805260bbd29311b3fc256f54d7cd2d163bd2`. Subsequent commits update the evidence report and planning index only.
- Exact-head CI: [36010151243](https://github.com/Zburgers/cb-connect/actions/runs/36010151243) passed on PR head `b1eacb2103bd9d70012b41aa30ea500612c6c07e`: deterministic qualification and protected authenticated release smoke, including Gates 0–2 and Gates 0–3 matrices. The production-configured immutable release job was skipped as required by governance.
- The earlier code-head run [36009587075](https://github.com/Zburgers/cb-connect/actions/runs/36009587075) passed deterministic qualification and was canceled after the report-only head was pushed. The older run for `71d9cd8e66782d65c9bf2c4355ca770c8519768a` was also canceled to prevent concurrent deployment to the shared test target.
- Both formerly unresolved P1 review threads have been answered with fix/test details and resolved. No unresolved review threads remain.
- Independent reviewers: code confidence **0.92**, no blocker; implementation/spec confidence **0.91**, conditional on D-013 provisioning the shared ledger before any real evaluation.
- Local authenticated QA used only synthetic Clerk fixtures and Convex deployment `dev:hallowed-hummingbird-284`. Credentials, cookies, storage state, and fixture identifiers are omitted.

## Local deterministic qualification

All checks passed locally on the clean application source commit above:

| Check | Result |
|---|---|
| `npm run test:unit -- --run` | PASS, 60 files / 552 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| Gate 3 focused snapshot, period, manifest tests | PASS, 77 tests |
| `npm run test:convex-safe-exec` | PASS |
| `npm run test:convex-command-policy` | PASS |
| `npm run test:fixture-evidence-boundary` | PASS |
| `npm run test:ci-workflow` | PASS |
| `npm run test:cycle-facts-plan` | PASS |
| `bash scripts/tests/prediction-runner-policy.test.sh` | PASS |
| `bash scripts/tests/deploy-workflow.test.sh` | PASS |
| `npm run benchmark:cycle:golden` | PASS, synthetic-only; `synthetic_not_evidence` |

The golden benchmark ran on a clean tree at `8300805260bbd29311b3fc256f54d7cd2d163bd2`; it used 7 synthetic users and 36 synthetic outcomes, with zero calibration fit outcomes. No real benchmark outcomes were inspected. The calibration-source subgroup is computed per estimator. The regression opens semantically identical, differently serialized data from separate checkout directories against one ledger and rejects the second opening. Real evaluation fails closed without a configured external ledger.

## Authenticated browser qualification

The secret-safe local wrapper parsed `.env.auth-test.local`, validated the approved Clerk/Convex identity, removed inherited generic Clerk/Convex credentials, and bound guarded operations to the approved test deployment. The file is ignored by Git.

The full authenticated Gates 0–3 matrix passed all four isolated lanes on the approved dev target:

- prediction V2 off, desktop and mobile;
- prediction V2 on, desktop and mobile.

Each Playwright result was `passed`; each teardown reported `remaining=false` and zero fixture records, including prediction segments, snapshots, and assessments. Gate flags were verified false after qualification. Sanitized evidence is in `/tmp/cb-connect-gates-0-3-push-20260924`.

The full primary/partner release smoke passed on desktop and mobile with retries disabled. Both runs exercised period deletion and completed teardown with `remaining=false`; the latest sanitized teardown proofs are under `e2e/.evidence/` (ignored). The smoke fix waits for the period-delete success state and ignores empty alert nodes. The approved browser executable was `/opt/google/chrome/chrome`.

Protected authenticated CI completed successfully for exact PR head `b1eacb2103bd9d70012b41aa30ea500612c6c07e`; its report/index follow-up changes documentation only and retains the same qualified application source.

## Gate 3 plan coverage

- **G3.0–G3.4:** default-off capability boundaries, private user-controlled segments, Gate 1/2 authority, eligible intervals, and deterministic estimators are implemented and tested.
- **G3.5–G3.6:** chronological synthetic evaluation, leakage safeguards, estimator-specific calibration grouping, and fail-closed calibration are implemented. Real evaluation and calibration are deferred under D-013.
- **G3.7:** immutable snapshots and correction/deletion restoration are implemented; the regression covers paginated correction history and restoration of the earliest currently effective outcome. Outcome scoring continues for existing snapshots while V2 serving is off.
- **G3.8–G3.11:** Gate 2 integration, private primary projection, reduced sharing-gated partner projection, notification parity, and feature-off compatibility are covered by code/tests and authenticated flows.
- **G3.12:** all four authenticated local desktop/mobile feature-off/on lanes and both full release-smoke projects pass with clean fixture teardown.
- **G3.13:** this report records the tested source commit, exact-head CI result, synthetic provenance, and authenticated local evidence. Protected authenticated Gates 0–3 CI passed on exact PR head `b1eacb2103bd9d70012b41aa30ea500612c6c07e`.

## Governance and exposure

- **D-012:** production exposure, destructive migration/lifecycle behavior, and final retention claims remain deferred. No production deployment or feature enablement occurred.
- **D-013:** real outcomes, dataset authority/permission, calibration sources, estimator promotion, and probability claims remain deferred pending approved authority, consent basis, and named statistical/preregistration approval. Before any real evaluation, D-013 must also provision one canonical shared durable ledger for all authorized evaluators; the runner cannot prove that different hosts share a configured path.
- **D-015:** pilot size and rollout remain deferred.
- **D-016:** population-trained Gate 7 work remains deferred.
- Synthetic metrics are pipeline checks only and do not establish real-world accuracy.
