# Gate 3 Personalized Prediction Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: use the native `shipyard:shipyard-executing-plans` skill to execute this plan task-by-task. Run spec-compliance review, then code-quality/security review, after every logical commit.

**Date:** 2026-09-20  
**Branch:** `codex/gate3implementation`  
**Base:** `origin/main` at Gate 2 merge `2f8dae22b6b2673c75e94d66985e749a303b92df`  
**Goal:** Replace legacy configured-date prediction with a benchmarked personal estimator, calibrated likely window, immutable audit trail, honest quality explanations, reduced partner projection, and a leakage-safe evaluation system without exposing unapproved ML or touching production.

**Architecture:** Gate 1 remains the observation authority. Gate 3 derives versioned start-to-start intervals from eligible exact facts inside a private active prediction segment, evaluates deterministic estimator candidates using a frozen chronological benchmark, calibrates likely windows, writes immutable prediction snapshots, and serves one versioned prediction contract into the existing Gate 2 state reducer. The Gate 2 state machine is retained; Gate 3 replaces the bounds-generation seam rather than creating a second state engine.

**Tech stack:** TypeScript, Convex 1.43, Vitest 4, convex-test, Next.js 15, React 19, Playwright, Node scripts.

---

## 1. Authority and frozen inputs

Read before implementation:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `docs/plans/2026-08-19-feature-first-delivery-design.md`
- `docs/plans/2026-08-01-cb-connect-major-release-program.md`
- `docs/plans/2026-08-01-04-personalized-prediction-and-evaluation.md`
- `docs/decisions/2026-09-20-gate-3-prediction-design-freeze.md`
- `docs/decisions/major-release-decision-register.md`
- `docs/research/2026-09-20-gate-3-prediction-literature-review.md`
- `docs/research/cycle-benchmark-protocol.md`
- the current Gate 1/2 helper tests and release QA scripts.

Current authoritative seam on `main`:

```text
eligible Gate 1 facts
    -> cycleReadModel
    -> createLegacyPredictionBounds(latest start + configured cycle length)
    -> Gate 2 cycleState reducer
```

Target seam:

```text
eligible Gate 1 facts
    -> active prediction segment
    -> cycleIntervals
    -> predictionEstimators
    -> predictionIntervals / quality
    -> periodPredictionV2
    -> PredictionBounds V2 adapter
    -> existing Gate 2 cycleState reducer
    -> primary + reduced partner projections
```

Do not reimplement cycle state, factual period coverage, timezone authority, or partner authorization in a second prediction engine.

## 2. Non-negotiable boundaries

- No production deploy, production data mutation, or production feature exposure from this branch.
- All stateful Convex QA operations use `bash scripts/convex-safe-exec test -- ...` only.
- Test Convex target remains `dev:hallowed-hummingbird-284`; approved Clerk environment remains `holy clerk`.
- D-012 blocks production exposure and final retention/deletion behavior.
- D-013 blocks opening real benchmark outcomes/promotion until dataset authority, applicable permission/consent basis, calibration/evaluation split, and named statistical/preregistration approval are recorded.
- D-015 blocks pilot size/rollout percentages only.
- D-016 continues to block Research Gate 7 population-model training on CB Connect data.
- No raw cycle dates, user IDs, notes, pain data, auth payloads, or unrestricted histories in generic benchmark/evidence logs.
- Additive/backward-compatible schema only.
- All Gate 3 feature flags are Convex-only, exact literal `"true"`, absent/other values mean disabled.
- Feature-off behavior must preserve the qualified Gate 1/2 path.

## 3. Locked contracts

### 3.1 Observation eligibility

Gate 3 start anchors use Gate 1 `isStartAnchorEligible`: visible, no legacy reason, exact start.

Authorized current partner-assisted exact starts are immediately eligible under D-009. Remove stale assumptions that they await primary confirmation.

Legacy `unreviewed` rows remain conservative legacy compatibility data.

### 3.2 Personalization

