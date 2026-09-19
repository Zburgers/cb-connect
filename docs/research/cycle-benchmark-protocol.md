# Gate 3 Cycle Prediction Benchmark Protocol

**Protocol version:** G3-BENCH-V1  
**Frozen:** 2026-09-20  
**Status:** Design frozen. Synthetic/golden implementation may begin. Real external/CB Connect outcome evaluation remains blocked until D-013 records dataset authority, permission/consent basis where applicable, and the named statistical/preregistration approver.

## 1. Purpose

Define the exact leakage, eligibility, estimator, split, metric, calibration, subgroup, and promotion rules for Gate 3 before candidate outcomes are inspected.

Changing this protocol after final-holdout outcomes are viewed requires a new protocol version and a new untouched holdout. Thresholds may never be weakened retroactively to rescue a failed candidate.

## 2. Prediction target

The target is the **next eligible exact period start date** for a primary user within the active prediction segment.

Gate 3 predicts start-to-start timing only. Period duration, pain, symptoms, mood, fertility observations, inferred diagnoses, and life-stage causes are not model inputs.

A prediction fold at cutoff `t` may use only information that existed at or before `t`. Later corrections, later starts, future segment changes, and later model outcomes are forbidden inputs.

## 3. Observation eligibility

An event is a start anchor when all apply:

- visible/not tombstoned;
- no `legacyReason`;
- `startCertainty === "exact"`;
- it belongs to the active eligible prediction segment for that fold; and
- its start date is at or before the fold cutoff.

Under D-009, an authorized current `partner_assist` exact start is immediately eligible. It does **not** require a second primary confirmation.

Legacy `confirmationStatus: "unreviewed"` is not treated as a current assistance workflow and is never silently promoted to exact/eligible truth.

Approximate and `legacy_unknown` observations remain visible history but are excluded from point-prediction start anchors.

## 4. Interval derivation

Sort eligible anchors by user, segment, and calendar date. Derive only consecutive start-to-start differences inside one segment.

Each derived interval records:

- `startDate` / `nextStartDate` only in ephemeral benchmark input, never generic evidence logs;
- interval length in calendar days;
- source/provenance category of each endpoint;
- inclusion state;
- reason codes; and
- correction/version cutoff metadata required to reproduce the fold.

Reason codes include at least:

- `LIMITED_HISTORY`
- `APPROXIMATE_DATE`
- `LEGACY_UNKNOWN`
- `POSSIBLE_MISSING_LOG`
- `CONTEXT_SEGMENT`
- `RECENT_CORRECTION`
- `PARTNER_ASSISTED`

`PENDING_PRIMARY_CONFIRMATION` is removed from the current assistance contract because D-009 accepts authorized partner assistance immediately.

### 4.1 Possible-missing-log heuristic

Gate 3 does not decide that an interval *is* a missed log. It may only mark a versioned data-quality suspicion.

`possible_missing_log_v1` is evaluated only when at least three preceding eligible intervals exist in the same active segment:

1. compute the median of the preceding eligible intervals, `m`;
2. for current interval `x`, require `x >= 1.75 * m`;
3. find the nearest multiple `k * m`, where `k ∈ {2, 3}`;
4. flag `POSSIBLE_MISSING_LOG` only when `abs(x - k*m) <= max(2, 0.15*m)`.

This is a tracking-quality heuristic, **not a clinical rule and not a truth label**. The interval is preserved and is never split into invented cycles. Baseline candidates still receive the observed interval according to their published definitions; robust candidates are expected to resist isolated extremes naturally. The flag may widen quality/calibration bands and is reported as a subgroup.

The heuristic itself must be stress-tested on synthetic cases before external outcomes are opened.

## 5. Personalization threshold

- Fewer than 3 eligible intervals: no `personalized` label.
- At least 3 eligible intervals: candidate is *eligible to be evaluated* as personalized.
- The approved user-facing threshold is the smallest preregistered history-count band that passes every promotion/calibration rule on the locked evaluation set.
- The threshold may become stricter than 3. It may not become looser than 3 after results are viewed.

Below the approved threshold, serve the configured-cycle baseline with `USER_CONFIGURED_BASELINE` and low/limited-evidence quality language.

## 6. Dataset classes

### 6.1 Synthetic golden data

Always allowed. Used for:

- exact-value estimator tests;
- leap/date/timezone cases;
- one-start / sparse-history behavior;
- stable, variable, shift, correction, segmentation, partner-assisted, and 28/29/58/28 histories;
- deliberate future-leakage traps;
- calibration nesting/point-containment invariants.

Synthetic data cannot establish real-world accuracy or calibration promotion.

### 6.2 External academic/research data

Allowed only after the D-013 dataset manifest records:

- source/version;
- license or explicit permission;
- permitted purpose;
- cohort and inclusion/exclusion rules;
- de-identification status;
- exact fields used;
- user/outcome counts;
- checksum/hash;
- missingness/adherence characteristics; and
- transfer limitations relative to CB Connect.

External data may inform estimator choice, robustness, subgroup behavior, and initial history-band calibration. It does **not** create a Gate 3 population-trained point predictor.

