# Gate 3 Menstrual-Cycle Prediction Literature Review

**Date:** 2026-09-20  
**Scope:** Evidence directly relevant to next-cycle timing, longitudinal variability, missing/self-tracking artifacts, calibrated uncertainty, and model choice for CB Connect Gate 3.

## Executive conclusion

The literature supports a conservative but technically ambitious Gate 3:

1. menstrual-cycle timing varies materially both across people and within the same person;
2. self-tracked app data mixes physiology with tracking/adherence behavior;
3. point accuracy alone is not enough—prediction intervals must be calibrated to observed outcomes;
4. robust personal statistics are an appropriate first user-facing baseline;
5. population-aware hierarchical models are scientifically promising, especially for sparse history and suspected skipped logging, but should remain shadow research until CB Connect has sufficient consented, representative outcomes and governance;
6. public/academic data can inform estimator design and initial calibration, but published cohorts must not be treated as a universal prior for CB Connect users.

This aligns with the existing major-release research dossier and the Gate 3 design freeze.

## 1. Real cycles are not a universal 28-day process

Bull et al. analysed 612,613 ovulatory cycles from 124,648 Natural Cycles users and reported a mean cycle length of 29.3 days with broad phase distributions. The cohort and ovulatory-cycle inclusion criteria mean the results are not a universal population prior, but they are strong evidence against fixed 28-day certainty and against presenting calendar-derived phase timing as observed physiology.

Source: Jonathan R. Bull et al., *Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles*, npj Digital Medicine 2, 83 (2019).  
https://www.nature.com/articles/s41746-019-0152-7  
https://pubmed.ncbi.nlm.nih.gov/31482137/

**Gate 3 implication:** personalized timing must be learned from the user's own eligible history; configured length is a baseline/default, not ground truth.

## 2. Within-person variability and tracking behavior both matter

Li et al. analysed more than 4.9 million natural cycles from over 378,000 Clue users. The study demonstrates substantial person-level variability and explicitly warns that self-tracked mobile-health data reflects both physiological behavior and user engagement/tracking behavior. The paper develops cycle-length difference as a useful variability concept, but its cohort restrictions must not be copied as universal clinical thresholds.

Source: Kathy Li et al., *Characterizing physiological and symptomatic variation in menstrual cycles using self-tracked mobile-health data*, npj Digital Medicine 3, 79 (2020).  
https://www.nature.com/articles/s41746-020-0269-8

**Gate 3 implications:**

- variability must influence prediction quality/window width;
- a long observed interval can represent a true long cycle, a missed log, or another tracking artifact;
- Gate 3 must preserve a suspicious interval and attach a quality/reason code instead of silently splitting, deleting, or clinically interpreting it;
- a single extreme interval should not be allowed to dominate a robust point estimator solely because it is recent.

## 3. Adherence-aware hierarchical modelling is the strongest later ML direction

Li et al.'s later next-cycle prediction work used more than two million tracked cycles from 186,106 users. The model represents each person's typical cycle behavior while also learning population-level information and a latent probability of skipped tracking. Predictions update as the current cycle evolves. In that study the hierarchical approach outperformed mean, median, CNN, RNN, and LSTM baselines, with particularly useful gains after the user's typical cycle length had already passed.

Source: Kathy Li et al., *A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking*, Journal of the American Medical Informatics Association 29(1):3–11 (2022 issue; published online 2021).  
https://academic.oup.com/jamia/article/29/1/3/6371799

Important limitations include self-tracked labels rather than physiological ground truth and cohort/data-selection assumptions. The published parameters are not transferable directly to CB Connect.

**Gate 3 implication:** reproduce/compare this methodology where dataset access permits, but do not ship a population-trained hierarchical prior in Gate 3.

**Research Gate 7 implication:** this is the primary model family to investigate once CB Connect satisfies its consent, cohort, lineage, subgroup, and independent-review entry criteria.

## 4. Calibration is a first-class prediction requirement

Urteaga et al. extend menstrual-cycle prediction with a flexible hierarchical generative model that estimates both expected cycle length and individual predictive dispersion. The paper emphasizes that healthcare prediction should quantify both physiological variability and uncertainty introduced by self-tracking behavior. It evaluates not only point prediction but calibration of the predictive distribution.

Source: Iñigo Urteaga et al., *A Generative Modeling Approach to Calibrated Predictions: A Use Case on Menstrual Cycle Length Prediction*, Proceedings of Machine Learning Research 149:535–566 (2021).  
https://proceedings.mlr.press/v149/urteaga21a.html  
https://pmc.ncbi.nlm.nih.gov/articles/PMC8782440/

**Gate 3 implications:**

- the likely range must be outcome-calibrated;
- high/medium/low prediction quality is distinct from a probability;
- two users can both have a valid 80% interval while one receives a much wider interval because their timing is less predictable;
- calibration and interval sharpness/width should be evaluated separately;
- personal residuals should be used when enough historical predictions exist, with externally calibrated history-band information used conservatively when personal residual history is sparse.

