# CB Connect major-release plan index

**Status:** Canonical planning dashboard; last reviewed 2026-08-04 with checkout `main` at `05af783` and live `origin/main` at `d3ef5a7`.

This index controls implementation order and planning readiness. Running code, current production evidence and `issues.md` override stale factual claims. The [major-release program](2026-08-01-cb-connect-major-release-program.md) controls product scope and invariants; the [decision register](../decisions/major-release-decision-register.md) controls unresolved authority and contract choices.

## Source-of-truth order

1. Current code, deployment configuration and independently verified production evidence.
2. `AGENTS.md` and `convex/_generated/ai/guidelines.md` for implementation rules.
3. This index and the major-release program for approved scope/order.
4. The currently approved dated execution plan.
5. Numbered gate-level plans for architecture, invariants and exit evidence.
6. `issues.md` for active evidence-backed defects and remediation status.
7. Research and historical branches for context only.

The historical `docs/v0.2.0-product-specs` branch is not an implementation base. Its Care Loop-first sequence is superseded by this reliability-first program.

## Ordered delivery tracks

| Order | Track | Gate-level plan | Blocking dependency | Planning readiness |
|---:|---|---|---|---|
| Continuous | Evidence-backed issue remediation | `issues.md` | None | Active; each fix requires its own acceptance evidence |
| 1 | Production reliability | [Gate 0](2026-08-01-01-production-reliability-foundation.md) | Preflight decisions D-002 through D-007; D-001 before affected production consent/retention exposure | Detailed execution plan drafted |
| 2 | Trustworthy cycle facts | [Gate 1](2026-08-01-02-trustworthy-cycle-facts.md) | Approved Gate 0 evidence | Gate-level only |
| 3 | Four-phase state semantics | [Gate 2](2026-08-01-03-four-phase-state-semantics.md) | Approved Gate 1 evidence | Gate-level only |
| 4 | Personalized prediction | [Gate 3](2026-08-01-04-personalized-prediction-and-evaluation.md) | Approved Gate 2 evidence and frozen protocol | Gate-level only |
| 5 | In-app notification platform | [Gate 4](2026-08-01-05-notification-platform.md) | Approved Gates 0-3 contracts | Gate-level only |
| 6 | Mobile internal beta | [Gate 5](2026-08-01-06-mobile-internal-beta.md) | Approved Gates 0-4 APIs | Gate-level only |
| 7 | Push and staged stores | [Gate 6](2026-08-01-07-push-and-store-qualification.md) | Gate 5 real-device evidence | Gate-level only |
| Research | Probabilistic shadow model | [Research Gate 7](2026-08-01-08-probabilistic-shadow-model.md) | Gates 0, 1 and 3 data/governance prerequisites | Research design only; never user-visible |

## Immediate execution sequence

1. Preserve the current uncommitted planning batch; do not pull or merge over it. The checkout is 12 commits behind `origin/main`.
2. Integrate/review this planning batch in a clean worktree based on `origin/main` at or after `d3ef5a7`.
3. Treat PR #8 as merged and its source branch as superseded. Record that CI run `30852430557` passed while deploy run `30852430655` failed at Convex deployment before build/PM2 promotion; do not claim those fixes are deployed.
4. Resolve Gate 0 decision-register items D-002 through D-007 without inventing missing owners or credentials. Resolve D-001 before any affected production consent/retention exposure; it does not block unrelated technical preflight work.
5. Create a dedicated Gate 0 implementation worktree from the then-current `origin/main`.
6. Execute [the detailed Gate 0 plan](2026-08-04-00-production-reliability-execution.md) in dependency order.
7. Produce and approve `docs/evidence/reliability-gate-0/REPORT.md`.
8. Only then write the dated Gate 1 execution plan using the real release, timezone, schema and migration contracts established by Gate 0/preflight.

## Planning policy

- Numbered gate documents are work-package plans, not permission to edit code.
- A gate becomes implementation-ready only when its blocking decisions are resolved and a dated task-sized execution plan is approved.
- One execution task equals one bounded test/fail/implement/pass/commit cycle. Tasks sharing a file or interface are sequential unless the plan explicitly proves otherwise.
- A major architecture, schema, privacy or dependency divergence pauses execution and requires plan revision/reapproval.
- Gate evidence must distinguish synthetic qualification, local checks, CI, deployment, and authenticated production behavior.
- Gate 7 shadow research may remain incomplete indefinitely; Gates 0-6 define major-release completion.

## Required evidence by gate

| Gate | Evidence root | Promotion authority |
|---|---|---|
| 0 | `docs/evidence/reliability-gate-0/` | Engineering, release operator, privacy/security as applicable |
| 1 | `docs/evidence/cycle-facts-gate-1/` | Engineering, privacy/legal for data lifecycle |
| 2 | `docs/evidence/four-phase-gate-2/` | Engineering, clinical/content, privacy |
| 3 | `docs/evidence/prediction-gate-3/` | Engineering, product, statistical/clinical review as applicable |
| 4 | `docs/evidence/notification-gate-4/` | Engineering, privacy/content, operator |
| 5 | `docs/evidence/mobile-gate-5/` | Engineering, mobile release owner, privacy/security |
| 6 | `docs/evidence/push-store-gate-6/` | Engineering, store authority, privacy/legal, operator |
| Research 7 | Restricted `docs/evidence/ml-shadow-gate-7/` | Statistical/ML reviewer, privacy/legal, product; no display authority |
