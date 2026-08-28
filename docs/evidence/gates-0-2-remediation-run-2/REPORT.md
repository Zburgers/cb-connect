# Gates 0–2 remediation run 2

## Final readiness verdict

**READY FOR INDEPENDENT QA RUN 2**

This is remediation and focused deterministic validation only. It is not
independent QA, merge approval, deployment, rollback authorization, feature
exposure approval, or Gate 1/Gate 2 qualification.

## 1. Starting repository and PR states

The review-time states were independently checked against GitHub and then
refreshed from `origin` before editing:

| Item | Starting state |
|---|---|
| PR #35 | `22a3b4b8415d6df926f53058e2fef6b855cb8e8f` on `gate-1/trustworthy-cycle-facts` |
| PR #36 | `bb9e0b9d387bf4599aa956d47fdefb846ffe5e2a` on `gate-2/four-phase-state-semantics` |
| PR #35 review | `5030398170` |
| PR #36 review | `5030400849` |
| Invalidated reference | `2fc028d9246cd958d60b59480245d810f8f81ecd` — reference only, not replayed |
| `origin/main` | `fc95ab2f7e24e8019fbd769333b9bface2561f5e` |

The original dirty checkout was preserved. Fresh sibling worktrees were used.

## 2–4. P0 incident closure and executor

Root cause was confirmed from current Convex CLI documentation and repository
behavior: a deploy key is associated with a deployment, while
`CONVEX_DEPLOYMENT` can select the production deployment associated with a
development deployment. An earlier shell preflight therefore did not prove
the later mutation target.

`scripts/convex-safe-exec` is now the single stateful executor. It requires
explicit `test` or `production` mode, exact approved target prefixes in the
deploy credential, explicit credential class, and (for production) the
protected execution boundary. It rejects missing credentials, wrong target
class, `CONVEX_DEPLOYMENT`, contradictory app consistency selectors, command
production/test selectors, and unprotected production execution. It verifies
effective backend identity twice immediately before and once after the
operation, with no secret output. CI and deploy workflows route their Convex
stateful operations through it; raw invocation policy tests cover workflows,
scripts, and deployment documentation.

No production or test Convex stateful command was run in this campaign.

## 5–6. QA-001 and PR #35 review reconciliation

Partner period history now has a presentation-only DTO when
`sharingPhase=true` and `sharingPeriodWrite=false`. Only the writable partner
projection includes the minimum opaque event target and authority version
needed for stale-safe assisted writes. `legacyReason`, actor/owner IDs,
`_creationTime`, timestamps, tombstones, and correction internals remain out
of the partner boundary. Timeline projection does not include target,
authority, or legacy-classification metadata for partners. Server-side tests
cover phase-off, read-only sharing, writable sharing, and revoked access.

The older PR #35 review findings were rechecked against current source:
flag-off compatibility, uncertainty-preserving correction, explicit certainty
promotion, single-open handling, targeted writes, primary correction
precedence, derived bounded legacy classification, migration identity
attestation, D-008/D-009/D-012 authority wording, exact-start versus
exact-coverage eligibility, bounded audit semantics, and Gate-1 E2E scope are
already reconciled in the current stack. The current review blockers were the
partner DTO and P0 boundary addressed here. No Gate 3 prediction/ML work was
added.

## 7. PR #36 restack identity

| Identity | Value |
|---|---|
| `GATE1_FINAL_REMEDIATION_SHA` | `a947f6d3738666318787c9a4cc5ec45158f85451` |
| `GATE2_NEW_BASE_SHA` | `a947f6d3738666318787c9a4cc5ec45158f85451` |
| Restack method | Fresh PR #36 worktree; rebase `--onto` new Gate-1 head from old merge-base `22a3b4b…` |
| Source freeze before report | `38db72d` |
| Merge-base with `main` | `4382c97b107853964a7439d4e51a6d1f1e5ff35e` |

The invalidated commit was not replayed wholesale.

## 8. QA-002 remediation

`e2e/cycle-state.spec.ts:createPeriod()` captures `logPeriodStart()`'s
`eventId`, reads the created period back, verifies its authority version, and
passes both `periodEventId` and `expectedAuthorityVersion` to
`logPeriodEnd()`. Gate 1's targeted mutation requirements remain intact.
Metadata guards were added for the now permission-aware history DTO.

## 9–11. Diagnostic and fixture readiness

- QA-003 diagnostics collect backend identity, compatibility, authenticated
  `getCapabilities()`, dashboard semantic payload, then DOM markers, with
  redacted status classes for each layer. Desktop/mobile classification is
  ready; no client fix was made without server evidence.
- QA-004 diagnostics inspect `hasData`, `cycleInfo`, `cycleStateV1`,
  `cycleStateV1Exposed`, raw capabilities, then `.phase-aura-card`. The
  prerequisite classifications are explicit; `PhaseAura` was not patched.
- QA-005 retains granular Clerk sign-in, Convex token, fixture-run creation,
  onboarding, pairing, registration, storage-state, refresh, and navigation
  boundaries. Only recognized transient failures have bounded retry; no
  arbitrary sleep or generic `primary-sign-in` product conclusion was added.
  Current authenticated runtime status remains unexecuted in this campaign.

## 12–13. Validation results

All ran on the fresh rebased Gate-2 worktree:

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `NEXT_PUBLIC_CONVEX_URL=https://example.invalid npm run build` | PASS |
| `npm run test:unit -- --run` | PASS — 44 files, 361 tests |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| deployment guard and wrong-target tests | PASS; fake mismatch proved no mutation |
| Gate 1/Gate 2/deploy/workflow/fixture policy tests | PASS |
| focused history/privacy tests | PASS — 10 tests |
| focused stateful Convex results | None; intentionally not run |

## 14. Unresolved findings and boundary

Authenticated stateful reproduction, browser qualification,
production inspection, merge, deployment, rollback, and feature-flag changes
remain outside this remediation campaign. These are independent QA Run 2
responsibilities, not hidden passes.

## 15. Campaign result

**READY FOR INDEPENDENT QA RUN 2**