- fewer than 3 eligible intervals: configured baseline, not personalized;
- 3+ intervals: eligible for benchmarked personalization;
- final approved threshold may be stricter if the frozen benchmark requires it.

### 3.3 Variability

High variability widens range and lowers quality; it does not by itself suppress the best prediction.

### 3.4 Model selection

Benchmark multiple deterministic candidates but promote one global estimator version first. Per-user model routing is deferred.

### 3.5 Confidence

User-facing:
- calibrated likely range;
- ordinal quality;
- basis count/band;
- plain-language reason codes.

Internal:
- versioned `qualityScoreV1` diagnostic permitted;
- no arbitrary user-visible 0–100/% confidence.

### 3.6 Data scope

Point prediction uses start-to-start timing only. End duration, pain, symptoms, mood, diagnoses, fertility signals, and inferred context causes are excluded.

### 3.7 Missing logs

Preserve suspicious long intervals. Never invent missing period starts. Attach `POSSIBLE_MISSING_LOG` using the frozen protocol heuristic and evaluate it as a subgroup.

## 4. Dependency map

```text
G3.0 docs/flags/policy
  |
  +--> G3.1 private segmentation
  |      |
  |      +--> G3.3 interval derivation
  |
  +--> G3.2 narrow partner correction
  |      |
  |      +--> G3.3
  |
  +--> G3.4 estimator interface
           |
G3.3 -----+--> G3.5 benchmark harness
           |       |
           |       +--> G3.6 calibration/quality
           |
           +--> G3.7 immutable snapshots
                   |
G3.4 + G3.6 + G3.7 --> G3.8 serving contract / Gate 2 adapter
                              |
                              +--> G3.9 primary UI
                              +--> G3.10 partner projection/care
                              +--> G3.11 notification consumer parity
                                      |
                                      +--> G3.12 authenticated E2E
                                              |
                                              +--> G3.13 qualification/evidence
```

Tasks sharing a file are sequential. Do not parallelize schema mutations or the serving-contract integration.

---

# Shipyard execution tasks

## Task G3.0 — Reconcile policy, capability, and stale Gate 3 assumptions

**Files**

- Create: `convex/_helpers/periodPredictionFlag.ts`
- Create: `convex/_helpers/periodPredictionFlag.test.ts`
- Modify: `convex/queries/capabilities.ts`
- Modify: relevant capability tests
- Modify: `scripts/tests/deploy-workflow.test.sh`
- Modify only if required by test: rollout/policy docs

**RED**

Write tests proving:

- `CB_CONNECT_PERIOD_PREDICTION_V2 === "true"` enables primary V2;
- malformed/false/unset disable it;
- `CB_CONNECT_PARTNER_PREDICTION_V2 === "true"` is a separate partner projection capability;
- there is no `NEXT_PUBLIC_*` mirror;
- feature-off keeps Gate 2 V1 output unchanged.

**Implement**

Add server-only capability helpers and expose booleans through authenticated `getCapabilities`. Do not wire user-visible behavior yet.

**Verify**

```bash
npx vitest run convex/_helpers/periodPredictionFlag.test.ts
npm run test:ci-workflow
bash scripts/tests/deploy-workflow.test.sh
```

**Commit:** `feat: define Gate 3 prediction capabilities`

---

## Task G3.1 — Add private user-controlled prediction segments

**Files**

- Modify: `convex/schema.ts`
- Create: `convex/_helpers/predictionSegments.ts`
- Create: `convex/_helpers/predictionSegments.test.ts`
- Create: `convex/mutations/cycleContext.ts`
- Create: `convex/mutations/cycleContext.test.ts`
- Modify: `convex/queries/history.ts`
- Modify: `convex/queries/history.test.ts`
- Modify later UI only after backend passes: `app/(dashboard)/dashboard/log/page.tsx` or settings/history surface selected by current UX

**Schema**

Add `cyclePredictionSegments`:

- `userId`
- `startDate`
- `status: active | superseded`
- `supersedesSegmentId?`
- `createdAt`
- `supersededAt?`

Indexes:
- `by_user_and_status`
- `by_user_and_created_at`

