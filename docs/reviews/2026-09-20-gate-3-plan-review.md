# Gate 3 Planning Packet Review

**Date:** 2026-09-20  
**Branch:** `codex/gate3implementation`  
**Base:** `2f8dae22b6b2673c75e94d66985e749a303b92df`  
**Scope:** Planning/specification only. No application code, production configuration, production data, or feature exposure is authorized by this review.

## Verdict

**Implementation-ready for default-off, non-production Gate 3 engineering.**

The packet is sufficiently specific to execute task-by-task without asking an implementation agent to invent product semantics, estimator candidates, benchmark split policy, missing-log behavior, confidence semantics, partner authority, or rollout boundaries.

Real external/CB Connect benchmark outcome viewing and model promotion remain blocked by the unresolved authority portion of D-013. Production exposure remains blocked by D-012. Pilot rollout remains governed by D-015.

## Reviewed artifacts

- `docs/decisions/2026-09-20-gate-3-prediction-design-freeze.md`
- `docs/decisions/major-release-decision-register.md`
- `docs/research/2026-09-20-gate-3-prediction-literature-review.md`
- `docs/research/cycle-benchmark-protocol.md`
- `docs/plans/2026-08-01-04-personalized-prediction-and-evaluation.md`
- `docs/plans/2026-09-20-gate-3-personalized-prediction-implementation.md`
- `docs/plans/2026-08-01-cb-connect-major-release-program.md`
- `docs/plans/README.md`
- `.shipyard/LESSONS.md`

Current code seams reviewed against the plan include:

- `convex/_helpers/cycleFactEligibility.ts`
- `convex/_helpers/cycleReadModel.ts`
- `convex/_helpers/predictionBounds.ts`
- `convex/_helpers/cycleState.ts`
- `convex/_helpers/partnerCycleProjection.ts`
- `convex/_helpers/cycleStateExposure.ts`
- `convex/queries/history.ts`
- `convex/queries/capabilities.ts`
- `convex/mutations/periods.ts`
- `convex/schema.ts`
- `convex/actions/notifications.ts`

## Spec-compliance review

### PASS — Gate 3 extends the Gate 2 seam instead of replacing it

Current Gate 2 derives legacy configured bounds in `cycleReadModel` and passes them to the non-wrapping `cycleState` reducer. The implementation plan replaces the bounds-generation seam with `periodPredictionV2` while retaining Gate 2 state precedence and late behavior.

No second client-side or notification-only prediction engine is planned.

### PASS — Gate 1 fact authority remains intact

The plan keeps exact start-anchor eligibility separate from exact factual period coverage and never writes predictions into `periodEvents`.

Approximate, tombstoned, and `legacy_unknown` rows do not silently become exact prediction anchors.

### PASS — D-009 contradiction is reconciled

The prior Gate 3 wording implied pending primary confirmation for partner assistance. D-009 and the current mutation path accept authorized partner-assisted facts immediately.

The planning packet now:

- removes `PENDING_PRIMARY_CONFIRMATION` from the current partner-assistance eligibility contract;
- retains `partner-assisted` as a benchmark subgroup;
- preserves actor/source provenance; and
- keeps primary correction/deletion authoritative.

Legacy `unreviewed` status remains conservative compatibility metadata rather than a new approval workflow.

### PASS — missing segmentation prerequisite is made explicit

Current main has prediction pause but no full private history segmentation implementation even though Gate 3 assumes an active segment.

The detailed plan adds one narrow user-controlled segment primitive before interval derivation. It does not infer pregnancy, contraception, PCOS, illness, postpartum state, or another cause.

Automatic change detection may affect uncertainty or later suggestion behavior but cannot silently exclude history.

### PASS — highly variable users are not abandoned

The previous gate-level wording allowed broad "widen/abstain" behavior. The frozen contract now requires:

- best usable personal prediction when sufficient evidence exists;
- wider interval;
- lower quality;
- explicit timing-variability explanation.

Variability alone is not an abstention reason.

### PASS — external-data boundary is explicit

External academic data may support:

- reproduction;
- estimator comparison;
- robustness/subgroup work;
- initial history-band calibration.

It may not become a hidden population-trained Gate 3 point predictor. Dataset access/permission and transfer limitations must be recorded before use.

Research Gate 7 remains the population-to-person probabilistic/ML lane.

### PASS — one initial global estimator

The benchmark compares configured, whole-history, rolling, and frozen recency candidates, but Gate 3 initially promotes at most one global personalized estimator. Per-user model routing is explicitly deferred until prospective evidence exists.

