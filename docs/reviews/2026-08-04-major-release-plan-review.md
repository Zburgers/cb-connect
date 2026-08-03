# Major-release planning review

**Reviewed:** 2026-08-04

**Baseline:** dirty checkout `main` at `05af783`; live `origin/main` refreshed to `d3ef5a7`. Review covers the August major-release program, eight numbered gate documents, research dossier, Shipyard map/guidance, branch state and `issues.md`.

**Scope:** Documentation and planning only; no application implementation or release verification.

## Stage 1 — Program/spec compliance

The August program matches the approved reliability-first scope: trustworthy release controls precede factual cycle semantics; factual semantics precede phase/read-model exposure; prediction precedes prediction-triggered notifications; stable backend contracts precede native clients and push. The plans preserve the required zero-tolerance privacy/data-integrity invariants and keep probabilistic ML shadow-only.

The historical `docs/v0.2.0-product-specs` branch does not match the approved order because it prioritizes a Care Loop candidate and defers cycle/mobile work differently. It is superseded context and must not be merged or executed wholesale.

## Stage 2 — Planning quality findings

### Major — Existing tasks are work packages, not commit-sized Shipyard tasks

**Applies throughout:** `docs/plans/2026-08-01-01-*.md` through `2026-08-01-08-*.md`.

The 59 work packages include exact paths and verification commands, but many combine contracts, tests, implementation, migration, UI, deployment and evidence. They exceed one bounded TDD cycle and generally omit explicit failing-run and commit boundaries. Direct execution would force builders to invent decomposition and coupling order.

**Remediation:** Treat numbered gate docs as gate-level plans. Require a dated, task-sized execution plan per gate; Gate 0 now has the first such plan.

### Major — Timezone authority is ordered after user-local validation

`docs/plans/2026-08-01-02-trustworthy-cycle-facts.md` asks F1 to reject future user-local dates, while F6 introduces timezone storage later. Merged PR #8 added a timezone-capable helper but defaults all writes to UTC because no user timezone is supplied, so the authoritative definition of user-local “today” remains unresolved.

**Remediation:** Decision D-008 and timezone storage/read behavior must precede future-local-date enforcement. Gate 1's detailed execution plan must order them that way.

### Major — Gate 2 consumes an optional Gate 3 bound

`docs/plans/2026-08-01-03-four-phase-state-semantics.md` places Gate 2 before Gate 3 but asks the Late transition to use Gate 3's calibrated latest bound when available.

**Remediation:** Gate 2 must define a versioned `PredictionBounds` input contract and an explicitly labeled legacy fallback. Gate 3 may later supply a calibrated implementation without changing state-machine meaning.

### Major — External authority and environment decisions are unresolved

Production operator, incident owner, target jurisdictions, data-controller identity, test environments, Clerk fixture ownership, backup target, clinical reviewer, privacy/legal reviewer and store authority are not canonical. Engineering cannot infer them.

**Remediation:** Track them in `docs/decisions/major-release-decision-register.md` and block only the affected execution/exposure.

### Minor — Codex guidance and plan headers disagreed

The plans used Claude-only execution boilerplate despite project-local guidance requiring native Shipyard skills under Codex.

**Remediation:** Headers now use native Codex/Shipyard wording; cached/global plugins remain untouched.

### Minor — Shipyard initialization and tracker wording overstate current state

The config and maps exist in the dirty checkout, but resumable `STATE.json`, `HISTORY.md`, `ROADMAP.md` and `PROJECT.md` are absent. `issues.md` also contains stale “None currently” and old release-history wording despite active planning/issues.

**Remediation:** Describe the checkout as mapped/configured but without resumable state; update tracker wording without claiming implementation or release completion.

## Current branch and CI review

- Live `origin/main` is `d3ef5a7`, 12 commits ahead of the dirty checkout. Do not pull/merge over the planning batch; integrate it from a clean current worktree.
- PR #8 is merged and its remote source branch is deleted. Local `agent/quick-issues-3-7` is fully contained in `origin/main` and is a stale cleanup candidate after the planning batch is safe.
- `docs/v0.2.0-product-specs` remains live but is superseded planning context, not an implementation or wholesale-merge branch.
- `cbconnect/*` remote-tracking refs are stale snapshots and must not be used as current remote truth.
- CI run `30852430557` passed for `d3ef5a7`; deploy run `30852430655` failed before frontend build/PM2 promotion because the Convex deployment selector/key was absent. Production deployment of PR #8 is therefore unproven.

## Verdict

**Needs-work for whole-program direct execution; planning-ready for Gate 0 preflight.** Later gates remain intentionally blocked behind evidence and just-in-time detailed planning.