Do not add segment IDs to existing `periodEvents`.

**Behavior**

- zero segment rows means all eligible history is the default active segment;
- primary can start a new baseline only from one of their own visible exact eligible start dates;
- mutation supersedes the previous active segment and inserts a new active segment transactionally;
- "restore earlier history" creates a new segment version with an earlier approved eligible start date rather than mutating/deleting old segment records;
- prediction pause remains independent;
- segment metadata never appears in partner projection.

**RED fixtures**

- no segment;
- create segment from eligible exact self start;
- create segment from accepted partner-assisted exact start;
- reject approximate/legacy/tombstoned/foreign date;
- new segment excludes earlier facts;
- restoration includes prior facts again;
- only one active row after each mutation;
- partner cannot mutate segments.

**Verify**

```bash
npx vitest run convex/_helpers/predictionSegments.test.ts convex/mutations/cycleContext.test.ts convex/queries/history.test.ts
npm run typecheck
```

**Commit:** `feat: add private prediction history segments`

---

## Task G3.2 — Add narrow partner correction for assisted records

**Files**

- Modify: `convex/mutations/periods.ts`
- Modify: `convex/mutations/periods.test.ts`
- Modify: `convex/_helpers/periodEventInvariants.ts` only if the existing interface cannot express targeted partner correction
- Modify: relevant history projection/UI permission field tests

**Contract**

Add a targeted partner-assisted correction mutation that:

- requires active couple membership and current period-write permission;
- requires `periodEventId` and `expectedAuthorityVersion`;
- only permits correction of a live `source: "partner_assist"` event created by the currently authorized partner;
- validates start/end calendar dates in the primary user's authoritative timezone;
- uses existing overlap/authority invariants;
- increments `authorityVersion`;
- preserves `source: "partner_assist"`;
- never sets `primaryCorrectionVersion`;
- cannot undo a primary correction/tombstone or override primary authority.

Primary `updatePeriodEvent` and `deletePeriodEvent` continue to win.

**RED**

Prove allowed self-created assisted correction and rejection after:
- revocation;
- share-off;
- stale authority version;
- primary correction;
- tombstone;
- attempt to edit a primary-created record;
- attempt to edit another user's record.

**Verify**

```bash
npx vitest run convex/mutations/periods.test.ts
npm run typecheck
```

**Commit:** `feat: allow scoped partner correction of assisted facts`

---

## Task G3.3 — Derive auditable eligible start-to-start intervals

**Files**

- Create: `convex/_helpers/cycleIntervals.ts`
- Create: `convex/_helpers/cycleIntervals.test.ts`
- Modify: `convex/queries/history.ts`
- Modify: `convex/queries/history.test.ts`

**Interface**

Return pure derived intervals containing only the fields needed by prediction/evaluation:

- calendar-day length;
- endpoint provenance category;
- basis cutoff/version;
- inclusion state;
- reason codes.

Do not mutate `periodEvents`.

**RED fixtures**

- stable 28/29 sequence;
- variable history;
- approximate start exclusion;
- `legacy_unknown` exclusion;
- tombstone exclusion;
- accepted partner-assisted exact anchor;
- primary correction;
- segment boundary;
- restored earlier segment;
- 28/29/58/28 possible-missing-log case;
- insufficient history.

Implement `possible_missing_log_v1` exactly as frozen in `docs/research/cycle-benchmark-protocol.md`.

**Verify**

```bash
npx vitest run convex/_helpers/cycleIntervals.test.ts convex/queries/history.test.ts
```

**Commit:** `feat: derive auditable cycle prediction intervals`

---

## Task G3.4 — Implement versioned deterministic estimator candidates

**Files**

- Create: `convex/_helpers/predictionEstimators.ts`
- Create: `convex/_helpers/predictionEstimators.test.ts`

**Candidates**

Implement exactly the frozen candidate IDs:

- `configured_v1`
- `all_mean_v1`
- `all_median_v1`
- `last3_mean_v1`
- `last3_median_v1`
- `recency_exp_h3_v1`

