# CB Connect major-release plan index

**Status:** Canonical planning dashboard under the approved
[feature-first delivery policy](2026-08-19-feature-first-delivery-design.md).
Gates 1 and 2 are merged on current `main` at `2f8dae22b6b2673c75e94d66985e749a303b92df`. Gate 3 has a frozen product/model contract, prediction-specific literature review, G3-BENCH-V1 protocol, and a dated implementation plan. Branch `codex/gate3implementation` passes local deterministic qualification at `9fc33e5`; authenticated desktop/mobile CI has not run because GitHub reports no protection rules or branch policy for `cb-connect-auth-test`. See the [Gate 3 qualification report](../evidence/prediction-gate-3/REPORT.md). D-013 still blocks real benchmark outcome viewing/promotion until its remaining dataset/consent/statistical authority is recorded; D-012 blocks production feature exposure.

This index controls implementation order and planning readiness. Running code, current production evidence and `issues.md` override stale factual claims. The [major-release program](2026-08-01-cb-connect-major-release-program.md) controls product scope and invariants; the [decision register](../decisions/major-release-decision-register.md) controls unresolved authority and contract choices.

## Source-of-truth order

1. Current code, deployment configuration and independently verified production evidence.
2. `AGENTS.md` and `convex/_generated/ai/guidelines.md` for implementation rules.
3. This index and the major-release program for approved scope/order.
4. The currently approved dated execution plan.
5. Numbered gate-level plans for architecture, invariants and exit evidence.
6. `issues.md` for active evidence-backed defects and remediation status.
7. Research and historical branches for context only.

The historical `docs/v0.2.0-product-specs` branch is not an implementation base. Its Care Loop-first sequence is superseded by this reliability-first program.

## Ordered delivery tracks

| Order | Track | Gate-level plan | Blocking dependency | Planning readiness |
|---:|---|---|---|---|
| Continuous | Evidence-backed issue remediation | `issues.md` | None | Active; each fix requires its own acceptance evidence |
| 1 | Production reliability | [Gate 0](2026-08-01-01-production-reliability-foundation.md) | Continuous automated deployment and measurement | Engineering complete; operations continue in parallel |
| 2 | Trustworthy cycle facts | [Gate 1](2026-08-01-02-trustworthy-cycle-facts.md) and [implementation plan](2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md) | Gate 0 reliability foundation | Merged as PR #35; D-012 still blocks destructive lifecycle work/production exposure |
| 3 | Four-phase state semantics | [Gate 2](2026-08-01-03-four-phase-state-semantics.md) and [implementation plan](2026-08-20-gate-2-four-phase-state-semantics-implementation.md) | Gate 1 facts | Merged as PR #36 at current main |
| 4 | Personalized prediction | [Gate 3](2026-08-01-04-personalized-prediction-and-evaluation.md), [design freeze](../decisions/2026-09-20-gate-3-prediction-design-freeze.md), [benchmark protocol](../research/cycle-benchmark-protocol.md), and [dated implementation plan](2026-09-20-gate-3-personalized-prediction-implementation.md) | Merged Gate 2 + G3-BENCH-V1 | Default-off code has local deterministic qualification; authenticated CI and PR readiness await protected test-environment rules; D-013 gates real outcome evaluation/promotion and D-012 gates production exposure |
| 5 | In-app notification platform | [Gate 4](2026-08-01-05-notification-platform.md) | Approved Gates 0-3 contracts | Gate-level only |
| 6 | Mobile internal beta | [Gate 5](2026-08-01-06-mobile-internal-beta.md) | Approved Gates 0-4 APIs | Gate-level only |
| 7 | Push and staged stores | [Gate 6](2026-08-01-07-push-and-store-qualification.md) | Gate 5 real-device evidence | Gate-level only |
| Research | Probabilistic shadow model | [Research Gate 7](2026-08-01-08-probabilistic-shadow-model.md) | Gates 0, 1 and 3 data/governance prerequisites | Research design only; never user-visible |

## Current Gate 0 boundary

The detailed Gate 0 implementation packet is complete and historical. Its
former blocked verdict is preserved in [`REPORT.md`](../evidence/reliability-gate-0/REPORT.md)
as evidence of the state before automatic deployment. It is not a current
feature-development gate.

