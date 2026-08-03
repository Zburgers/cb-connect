# CB Connect major-release research: cycle intelligence, trust, and reliability

**Status:** Research basis approved for reliability-first release planning
**Date:** 2026-08-01
**Repository baseline:** `main` at `05af78335a0fc17683813bea6faac9c33ef34106`
**Live evidence checked:** GitHub issues/PRs/actions, public health endpoint, and Convex production function metadata on 2026-08-01
**Purpose:** Establish current truth, compare feasible cycle-prediction approaches, and define decisions required before a major-release design and implementation plan.

**Approved program:** [Reliability-first major-release roadmap](../plans/2026-08-01-cb-connect-major-release-program.md)

## 1. Research question

What can CB Connect credibly ship as its next major release that:

1. closes the MVP's trust and production-reliability defects;
2. keeps recorded health facts separate from estimates;
3. improves period predictions for both stable and variable histories without diagnosing PCOS or claiming observed ovulation;
4. produces auditable evidence that predictions and care-sharing behavior are safe and reliable; and
5. leaves a feasible path to probabilistic ML only if it beats simple baselines.

This document is research, not authorization to implement or deploy.

## 2. Current repository and production truth

### 2.1 What is implemented

The application has a substantial MVP surface. It includes Clerk authentication, Convex persistence and subscriptions, primary/partner roles, onboarding, period and pain logging, cycle settings, calendar-derived phases and predictions, seeded guidance, pairing, sharing controls, revocation, period-history correction/export, notifications, presence, nudges, private couple messaging, reactions, and message receipts.

The implementation is primarily under `app/`, `components/`, `convex/`, and `lib/`. The deployed Git branch is `main`; `.github/workflows/deploy.yml` triggers on pushes to `main`.

### 2.2 What can be confirmed as deployed

- `origin/main` and the checkout both resolve to `05af783`.
- GitHub Actions run `30399933598` successfully built and restarted commit `05af783` on self-hosted runner `razor-crest`.
- `https://cb.nakshatraneuratech.dev/api/health` returns HTTP 200 and `{ "status": "ok", "service": "cb-connect" }`.
- Production Convex function metadata for `festive-malamute-715` exposes the period-assist functions and the newer chat functions `markDelivered`, `markRead`, and `unreadSummary`.

This does **not** prove an authenticated two-user production journey, frontend/backend version alignment, PM2 startup persistence, prediction-cron correctness, or rollback readiness. The health response has no commit/build/backend identifiers. The workflow does not deploy Convex or run a post-restart smoke check.

### 2.3 Fresh local qualification

On the research baseline:

- `npm run typecheck`: passed.
- `npm run test:unit -- --run`: 5 files and 27 tests passed.
- `npm run build`: passed; 12 App Router routes generated.
- `npx playwright test --list`: 39 tests discovered.
- Static suite review: 32 individual browser tests are explicitly skipped; the two chat tests require an optional `CB_CONNECT_AUTH_STATE` file.
- `npm audit --omit=dev`: 9 reported vulnerabilities (6 high, 3 moderate).

A passing build is useful implementation evidence, but it is not release qualification for authentication, consent boundaries, real-time two-user behavior, scheduled effects, or production persistence.

## 3. PRD v1 completion audit

`docs/cb-connect-technical-prd.md` is a January 2026 draft and product background, not guaranteed current truth. Its 34 implementation checkboxes were never updated. The audit below asks whether each phase meets the intent of the stated deliverable, not merely whether a similarly named file exists.

