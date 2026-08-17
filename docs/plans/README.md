# CB Connect major-release plan index

**Status:** Canonical planning dashboard; Gate 0 implementation packet closed 2026-08-06 with an explicit blocked promotion verdict in [`REPORT.md`](../evidence/reliability-gate-0/REPORT.md).

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
| 1 | Production reliability | [Gate 0](2026-08-01-01-production-reliability-foundation.md) | Approved Gate 0 report backed by direct CI, production, recovery and baseline evidence | Implementation packet closed; promotion blocked |
| 2 | Trustworthy cycle facts | [Gate 1](2026-08-01-02-trustworthy-cycle-facts.md) and [dated plan](2026-08-12-gate-1-trustworthy-cycle-facts-execution.md) | Approved Gate 0 report; D-012 approval is required for destructive migration, hard deletion and production exposure | Dated implementation plan exists; execution awaits Gate 0 approval, then additive work may proceed while destructive work remains blocked |
| 3 | Four-phase state semantics | [Gate 2](2026-08-01-03-four-phase-state-semantics.md) | Approved Gate 1 evidence | Gate-level only |
| 4 | Personalized prediction | [Gate 3](2026-08-01-04-personalized-prediction-and-evaluation.md) | Approved Gate 2 evidence and frozen protocol | Gate-level only |
| 5 | In-app notification platform | [Gate 4](2026-08-01-05-notification-platform.md) | Approved Gates 0-3 contracts | Gate-level only |
| 6 | Mobile internal beta | [Gate 5](2026-08-01-06-mobile-internal-beta.md) | Approved Gates 0-4 APIs | Gate-level only |
| 7 | Push and staged stores | [Gate 6](2026-08-01-07-push-and-store-qualification.md) | Gate 5 real-device evidence | Gate-level only |
| Research | Probabilistic shadow model | [Research Gate 7](2026-08-01-08-probabilistic-shadow-model.md) | Gates 0, 1 and 3 data/governance prerequisites | Research design only; never user-visible |

## Current Gate 0 boundary

The detailed Gate 0 implementation packet is complete; it is no longer a local
task queue. The authoritative outcome is the explicit **BLOCKED** verdict in
[`REPORT.md`](../evidence/reliability-gate-0/REPORT.md). The remaining work is
external evidence and authorization, in this order:

1. C2 is now evidenced by [protected CI run 32010663067](../evidence/reliability-gate-0/c2-protected-2026-08-17.md), which passed deterministic qualification and authenticated desktop/mobile smoke with zero skips. This does not establish production evidence.
2. Only with separate release authorization, establish direct production V1/V2
   identity, TLS/listener/readiness and PM2-persistence evidence; do not infer
   it from an old deploy, build, or dev deployment.
3. Run and record the approved synthetic restore rehearsal with measured
   integrity and RPO/RTO results, then collect the 28-day allowlisted SLO
   baseline.
4. Refresh the Gate 0 report and obtain an explicit approval. Until then, do
   not expose or execute Gate 1. Its dated plan may be reviewed, but it is
   not an authorization to mutate code or data. After Gate 0 approval, safe
   additive helpers/schema/tests may proceed; D-012 still blocks destructive
   migration, hard deletion and production exposure.

## Gate 0 closeout

The implementation sequence G1 → C1/C2/C3 → V1/V2 → X1 → G2 → G3 is
recorded in the dedicated worktree and append-only execution log. G1, C1, C2,
C3, V1 isolated-dev identity, V2 implementation and X1 guardrails have
passing local, protected-CI or synthetic evidence. Production V1/V2 runtime
evidence, measured X1 restore objectives and the G2 baseline are not available;
therefore the Gate 0 report is explicitly **BLOCKED** and Gate 1 must remain
unexposed and its feature flag must remain off.

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
