# CB Connect major-release decision register

**Status:** Canonical decision register; Gate 0 preflight decisions D-002 through D-007 resolved by the sole project owner on 2026-08-05.

Engineering must not invent names, credentials, jurisdictions, legal conclusions, clinical approval or store authority. “Required input” means implementation may continue only where the program explicitly says missing authority blocks the affected exposure rather than unrelated safe work.

## Status vocabulary

- **Required input:** an authorized person must supply or approve the answer.
- **Engineering proposal required:** engineering may draft the answer, but the named authority approves it.
- **Deferred:** intentionally resolved just before the blocking gate.
- **Resolved:** the decision, approver, date and evidence link are recorded here.

## Decisions

| ID | Decision | Required authority | Blocks | Status | Progress evidence |
|---|---|---|---|---|---|
| D-001 | Initial target jurisdictions and legal data-controller/operator identity | Product owner and privacy/legal | Only affected consent/retention claims and public rollout | Deferred until affected exposure | — |
| D-002 | Named release operator and incident owner, with an escalation route | Product owner/operator | Gate 0 production rollout and exit | Resolved 2026-08-05 | Sole owner is operator and incident authority; this repository/GitHub thread is the escalation record |
| D-003 | Exact production Convex selector plus frontend/backend compatibility-version scheme | Engineering and release operator | Gate 0 release identity/deploy tasks | Resolved 2026-08-05 | `prod:festive-malamute-715`; compatibility `v1` approved |
| D-004 | Isolated Clerk and Convex preview/test environments and credential ownership | Engineering, security/operator | Gate 0 authenticated release suite and rehearsals | Resolved 2026-08-05 | Owner approved Clerk test instance `holy clerk` and isolated Convex dev deployment |
| D-005 | Clerk test-user provisioning, rate-limit-safe cleanup and artifact-redaction method | Engineering and Clerk environment owner | Gate 0 authenticated fixture tasks | Resolved 2026-08-05 | Fixture proposal approved with seven-day restricted failure artifacts |
| D-006 | Critical-journey SLI definitions, baseline window, approved SLOs and error-budget policy | Engineering proposes; operator/product approve | Only affected rollout or reliability claims | Resolved 2026-08-05 | Definitions and targets are documented; measurement continues in parallel |
| D-007 | Backup/restore owner, approved non-production restore target and RPO/RTO objectives | Operator and product owner | Only recovery-sensitive rollout steps | Resolved 2026-08-05 | Sole owner; isolated dev target; RPO 24h and RTO 4h approved |
| D-008 | User timezone source, default, change behavior and authoritative definition of user-local “today” | Product and engineering; privacy reviews private context | Gate 1 date invariants and replacement of PR #8's UTC fallback | Resolved 2026-08-12 | Device-local IANA timezone is authoritative for user-facing dates; validate and normalize consistently; no silent UTC fallback for an identified user |
| D-009 | Exact observation certainty, provenance, confirmation and `legacy_unknown` schema/mapping | Product, engineering and privacy | Gate 1 schema/migration | Resolved 2026-08-12 | Partner assistance is accepted immediately; primary user's later correction/deletion is authoritative; approximate dates remain explicit approximate facts and never become exact implicitly |
| D-010 | Treatment of suspected auto-ended, duplicate, overlapping and ambiguous legacy rows | Product, engineering, privacy/legal | Gate 1 production migration | Resolved 2026-08-12 for conservative policy; aggregate audit still required | Preserve ambiguous rows as explicit `legacy_unknown`; exclude them from high-confidence facts/prediction until corrected; never fabricate confirmation or delete history silently |
| D-011 | Clinical/content reviewer and approval process for phase, Late and relationship-guidance copy | Product owner and qualified reviewer | Only affected health-adjacent copy exposure | Deferred until Gate 2 copy task | — |
| D-012 | Data retention/deletion rules for users, couples, messages, notifications, snapshots and research artifacts | Privacy/legal and product owner | Destructive deletion/migration, final retention behavior and production exposure | Required before affected task | Safe proposal: retain user-visible cycle history until explicit primary deletion; use tombstones; block destructive behavior and production exposure pending confirmation |
| D-013 | Prediction benchmark dataset authority, consent basis, calibration split and preregistration approver | Product, privacy and engineering/statistical reviewer | Gate 3 benchmark/promotion | Deferred until Gate 2 evidence | Criteria may not be loosened after results |
| D-014 | Apple, Google and EAS account ownership, bundle/package IDs, signing recovery and supported OS matrix | Mobile release owner/product | Gates 5-6 | Deferred until Gate 4 evidence | — |
| D-015 | Pilot cohort sizes, staffing, observation windows and staged rollout percentages | Product owner and operator | Only the affected pilot/store rollout | Deferred until affected pilot | — |
| D-016 | Research consent, withdrawal, secure storage, access logging, cohort sufficiency and independent ML reviewer | Privacy/legal, product and statistical/ML reviewer | Research Gate 7 | Deferred; shadow research only | Minimum cohort rules remain hard entry criteria |