Use half-up whole-day rounding and exact deterministic tie handling from the protocol.

Estimator result includes:

- estimator ID/version;
- point cycle length;
- basis count;
- personalization eligibility;
- reason codes.

No candidate reads environment variables or database state.

**RED**

Exact values for:
- stable histories;
- odd/even medians;
- sparse history;
- one outlier;
- persistent shift;
- 28/29/58/28;
- recency-weight formula;
- deterministic ties/rounding.

**Verify**

```bash
npx vitest run convex/_helpers/predictionEstimators.test.ts
```

**Commit:** `feat: add versioned Gate 3 estimator candidates`

---

## Task G3.5 — Build leakage-safe benchmark, manifests, and deterministic split

**Files**

- Create: `scripts/cycle-benchmark.ts`
- Create: `scripts/cycle-benchmark.test.ts`
- Create: `scripts/cycle-benchmark-manifest.ts`
- Create: `scripts/cycle-benchmark-manifest.test.ts`
- Create: `fixtures/cycle-benchmark/golden.json` or equivalent synthetic fixture location that contains no real user data
- Modify: `package.json`
- Modify: `package-lock.json`
- Keep `docs/research/cycle-benchmark-protocol.md` frozen unless a pre-outcome protocol version bump is approved

**Behavior**

- deterministic salted user-level 60/20/20 development/calibration/evaluation split;
- chronological walk-forward folds inside every user;
- exact input cutoff;
- no future corrections or later segment state in earlier folds;
- complete metrics/subgroups from the protocol;
- a deliberate leakage trap that fails when future data is enabled;
- manifest refuses unapproved/unknown external dataset source metadata;
- final evaluation command refuses to run until an explicit approved manifest/authority record exists.

Add a pinned development-only TypeScript script runner (`tsx`) to `devDependencies` and the lockfile unless the then-current repository already has an equivalent pinned runner. Do not rely on an unpinned `npx` download.

Suggested scripts:

```json
"benchmark:cycle:golden": "tsx scripts/cycle-benchmark.ts --dataset fixtures --partition development",
"benchmark:cycle": "tsx scripts/cycle-benchmark.ts"
```

The benchmark runner is tooling only; it must not enter the application/runtime dependency path.

**D-013 guard**

Synthetic/golden development may run. Real development/calibration/final outcome commands must fail closed until the manifest includes the approved D-013 authority fields.

**Verify**

```bash
npx vitest run scripts/cycle-benchmark.test.ts scripts/cycle-benchmark-manifest.test.ts
npm run benchmark:cycle:golden
```

**Commit:** `feat: add leakage-safe cycle benchmark`

---

## Task G3.6 — Calibrate likely windows and internal quality diagnostics

**Files**

- Create: `convex/_helpers/predictionIntervals.ts`
- Create: `convex/_helpers/predictionIntervals.test.ts`
- Create: `convex/_helpers/predictionQuality.ts`
- Create: `convex/_helpers/predictionQuality.test.ts`
- Modify: `scripts/cycle-benchmark.ts`

**Contract**

Return:

- earliest date;
- point date;
- latest date;
- calibration source/version;
- empirical target coverage level when approved;
- ordinal quality;
- optional internal `qualityScoreV1`;
- explanation reason codes.

Implement:

- calibration from calibration partition and/or prior personal walk-forward residuals only;
- personal residual threshold >=5 before personal blend;
- asymmetric intervals when residuals justify them;
- point always inside range;
- 80% not narrower than 50% diagnostic interval;
- monotonic widening with higher approved variability/risk band;
- high variability = widen/lower quality first, not automatic abstention;
- `qualityScoreV1` as calibration risk decile mapping from the frozen protocol.

Do not expose numeric score to users.

**RED**

- stable vs variable window width;
- one outlier widens before major center change;
- persistent shift;
- asymmetric residuals;
- sparse calibration fallback;
- insufficient calibration prevents `80%` probability language;
- quality score monotonicity;
- timezone/leap-day stability.

**Verify**