| PRD phase | Met | Partial or defective | Missing | Assessment |
|---|---:|---:|---:|---|
| 1. Foundation (6) | 4 | 2 | 0 | Core stack/dashboard/logging exists. Webhook trust and period backend invariants remain incomplete. |
| 2. Cycle logic (5) | 1 | 4 | 0 | Settings exist. Calculation, phase, onboarding recovery, and exact-date prediction are present but do not meet the PRD's “accurate” deliverable. |
| 3. Tips system (5) | 5 | 0 | 0 | Seed, retrieval, display, and hiding exist. Clinical/content review remains a separate release concern. |
| 4. Partner features (6) | 3 | 3 | 0 | Linking/dashboard/toggles exist. Pairing resistance, lifecycle/data rights, and phase-inferred partner guidance remain trust concerns. |
| 5. Notifications (5) | 2 | 3 | 0 | Action and review UI exist. Consent/destination, retry idempotency, user-local scheduling, and prediction semantics are incomplete. |
| 6. Polish/testing (7) | 0 | 3 | 4 | Some tests, security remediation, and performance work exist. Comprehensive tests, measured performance, mounted route error handling, analytics/observability, UAT, and edge-case closure do not meet release-grade intent. |
| **Total (34)** | **15** | **15** | **4** | **Most feature names exist; the “production-ready MVP” deliverable is not complete.** |

Important requirement-level mismatches include:

- No use of Convex optimistic updates was found, although PRD section 6.1 requires immediate optimistic UI with rollback.
- Period mutations on deployed `main` do not enforce future-date, duplicate, overlap, or maximum-duration rules described by the PRD.
- `components/common/ErrorBoundary.tsx` exists but no mounted use was found.
- The PRD's latency targets have no production instrumentation or SLO evidence.
- The deployment guide says Actions runs tests and deploys to a server via SSH; the workflow actually builds in place on a self-hosted runner and restarts PM2.
- The release history says “v1.0.0,” while `package.json` remains `0.1.0` and the repository has no published release/tag evidence.

The correct conclusion is therefore: **the MVP feature skeleton is largely delivered, but PRD v1's production-readiness, validation, performance, testing, and reliability promises are not.**

## 4. Cycle and prediction research findings

### 4.1 A calendar phase is not an observed biological phase

