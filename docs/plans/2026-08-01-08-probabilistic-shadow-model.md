# Probabilistic Shadow Model Research Implementation Plan

> **Codex/Shipyard execution:** This research design requires consent, cohort and statistical-review approval plus a dated execution plan; it never authorizes user-visible ML.

**Goal:** Determine whether an adherence-aware hierarchical probabilistic model can safely outperform CB Connect's approved statistical predictor without exposing experimental outputs to users.

**Architecture:** An access-controlled offline Python research workspace consumes a versioned de-identified event extract and produces immutable artifacts/metrics. PyMC is the provisional modeling environment because it supports explicit hierarchical distributions and posterior predictive checks; Python never enters the user request path. Approved shadow outputs are imported into the existing prediction snapshot registry and scored only when later confirmed outcomes exist.

**Tech Stack:** Python, PyMC, ArviZ, optional local/database-backed MLflow metadata tracking, TypeScript benchmark bridge, Convex shadow snapshots.

---

**Depends on:** Clean consented Gate 1 facts, Gate 3 benchmark/snapshots, and Gate 0 governance. It may research in parallel after those data prerequisites but cannot block Gates 4–6.

**Research reference:** [Li et al. adherence-aware model review](../research/2026-08-01-major-release-cycle-trust-research.md#43-the-most-relevant-future-model-is-probabilistic-and-adherence-aware)

**User exposure:** None. Promotion requires a new approved PRD/plan.

**Planning status:** Research design only. Resolve D-001, D-012, D-013 and D-016 and meet the hard cohort/data prerequisites before writing a dated research execution plan. Research may not delay Gates 4-6 or enter a user request path.

**Required task order:** ML1 governance/environment -> ML2 consented versioned manifest -> ML3 TypeScript/Python golden parity -> ML4 model criticism/simulation -> ML5 immutable lineage -> ML6 frozen held-out/subgroup evaluation -> ML7 isolated shadow import/scoring -> ML8 drift/disable policy. Any future display requires a separate PRD and rollout plan.

## Entry criteria

- Explicit research-training consent is purpose-specific and distinct from product prediction consent.
- Deletion/withdrawal, dataset retention, de-identification, access logging and jurisdictional review are approved.
- At least 500 consented users and 5,000 eligible confirmed outcomes exist after time-ordered holdout and subgroup accounting; otherwise use only synthetic/public/reproduction data and do not train a CB Connect population model.
- The Gate 3 protocol and baseline code are frozen before candidate results are viewed.
- A qualified statistical/ML reviewer and privacy reviewer are named.

## Implementation tasks

<task id="ML1" name="Create research governance and reproducible environment">
  <description>Isolate Python dependencies, access policy, deterministic seeds and artifact handling from application runtime.</description>
  <files>
    <create>research/cycle-model/pyproject.toml</create>
    <create>research/cycle-model/uv.lock</create>
    <create>research/cycle-model/README.md</create>
    <create>research/cycle-model/config/base.yaml</create>
    <create>docs/ml/research-governance.md</create>
    <modify>.gitignore</modify>
  </files>
  <steps>
    <step>Pin Python/PyMC/ArviZ versions and deterministic seed policy.</step>
    <step>Ignore raw extracts, posterior draws and local experiment databases by default.</step>
    <step>Define roles, access logs, approved storage, retention, withdrawal/deletion and incident response.</step>
    <step>Document that the model is not for fertility, contraception, diagnosis or observed ovulation.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv sync --frozen &amp;&amp; uv run python -c "import pymc, arviz"</command>
    <expected>Frozen environment installs and imports without application production dependencies.</expected>
  </verification>
</task>

<task id="ML2" name="Export a versioned de-identified dataset manifest">
  <description>Create a cutoff-aware extraction with consent, eligibility, provenance and lineage but no direct identifiers or free text.</description>
  <files>
    <create>convex/internal/researchExport.ts</create>
    <create>convex/internal/researchExport.test.ts</create>
    <create>research/cycle-model/src/data_manifest.py</create>
    <create>research/cycle-model/tests/test_data_manifest.py</create>
  </files>
  <steps>
    <step>Write synthetic tests for consent withdrawal, pending assistance, legacy unknown, segmentation, correction and cutoff leakage.</step>
    <step>Pseudonymize users with a research-specific rotating mapping held outside the artifact.</step>
    <step>Exclude names, emails, Clerk/Convex IDs, notes, pain values and exact created-by identities.</step>
    <step>Hash and record schema/query/code versions, cutoff, row counts, reason counts and access approval.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/researchExport.test.ts &amp;&amp; cd research/cycle-model &amp;&amp; uv run pytest tests/test_data_manifest.py</command>
    <expected>Consent/eligibility/leakage tests pass and forbidden fields never serialize.</expected>
  </verification>
</task>

<task id="ML3" name="Reproduce simple baselines across the Python bridge">
  <description>Prove the research dataset and metric implementations exactly match the approved TypeScript Gate 3 benchmark.</description>
  <files>
    <create>research/cycle-model/src/baselines.py</create>
    <create>research/cycle-model/src/metrics.py</create>
    <create>research/cycle-model/tests/test_golden_bridge.py</create>
    <modify>scripts/cycle-benchmark.ts</modify>
  </files>
  <steps>
    <step>Export a synthetic golden dataset/report from the TypeScript benchmark.</step>
    <step>Implement configured, mean, median, rolling and recency baselines in Python only for metric parity.</step>
    <step>Fail on any fold, eligibility, rounding, interval or subgroup mismatch.</step>
    <step>Use one canonical metric definition/version in every experiment report.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv run pytest tests/test_golden_bridge.py</command>
    <expected>Python and TypeScript predictions/metrics match exactly on all golden fixtures.</expected>
  </verification>
</task>

<task id="ML4" name="Implement and criticize hierarchical adherence model">
  <description>Model population/person cycle distributions and possible skipped tracking while preserving uncertainty and avoiding certainty about individual missing logs.</description>
  <files>
    <create>research/cycle-model/src/model.py</create>
    <create>research/cycle-model/src/train.py</create>
    <create>research/cycle-model/src/predict.py</create>
    <create>research/cycle-model/tests/test_model.py</create>
    <create>docs/ml/model-card-template.md</create>
  </files>
  <steps>
    <step>Write recovery tests using simulated known parameters and known skipped-log mechanisms.</step>
    <step>Specify priors explicitly; perform prior predictive checks before fitting real data.</step>
    <step>Fit only training folds, run convergence diagnostics and posterior predictive checks.</step>
    <step>Return a next-start distribution and internal possible-missing-log probability; never convert it into an invented period or user-facing assertion.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv run pytest tests/test_model.py</command>
    <expected>Simulation recovery, prior/posterior predictive, convergence-failure and abstention tests pass.</expected>
  </verification>
</task>

<task id="ML5" name="Track immutable experiments and artifacts">
  <description>Record dataset/code/config/model/metric versions and approvals without placing sensitive data or posterior samples in an unsecured registry.</description>
  <files>
    <create>research/cycle-model/src/experiment.py</create>
    <create>research/cycle-model/tests/test_experiment.py</create>
    <create>docs/ml/artifact-register.md</create>
  </files>
  <steps>
    <step>Start with local metadata tracking; add a protected database-backed MLflow registry only if concurrent team use justifies it.</step>
    <step>Log dataset hash/cutoff, Git commit, environment lock hash, config, seeds, metrics and artifact checksums.</step>
    <step>Keep extracts/posterior draws in approved encrypted storage with separate access.</step>
    <step>Require reviewer sign-off before an artifact becomes shadow-eligible.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv run pytest tests/test_experiment.py</command>
    <expected>Run replay resolves exact inputs/artifacts and forbidden sensitive fields fail validation.</expected>
  </verification>
</task>

<task id="ML6" name="Evaluate against every approved baseline and subgroup">
  <description>Run time-ordered walk-forward/held-out evaluation, calibration, interval width, abstention and paired uncertainty analyses.</description>
  <files>
    <create>research/cycle-model/src/evaluate.py</create>
    <create>research/cycle-model/tests/test_leakage.py</create>
    <create>docs/ml/promotion-policy.md</create>
  </files>
  <steps>
    <step>Freeze train/calibration/test users and cutoffs before model selection.</step>
    <step>Compare configured, all-history/rolling statistics, recency estimator and the shipped Gate 3 estimator.</step>
    <step>Apply Gate 3 overall/calibration/subgroup criteria plus model-specific diagnostics.</step>
    <step>Publish negative/null results and retain the statistical baseline when the model does not materially improve it.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv run pytest tests/test_leakage.py &amp;&amp; uv run python -m src.evaluate --dataset heldout</command>
    <expected>Leakage traps pass and a signed immutable evaluation report is produced.</expected>
  </verification>
</task>

<task id="ML7" name="Run shadow snapshots and delayed outcome scoring">
  <description>Generate non-visible predictions, import them through protected internal functions and score only after a later confirmed eligible start.</description>
  <files>
    <create>convex/internal/shadowPredictions.ts</create>
    <create>convex/internal/shadowPredictions.test.ts</create>
    <create>research/cycle-model/src/shadow_export.py</create>
    <modify>convex/schema.ts</modify>
  </files>
  <steps>
    <step>Write signature/version/user-mapping/duplicate/outcome-correction tests.</step>
    <step>Import only point/distribution summary, window, model version, cutoff and reasons; never raw features/history.</step>
    <step>Set `shadow_only` immutably and exclude the candidate from all user/partner/notification queries.</step>
    <step>Score when a confirmed eligible outcome appears; treat absent log as missing label, not lateness ground truth.</step>
  </steps>
  <verification>
    <command>npx vitest run convex/internal/shadowPredictions.test.ts</command>
    <expected>Shadow outputs never enter public read models and correction/missing-label scoring is cutoff-aware.</expected>
  </verification>
</task>

<task id="ML8" name="Monitor drift and require separate promotion decision">
  <description>Track input eligibility, calibration/error/subgroup drift and operational failures while forbidding automatic retraining or display.</description>
  <files>
    <create>research/cycle-model/src/monitor.py</create>
    <create>research/cycle-model/tests/test_monitor.py</create>
    <create>docs/runbooks/shadow-model-disable.md</create>
    <modify>docs/ml/promotion-policy.md</modify>
  </files>
  <steps>
    <step>Define drift thresholds from approved baseline variance and minimum sample sizes.</step>
    <step>Alert on data/schema/consent shift, calibration miss, subgroup regression and artifact mismatch.</step>
    <step>Disable shadow import on threshold breach; retain the shipped statistical predictor.</step>
    <step>Require a new PRD, model card, legal/privacy/clinical review and user-facing rollout plan before any display experiment.</step>
  </steps>
  <verification>
    <command>cd research/cycle-model &amp;&amp; uv run pytest tests/test_monitor.py</command>
    <expected>Every simulated drift/consent/artifact breach disables shadow processing and creates an owned alert.</expected>
  </verification>
</task>

## Hard research success criteria

- Training record without explicit active research consent: 0.
- Direct identifier, free text, pain value or raw history artifact in model/experiment registry: 0.
- Future-data or same-user cross-fold leakage against the frozen protocol: 0.
- Experimental output visible to user, partner or notification query: 0.
- Absent log scored as confirmed biological lateness: 0.
- Model must pass every Gate 3 promotion criterion against the **stronger of the two approved baselines and the shipped statistical estimator**.
- Additionally, model mean absolute error must improve by at least 0.25 day with paired-bootstrap 95% interval below 0, 80% interval coverage must remain within 77–83% overall, and no sufficiently sized subgroup may exceed Gate 3's 0.5-day/3-point regression limits.
- Convergence diagnostics, simulation recovery, prior/posterior predictive checks and independent statistical review all pass.
- Dataset, code, environment, config, seed and artifact lineage is reproducible: 100% shadow runs.
- Automatic retraining/promotion: 0 until a separately approved operational policy exists.

Passing these criteria establishes research merit only. It does not authorize user-visible ML.

## Disable and retention behavior

Any consent, lineage, leakage, calibration, subgroup, convergence or security failure disables shadow generation/import. Delete/withdraw affected research artifacts according to approved governance while retaining only legally permitted audit metadata. The production statistical predictor and user journeys remain unaffected.

## Exit evidence

Store governance approvals, cohort/power report, de-identified manifest hashes, golden parity, simulation/diagnostics, immutable experiment lineage, full held-out/subgroup/calibration report, shadow isolation tests, drift rehearsal and model card under restricted `docs/evidence/ml-shadow-gate-7/`. A public model requires a new decision and plan.