```bash
npx vitest run convex/_helpers/predictionIntervals.test.ts convex/_helpers/predictionQuality.test.ts
```

**Commit:** `feat: calibrate Gate 3 prediction uncertainty`

---

## Task G3.7 — Add immutable prediction snapshots and assessment events

**Files**

- Modify: `convex/schema.ts`
- Create: `convex/internal/predictionSnapshots.ts`
- Create: `convex/internal/predictionSnapshots.test.ts`

**Schema**

Create immutable `predictionSnapshots` with at least:

- `userId`;
- generated timestamp;
- input cutoff;
- estimator ID/version;
- interval/calibration version;
- point/earliest/latest dates;
- ordinal quality;
- optional internal score;
- basis count;
- bounded reason-code list;
- `displayStatus: shadow | visible`;
- prediction-segment identity/reference; and
- feature/contract version.

Indexes:
- by user/generated time;
- by user/input cutoff.

Create append-only `predictionSnapshotAssessments` for later outcome/supersession facts:

- snapshot ID;
- type `outcome | superseded`;
- observed eligible start date when applicable;
- absolute/signed error and inside-window boolean when applicable;
- source event authority version/reference only where privacy-safe;
- reason;
- recordedAt.

Do not rewrite snapshot point/window/model/input fields after creation.

Do not store notes, pain, raw event lists, partner-private context, Clerk IDs, or unrestricted provenance blobs.

**RED**

- immutable core snapshot;
- outcome appends without rewrite;
- later primary correction supersedes affected evaluation state;
- later predictions use corrected history;
- old displayed snapshot remains exactly reproducible;
- indexes are bounded.

**Verify**

```bash
npx vitest run convex/internal/predictionSnapshots.test.ts
npm run typecheck
```

**Commit:** `feat: persist immutable prediction snapshots`

---

## Task G3.8 — Serve one V2 prediction contract through the Gate 2 seam

**Files**

- Create: `convex/_helpers/periodPrediction.ts`
- Create: `convex/_helpers/periodPrediction.test.ts`
- Modify: `convex/_helpers/predictionBounds.ts`
- Modify: `convex/_helpers/predictionBounds.test.ts`
- Modify: `convex/_helpers/cycleState.ts`
- Modify: `convex/_helpers/cycleState.test.ts`
- Modify: `convex/_helpers/cycleReadModel.ts`
- Modify: `convex/_helpers/cycleReadModel.test.ts`
- Modify: `convex/queries/dashboard.ts`
- Modify: dashboard query tests
- Modify: `convex/queries/history.ts` internal prediction input path

**V2 contract**

At minimum:

- `version: 2`;
- status: configured / personalized / limited_evidence / paused / unavailable;
- point date;
- earliest/latest;
- approved probability label only when calibrated;
- ordinal quality;
- basis count;
- estimator ID/version;
- calibration version;
- reason codes;
- snapshot/display identity where permitted.

Below approved personalization threshold use configured baseline and `USER_CONFIGURED_BASELINE`.

Upgrade `PredictionBounds` to a backward-compatible V1/V2 union. Gate 2 reducer continues consuming generic bounds and must preserve no-rollover semantics.

Feature-off continues to call `createLegacyPredictionBounds` exactly as before.

**RED**

- 1 start;
- 2–3 intervals;
- 4–6;
- stable;
- highly variable;
- one outlier;
- persistent shift;
- possible missing log;
- accepted partner-assisted anchor;
- segment boundary;
- paused;
- correction after prior snapshot;
- every point inside range;
- no `personalized` below threshold;
- no probability label without approved calibration.

**Verify**

```bash
npx vitest run convex/_helpers/periodPrediction.test.ts convex/_helpers/predictionBounds.test.ts convex/_helpers/cycleState.test.ts convex/_helpers/cycleReadModel.test.ts
```

**Commit:** `feat: serve versioned personal period predictions`

---

## Task G3.9 — Replace primary exact-date prediction UI

**Files**

