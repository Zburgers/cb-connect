# Shipyard Lessons Learned

## 2026-08-20 Phase Gate 1: Trustworthy Cycle Facts

### What Went Well
- Keeping cycle facts additive, Convex-authoritative and flag-off by default allowed the implementation to qualify without authorizing production exposure.

### Surprises / Discoveries
- A legacy reason must dominate exact-looking certainty fields on reads; partially annotated historical rows can otherwise become prediction inputs.

### Pitfalls to Avoid
- Never use a server or runner timezone as a fallback for an identified user's calendar date, and never treat a configured duration or later start as an observed end.

### Process Improvements
- Reconcile the dated plan, decision register, evidence report and issue tracker together before opening the PR so implementation status and remaining Gate 2 work cannot drift.

---

## 2026-09-20 Phase Gate 3: Personalized Prediction Planning

### What Went Well
- Product/model behavior was grilled before implementation: personalization, variability, partner-assisted evidence, missing logs, segmentation, confidence, external-data use, model selection, and partner projection are now explicit instead of being left to an implementation agent.
- The benchmark protocol was frozen before real candidate outcomes, preserving a clean development/calibration/locked-evaluation separation.

### Surprises / Discoveries
- The Gate 3 gate-level plan still contained stale pending-primary-confirmation language even though D-009 and the current partner-assisted write path accept authorized partner assistance immediately.
- Gate 3 assumed an active history segment, but current main only implements prediction pause; the private segmentation primitive still needs to be built.
- Open-access papers do not imply their underlying app datasets are redistributable or transferable to CB Connect.

### Pitfalls to Avoid
- Do not turn an internal quality score into a user-visible probability. Only calibrated interval coverage may use probabilistic language.
- Do not let one long/suspicious interval silently become two invented cycles, and do not delete it to improve metrics.
- Do not tune eligibility, subgroup definitions, estimator candidates, calibration rules, or promotion thresholds after opening the locked holdout.
- Do not insert external population-trained parameters into the Gate 3 point predictor; that belongs to Research Gate 7.

### Process Improvements
- Treat the design freeze, literature review, G3-BENCH-V1 protocol, and dated execution plan as one atomic planning packet.
- A missing D-013 authority blocks only real outcome evaluation/promotion; synthetic/golden benchmark machinery and default-off application implementation may proceed.

---
