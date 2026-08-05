# CB Connect major-release plan index

**Status:** Canonical planning dashboard; Gate 0 implementation approved 2026-08-05 in the dedicated worktree at `d586c73` plus the recorded readiness-contract changes.

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
| 1 | Production reliability | [Gate 0](2026-08-01-01-production-reliability-foundation.md) | D-002 through D-007 resolved; D-001 remains required only before affected production consent/retention exposure | Implementation-ready; first packet I1, I3, O1 |
| 2 | Trustworthy cycle facts | [Gate 1](2026-08-01-02-trustworthy-cycle-facts.md) | Approved Gate 0 evidence | Gate-level only |
| 3 | Four-phase state semantics | [Gate 2](2026-08-01-03-four-phase-state-semantics.md) | Approved Gate 1 evidence | Gate-level only |
| 4 | Personalized prediction | [Gate 3](2026-08-01-04-personalized-prediction-and-evaluation.md) | Approved Gate 2 evidence and frozen protocol | Gate-level only |
| 5 | In-app notification platform | [Gate 4](2026-08-01-05-notification-platform.md) | Approved Gates 0-3 contracts | Gate-level only |
| 6 | Mobile internal beta | [Gate 5](2026-08-01-06-mobile-internal-beta.md) | Approved Gates 0-4 APIs | Gate-level only |
| 7 | Push and staged stores | [Gate 6](2026-08-01-07-push-and-store-qualification.md) | Gate 5 real-device evidence | Gate-level only |
| Research | Probabilistic shadow model | [Research Gate 7](2026-08-01-08-probabilistic-shadow-model.md) | Gates 0, 1 and 3 data/governance prerequisites | Research design only; never user-visible |

## Immediate execution sequence

1. Work only in `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-0` on `gate-0/reliability-2026-08-04`; read and append the Gate 0 agent log.
2. Execute first packet I1, I3 and O1 as separate test/fail/implement/pass/commit cycles.
3. Continue the detailed Gate 0 dependency graph using only the isolated Convex dev and owner-approved Clerk test environments until the explicit V1/V2 promotion tasks.
4. Treat PR #8 as merged while retaining its failed deployment as historical evidence; do not claim coordinated promotion until Gate 0 proves it.
5. Produce and approve `docs/evidence/reliability-gate-0/REPORT.md`.
6. Only then write the dated Gate 1 execution plan using the real release, timezone, schema and migration contracts established by Gate 0/preflight.

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