### 6.3 CB Connect outcomes

May enter the benchmark only under the approved D-013 analysis/consent basis. Pre-Gate-1/2 rows remain subject to Gate 1 eligibility and `legacy_unknown` exclusions.

Current CB Connect volume is not assumed sufficient for promotion. Small CB Connect samples are descriptive/prospective monitoring until the hard sample criteria are met.

## 7. Deterministic data partition

To prevent person leakage, each pseudonymous user belongs to exactly one partition using a stable salted hash recorded in the dataset manifest:

- development: 60%
- calibration: 20%
- locked evaluation holdout: 20%

The salt/version is frozen before outcome inspection and stored outside generic logs.

Within every user, all folds are chronological. A user's future observations never appear in the feature history for an earlier fold.

### Partition roles

**Development** may be used to debug implementation, compare preregistered candidate families, and select the single estimator family that advances.

**Calibration** is used to fit interval residual bands and internal quality mappings for the selected estimator version. It is not used to change promotion thresholds.

**Locked evaluation holdout** is opened once for G3-BENCH-V1 after implementation, metrics, subgroups, and calibration rules are frozen. It decides promotion.

If implementation or protocol changes after holdout review, create G3-BENCH-V2 and a new untouched holdout.

## 8. Preregistered point-estimator candidates

Every candidate is deterministic and versioned.

### `configured_v1`

Point interval = the user's configured `cycleLength`.

This is a baseline, not a personalized estimator.

### `all_mean_v1`

Arithmetic mean of every eligible interval in the active segment, rounded to nearest calendar day with half-up ties.

### `all_median_v1`

Median of every eligible interval in the active segment; for an even count use the arithmetic mean of the two middle values, then half-up round to calendar days.

### `last3_mean_v1`

Arithmetic mean of the most recent up-to-three eligible intervals. Requires at least three eligible intervals to carry a personalized label.

### `last3_median_v1`

Median of the three most recent eligible intervals. Requires at least three eligible intervals.

### `recency_exp_h3_v1`

Uses every eligible interval in the active segment with exponential recency weights whose half-life is three intervals:

```text
age = 0 for newest eligible interval
weight(age) = 2 ^ (-age / 3)
point = weighted_sum(interval * weight) / sum(weight)
```

Half-up round to whole calendar days.

This formula is a benchmark candidate, not a promise that recency is biologically correct.

### Initial promotion rule

Gate 3 promotes at most **one** personalized estimator version globally. Per-user algorithm routing, dynamic model selection, and meta-models are out of scope for V1.

## 9. Walk-forward folds

For each user with enough observations:

1. sort eligible starts ascending;
2. choose a target start `k`;
3. construct all intervals that were knowable strictly before start `k`;
4. generate the candidate prediction from the immediately preceding eligible start;
5. record point error and interval outcome;
6. advance one target and repeat.

Corrections use their historical authority cutoff. A correction made after a prediction was generated cannot be back-propagated into that prediction's input snapshot.

A deliberate leakage fixture must produce an unrealistically improved result when future data is intentionally enabled, and the production benchmark must fail if that path is reachable.

## 10. Point-prediction metrics

Report overall and required subgroups:

- mean absolute error (MAE);
- median absolute error;
- RMSE for literature comparison only;
- within ±1 day;
- within ±2 days;
- within ±3 days;
- within ±5 days;
- signed error distribution;
- candidate-minus-baseline paired differences; and
- abstention/insufficient-data rate.

Configured and rolling-median baselines are always reported even if another candidate is selected.

## 11. Variability bands

Variability is descriptive, not diagnostic.

For each fold, compute only from prior eligible intervals:

- median interval;
- median absolute deviation (MAD);
- cycle-length difference sequence `abs(interval_i - interval_(i-1))`;
- recent-vs-all-history median difference; and
- history count.

Development data defines stable/moderate/high variability cut points by preregistered empirical tertiles of robust dispersion. The numerical cut points are then frozen before calibration and final evaluation.

Do not copy a clinical or paper-specific irregularity threshold into CB Connect as a diagnosis rule.

## 12. Calibrated likely window

The displayed probabilistic target is an **80% likely interval** around the selected point estimate.

Calibration requirements:

- point must lie inside its own interval;
- an 80% interval must never be narrower than any 50% diagnostic interval derived from the same residual model;
- calibration uses only the calibration partition or prior personal walk-forward residuals;
- final target outcome is never used to size its own interval;
- intervals may be asymmetric when empirical residuals are asymmetric;
- higher robust variability must not produce a narrower interval solely because history count increased;
- possible-missing-log, recent-correction, sparse-history, and context-boundary conditions may widen the window;
- high variability alone does not suppress the best prediction when evidence is otherwise usable.

### 12.1 Personal residual blend

When at least five prior walk-forward residuals exist for that user under the selected estimator version, derive a personal empirical residual distribution and shrink it toward the approved calibration band.

With fewer than five personal residuals, use the approved calibration band directly.

The exact shrinkage implementation must be deterministic and unit-tested; it may not use the current target outcome.

### 12.2 Coverage target

For a displayed "80% likely" window:

- overall empirical coverage: 77–83%;
- every sufficiently sized subgroup: 75–85%;
- among candidates satisfying coverage, prefer the narrowest calibrated window subject to all point/subgroup promotion rules.

If calibration evidence is insufficient, do not show probabilistic percentage language. Return the point/range as an estimate with quality reasons until calibration is proven.

## 13. Internal quality score and user-facing quality

Gate 3 keeps probability and usefulness separate.

### Internal diagnostic

`qualityScoreV1` is internal-only and based on calibration evidence, not an arbitrary hand-weighted percentage.

For each approved history/variability/calibration band, calculate its empirical expected absolute-error distribution and calibrated window-width distribution. Rank the band into ten risk deciles on the calibration partition. Map:

```text
lowest-error/useful-width decile -> 100
...
highest-error/widest/least-supported decile -> 10
insufficient calibration -> null
```

The score must be monotonic with observed error on the calibration set and reported against the locked holdout. It is a model-quality diagnostic, **not "chance the period starts on the predicted date."**

### User-facing quality

Expose only an ordinal state plus reasons:

- `high`
- `moderate`
- `low`
- `timing_less_predictable`
- `limited_evidence`

A subgroup with fewer than 200 final-evaluation outcomes cannot support a High quality promotion claim.

## 14. Required subgroups

Report, at minimum:

- stable / moderate / high variability;
- history-count bands: 3, 4–6, 7–12, 13+ eligible intervals;
- short/long relative history bands defined from development data;
- `POSSIBLE_MISSING_LOG`;
- approximate/legacy exclusion-adjacent histories;
- recently corrected histories;
- partner-assisted histories;
- context-change/segment-boundary histories; and
- externally calibrated vs personal-residual-calibrated predictions.

Small groups remain descriptive.

## 15. Promotion criteria

A personalized estimator may replace the configured baseline only when all apply:

- at least 1,000 eligible labeled walk-forward cycles overall;
- at least 200 outcomes for any subgroup-level promotion claim;
- against both configured-length and rolling-median baselines, paired MAE improves by at least 0.25 calendar day and the 95% paired-bootstrap CI for candidate-minus-baseline is below 0;
- overall median absolute error does not worsen;
- within-±3-day rate does not decline;
- 80% coverage satisfies Section 12.2;
- no sufficiently sized subgroup worsens MAE by more than 0.5 day or within-±3-day accuracy by more than 3 percentage points versus its stronger approved baseline;
- wider historical dispersion never produces higher quality solely because there are more records; and
- snapshot/input-cutoff/leakage audits pass.

If any promotion criterion fails, keep the candidate shadow-only and continue with an honestly labelled configured/approved rolling baseline.

## 16. Product behavior for highly variable histories

When sufficient trustworthy history exists:

- still generate the best approved personalized point/range;
- widen the calibrated interval as required;
- lower the quality state;
- include a reason such as `RECENT_TIMING_VARIABLE`;
- do not replace uncertainty with deterministic copy; and
- do not diagnose a cause.

True abstention is reserved for invalid bounds, no usable start anchor, paused prediction, or insufficient/invalid calibration contract—not variability alone.

## 17. Partner projection

Benchmark/serving internals remain primary-private.

With sharing enabled, partner projection may include:

- broad point/likely date range;
- ordinal quality;
- broad phase/timing state;
- basis-count band rather than sensitive raw history count when appropriate; and
- privacy-safe care suggestions.

It excludes:

- raw period-event list;
- private context/segment labels;
- possible diagnosis language;
- detailed model residuals;
- internal quality score;
- dataset/model research metadata; and
- private health-pattern notices.

## 18. Immutable result artifacts

Every benchmark run records:

- protocol version;
- source-code commit;
- dataset manifest IDs/hashes;
- split salt/version identifier (not the secret salt itself);
- estimator IDs/versions;
- metric implementation version;
- subgroup definitions;
- calibration version;
- candidate outcomes;
- promotion verdict; and
- reviewer/approver record.

Artifacts must not contain direct identifiers, raw notes, Clerk IDs, Convex IDs, pain values, or unrestricted raw date histories.

## 19. Stop conditions

Stop qualification and do not promote on:

- detected future leakage;
- dataset permission/consent ambiguity;
- inability to reproduce the frozen manifest;
- subgroup material regression;
- calibration outside allowed coverage;
- snapshot/input mismatch;
- privacy incident;
- outcome-dependent protocol change; or
- any production exposure while D-012 remains unresolved.

## 20. Required implementation tests

At minimum:

- estimator exact-value golden tests;
- timezone/leap-day calendar arithmetic;
- 28/29/58/28 missing-log fixture;
- one-outlier vs persistent-shift fixtures;
- partner-assisted eligibility;
- primary correction and snapshot immutability;
- segment-boundary isolation/restoration;
- future-leakage trap;
- deterministic split assignment;
- point-inside-window and interval nesting;
- variability-to-width monotonicity;
- asymmetric residual interval case;
- internal quality-score monotonicity;
- insufficient calibration fallback; and
- subgroup/promotion verdict golden report.

No real candidate outcome report may be opened until D-013's remaining approval fields are recorded.