Bull et al. analyzed 612,613 ovulatory cycles and found broad follicular- and luteal-phase distributions; their conclusion is that fertility timing cannot be responsibly reduced to standardized cycle assumptions. The cohort was drawn from Natural Cycles users and included only ovulatory cycles, so its population is not a universal prior for CB Connect. It is nevertheless strong evidence against presenting a midpoint calendar partition as observed ovulation. [Bull et al., 2019](https://www.nature.com/articles/s41746-019-0152-7)

Johnson et al. compared cycle-length calendar methods with urinary LH observations from 949 volunteers. For a 28-day cycle, the most likely ovulation day was day 16 with only 21% probability, and cycle-length-only app accuracy was no better than 21%. CB Connect should not call its fixed four-day midpoint block an observed “ovulation window,” and it must explicitly exclude fertility/contraception use. [Johnson et al., 2018](https://pubmed.ncbi.nlm.nih.gov/29749274/)

Symul et al. analyzed more than 30 million tracked days from over 2.7 million cycles across two fertility-awareness apps. Their Hidden Markov Model estimated that only 24% of ovulations occurred on cycle days 14–15. The study relied on retrospective self-observations from users of symptothermal fertility-awareness apps and did not provide hormonal ground truth for every cycle; its inferred phase timing must not be treated as a universal population prior. It reinforces that calendar day alone cannot confirm ovulation and that physiological observations would still need validation for any future ovulation-detection claim. [Symul et al., 2019](https://www.nature.com/articles/s41746-019-0139-4)

### 4.2 Self-tracked data contains physiology and tracking behavior

Li et al. studied 4.9 million app-derived cycles and explicitly developed procedures to separate tracking artifacts from plausible physiological cycles. The work also provides a useful variability statistic—cycle length difference—but its selected cohort was aged 21–33 and excluded hormonal-birth-control and other records, so its threshold must not be copied as a universal clinical rule. [Li et al., 2020](https://www.nature.com/articles/s41746-020-0269-8)

For CB Connect this means a 58-day start-to-start interval is not automatically a 58-day biological cycle and is not automatically two 29-day cycles. It needs a quality/reason code and, where appropriate, a confirmation prompt. The system should preserve the user's account rather than silently “cleaning” it into an invented fact.

### 4.3 The most relevant future model is probabilistic and adherence-aware

Li et al.'s later model used more than two million tracked cycles from 186,106 users. It modeled a person's typical cycle length and probability of skipped tracking hierarchically, updated predictions as the current cycle evolved, and outperformed mean, median, CNN, RNN, and LSTM baselines—especially after a typical cycle length had passed. The reported day-zero RMSE improvement over the mean baseline was small (7.38 versus 7.50 days); the large benefit appeared in late-cycle/missing-log cases. The authors also acknowledge no physiological ground truth and exclude user-marked anomalous and greater-than-90-day cycles. [Li et al., 2021](https://academic.oup.com/jamia/article/29/1/3/6371799)

This supports a later adherence-aware hierarchical model. It does **not** support copying the paper's parameters, training a per-user neural network, or claiming that an app can distinguish a long cycle from a missed log with certainty.

### 4.4 Irregularity handling must be contextual and non-diagnostic

The 2023 international PCOS guideline defines irregular cycles by years since menarche and life stage, advises that irregularity should prompt consideration/assessment, and states that ovulatory dysfunction can occur even with apparently regular cycles. Cycle dates alone are therefore insufficient for a PCOS diagnosis or for a claim of ovulation. [International PCOS Guideline, 2023](https://integration.asrm.org/practice-guidance/practice-committee-documents/recommendations-from-the-2023-international-evidence-based-guideline-for-the-assessment-and-management-of-polycystic-ovary-syndrome/)

FIGO's reference for many adults aged 18–45 describes menstrual frequency of 24–38 days and age-dependent regularity, while also emphasizing that regularly timed bleeding does not prove ovulation. These are clinician-oriented descriptive references, not safe universal UI limits or automatic diagnoses. [FIGO ovulatory-disorders classification](https://academic.oup.com/humrep/article/37/10/2446/6670602)

CB Connect should say “your recorded timing has varied” and offer a private history for professional discussion. It should not say “you may have PCOS,” infer pregnancy, or expose a health-pattern flag to a partner without explicit sharing.

WHO's January 2026 PCOS fact sheet describes irregular or absent menstruation as only one possible feature and explains that diagnosis considers at least two criteria after excluding other causes, with life stage and additional clinical assessment taken into account. This is direct support for a non-diagnostic product boundary: calendar history can describe a recorded pattern, but it cannot establish PCOS, ovulation, pregnancy, infertility, or a cause. [WHO PCOS fact sheet, 2026](https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome)

### 4.5 Review of every source supplied in the initial audit

| Source | Reliable use in CB Connect planning | Important limitation or prohibited inference |
|---|---|---|
| [Bull et al., 2019](https://www.nature.com/articles/s41746-019-0152-7) | Demonstrates broad cycle and phase-length variability and supports individualized, uncertainty-aware timing | Natural Cycles cohort; only cycles with detected ovulation were analyzed; not a universal prior |
| [Symul et al., 2019](https://www.nature.com/articles/s41746-019-0139-4) | Demonstrates wide inferred ovulation timing and the value/limitations of dense self-tracking | Retrospective fertility-awareness-app data and modeled timing; does not validate CB Connect's calendar partition |
| [Johnson et al., 2018](https://pubmed.ncbi.nlm.nih.gov/29749274/) | Shows cycle-length-only calendar methods cannot accurately identify an individual's ovulation day | Supports a warning and claim boundary, not a replacement ovulation algorithm |
| [International PCOS Guideline, 2023](https://integration.asrm.org/practice-guidance/practice-committee-documents/recommendations-from-the-2023-international-evidence-based-guideline-for-the-assessment-and-management-of-polycystic-ovary-syndrome/) | Provides age/life-stage-aware clinical context and supports non-diagnostic pattern notices | Clinical guideline; must not be reduced to a universal app threshold |
| [WHO PCOS fact sheet, 2026](https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome) | Confirms PCOS has multiple possible features and requires broader diagnostic assessment | A fact sheet, not a model specification or screening algorithm |
| [FIGO ovulatory-disorders classification](https://academic.oup.com/humrep/article/37/10/2446/6670602) | Useful clinician-reviewed terminology and descriptive frequency/regularity context | Regularly timed bleeding does not prove ovulation; reference ranges are not universal UI limits |
| [Li et al., 2021](https://academic.oup.com/jamia/article/29/1/3/6371799) | Closest architectural reference for a future adherence-aware hierarchical model | Proprietary self-tracked cohort, no physiological ground truth, selected histories; parameters are not transferable |
| [Li et al., 2020](https://www.nature.com/articles/s41746-020-0269-8) | Supports provenance/engagement filtering, variability analysis, and explicit tracking-artifact handling | Selected cohort and research eligibility procedures are not clinical rules |

All eight supplied sources are now represented in this dossier. None justifies fertility, contraception, diagnosis, observed-ovulation, hormonal-state, mood, libido, or partner-behavior claims from CB Connect's current inputs.

## 5. Architecture options

| Option | What ships | Benefits | Costs and failure modes | Recommendation |
|---|---|---|---|---|
| A. Trust foundation + robust personal statistics | Fact/inference separation, validated events, explicit state machine, median/rolling/recency baselines, calibrated windows, snapshots, evaluation harness | Explainable, testable, fits TypeScript/Convex, works with small histories, creates clean future data | Less impressive marketing; intervals may be wide; calibration needs enough evaluation data | **Recommended for the next user-facing release** |
| B. Hierarchical Bayesian/adherence-aware model | Population prior, user posterior, skipped-log probability, daily posterior updates | Best scientific fit for sparse personal histories and late cycles; produces distributions | Needs a large consented/de-identified cohort, specialist modeling, offline training/registry, drift and subgroup governance; paper parameters are not transferable | Build only as a later shadow research track |
| C. Global regression/neural sequence model | Features feed a boosted model, RNN, LSTM, or small neural network | Familiar tooling; can add covariates | Sparse/noisy labels, opaque failure modes, difficult calibration, privacy/governance burden, and published neural baselines did not dominate the hierarchical model | Reject for the next release |
| D. Keep the fixed slider and improve copy only | Existing date calculation with softer wording | Lowest engineering effort | Does not use history, does not fix rollover/history corruption, and provides no auditable improvement | Reject |

What would change the recommendation: a sufficiently large, explicitly authorized, representative dataset with clean provenance; a preregistered walk-forward benchmark showing meaningful and calibrated subgroup gains; and operational capacity for model versioning, rollback, monitoring, and incident response.

### 5.1 Cross-client and notification architecture research

The mobile client should be an Expo/React Native application rather than a WebView wrapper or a second web rewrite. Convex officially supports React Native through its React client, and `ConvexProviderWithClerk` works with Clerk's React-based Expo SDK. Clerk's prebuilt native Expo components are currently beta, so CB Connect should keep auth behavior behind a small adapter and use custom branded flows unless beta acceptance is explicitly approved. [Convex React Native](https://docs.convex.dev/client/react-native), [Convex and Clerk](https://docs.convex.dev/auth/clerk), [Clerk Expo SDK](https://clerk.com/docs/reference/expo/overview)

Expo Application Services supports internal iOS/Android distribution, managed signing, CI integration and later store submission. This makes a development-build/internal-beta progression more feasible than immediate public parity. It does add Expo/EAS vendor dependency and native-runtime version governance; a bare React Native migration remains an escape hatch if unsupported native requirements later emerge. [EAS Build](https://docs.expo.dev/build/introduction/)

The backend—not either client—must own observation eligibility, cycle state, prediction generation, sharing projection and notification-event creation. Web and mobile should consume one versioned read model. Shared packages may contain pure types, schema validators and design tokens, but never a separately evolving prediction implementation.

For notifications, the durable in-app inbox should be canonical and remote channels should be adapters. An accepted Expo push ticket is not device delivery; Expo requires receipt checking and token invalidation handling and states that its push service has no SLA. Therefore trust metrics must separate event-created, queued, provider-accepted, provider-receipted, opened and acted-on states. Sensitive health values should be absent from generic lock-screen previews by default. [Expo push delivery and receipts](https://docs.expo.dev/push-notifications/sending-notifications/)

Remote push requires a development build and real notification credentials; it is not an Expo Go acceptance test. Push qualification therefore follows mobile internal beta rather than blocking the first navigation/auth shell. [Expo notification requirements](https://docs.expo.dev/push-notifications/what-you-need-to-know/)

Mobile security acceptance should use the OWASP MASVS categories for storage, authentication, networking, platform interaction and privacy as a baseline, with explicit tests for sensitive local caches, screenshots/app switcher, deep links, logs and revocation. MASVS is an engineering standard, not a substitute for jurisdiction-specific privacy review. [OWASP MASVS](https://mas.owasp.org/MASVS/)

### 5.2 Reliability program research

Reliability targets without measured service-level indicators are decorative. The program should first instrument critical journeys, establish a baseline and then approve SLOs and an error-budget policy. Google SRE guidance recommends explicit stakeholder approval and a policy that changes engineering priorities when the budget is exhausted. CB Connect should stop non-critical rollouts during budget exhaustion while allowing P0/privacy/security remediation. [Google SRE: implementing SLOs](https://sre.google/workbook/implementing-slos/), [example error-budget policy](https://sre.google/workbook/error-budget-policy/)

## 6. Recommended cycle-intelligence foundation

### 6.1 Separate facts from inferences

`periodEvents` should contain only user-confirmed or explicitly approximate observations. A predicted end belongs in a read model or prediction snapshot, never in `periodEvents.endDate`. Actor/source, observation certainty, and confirmation should be explicit. Partner-assist provenance must remain distinct from observation certainty: a partner-entered record can be pending primary confirmation.

The current `confirmationStatus: "confirmed"` for every assisted start/end does not express that distinction.

### 6.2 Use an explicit state machine

At minimum:

```text
insufficient_data
recorded_period_open
recorded_period_closed
estimated_before_window
estimated_in_window
late_or_uncertain
prediction_paused
```

No transition may create `recorded_period_open` without a confirmed start event. Recorded open/end facts take precedence over calendar estimates. Every state transition should be pure/testable from inputs before it is placed in Convex queries.

### 6.3 Introduce versioned prediction snapshots

A snapshot should record model version, input cutoff, eligible interval count, point estimate, interval bounds, confidence/quality state, reason codes, generation time, and whether it was user-visible or shadow-only. It should not duplicate raw sensitive history in payloads.

Snapshots are required to answer “what did we tell the user at the time?” Recomputing old predictions with today's code cannot evaluate historical accuracy honestly.

### 6.4 Show calibrated windows and abstain

The UI should show “most likely around” plus a likely range, basis count, and a low/medium/high or “timing less predictable” explanation. Confidence must combine history count, recent variability, approximate/pending records, tracking-context changes, and interval calibration. If the expected range passes, the app should stop phase progression and ask for a log/pause decision.

“Unknown” or “we cannot estimate this reliably” is a successful safety behavior, not a model failure.

## 7. Feasible ML/research pipeline

The next release does not need Airflow, Kubeflow, real-time feature serving, or a neural inference service. Those would be disproportionate to CB Connect's dataset and team burden.

### Level 1: deterministic benchmark in the repository

```text
versioned event extract
-> invariant and provenance report
-> user/time ordered walk-forward folds
-> baseline estimators
-> accuracy, coverage, width, abstention, and subgroup report
-> signed research artifact
```

The extract must be access-controlled and de-identified for analysis; synthetic fixtures should be public, not user histories. Each estimator and data-eligibility rule must be versioned and idempotent.

### Level 2: shadow prediction registry

Generate candidate snapshots but do not show them to users. Compare them only when a later confirmed start becomes available. Track missing labels and corrections; never treat absence of a log as ground-truth lateness.

### Level 3: probabilistic model experiment

Use separate offline training and serving artifacts, dataset/code/model versions, experiment records, calibration reports, model cards, approval gates, and rollback. Candidate promotion requires better walk-forward performance than configured-length, mean, median, rolling mean/median, and recency-weighted baselines. Production display remains behind a feature flag.

Continuous automatic retraining is not justified initially. Manual reviewed training runs are safer until data volume, drift, and operational ownership warrant automation.

## 8. Evaluation and trust metrics

### 8.1 Non-negotiable trust invariants

| Metric | Release expectation |
|---|---|
| Predictions persisted as observed events | 0 |
| Cycle rollover without a confirmed start | 0 |
| Duplicate/overlapping events accepted by backend | 0 |
| Cross-couple or post-revocation disclosures in tests/pilot | 0; stop-ship/stop-pilot |
| Observed rows with known actor/source/certainty provenance | 100% after measured migration or explicit legacy-unknown marking |
| Duplicate external effects for the same idempotency key | 0 |
| Sensitive values in analytics, logs, or generic notification previews | 0 |

### 8.2 Prediction metrics

- Walk-forward median and mean absolute error.
- Percentage of confirmed starts within ±1, ±2, ±3, and ±5 days.
- Empirical coverage and average width for each named interval.
- Calibration by displayed confidence and history-count band.
- Abstention/unknown rate and later outcomes.
- Performance for stable, moderately variable, highly variable, short/long, possible-missing-log, approximate, corrected, partner-assisted, and context-change histories.
- Candidate-minus-baseline performance for every subgroup. A global gain must not hide material harm to variable-cycle users.

RMSE may be reported for literature comparison but should not be the sole product metric because missing logs and very long outliers dominate it.

### 8.3 Reliability metrics and proposed initial SLOs

Targets must be finalized only after telemetry establishes a baseline. A feasible starting proposal is:

- 99.5% monthly availability for authenticated critical journeys.
- 99.9% accepted critical-mutation success, excluding deliberate validation rejections.
- 99.9% scheduled-effect processing without duplicate delivery.
- p95 dashboard/query and mutation latency measured per Convex function and client journey; replace the old PRD's unmeasured numbers with baselined targets.
- 100% releases expose frontend commit, Convex deployment/model version, and health/readiness evidence.
- Rollback decision within 5 minutes and service restoration within 15 minutes in a rehearsal.

Track error-budget burn and pause feature rollout when it exceeds the approved threshold. Do not use engagement as a proxy for health benefit, relationship quality, consent, or prediction trust.

## 9. Privacy, safety, and regulatory boundary

The release should deliberately remain a consent-first general wellness and care-coordination product. FDA's 2026 general-wellness guidance distinguishes lifestyle software unrelated to diagnosis/treatment from device functions; intended use and claims matter. Fertility/contraception or diagnostic claims require a separate regulatory assessment. [FDA General Wellness Guidance, 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)

“Not covered by HIPAA” does not mean unregulated. HHS explains that consumer apps outside a covered-entity/business-associate relationship may not be protected by HIPAA. The FTC's amended Health Breach Notification Rule expressly addresses many non-HIPAA health apps and unauthorized disclosures. Applicability depends on product/data-source details and needs counsel, not an engineering assumption. [HHS health-app guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/access-right-health-apps-apis/index.html), [FTC HBNR guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)

India's Digital Personal Data Protection Rules were published in November 2025 with a staged enforcement timeline. Because CB Connect's operator, users, and target markets are not yet specified in canonical docs, release planning needs a jurisdiction/data-controller decision and qualified legal review rather than a copied compliance checklist. [MeitY DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)

Minimum engineering controls should include purpose-specific consent, immediate revocation, destination-bound notifications, retention/deletion, export, account/couple lifecycle semantics, least-privilege operational access, encrypted transport/storage, redacted logs, incident response, and a vendor/data-flow register.

## 10. Approved major-release sequence

The owner approved a reliability-first program. Each gate is independently qualified and progressively deployed; no later gate may borrow evidence from an earlier green build.

1. **Continuous lane — evidence-backed issue remediation:** triage `issues.md` continuously; critical trust/privacy/security defects may interrupt any feature phase.
2. **Release Gate 0 — production reliability:** build identity, deployment/readiness evidence, deterministic E2E fixtures, dependency/security remediation, telemetry, backup/restore, rollback, and an enforceable error-budget policy.
3. **Release Gate 1 — trustworthy cycle facts:** assess/migrate provenance, remove inferred-history writes, enforce event invariants, require primary confirmation for partner-assisted records used in predictions, add timezone/context/pause semantics, and unify factual dashboard/history behavior.
4. **Release Gate 2 — four-phase state semantics:** retain the product terms menstruation, follicular, ovulation, and luteal. Mark factual menstruation as **Recorded** and all calendar-derived phase labels—including ovulation—as **Calendar estimate**. Add a non-biological **Late** status automatically on the day after the latest prediction-window date; never wrap without a confirmed start.
5. **Release Gate 3 — personalized prediction and evaluation:** derive eligible confirmed intervals, benchmark simple estimators, produce calibrated point-plus-window outputs, snapshots, explanations and abstention, and promote only if hard overall/calibration/subgroup criteria pass.
6. **Release Gate 4 — notification platform:** build a user-visible in-app inbox, event taxonomy, destination-bound consent/preferences, idempotent outbox/delivery attempts, privacy-safe previews and observable delivery before adding remote channels.
7. **Release Gate 5 — mobile internal beta:** build an Expo/React Native iOS and Android client on the stable Clerk/Convex contracts; share domain contracts and backend behavior, not a duplicated client-side prediction engine.
8. **Release Gate 6 — push and store qualification:** add device-token lifecycle, push-ticket/receipt processing, safe deep links, real-device notification tests, store privacy declarations, staged rollout and rollback/kill switches.
9. **Research Gate 7 — probabilistic shadow model:** only after enough clean, consented, versioned snapshots and confirmed outcomes exist and a model beats all approved simple baselines without material subgroup harm.

Care Loop, health-platform imports, fertility features, diagnostic screening, and public ML predictions are outside this program unless separately researched and approved. Plans are interlinked but independently stoppable.

## 11. Resolved product decisions and remaining governance inputs

### 11.1 Resolved decisions

| Decision | Approved outcome |
|---|---|
| Major-release shape | Trust/reliability and Cycle Intelligence v2; defer Care Loop and ML display |
| Delivery | Independent evidence gates with progressive deployment |
| Production data assessment | Read-only aggregate integrity/provenance audit; no raw IDs, dates, notes, or rows in reports |
| Partner-assisted records | Primary confirmation required before prediction/evaluation eligibility |
| Product boundary | Consent-first general wellness; no fertility, contraception, diagnosis, pregnancy or observed-ovulation claims |
| Four phase terms | Retain menstruation, follicular, ovulation and luteal with Recorded/Calendar estimate labeling |
| Late behavior | Automatic day after the latest likely-window date; no confirmation required; clears on confirmed start or pause |
| Context changes | User-controlled pause and private history segmentation; prior segments excluded unless explicitly restored |
| Prediction display | Point estimate, calibrated likely window, confidence/quality, basis count and explanation reasons |
| Personalization label | Evidence-gated; provisional minimum three eligible confirmed start-to-start intervals, benchmark may require more |
| Estimator promotion | Beat configured-length and rolling-median baselines overall, calibrated windows, no material subgroup regression |
| Partner sharing | One explicit broad phase-sharing consent with enumerated fields and immediate revocation |
| Partner guidance | Generic check-in by default plus visible “Ideas, not assumptions” phase suggestions; never deterministic mood/hormone behavior |
| Roadmap position of mobile | After reliability, cycle semantics, prediction and notification contracts are stable |

### 11.2 Inputs that cannot be invented by engineering

- Initial target countries/jurisdictions and data-controller/operator identity.
- Named incident owner and approvers for SLO/error-budget policy.
- Clinical reviewer for health wording and pattern notices.
- Privacy/legal reviewer for consent, retention/deletion, partner sharing and store disclosures.
- Apple/Google developer-account ownership, store identities and release authority.
- Pilot cohort size and staffing capacity. Plans therefore use evidence gates rather than calendar promises.
