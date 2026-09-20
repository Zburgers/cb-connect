# Gate 3 Qualification Report

**Verdict: Exact-code-head deterministic qualification passes. Gate 3 is not merge-ready yet.** The authenticated desktop/mobile matrix is implemented. Its protected CI job is waiting for an eligible reviewer approval before any test steps begin.

## Exact source and runtime

- Branch: `codex/gate3implementation`
- Qualified code commit: `ed35b7e0630957078282dffcd4022065f85097f2`
- Source tree: `3e527ea5a098d03ba5cc8f0e9d8ab3c8626dc2a8` (clean during qualification)
- Base: `origin/main` at `2f8dae22b6b2673c75e94d66985e749a303b92df`; 48 commits ahead, 0 behind at qualification
- Local runtime: Node `v26.5.0`, npm `11.17.0`; CI is pinned to Node `v20.19.1`, npm `10.8.2`
- CI run: [35508642431](https://github.com/Zburgers/cb-connect/actions/runs/35508642431), exact head `ed35b7e0630957078282dffcd4022065f85097f2`
- PR: [#46](https://github.com/Zburgers/cb-connect/pull/46), open and Draft, base `main`; run `35508642431` qualified the implementation code commit shown above. This report/index refresh contains documentation changes only.
- GitHub environment `cb-connect-auth-test`: the user confirmed all eight required credential/config names are present; this was a names-only check and values were not read or validated. The authenticated job is waiting for approval by an eligible reviewer; the current workflow actor cannot approve it. Self-review and administrator bypass are disabled, and deployment branches are limited to `main` and `refs/pull/*/merge`.

## Deterministic qualification

All commands passed on the committed source. `npm run build` used the same inert public Convex and Clerk placeholders configured in the repository's secret-free CI build job.

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:unit -- --run` | PASS, 59 files / 523 tests |
| `npm run test:convex-safe-exec` | PASS |
| `npm run test:convex-command-policy` | PASS |
| `npm run test:fixture-evidence-boundary` | PASS |
| `npm run test:ci-workflow` | PASS |
| `bash scripts/tests/deploy-workflow.test.sh` | PASS |
| `npm run test:cycle-facts-plan` | PASS |
| `npm run test:prediction-runner-policy` | PASS |
| `npm run benchmark:cycle:golden` | PASS, synthetic golden protocol output |
| Playwright `--list`, `release-desktop` and `release-mobile` | PASS, one test listed per project; this is discovery only, not execution |

The benchmark ran on code commit `ed35b7e0630957078282dffcd4022065f85097f2` using G3-BENCH-V1 manifest `g3-synthetic-golden-v1` (`0b29b505c7bdf4d87bbbbc846f9281ce9abac4512a868d04556b963edae51eae`) and dataset hash `b53424a7d8612b761498f84a33831f5d28d9320b598f36637c1ac146e8e14b76`. It contains 36 synthetic outcomes. The `configured_v1` synthetic MAE is 1.611 days; `fitOutcomeCount=0`; the benchmark reports `promotionStatus=synthetic_not_evidence`.

## Authenticated qualification

The isolated four-lane desktop/mobile matrix is implemented and its mocked runner policy passes. The actual authenticated browser matrix is **NOT RUN**, not skipped. All eight local release-test variables are unset; no values were requested or printed. GitHub Actions run `35508642431` has a passing deterministic qualification job and an authenticated release smoke job in `waiting` state with no steps started. An eligible reviewer must approve `cb-connect-auth-test` before its secrets become available. E2E fixture accounts use random passwords and testing tokens, so existing test-user passwords are not needed.

No authenticated E2E evidence exists yet. The protected environment's required-reviewer, self-review, administrator-bypass, and deployment-branch settings were verified after configuration.

## External dataset availability screen

No external outcomes were downloaded, opened, or evaluated. The named Natural Cycles cohort is not public and requires permission from its developer; the Clue study data require a data-use agreement; and PhysioNet's mcPHASES dataset requires a signed restricted-health-data agreement. Marquette's public `Menstrual Cycle Data` record says participant consent permits reuse, but it has no dataset-specific open license; repository terms direct reuse questions to rights holders. These sources are not admitted to the benchmark unless an approved D-013 record establishes dataset authority and permission.

- [Natural Cycles data statement](https://www.nature.com/articles/s41746-019-0152-7)
- [Clue study data statement](https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828/)
- [mcPHASES access and license](https://physionet.org/content/mcphases/1.0.0/)
- [Marquette dataset record](https://epublications.marquette.edu/data_nfp/7/) and [repository reuse terms](https://epublications.marquette.edu/faq.html)

## Governance and exposure status

- **Synthetic benchmark:** pipeline/golden check passed; its results do not establish real-world accuracy or support promotion.
- **D-013 real-outcome authority:** pending approved dataset authority, applicable permission/consent basis, and named statistical/preregistration approval. The availability screen above did not access real outcomes.
- **Calibration:** no real calibration source; `fitOutcomeCount=0`.
- **User-visible probability language:** unavailable. The served prediction remains `configured_v1`/`limited_evidence` with `PERSONALIZATION_NOT_APPROVED`; no calibrated probability label is shown.
- **D-012 production exposure:** blocked. No production deployment, data mutation, or Gate 3 enablement was performed. Destructive lifecycle and final retention behavior remain blocked.
- **D-015 pilot:** deferred; no pilot size or rollout percentage is approved.
- **D-016 Research Gate 7:** population-model training on CB Connect data remains blocked.
- **Rollback:** set `CB_CONNECT_PERIOD_PREDICTION_V2=false` and `CB_CONNECT_PARTNER_PREDICTION_V2=false` through the guarded test-target process. Preserve existing period facts, prediction snapshots, and assessments.

The last independent code-quality review scored 0.92 with no code blocker. The last spec review scored 0.80 because authenticated E2E was still pending and the previous report was stale; rerun both critics against final evidence before marking the PR ready. No formal GitHub review is recorded. The authenticated CI boundary above remains an external blocker; this report does not claim full Gate 3 completion.
