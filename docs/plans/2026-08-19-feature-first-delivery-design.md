# Feature-First Delivery Design

**Status:** Approved by the project owner on 2026-08-19.

## Goal

Preserve CB Connect's deliberate roadmap and execution-plan discipline while
removing operational paperwork, premature decisions, and elapsed-time gates
that prevent unrelated feature development.

## Shipping architecture

Every green merge to `main` automatically deploys the production Convex
backend and the exact frontend artifact qualified by CI. The deployment then
verifies backend identity, `/api/health`, and `/api/ready`. A successfully
verified frontend becomes the rollback target for the following deployment.
The first managed deployment is allowed without a previous managed artifact.

The essential controls remain:

- isolated secrets and exact production-target validation;
- build, typecheck, unit, policy, and authenticated release tests;
- non-destructive, backward-compatible data changes;
- default-off flags for unfinished user-facing behavior;
- post-deployment identity, health, and readiness checks;
- automatic frontend rollback when a prior verified release exists.

Manual promotion variables, duplicated evidence packets, and a 28-day
measurement window do not block ordinary feature development. Operational
metrics continue in parallel and may restrict rollout or claims when directly
relevant.

## Product roadmap

The existing product scope remains intact:

1. trustworthy cycle facts;
2. four-phase cycle experience;
3. personalized statistical prediction and evaluation;
4. consent-aware notifications;
5. mobile beta, push notifications, and store release;
6. probabilistic and machine-learning prediction research.

ML research is a first-class product track. It may begin once sufficiently
clean, consented cycle facts and a reproducible baseline exist. A trained model
is promoted only when it beats the approved baseline without unacceptable
calibration or subgroup regressions.

## Planning and execution

Each major roadmap area retains a canonical roadmap document and receives a
proper, ordered execution plan before implementation. Execution plans define
dependencies, acceptance criteria, tests, safe migration order, feature-flag
behavior, deployment verification, and rollback.

Planning remains meticulous; approval bureaucracy does not. Automated CI,
deployment logs, and Git history are the default evidence. Create a separate
evidence artifact only when it contains information those systems cannot
retain safely or clearly.

## Decision rule

A missing decision blocks only the smallest task that genuinely depends on
it. It does not block the entire roadmap or unrelated implementation.

Decisions are requested when their affected task becomes next. Settled
decisions are not reopened without new evidence. Future legal, clinical,
retention, cohort, provider, and store questions remain recorded but do not
block default-off or non-destructive work that does not depend on them.

## Completion standard

A roadmap increment is ready to ship when its execution-plan tasks and tests
pass, migrations are safe, unfinished exposure remains disabled, and the
automatic deployment verifies the live release. Long-running measurements
and later-stage approvals may control rollout size or public claims without
halting the next independent implementation task.
