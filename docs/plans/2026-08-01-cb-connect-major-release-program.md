# CB Connect Reliability-First Major Release Implementation Plan

> **Codex/Shipyard execution:** Use the native `shipyard:shipyard-executing-plans` skill and execute only the currently approved gate plan.

**Goal:** Deliver a trustworthy major release through independently qualified reliability, cycle, notification, mobile and research gates.

**Architecture:** Convex remains the authoritative domain and authorization boundary. Next.js and the later Expo client consume versioned read models; observations, estimates, sharing projections and delivery attempts remain distinct. Every gate has entry evidence, hard success criteria, a progressive rollout and a rollback/kill-switch path.

**Tech Stack:** Next.js 15, React 19, TypeScript, Convex, Clerk, Vitest/convex-test, Playwright, Expo/React Native, EAS, Expo Notifications.

---

## Canonical inputs

- [Plan index and readiness dashboard](README.md)
- [Program decision register](../decisions/major-release-decision-register.md)
- [Research dossier](../research/2026-08-01-major-release-cycle-trust-research.md)
- [PRD v1 background](../cb-connect-technical-prd.md)
- [`issues.md`](../../issues.md)
- [Project instructions](../../AGENTS.md)

Running code and production evidence override historical documents. The research dossier defines the approved safety and claim boundaries. A later plan may not weaken an earlier invariant.

## Document authority and planning level

This August reliability-first program supersedes the implementation order on the historical `docs/v0.2.0-product-specs` branch. That branch remains useful research, but its Care Loop-first sequence is not approved for this release. Care Loop, health imports, fertility/contraception claims, diagnostic screening and public ML remain outside this program unless separately approved.

The numbered gate documents are **gate-level plans**: they lock goals, architecture, invariants, entry/exit evidence and implementation work packages. They are not automatically commit-sized execution plans. Before application code changes begin for a gate, Shipyard must have a dated execution plan that:

1. resolves that gate's blocking decisions in the decision register;
2. decomposes each work package into one failing-test/implementation/passing-test/commit cycle;
3. names exact file paths, verification commands, rollback boundaries and task dependencies;
4. records the approved branch/worktree and production exposure boundary.

Only Gate 0 has a current detailed execution plan. Gates 1-6 and Research Gate 7 are deliberately planned just in time after their prerequisites produce evidence; this prevents later plans from guessing contracts that earlier gates are responsible for establishing.

## Current planning readiness

| Lane or gate | Planning status | May implementation start? | Next required artifact |
|---|---|---|---|
| Continuous issue remediation | Active | Yes, for independently qualified fixes | Reproduction and acceptance evidence in `issues.md` |
| Gate 0 reliability | Detailed execution plan drafted | After Gate 0 preflight decisions are resolved | `2026-08-04-00-production-reliability-execution.md` |
| Gate 1 cycle facts | Gate-level plan only | No | Post-Gate-0 schema/timezone/migration execution plan |
| Gate 2 four-phase semantics | Gate-level plan only | No | Post-Gate-1 state-contract execution plan |
| Gate 3 prediction | Gate-level plan only | No | Frozen benchmark and calibration protocol |
| Gate 4 notifications | Gate-level plan only | No | Approved event/privacy/retention execution plan |
| Gate 5 mobile beta | Gate-level plan only | No | Current Expo/runtime/account decision and execution plan |
| Gate 6 push/stores | Gate-level plan only | No | Post-device-beta push/store execution plan |
| Research Gate 7 | Research design only | No user-visible work | Consent, cohort, access and statistical-review approval |

## Git and worktree policy

- Preserve the current dirty checkout; planning artifacts must not be mixed accidentally with application implementation.
- Start each gate from the then-current `origin/main` only after remote parity and applicable open PRs are rechecked.
- Use one dedicated worktree/branch per gate execution plan. Continuous fixes use separate narrow branches and may merge only after their own evidence passes.
- Never implement from the historical docs branch or stale duplicate-remote tracking refs.
- Do not delete or reset user work while creating a gate worktree. If files overlap, stop and resolve ownership first.

## Program order and dependencies

| Gate | Plan | Depends on | Product exposure |
|---|---|---|---|
| Continuous | Evidence-backed issue remediation | None | Fixes may ship whenever qualified |
| 0 | [Production reliability](2026-08-01-01-production-reliability-foundation.md) | None | Operational controls and transparent release identity |
| 1 | [Trustworthy cycle facts](2026-08-01-02-trustworthy-cycle-facts.md) | Gate 0 release controls | Corrected logging/history semantics |
| 2 | [Four-phase state semantics](2026-08-01-03-four-phase-state-semantics.md) | Gate 1 facts | Recorded/Calendar estimate/Late UX |
| 3 | [Personalized prediction](2026-08-01-04-personalized-prediction-and-evaluation.md) | Gate 2 state machine | Calibrated point and likely window |
| 4 | [Notification platform](2026-08-01-05-notification-platform.md) | Gates 0–3 event contracts | In-app inbox first |
| 5 | [Mobile internal beta](2026-08-01-06-mobile-internal-beta.md) | Gates 0–4 stable APIs | Invited iOS/Android beta |
| 6 | [Push and stores](2026-08-01-07-push-and-store-qualification.md) | Gate 5 real-device beta | Push channel and staged stores |
| Research 7 | [Probabilistic shadow model](2026-08-01-08-probabilistic-shadow-model.md) | Clean facts/snapshots and consented data | No user-visible model until separately promoted |