1. C2 is now evidenced by [protected CI run 32010663067](../evidence/reliability-gate-0/c2-protected-2026-08-17.md), which passed deterministic qualification and authenticated desktop/mobile smoke with zero skips. This does not establish production evidence.
2. Automatic `main` deployment now establishes direct production identity,
   readiness, PM2 persistence, and the managed rollback chain.
3. Restore rehearsals and SLO measurement continue as operational work and may
   restrict rollout or claims; they do not block unrelated feature coding.
4. Gate 1's additive/default-off implementation is complete for deterministic
   qualification, but authenticated desktop/mobile qualification is pending.
   Additive/default-off deployment is separate; D-012 blocks destructive
   migration, hard deletion, final retention behavior and production feature
   exposure until approval plus a separate exposure decision.
5. Gate 1 implementation remains Convex-only and flag-off by default. A green
   engineering qualification does not authorize production exposure; rollback
   is flag-off plus backward-compatible reads.
6. D-008 makes the validated device-local IANA timezone authoritative for
   date-bearing writes; D-009 keeps certainty explicit and primary correction
   or tombstone authority final.

## Gate 0 closeout

The implementation sequence G1 → C1/C2/C3 → V1/V2 → X1 → G2 → G3 is
recorded in the dedicated worktree and append-only execution log. G1, C1, C2,
C3, V1 isolated-dev identity, V2 implementation and X1 guardrails have
passing local, protected-CI or synthetic evidence. Production V1/V2 runtime
evidence and measurement remain useful operational history. Gate 1 code may
proceed behind its default-off feature flag.


## Current Gate 3 boundary

1. The implementation branch is `codex/gate3implementation`, based on Gate 2 merged `main` at `2f8dae22b6b2673c75e94d66985e749a303b92df`.
2. Product/model choices are frozen in `docs/decisions/2026-09-20-gate-3-prediction-design-freeze.md`.
3. G3-BENCH-V1 freezes eligibility, estimator candidates, 60/20/20 user-level development/calibration/locked-evaluation partitioning, walk-forward rules, metrics, calibration semantics, subgroups and promotion thresholds before real outcome review.
4. Synthetic/golden benchmark implementation and default-off application work may proceed. Real external/CB Connect outcome reports must fail closed until D-013's remaining authority is recorded.
5. Gate 3 user-visible point predictions are personal-history/configured-baseline driven. Population-trained hierarchical ML remains Research Gate 7.
6. D-012 continues to prohibit production feature exposure from this planning/implementation branch.

## Planning policy

- Numbered gate documents are work-package plans, not permission to edit code.
- A gate becomes implementation-ready only when its blocking decisions are resolved and a dated task-sized execution plan is approved.
- One execution task equals one bounded test/fail/implement/pass/commit cycle. Tasks sharing a file or interface are sequential unless the plan explicitly proves otherwise.
- A major architecture, schema, privacy or dependency divergence pauses execution and requires plan revision/reapproval.
- CI, deployment logs and Git history are the default evidence. Add a separate
  artifact only when those systems cannot retain the required result safely.
- Gate 7 shadow research may remain incomplete indefinitely; Gates 0-6 define major-release completion.

## Required evidence by gate

| Gate | Evidence root | Promotion authority |
|---|---|---|
| 0 | `docs/evidence/reliability-gate-0/` | Engineering, release operator, privacy/security as applicable |
| 1 | `docs/evidence/cycle-facts-gate-1/` | Engineering, privacy/legal for data lifecycle |
| 2 | `docs/evidence/four-phase-gate-2/` | Engineering, clinical/content, privacy |
| 3 | `docs/evidence/prediction-gate-3/` | Engineering, product, statistical/clinical review as applicable |
| 4 | `docs/evidence/notification-gate-4/` | Engineering, privacy/content, operator |
| 5 | `docs/evidence/mobile-gate-5/` | Engineering, mobile release owner, privacy/security |
| 6 | `docs/evidence/push-store-gate-6/` | Engineering, store authority, privacy/legal, operator |
| Research 7 | Restricted `docs/evidence/ml-shadow-gate-7/` | Statistical/ML reviewer, privacy/legal, product; no display authority |