## Gate 0 preflight progress

The 2026-08-04 read-only baseline is recorded in [Gate 0 baseline](../evidence/reliability-gate-0/baseline.md). It verifies the local planning integration, current `origin/main`, PR #8/CI/deploy evidence, public liveness and the documented Convex function identity candidate. It does not establish production host/process persistence, frontend/backend version alignment or approval authority.

The fixture and measurement proposals were approved by the sole project owner on 2026-08-05. D-002 through D-007 are resolved for Gate 0 execution. Their success criteria still require implementation and direct evidence; approval is not evidence that a release or rehearsal passed.

### Engineering proposal for D-003

- Candidate production Convex selector: `festive-malamute-715`, independently queried in the baseline; the release operator must confirm that it is still the intended production deployment.
- Compatibility scheme: exact equality on a shared opaque contract version, initially proposed as `v1`. Frontend and Convex publish the same `CB_CONNECT_COMPATIBILITY_VERSION`; a breaking read-model, schema or endpoint contract increments the major version and requires a coordinated pair. A non-breaking implementation change keeps the same contract version only when the compatibility tests pass.
- Release identity: commit SHA and build ID remain immutable per artifact; the compatibility version is not inferred from `package.json` or a CLI default.
- Approval needed: engineering confirms the contract semantics and the named release operator confirms the selector and initial version before deployment work begins.

## D-002 — Release and incident ownership

- Decision: The sole project owner acts as product owner, release operator, incident owner and escalation authority. Escalation is recorded in this repository and its GitHub workflow/issue history; any production-impacting ambiguity stops and returns to the owner.
- Alternatives considered: Inventing separate organizational roles was rejected because this is a solo-owned and solo-operated project.
- Approver and authority: Sole project owner and self-hosted service operator, approved directly in the coordinating conversation.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 branch at `d586c73`; no production readiness implied.
- Evidence or runbook: Gate 0 agent log and this decision register.
- Review/expiry date: 2026-11-05 or on any ownership/hosting change, whichever comes first.

## D-003 — Production selector and compatibility scheme

- Decision: The intended production Convex selector is `prod:festive-malamute-715`. The initial shared frontend/backend compatibility version is the opaque tag `v1`; breaking contracts increment it and require a coordinated compatible pair.
- Alternatives considered: Inferring compatibility from `package.json` or a CLI default was rejected.
- Approver and authority: Sole project owner and release operator.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 implementation after `d586c73`; production deployment remains confined to V1/V2 and their gates.
- Evidence or runbook: Gate 0 baseline and the detailed execution plan.
- Review/expiry date: Revalidate immediately before every production promotion.

## D-004 — Isolated test environments and ownership