- Create: `components/dashboard/predictionPresentation.ts`
- Create: `components/dashboard/predictionPresentation.test.ts`
- Modify: `components/dashboard/CurrentPhase.tsx`
- Modify: `components/dashboard/PhaseAura.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: relevant log/history/settings surfaces for segment control and prediction explanation

**UI rules**

When V2 is exposed:

- "Most likely around …"
- calibrated "80% likely range …" only when calibration contract says probability language is allowed;
- otherwise "Estimated range …";
- High / Moderate / Low / Timing less predictable / Limited evidence;
- basis count or safe basis description;
- explanation reasons in plain language;
- no deterministic "starts on";
- no internal quality score;
- no diagnostic/life-stage inference.

For highly variable history, keep the best range visible and explain that timing has varied.

**Verify**

```bash
npx vitest run components/dashboard/predictionPresentation.test.ts
npm run typecheck
npm run build
```

**Commit:** `feat: render honest personalized prediction ranges`

---

## Task G3.10 — Build reduced partner prediction and care projection

**Files**

- Modify: `convex/_helpers/partnerCycleProjection.ts`
- Modify: `convex/_helpers/partnerCycleProjection.test.ts`
- Create: `components/partner/partnerPredictionPresentation.ts`
- Create: `components/partner/partnerPredictionPresentation.test.ts`
- Modify: `components/partner/PartnerDashboard.tsx`
- Modify: partner dashboard/page surfaces
- Modify or add policy test for care copy

**Projection**

Only when active relationship, membership, sharing and prediction partner flag all allow it.

May include:

- broad point/range;
- ordinal quality;
- broad phase/timing state;
- safe basis band;
- care-oriented suggestions.

Must exclude:

- raw event IDs/history;
- internal score;
- detailed residuals;
- private context/segment metadata;
- possible diagnosis/medical interpretation;
- research dataset/model metadata.

Care copy follows Gate 2's "Ideas, not assumptions" contract and D-011 exposure boundary. It may suggest generic supportive actions but may not claim the primary "will feel" a mood/hormonal state.

**Verify**

```bash
npx vitest run convex/_helpers/partnerCycleProjection.test.ts components/partner/partnerPredictionPresentation.test.ts
npm run typecheck
```

**Commit:** `feat: add privacy-safe partner prediction guidance`

---

## Task G3.11 — Unify notification prediction inputs without shipping Gate 4

**Files**

- Modify: `convex/queries/history.ts`
- Modify: `convex/queries/history.test.ts`
- Modify: `convex/actions/notifications.ts`
- Modify/add focused notification tests

The existing notification action consumes `internal.queries.history.getPredictionInputsForUser`. Prevent it from becoming a competing prediction implementation.

When Gate 3 is enabled, the internal query must consume the same V2 `periodPrediction` contract or an internal privacy-safe projection of it. When disabled, retain legacy behavior.

Do **not** redesign notification delivery, consent, outbox, or push in Gate 3; those remain Gate 4/6.

**Verify**

```bash
npx vitest run convex/queries/history.test.ts convex/actions/notifications.test.ts
```

If the repository has no action test at that exact path, create the narrowest existing-pattern test file rather than skipping verification.

**Commit:** `refactor: unify notification prediction source`

---

## Task G3.12 — Add isolated authenticated Gate 3 E2E

**Files**

- Create: `e2e/prediction-v2.spec.ts`
- Modify: release diagnostics/support only when required
- Modify: `scripts/run-gates-0-2-qa.sh` by creating a new Gate 0–3 runner or safely extending it; do not contaminate existing evidence semantics
- Add policy test for isolated destructive lanes

**Fixtures**

Every destructive spec/project lane gets a fresh synthetic fixture pair.

Cover desktop and mobile for:

- configured baseline / limited history;
- stable personalized history;
- variable personalized history;
- 28/29/58/28 possible-missing-log behavior;
- one outlier;
- persistent shift;
- segment reset/restoration;
- partner-assisted exact start immediately affecting prediction;
- partner correction;
- primary correction;
- pause;
- partner sharing on/off/revocation;
- feature flags off;
- probability language absent when calibration unavailable.

No silent skip.

All stateful target operations go through:

```bash
bash scripts/convex-safe-exec test -- ...
```

**Verify**

```bash
npx playwright test --config=playwright.release.config.ts e2e/prediction-v2.spec.ts --project=release-desktop
npx playwright test --config=playwright.release.config.ts e2e/prediction-v2.spec.ts --project=release-mobile
```

**Commit:** `test: qualify Gate 3 authenticated prediction flows`

---

## Task G3.13 — Run deterministic qualification and produce redacted evidence

**Files**

- Create/update only after real runs: `docs/evidence/prediction-gate-3/REPORT.md`
- Create/update manifest/report files that contain no raw identifying/cycle-history data
- Update `docs/plans/README.md`
- Update `issues.md` only for evidence-backed unresolved defects

**Deterministic gate**

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:convex-safe-exec
npm run test:convex-command-policy
npm run test:fixture-evidence-boundary
npm run test:ci-workflow
bash scripts/tests/deploy-workflow.test.sh
npm run benchmark:cycle:golden
```

