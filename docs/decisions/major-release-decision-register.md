# CB Connect major-release decision register

**Status:** Canonical unresolved-decision register; created 2026-08-04.

Engineering must not invent names, credentials, jurisdictions, legal conclusions, clinical approval or store authority. “Required input” means implementation may continue only where the program explicitly says missing authority blocks the affected exposure rather than unrelated safe work.

## Status vocabulary

- **Required input:** an authorized person must supply or approve the answer.
- **Engineering proposal required:** engineering may draft the answer, but the named authority approves it.
- **Deferred:** intentionally resolved just before the blocking gate.
- **Resolved:** the decision, approver, date and evidence link are recorded here.

## Decisions

| ID | Decision | Required authority | Blocks | Status | Progress evidence |
|---|---|---|---|---|---|
| D-001 | Initial target jurisdictions and legal data-controller/operator identity | Product owner and privacy/legal | Production exposure involving unreviewed consent/retention claims; Gates 1, 4-6 | Required input | — |
| D-002 | Named release operator and incident owner, with an escalation route | Product owner/operator | Gate 0 production rollout and exit | Blocked: named authority required | [Gate 0 baseline](../evidence/reliability-gate-0/baseline.md) |
| D-003 | Exact production Convex selector plus frontend/backend compatibility-version scheme | Engineering and release operator | Gate 0 release identity/deploy tasks | Proposal pending release-operator confirmation | [Gate 0 baseline](../evidence/reliability-gate-0/baseline.md) |
| D-004 | Isolated Clerk and Convex preview/test environments and credential ownership | Engineering, security/operator | Gate 0 authenticated release suite and rehearsals | Blocked: environment owner required | [Fixture proposal](../testing/authenticated-release-fixtures.md) |
| D-005 | Clerk test-user provisioning, rate-limit-safe cleanup and artifact-redaction method | Engineering and Clerk environment owner | Gate 0 authenticated fixture tasks | Proposal pending environment-owner approval | [Fixture proposal](../testing/authenticated-release-fixtures.md) |
| D-006 | Critical-journey SLI definitions, baseline window, approved SLOs and error-budget policy | Engineering proposes; operator/product approve | Gate 0 exit | Proposal pending operator/product approval | [Measurement proposal](../reliability/gate-0-measurement-plan.md) |
| D-007 | Backup/restore owner, approved non-production restore target and RPO/RTO objectives | Operator and product owner | Gate 0 recovery rehearsal and exit | Blocked: owner/target required | [Measurement proposal](../reliability/gate-0-measurement-plan.md) |
| D-008 | User timezone source, default, change behavior and authoritative definition of user-local “today” | Product and engineering; privacy reviews private context | Gate 1 date invariants and replacement of PR #8's UTC fallback | Engineering proposal required | Must precede user-local future-date validation |
| D-009 | Exact observation certainty, provenance, confirmation and `legacy_unknown` schema/mapping | Product, engineering and privacy | Gate 1 schema/migration | Engineering proposal required | — |
| D-010 | Treatment of suspected auto-ended, duplicate, overlapping and ambiguous legacy rows | Product, engineering, privacy/legal | Gate 1 production migration | Required input after aggregate audit | Never fabricate confirmation or delete history silently |
| D-011 | Clinical/content reviewer and approval process for phase, Late and relationship-guidance copy | Product owner and qualified reviewer | Gate 2 pilot exposure | Required input | — |
| D-012 | Data retention/deletion rules for users, couples, messages, notifications, snapshots and research artifacts | Privacy/legal and product owner | Gates 1, 4, 6 and Research 7 | Required input | Include Clerk `user.deleted` workflow |
| D-013 | Prediction benchmark dataset authority, consent basis, calibration split and preregistration approver | Product, privacy and engineering/statistical reviewer | Gate 3 benchmark/promotion | Deferred until Gate 2 evidence | Criteria may not be loosened after results |
| D-014 | Apple, Google and EAS account ownership, bundle/package IDs, signing recovery and supported OS matrix | Mobile release owner/product | Gates 5-6 | Deferred until Gate 4 evidence | — |
| D-015 | Pilot cohort sizes, staffing, observation windows and staged rollout percentages | Product owner and operator | Pilot/store promotion in Gates 2-6 | Required input before affected pilot | — |
| D-016 | Research consent, withdrawal, secure storage, access logging, cohort sufficiency and independent ML reviewer | Privacy/legal, product and statistical/ML reviewer | Research Gate 7 | Deferred; shadow research only | Minimum cohort rules remain hard entry criteria |

## Gate 0 preflight progress

The 2026-08-04 read-only baseline is recorded in [Gate 0 baseline](../evidence/reliability-gate-0/baseline.md). It verifies the local planning integration, current `origin/main`, PR #8/CI/deploy evidence, public liveness and the documented Convex function identity candidate. It does not establish production host/process persistence, frontend/backend version alignment or approval authority.

The fixture and measurement documents linked above are engineering proposals only. They intentionally do not name owners, credentials, jurisdictions or production targets. D-002 through D-007 are not resolved until the required authorities approve the applicable proposal and the resolution is recorded below with an approver, date, commit/deployment boundary and review date.

### Engineering proposal for D-003

- Candidate production Convex selector: `festive-malamute-715`, independently queried in the baseline; the release operator must confirm that it is still the intended production deployment.
- Compatibility scheme: exact equality on a shared opaque contract version, initially proposed as `v1`. Frontend and Convex publish the same `CB_CONNECT_COMPATIBILITY_VERSION`; a breaking read-model, schema or endpoint contract increments the major version and requires a coordinated pair. A non-breaking implementation change keeps the same contract version only when the compatibility tests pass.
- Release identity: commit SHA and build ID remain immutable per artifact; the compatibility version is not inferred from `package.json` or a CLI default.
- Approval needed: engineering confirms the contract semantics and the named release operator confirms the selector and initial version before deployment work begins.

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