## 5. What the literature does not justify

The reviewed evidence does **not** justify any of the following for Gate 3:

- treating 28 days as a physiological norm for prediction;
- assuming every long interval is a true long biological cycle;
- assuming every long interval is a missed log;
- splitting a 58-day interval into two 29-day cycles without evidence;
- inferring PCOS, pregnancy, contraception, postpartum status, illness, medication effects, or lifestyle cause from cycle timing alone;
- exposing a neural model simply because it is more complex;
- claiming an arbitrary numeric "confidence percentage" without calibration;
- transferring source-cohort parameters to CB Connect as if the cohorts were interchangeable;
- using future observations when evaluating a historical prediction.

## 6. Recency and pattern change

The product hypothesis is that recent cycles may contain useful information about a changing personal pattern while older trustworthy history still matters. The academic record does not support a universal recency weight that can simply be copied into the product.

Gate 3 therefore treats recency as a preregistered candidate rather than a fixed truth:

- whole-history mean/median;
- rolling mean/median;
- recency-weighted estimator(s);
- configured baseline.

An isolated deviation should be expressed first through increased uncertainty unless the selected estimator has strong evidence to move the center. Persistent changes may shift the estimate over subsequent predictions. The winning behavior is determined by leakage-safe walk-forward evaluation, not intuition.

## 7. External-data policy for Gate 3

The owner-approved policy is **Level 2**:

- external academic data may be used to reproduce published work;
- it may be used to compare candidate estimators, understand variability/missingness, and derive initial history-band calibration;
- the final Gate 3 point predictor remains personal-history/configured-baseline driven;
- external datasets do not become a hidden population-trained point-prediction prior;
- dataset transfer limitations must be explicit in every report.

A paper being open access does not mean its underlying user dataset is publicly redistributable. Before an external dataset enters the benchmark, the dataset manifest must record:

- canonical source and version;
- license/terms or explicit research permission;
- permitted purpose;
- cohort and inclusion/exclusion rules;
- exact fields consumed;
- whether dates are absolute or transformed;
- de-identification status;
- known missingness/adherence behavior;
- user count and eligible cycle count;
- checksum/hash of the frozen local research artifact; and
- transfer limitations relative to CB Connect.

If no suitable real external dataset can be lawfully obtained, synthetic/reproduction fixtures remain sufficient to build the benchmark machinery, but they cannot establish real-world promotion evidence.

## 8. Model families to benchmark

### Required Gate 3 user-facing candidates

- configured cycle-length baseline;
- all-history arithmetic mean;
- all-history median;
- rolling mean;
- rolling median;
- preregistered recency-weighted estimator.

These are intentionally simple, auditable, and deterministic.

### Research-only comparators when data permits

- hierarchical generalized-Poisson / adherence-aware generative reproduction;
- other Bayesian hierarchical models with explicit posterior predictive checks;
- neural/RNN/LSTM baselines only for reproduction/comparison, not because they are preferred product candidates.

Research-only models must run outside the user request path and may not become visible Gate 3 output.

## 9. Reliability principles derived from the literature

Gate 3 should be judged on:

- time-ordered point error;
- percentage within ±1/2/3/5 days;
- likely-window empirical coverage;
- interval width/sharpness;
- error/coverage by variability band;
- error/coverage by history-count band;
- behavior on suspected missing-log histories;
- behavior after correction and context change;
- partner-assisted subgroup performance;
- abstention/insufficient-data behavior;
- calibration of internal quality buckets against actual subsequent error.

A globally better mean error is insufficient if highly variable users materially regress.

## 10. CB Connect implementation position

The evidence supports the existing repository architecture:

```text
Gate 1 trustworthy observations
        ↓
Gate 3 eligible start-to-start intervals
        ↓
versioned personal estimator candidates
        ↓
leakage-safe walk-forward benchmark
        ↓
calibrated likely window + quality
        ↓
immutable prediction snapshot
        ↓
one Convex serving contract
        ↓
web / partner / notifications / future mobile
```

Population-to-person ML remains a shadow research lane:

```text
approved Gate 3 benchmark + snapshots
        +
sufficient consented CB Connect outcomes
        ↓
Research Gate 7 hierarchical model
        ↓
held-out/subgroup comparison
        ↓
shadow only unless separately promoted
```

## References already incorporated elsewhere in the repository

This review narrows and operationalizes the broader evidence in:

- `docs/research/2026-08-01-major-release-cycle-trust-research.md`
- `docs/plans/2026-08-01-04-personalized-prediction-and-evaluation.md`
- `docs/plans/2026-08-01-08-probabilistic-shadow-model.md`

If later literature materially changes these assumptions, update this review and the benchmark protocol **before** opening a new locked evaluation holdout.