### PASS — confidence semantics are separated correctly

The packet distinguishes:

- calibrated interval probability;
- ordinal user-facing prediction quality; and
- internal numeric quality diagnostics.

The plan prohibits presenting the engineering score as a probability.

### PASS — evaluation leakage controls are implementation-specific

G3-BENCH-V1 specifies:

- stable user-level 60/20/20 development/calibration/locked-evaluation partition;
- chronological walk-forward folds;
- cutoff-aware corrections;
- a deliberate leakage trap;
- immutable protocol versioning;
- new holdout requirement after post-outcome protocol changes.

### PASS — notification path is included without expanding Gate 4

Current notifications consume `getPredictionInputsForUser`. The plan explicitly makes that path consume the same Gate 3 serving source under V2 while leaving delivery/consent/outbox redesign to Gate 4.

### PASS — partner projection remains reduced

Partner output may contain broad prediction timing, quality, and care-oriented guidance only when sharing/consent permits. It excludes private segments, residuals, internal score, raw history, research metadata, and diagnostic interpretation.

## Engineering-quality review

### Deep-module boundaries

The proposed modules have clear responsibilities:

- `predictionSegments`: active private history boundary;
- `cycleIntervals`: observation-to-interval derivation;
- `predictionEstimators`: deterministic point candidates;
- `predictionIntervals`: calibrated date ranges;
- `predictionQuality`: calibrated diagnostic/ordinal quality;
- `periodPrediction`: versioned serving orchestration;
- `predictionSnapshots`: immutable generation record;
- existing `cycleState`: semantic state machine.

This is preferable to continuing to deepen `cycleCalculations.ts` or duplicating calculations in UI/notifications.

### Schema locality

The plan avoids modifying `periodEvents` for segmentation or predictions. New segment and snapshot tables keep prediction metadata separate from observed health facts.

Snapshot assessment events are append-only so later correction can supersede evaluation without rewriting what was shown.

### Convex constraints

The plan requires:

- server-derived auth;
- indexed/bounded reads;
- validators;
- transaction-safe segment/authority mutations;
- no unbounded history arrays in one document;
- internal functions for private benchmark/snapshot operations.

These match `convex/_generated/ai/guidelines.md`.

### Dependency discipline

The benchmark runner is development-only. The plan requires a pinned TS runner and lockfile update rather than an implicit unpinned `npx` dependency.

## Privacy/security review

No planning blocker found for default-off engineering.

Required boundaries remain:

- no production target/stateful command outside `scripts/convex-safe-exec`;
- no production execution from this branch;
- no direct identifiers/raw health histories in generic benchmark artifacts;
- no partner access to private segment/model diagnostics;
- no external dataset admitted without source/permission/de-identification/manifest review;
- no destructive migration under unresolved D-012.

## Research/methodology review

The prediction-specific literature review is consistent with the broader repo research dossier:

- broad within/between-person cycle variability argues against fixed exact-date claims;
- self-tracking artifacts require explicit missingness/adherence caution;
- calibrated uncertainty is a first-class outcome;
- hierarchical adherence-aware modelling remains scientifically interesting but is not justified as the first user-visible CB Connect model.

The benchmark therefore evaluates robust simple personal statistics first and leaves population-aware ML to shadow research.

## Remaining blockers and intentionally deferred decisions

| Item | Blocks | Does not block |
|---|---|---|
| D-013 remaining dataset permission/consent + named statistical/preregistration authority | real external/CB outcome report viewing and promotion | synthetic fixtures, code, benchmark harness, default-off integration |
| D-012 | production exposure, final retention/destructive lifecycle behavior | additive/default-off Gate 3 implementation |
| D-011 | affected health-adjacent/care copy exposure | backend prediction contracts and neutral placeholder/test copy |
| D-015 | bounded pilot cohort/rollout percentages | engineering qualification |
| D-016 | CB Connect population-model Research Gate 7 | Gate 3 personal statistics |

## Execution recommendation

Execute `docs/plans/2026-09-20-gate-3-personalized-prediction-implementation.md` in order.

Do not open a temporary QA PR merely to run Gate 3. Use the existing branch/worktree strategy and isolated test target. Open a normal implementation PR only when the coherent Gate 3 stack is reviewable and qualified.

If implementation discovers a model, schema, privacy, benchmark, or authority assumption not covered by the frozen packet, stop only the dependent task and revise the protocol/plan before viewing affected outcomes.
