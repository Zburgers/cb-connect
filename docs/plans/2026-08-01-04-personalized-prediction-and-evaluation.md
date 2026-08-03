# Personalized Prediction and Evaluation Implementation Plan

> **Codex/Shipyard execution:** This gate-level plan requires a frozen benchmark protocol and dated execution plan after Gate 2 evidence exists.

**Goal:** Replace fixed exact-date claims with benchmarked personal estimates, calibrated likely windows, explanations and safe abstention.

**Architecture:** Pure versioned estimators operate only on eligible confirmed start-to-start intervals. A time-ordered walk-forward harness compares simple baselines and calibrates an 80% likely window. Immutable snapshots record what was generated and shown; a feature-flagged Convex read model serves one result to web, notifications and mobile.

**Tech Stack:** TypeScript, Convex, Vitest, offline benchmark scripts, Next.js, Playwright.

---

**Depends on:** [Four-phase state semantics](2026-08-01-03-four-phase-state-semantics.md)

**Research:** [Cycle prediction findings](../research/2026-08-01-major-release-cycle-trust-research.md#4-cycle-and-prediction-research-findings)

**Next gate:** [Notification platform](2026-08-01-05-notification-platform.md)

**Planning status:** Gate-level work packages only. Resolve D-013 before viewing benchmark outcomes and D-015 before pilot promotion.

**Required task order:** P1 eligibility/reasons -> P2 estimator interface -> P3 frozen leakage-safe protocol -> P4 calibration -> P5 immutable snapshots -> P6 versioned serving contract -> P7 owner-first UI/pilot. Benchmark, eligibility, metric and subgroup definitions are frozen before candidate results are viewed.

## Entry criteria

- Gates 1–2 facts/eligibility/state invariants are approved.
- No historical evaluation will use recomputed future inputs.
- Analysis access, research consent and de-identification rules are approved.
- Candidate promotion criteria below are preregistered before benchmark results are viewed.

## Implementation tasks

<task id="P1" name="Derive eligible start-to-start intervals">
  <description>Build a pure derivation that returns intervals plus inclusion/exclusion reason codes without silently repairing possible missing logs.</description>
  <files>
    <create>convex/_helpers/cycleIntervals.ts</create>
    <create>convex/_helpers/cycleIntervals.test.ts</create>
    <modify>convex/queries/history.ts</modify>
  </files>
  <steps>
    <step>Write failing fixtures for stable, variable, approximate, pending partner, corrected, segmented and 28/29/58/28 histories.</step>
    <step>Calculate only consecutive confirmed starts in the active eligible segment.</step>
    <step>Attach reason codes such as `LIMITED_HISTORY`, `APPROXIMATE_DATE`, `PENDING_PRIMARY_CONFIRMATION`, `POSSIBLE_MISSING_LOG`, `CONTEXT_SEGMENT` and `RECENT_CORRECTION`.</step>
    <step>Never divide a long interval or delete it without preserving its reason and eligibility decision.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/cycleIntervals.test.ts</command>
    <expected>Every fixture produces exact interval values and auditable reason codes.</expected>
  </verification>
</task>

<task id="P2" name="Implement versioned simple estimators">
  <description>Provide configured length, all-history mean/median, rolling mean/median and recency-weighted candidates behind one interface.</description>
  <files>
    <create>convex/_helpers/predictionEstimators.ts</create>
    <create>convex/_helpers/predictionEstimators.test.ts</create>
  </files>
  <steps>
    <step>Write deterministic failing examples for all required history patterns.</step>
    <step>Implement estimator IDs/versions, point output and required-history rules.</step>
    <step>Make tie/rounding behavior explicit and stable.</step>
    <step>Return insufficient data rather than claiming historical personalization below three eligible intervals.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/predictionEstimators.test.ts</command>
    <expected>All estimators and insufficient-history behavior pass exact-value tests.</expected>
  </verification>
</task>

<task id="P3" name="Create a leakage-safe walk-forward benchmark">
  <description>Predict cycle k using only records available before its confirmed start and produce overall/subgroup metrics.</description>
  <files>
    <create>scripts/cycle-benchmark.ts</create>
    <create>scripts/cycle-benchmark.test.ts</create>
    <create>docs/research/cycle-benchmark-protocol.md</create>
    <modify>package.json</modify>
  </files>
  <steps>
    <step>Write a leakage trap where future cycles would falsely improve the result.</step>
    <step>Sort by user/segment/time, freeze each input cutoff and evaluate configured, mean, median, last-three mean/median and recency-weighted candidates.</step>
    <step>Report median/mean absolute error, ±1/2/3/5 rates, interval coverage/width, abstention and paired candidate-minus-baseline results.</step>
    <step>Report stable/moderate/high variability, short/long, possible missing log, approximate, corrected, partner-assisted, context-change and history-count bands.</step>
  </steps>
  <verification>
    <command>npm run benchmark:cycle -- --dataset fixtures</command>
    <expected>Synthetic golden report matches expected metrics and leakage fixture fails when future input is intentionally enabled.</expected>
  </verification>
</task>

<task id="P4" name="Calibrate an 80 percent likely window">
  <description>Estimate person/history-band residual distributions, ensure nested intervals and widen/abstain with variability and limited history.</description>
  <files>
    <create>convex/_helpers/predictionIntervals.ts</create>
    <create>convex/_helpers/predictionIntervals.test.ts</create>
    <modify>scripts/cycle-benchmark.ts</modify>
  </files>
  <steps>
    <step>Write failing tests for point-inside-window, 80%-not-narrower-than-50%, monotonic variability and timezone stability.</step>
    <step>Fit calibration only on prior folds or a separate calibration split; never on the evaluated target.</step>
    <step>Use personal residuals when sufficient and shrink/blend to approved history-band calibration when sparse.</step>
    <step>Widen or abstain for high variability, context change, possible missing log and limited history.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/predictionIntervals.test.ts</command>
    <expected>All nesting, monotonicity, point containment, leap/date and abstention invariants pass.</expected>
  </verification>
</task>

<task id="P5" name="Persist immutable prediction snapshots">
  <description>Record what was generated/shown without copying raw history or mutating observations.</description>
  <files>
    <modify>convex/schema.ts</modify>
    <create>convex/internal/predictionSnapshots.ts</create>
    <create>convex/internal/predictionSnapshots.test.ts</create>
  </files>
  <steps>
    <step>Write tests for immutable model/input cutoff, point/window, quality, basis count, reason codes and visible/shadow status.</step>
    <step>Add indexes by user/generated time and outcome linkage.</step>
    <step>Store no raw event list, notes, pain values or partner-private context in a snapshot.</step>
    <step>On correction/deletion, mark affected snapshots superseded; never rewrite what the user previously saw.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/predictionSnapshots.test.ts</command>
    <expected>Snapshots are immutable, redacted and correctly superseded by cutoff-aware changes.</expected>
  </verification>
</task>

<task id="P6" name="Serve a versioned prediction contract">
  <description>Generate one point/window/quality/explanation output for cycle state, web, notification and future mobile clients.</description>
  <files>
    <create>convex/_helpers/periodPrediction.ts</create>
    <create>convex/_helpers/periodPrediction.test.ts</create>
    <modify>convex/queries/dashboard.ts</modify>
    <modify>convex/_helpers/cycleReadModel.ts</modify>
  </files>
  <steps>
    <step>Write failing contract tests for one start, 2–3 starts, 4–6 starts, stable, irregular, missing-log and paused histories.</step>
    <step>Return status, point, earliest/latest, confidence/quality, basis count, estimator version and explanation codes.</step>
    <step>Use configured baseline with `USER_CONFIGURED_BASELINE` and low confidence when personal evidence is insufficient.</step>
    <step>Never say personalized below three eligible intervals; permit the benchmark to require a higher threshold.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/_helpers/periodPrediction.test.ts convex/_helpers/cycleReadModel.test.ts</command>
    <expected>Contract fixtures pass and every point lies within its window.</expected>
  </verification>
</task>

<task id="P7" name="Replace exact-date-only prediction UI">
  <description>Show “most likely around,” an 80% likely window, basis count, quality and explanation; show timing-less-predictable or abstention when appropriate.</description>
  <files>
    <modify>components/dashboard/CurrentPhase.tsx</modify>
    <modify>components/dashboard/PhaseAura.tsx</modify>
    <modify>components/partner/PartnerDashboard.tsx</modify>
    <modify>app/(dashboard)/dashboard/page.tsx</modify>
    <modify>app/(dashboard)/dashboard/log/page.tsx</modify>
    <create>e2e/prediction-v2.spec.ts</create>
  </files>
  <steps>
    <step>Write failing regular/irregular/late/limited-history/paused assertions and accessible screenshots.</step>
    <step>Render point and window without deterministic “starts on” language.</step>
    <step>Explain basis and quality in plain language; keep detailed health-pattern notices private.</step>
    <step>Feature-flag separately for primary and partner projections.</step>
  </steps>
  <verification>
    <command>npx playwright test e2e/prediction-v2.spec.ts --project=chromium</command>
    <expected>Every prediction state is honest, accessible and sourced from the versioned contract.</expected>
  </verification>
</task>

## Preregistered promotion criteria

A candidate may replace the configured baseline only when all apply:

- Evaluation contains at least 1,000 eligible labeled walk-forward cycles overall. A subgroup requires at least 200 outcomes for a promotion claim; smaller groups remain descriptive and cannot receive High confidence.
- Against both configured-length and rolling-median baselines, paired mean absolute error improves by at least 0.25 calendar day and the 95% paired-bootstrap confidence interval for candidate-minus-baseline is below 0.
- Overall median absolute error does not worsen and within-±3-day rate does not decline.
- The named 80% likely window has 77–83% empirical coverage overall, and each sufficiently sized subgroup is within 75–85%; choose the narrowest candidate that meets coverage.
- No sufficiently sized subgroup worsens mean absolute error by more than 0.5 day or within-±3-day accuracy by more than 3 percentage points versus its stronger approved baseline.
- A wider historical distribution never produces higher confidence solely because more records exist.
- All displayed confidence bands are outcome-calibrated; otherwise display quality reasons without probabilistic confidence language.
- If sample-size or calibration criteria are not met, keep the candidate shadow-only and continue using an honestly labeled configured/rolling baseline.

These thresholds may be amended only before a new evaluation run, with owner, rationale and version history. They may not be loosened after viewing an unfavorable result.

## Hard product success criteria

- User-visible single-date certainty without a likely window or insufficient-data explanation: 0.
- “Personalized” below the approved eligible-history threshold: 0.
- Point outside likely window: 0.
- Snapshot missing model/input cutoff/display status/reason provenance: 0.
- Future-data leakage in golden benchmark traps: 0.
- Predictions modifying `periodEvents`: 0.
- Promotion without passing every preregistered overall, calibration and subgroup criterion: 0.

## Rollout and rollback

Run estimators and snapshots shadow-only first. Approve the benchmark artifact, then staff/test exposure, then a bounded primary-user pilot, then partner projection. Stop on calibration drift, subgroup stop condition, unexplained abstention change, snapshot mismatch or privacy incident. Roll back the display feature flag to the last approved honest baseline; preserve snapshots for audit.

## Exit evidence

Store protocol version, de-identified dataset manifest/hash, code/model versions, golden leakage tests, complete baseline/subgroup/calibration report, snapshot audit, privacy review, screenshots and pilot report under `docs/evidence/prediction-gate-3/`.