- Decision: Use the owner-approved non-production Clerk instance labeled `holy clerk` with isolated Convex dev deployment `dev:hallowed-hummingbird-284`. The sole owner controls credentials. Agents may configure and use these environments for synthetic Gate 0 fixtures.
- Alternatives considered: Production accounts/data and shared static accounts were rejected.
- Approver and authority: Sole project and environment owner.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 branch at `d586c73`; development/test only.
- Evidence or runbook: Authenticated fixture contract and Gate 0 agent log.
- Review/expiry date: 2026-11-05 or when either test environment changes.

## D-005 — Fixture provisioning, cleanup and artifacts

- Decision: Agents may create one run-scoped primary/partner pair, link synthetic data, reuse the pair within a run, and delete/revoke it with idempotent cleanup. Restricted failure artifacts are retained seven days and must pass redaction checks. Missing or ambiguous environment identity fails closed.
- Alternatives considered: Production users, persistent shared credentials, conditional skips and unredacted artifacts were rejected.
- Approver and authority: Sole project and Clerk environment owner.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 E1-E3 in the approved isolated environments.
- Evidence or runbook: `docs/testing/authenticated-release-fixtures.md`.
- Review/expiry date: 2026-11-05 or on Clerk/CI provisioning changes.

## D-006 — SLI, baseline and error-budget policy

- Decision: Approve the proposed SLI definitions and targets, a 28-day baseline, and allowlisted telemetry boundaries. Any P0/privacy failure or material budget burn pauses non-critical rollout and opens an owner-visible incident; exceptions require owner, controls and expiry.
- Alternatives considered: Treating build success or liveness HTTP 200 as reliability evidence was rejected.
- Approver and authority: Sole project owner acting as product and operations approver.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 telemetry and measurement tasks after `d586c73`.
- Evidence or runbook: `docs/reliability/gate-0-measurement-plan.md`.
- Review/expiry date: Review after the first 28-day baseline and at least quarterly thereafter.
- Implementation record: `docs/reliability/slo.md`, `docs/reliability/error-budget-policy.md` and `docs/reliability/incident-response.md` document the approved contract. No target is labeled achieved until the baseline report exists.

## D-007 — Recovery ownership and objectives

- Decision: The sole project owner is backup/restore owner and recovery approver. Use `dev:hallowed-hummingbird-284` only with synthetic data as the initial non-production rehearsal target. Approve RPO 24 hours and RTO four hours. Agents may perform non-destructive rehearsal work but scripts must reject production selectors and destructive production operations.
- Alternatives considered: A production restore rehearsal and any target containing real user data were rejected. A dedicated preview target may replace the dev target later if a preview deploy key is provisioned and the decision/log are updated first.
- Approver and authority: Sole project owner and self-hosted operator.
- Approved on: 2026-08-05.
- Applies from commit/deployment: Gate 0 X1 rehearsal only; never production restoration.
- Evidence or runbook: `docs/reliability/gate-0-measurement-plan.md` and the future backup/restore runbook.
- Review/expiry date: Revalidate immediately before X1 and every restore rehearsal.

## D-008 — Device-local timezone authority

- Decision: The device-reported IANA timezone is authoritative for user-facing calendar dates. The client sends the current device timezone with date-bearing writes and the backend validates it before comparing dates; stored timezone is updated when the device timezone changes. Date-only values remain `YYYY-MM-DD` calendar values and are never converted through server-local time. An identified user must not silently fall back to UTC; missing or invalid device timezone fails closed until the client supplies a valid IANA zone.
- Alternatives considered: Backend UTC, runner timezone and browser locale strings were rejected because they can shift a user's calendar date or vary by execution environment.
- Approver and authority: Sole project owner, approved directly in the coordinating conversation.
- Approved on: 2026-08-12.
- Applies from commit/deployment: Gate 1 additive timezone contract under the August 19 feature-first policy; production exposure remains separately blocked by D-012 and its exposure decision.
- Evidence or runbook: `docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md` and `convex/_helpers/calendarDates.ts` tests.
- Review/expiry date: Revalidate on client platform/timezone-library changes or 2026-11-12, whichever comes first.