No calendar deadline can waive an entry or exit gate. Plans may overlap only in research, test-fixture creation, non-conflicting issue fixes and feature-flagged code that is not exposed before its dependency passes.

## PRD v1 closure map

The PRD v1 audit found 15 requirements met, 15 partial/defective and 4 missing. This program closes or deliberately supersedes the incomplete intent:

| PRD v1 area | Current gap | Owning gate |
|---|---|---|
| Foundation | Webhook/authorization regression evidence and period backend invariants | Gates 0–1 |
| Cycle logic | Fixed setting, rollover, competing period semantics and exact-date certainty | Gates 1–3 |
| Tips | Health/content review and deterministic phase-to-behavior language | Gate 2 |
| Partner | Lifecycle/data-rights evidence, reduced projection and immediate revocation | Gates 0–2 |
| Notifications | Consent/destination, idempotency, local scheduling and honest delivery state | Gates 4 and 6 |
| Polish/testing | Comprehensive authenticated tests, mounted error handling, measured performance/SLOs, observability and UAT | Gate 0 and every phase exit |
| Mobile | Not part of PRD v1; consume the corrected contracts rather than reproducing v1 | Gate 5 |

Historical implementation techniques such as “add optimistic updates everywhere” are not completion criteria by themselves. A later plan may supersede them with a measured, rollback-safe interaction as long as the original user-experience intent is met and documented.

## Continuous issue-remediation lane

1. Reproduce and add evidence to `issues.md` using the existing `--` separator convention.
2. Classify the finding:
   - P0: privacy breach, cross-couple disclosure, fabricated observation, destructive data corruption, compromised credential or active critical exploit.
   - P1: broken critical journey, high-severity reachable vulnerability, duplicate external effect or release/rollback failure.
   - P2/P3: bounded defect, accessibility/performance debt or enhancement.
3. P0 interrupts feature rollout. P1 enters the current gate unless explicitly risk-accepted with owner and expiry.
4. Every resolution includes failing-before/passing-after evidence, production applicability and rollback notes.
5. Archive or mark resolved entries; never silently delete historical evidence.

## Program-wide trust metrics

| Invariant or metric | Major-release threshold |
|---|---|
| Prediction persisted as an observed event | 0 |
| Cycle rollover without a confirmed start | 0 |
| Backend-accepted duplicate/overlapping period events | 0 |
| Cross-couple or post-revocation disclosure | 0; stop-ship |
| Known observation actor/source/certainty, or explicit `legacy_unknown` | 100% |
| Duplicate destination delivery for one idempotency key | 0 |
| Sensitive health values in generic analytics/logs/lock-screen preview | 0 |
| Releases exposing frontend/backend/model identity and readiness evidence | 100% |
| Candidate prediction window coverage | Within the preregistered tolerance for its named level |
| Material subgroup regression against approved baseline | 0 |

Engagement, notification-open rate and time-in-app are not proxies for health benefit, relationship quality, consent or prediction accuracy.

## Standard entry gate

Before starting any numbered phase:

- The preceding phase has an approved evidence report.
- `main`, production frontend and production Convex versions are identified.
- Relevant open P0/P1 issues have owners and dispositions.
- Migration, feature-flag and rollback paths are documented.
- Required privacy, clinical, operational or store approvers are named where applicable.

## Standard exit gate

Every numbered phase must provide:

```bash
npm run build
npm run typecheck
npm run test:unit
```

Expected: all commands exit 0. Relevant authenticated Playwright and production smoke suites must also pass; static skips do not count as evidence.

Additionally:

- Acceptance metrics are measured from real instrumentation or explicitly synthetic qualification fixtures.
- No unresolved P0 and no unowned P1 applies to the phase.
- Migration rehearsal and rollback/kill-switch rehearsal pass.
- Accessibility and privacy reviews cover every new user-visible surface.
- The rollout starts disabled/internal, advances through a bounded cohort and pauses on stop conditions.
- `issues.md`, operator documentation and the phase evidence report are updated.

## Promotion authority

The product owner approves product scope. Engineering signs implementation and rollback evidence. A named operator approves SLO/error-budget readiness. A clinician approves health-adjacent wording. A privacy/legal reviewer approves consent, partner disclosure, retention and store declarations. Missing authority blocks only the affected exposure; it does not justify inventing approval.

## Program completion definition

The major release is complete only when Gates 0–6 have passed and the staged mobile rollout is healthy inside the approved error budget. Research Gate 7 may remain shadow-only indefinitely and is not required for the major release.