Run authenticated isolated Gate 0–3 matrix against the approved test target.

Do not run real external/final benchmark outcomes until D-013 is complete.

**Evidence report must state separately**

- code qualification verdict;
- synthetic benchmark verdict;
- D-013 real-outcome benchmark status;
- calibration status;
- user-visible probability-language status;
- D-012 production exposure status;
- D-015 pilot status;
- exact branch/head/tree/CI run IDs;
- rollback = Gate 3 flags off, preserving snapshots/facts.

**Commit:** `docs: record Gate 3 qualification evidence`

---

## 5. Promotion and rollback

### Engineering completion

Gate 3 code may be called engineering-complete when:

- all tasks through G3.13 that are not specifically blocked by D-013/D-012/D-015 pass;
- synthetic golden benchmark and leakage traps pass;
- feature-off regression path passes;
- authenticated test target passes;
- snapshots and partner projection audits pass.

### Model promotion

A personalized estimator may be approved only after the frozen G3-BENCH-V1 final holdout passes every criterion in `docs/research/cycle-benchmark-protocol.md`.

If the sample/calibration criteria fail, keep the candidate shadow-only and serve the configured/approved baseline honestly.

### Production exposure

Not authorized by this plan. D-012 and the separate production exposure decision must be resolved first.

### Rollback

Set:

```text
CB_CONNECT_PARTNER_PREDICTION_V2=false
CB_CONNECT_PERIOD_PREDICTION_V2=false
```

through the guarded target-specific process. Preserve prediction snapshots and assessments for audit; do not reverse or fabricate `periodEvents`.

---

## 6. Hard success criteria

- future-data leakage: 0;
- prediction writes into `periodEvents`: 0;
- invented missing periods: 0;
- partner-assisted exact observations incorrectly held pending under D-009: 0;
- user-visible arbitrary numeric confidence: 0;
- point outside displayed range: 0;
- "personalized" below approved history threshold: 0;
- displayed 80% language without approved outcome calibration: 0;
- automatic hard segmentation without primary action: 0;
- private segment/model diagnostics leaked to partner: 0;
- predictions continuing past latest Gate 2 bound by modulo rollover: 0;
- snapshot core rewritten after later correction: 0;
- promotion after any preregistered criterion fails: 0.

## 7. Review gates

After every task:

1. **Spec compliance:** does the implementation exactly satisfy the frozen design/protocol and preserve prior Gate 1/2 invariants?
2. **Code quality:** deep module boundaries, deterministic tests, bounded reads/indexes, no duplicate prediction logic.
3. **Security/privacy:** authorization, partner projection, artifact/log redaction, no production selector access.
4. **Simplification:** do not add framework/ML infrastructure beyond what the task needs.
5. **Documentation:** update only durable contracts/evidence; do not manufacture Shipyard state.

Any schema, privacy, model-selection, benchmark, or production-boundary divergence pauses execution and requires plan revision before dependent work continues.