## D-009 — Observation certainty, provenance and primary autonomy

- Decision: Every new period fact records actor/source and explicit certainty for start and end. Exact and approximate dates are both allowed, but approximate values remain approximate facts and are never silently promoted to exact. Partner-assisted entries are accepted immediately for the primary user's history and may be shown as accepted assistance; the menstruating/primary user's later correction or deletion always wins. Partner assistance cannot prevent primary correction/deletion and does not override primary privacy/revocation controls.
- Alternatives considered: Treating partner assistance as pending until primary confirmation was rejected by the owner; silently treating approximate input as exact was rejected because it pollutes later reliability and prediction work.
- Approver and authority: Sole project owner, approved directly in the coordinating conversation.
- Approved on: 2026-08-12.
- Applies from commit/deployment: Gate 1 additive schema and write path under the August 19 feature-first policy; immediate partner assistance is allowed, while production exposure remains blocked by D-012 and its exposure decision.
- Evidence or runbook: `docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md` and `docs/evidence/cycle-facts-gate-1/REPORT.md`.
- Review/expiry date: Revalidate before Gate 2 prediction/phase exposure or 2026-11-12, whichever comes first.

## D-010 — Conservative legacy compatibility

- Decision: Legacy rows are never rewritten into certainty that the old data cannot prove. Rows with missing provenance, system-inferred endings, duplicate/overlap ambiguity or uncertain closure receive explicit `legacy_unknown` compatibility metadata, remain readable, and are excluded from high-confidence cycle facts and prediction/evaluation inputs until a primary correction establishes current truth. The aggregate audit determines counts and migration scope; it does not expose raw histories or delete rows.
- Alternatives considered: Deleting ambiguous rows, choosing the newest duplicate as truth, and labeling inferred endings confirmed were rejected because each can break history or fabricate health facts.
- Approver and authority: Sole project owner, approved directly in the coordinating conversation; privacy/retention authority remains required for destructive lifecycle actions.
- Approved on: 2026-08-12.
- Applies from commit/deployment: Gate 1 audit/migration implementation is additive and locally qualified; production annotation still requires an approved target, retention decision and recovery boundary.
- Evidence or runbook: `docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md`, `docs/evidence/cycle-facts-gate-1/REPORT.md` and `docs/runbooks/cycle-facts-migration.md`.
- Review/expiry date: Revalidate after the aggregate audit and before any protected migration.

## D-012 — Retention proposal pending explicit authority

- Decision: Proposed safe default is to retain user-visible cycle history until the primary user explicitly deletes it, preserve only minimum redacted aggregate/audit evidence for a bounded period, and block destructive migration, hard deletion of legacy rows and final retention-duration claims until the owner and privacy authority confirm the policy. Account deletion must be wired to the approved Clerk deletion event once the lifecycle policy is resolved.
- Alternatives considered: Automatic deletion on age alone and irreversible legacy cleanup were rejected while the owner has not confirmed retention duration, deletion scope or legal basis.
- Approver and authority: Proposal drafted by engineering on 2026-08-12; explicit owner/privacy confirmation is still required.
- Approved on: Pending.
- Applies from commit/deployment: Under the August 19 feature-first policy, additive schema/helpers/tests and non-destructive compatibility are allowed; no hard deletion, destructive migration or production exposure is authorized until this decision is approved.
- Evidence or runbook: `docs/plans/2026-08-20-gate-1-trustworthy-cycle-facts-implementation.md`.
- Review/expiry date: Must be resolved before Gate 1 migration or any deletion behavior is enabled.

## Resolution format

When resolving a decision, update its row and append a section using:

```markdown
## D-NNN — Decision title

- Decision:
- Alternatives considered:
- Approver and authority:
- Approved on:
- Applies from commit/deployment:
- Evidence or runbook:
- Review/expiry date:
```
