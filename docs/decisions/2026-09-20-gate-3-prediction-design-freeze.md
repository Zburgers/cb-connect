# Gate 3 Prediction Design Freeze

**Date:** 2026-09-20  
**Status:** Product/model contract approved for implementation planning. This document does not authorize production exposure, destructive migration, real-data benchmark outcome viewing, or Research Gate 7 user-visible ML.

## Purpose

Freeze the product and modelling decisions required to turn Gate 3 from a gate-level concept into an implementation-ready plan. These decisions reconcile the current Gate 1/2 implementation, D-009, the Gate 3 work packages, and the owner's September 20 design review.

## Locked product/model decisions

1. **Personalization threshold is evidence-gated.** Three eligible start-to-start intervals is the provisional floor. The preregistered benchmark may require a stricter threshold before the UI uses the word `personalized`; it may not relax the threshold after outcome review.
2. **External academic data is Level-2 input for Gate 3.** Properly usable/licensed external datasets may be used for reproduction, estimator comparison, robustness studies, subgroup analysis, and initial history-band calibration. They do not supply a population-trained point-prediction model to Gate 3 users. User-visible point predictions are generated from the user's configured baseline plus their own eligible history.
3. **Promote one global estimator first.** Gate 3 benchmarks multiple preregistered candidates, but the first approved user-facing release promotes one globally approved estimator version. Per-user estimator routing or meta-model selection is deferred until a prospective baseline exists.
4. **Automatic adaptation does not silently create hard context segments.** Numerical shifts may move the estimate and widen/narrow uncertainty automatically. A hard history boundary remains an explicit primary-user action. Future automatic change-point detection may be evaluated as a shadow/suggestion signal but must not silently exclude history in Gate 3.
5. **Authorized partner-assisted exact observations are immediately eligible.** D-009 remains authoritative. Partner assistance is not a pending-approval workflow. Provenance remains explicit; the primary user's later correction/deletion always wins.
6. **Partner correction authority is narrow.** While assist permission remains active, a partner may correct partner-assisted records that they are authorized to manage, subject to the existing authority-version checks. The partner may not gain unrestricted edit authority over primary-created history. Primary correction/deletion remains final.
7. **User-facing confidence is not an arbitrary percentage.** The UI shows an outcome-calibrated likely range plus an ordinal quality/confidence state and explanation reasons. Any internal numeric quality score is diagnostic only unless its semantics are empirically calibrated.
8. **Subjective prediction feedback does not become a cycle label.** "That prediction felt wrong" may be stored/analysed as product feedback, but confirmed eligible period starts are the modelling outcomes that score prior predictions.
9. **Gate 3 is start-to-start prediction.** Period end/duration remains factual cycle-state information but is not a Gate 3 point-prediction feature. Pain, symptoms, mood, fertility observations, diagnosis labels, and inferred life-stage causes are excluded from the Gate 3 predictor.
10. **Partner projection remains reduced and care-oriented.** With sharing enabled, the partner may receive broad timing/window/quality information and privacy-safe "how to show care" guidance. Private context segmentation, detailed model diagnostics, raw reasons, health-pattern metadata, and research/model internals remain primary-private.
11. **Evaluation uses development, calibration, and locked final holdout partitions.** Each user's evaluation is chronological/walk-forward. Dataset authority, subgroup definitions, metrics, calibration policy, and promotion thresholds are frozen before the final holdout is opened.
12. **Irregularity reduces certainty; it does not abandon the user.** With sufficient trustworthy history, Gate 3 should produce the best defensible personalized range even for highly variable histories. Variability widens the interval, lowers quality, and adds a "timing less predictable" explanation. True abstention is reserved for unusable/insufficient evidence or an invalid prediction contract, not variability alone.
13. **One unusual interval should increase uncertainty before it can dominate the center.** The full eligible history is preserved. Robust estimators are expected to resist isolated extremes; persistent recent shifts may move the point estimate if the frozen benchmark supports the selected estimator.
14. **Possible missing logs are preserved, never repaired into invented cycles.** A sequence such as 28/28/58 is retained as observed history with `POSSIBLE_MISSING_LOG` quality metadata. The system must not silently split 58 into 29+29 or delete it. Robust estimator choice and calibration must prevent one questionable extreme from silently dictating the point estimate.
15. **Whole history is retained; recency is a candidate signal, not an article of faith.** All trustworthy history remains available for audit/evaluation. Rolling and recency-weighted candidates may give recent observations greater predictive influence, but the winning behavior is selected only by the frozen walk-forward benchmark.
16. **Prediction feedback loop is immutable.** A later exact start both scores the prediction that preceded it and becomes evidence for future predictions. Corrections/deletions update future predictions but never rewrite what a prior snapshot actually showed.

## Confidence contract

Gate 3 separates probability from usefulness:

- **Likely-window coverage** is a probabilistic claim and must be outcome-calibrated before displaying a percentage such as "80% likely range".
- **Prediction quality** is an ordinal product state such as High / Moderate / Low / Timing less predictable.
- **Internal quality diagnostics** may include a numeric score for engineering analysis, but it remains internal unless a future calibration study establishes safe user-facing semantics.

Quality/calibration may use, at minimum:

- eligible-history count;
- personal cycle dispersion;
- recent cycle-length surprise/change;
- walk-forward residual history;
- empirical interval coverage and width;
- possible-missing-log flags;
- recent corrections;
- context-segment boundaries;
- approximate/legacy exclusions; and
- subgroup calibration evidence.

No arbitrary hand-tuned weighted sum may be presented as probability.

## Context segmentation contract

Gate 3 adds the missing private segmentation primitive assumed by the existing Gate 3 plan:

- exactly one active prediction segment per primary user;
- explicit primary action starts a new segment;
- old events remain immutable/readable and are not deleted;
- current predictions use the active segment by default;
- prior segments may be explicitly restored;
- no medical reason is required or inferred;
- segment metadata is private and excluded from partner projections; and
- statistical change detection may affect prediction uncertainty or later suggest a segment, but does not silently create one.

Prediction pause remains independent from segmentation.

## Partner-assisted observation contract

D-009 controls prediction eligibility:

- an authorized partner-assisted exact start is accepted immediately and may affect the next prediction;
- `source: "partner_assist"` and actor provenance remain preserved;
- legacy `confirmationStatus: "unreviewed"` is not reinterpreted as a current partner-approval workflow;
- the primary may correct or tombstone any of their cycle events under the existing authority model;
- a partner correction, if implemented, is scoped to authorized assisted records and must use optimistic authority/version checks; and
- benchmark reports retain `partner-assisted` as an explicit subgroup.

This supersedes stale Gate 3 wording that implied all partner-assisted observations wait for primary confirmation.

## External-data boundary

Gate 3 may use external academic data to select and calibrate methodology, but must not claim those cohorts are representative of CB Connect users. Open-access publication does not imply the underlying dataset is redistributable. Every external dataset admitted to the benchmark requires a manifest entry covering source, license/permission, cohort definition, fields used, exclusions, de-identification, hash/version, and known transfer limitations.

No external population prior is inserted into the Gate 3 point predictor. Hierarchical population-to-person modelling remains Research Gate 7.

## Deferred capabilities

The following are intentionally not Gate 3 user-visible features:

- hierarchical Bayesian/adherence-aware population model;
- neural/RNN/LSTM/global-regression predictor;
- automatic diagnostic interpretation of irregularity;
- automatic inference of PCOS, pregnancy, contraception, postpartum state, illness, medication, or lifestyle cause;
- symptoms/pain/mood as prediction features;
- automatic hard change-point segmentation;
- fertility/contraception/ovulation prediction claims; and
- per-user algorithm selection.

## Governance boundaries

- **D-013:** Product choices above are frozen, but real benchmark outcome viewing/promotion still requires approved dataset authority, consent/legal basis where applicable, the calibration/evaluation split, and the named preregistration/statistical review authority.
- **D-012:** Production exposure and final retention/deletion behavior remain blocked.
- **D-015:** Pilot cohort size, staffing, observation window, and staged rollout remain deferred until pilot preparation.
- **D-016:** Research Gate 7 consent/cohort/storage/access/reviewer requirements remain unchanged.

## Implementation handoff

Use the dated Gate 3 implementation plan and the frozen benchmark protocol. Any change to estimator candidates, eligibility rules, split strategy, metrics, subgroup definitions, calibration semantics, or promotion thresholds after benchmark outcomes are viewed requires a new protocol version and must not retroactively weaken the failed criteria.
