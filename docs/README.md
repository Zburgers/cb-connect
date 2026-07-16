# CB Connect Documentation

This is the canonical index for repository documentation. It identifies which documents define current direction, which specifications are ready to drive implementation after approval, and which files are research or historical context only.

## Source-of-truth order

When documents disagree, use this order:

1. **Running code, schema, tests, and deployed configuration** are authoritative for what is implemented now. A document labelled `TARGET`, `Proposed`, or `Candidate` does not override checked-in behavior.
2. **[Product Requirements Document v2](./product/cb-connect-prd-v2.md)** is authoritative for current product direction, scope, goals, and non-goals.
3. **[Architecture baseline](./architecture.md)** is authoritative for approved system boundaries and the distinction between current and target architecture.
4. **Numbered specifications** refine implementation behavior within approved PRD scope. They cannot broaden or reverse product scope without a matching PRD update; within that boundary, a more specific approved spec wins over a general architecture statement.
5. **[The v0.2.0 roadmap](./product/v0.2.0-roadmap.md)** is authoritative for milestone sequencing and implementation status, but cannot broaden product/spec scope.
6. **Active dated plans** define file-level execution only. They must not silently change product or specification decisions.
7. **GitHub issues and pull requests** are authoritative for live work status; local plan checkboxes are not proof that code is merged or deployed.
8. **Research, historical plans, audits, and legacy documents** explain prior reasoning but are not current implementation contracts.

If code and a `CURRENT` documentation statement differ, verify the live repository and update the stale document. If a target requirement is implemented, change its status only with linked code, tests, migration evidence, and deployment evidence where applicable.

## Canonical documents

| Document | Purpose | Status |
|---|---|---|
| [Documentation index](./README.md) | Navigation, authority order, and documentation conventions. | Canonical index; keep current with every docs change. |
| [Product Requirements Document v2](./product/cb-connect-prd-v2.md) | Product promise, v0.2.0 trust-first scope, Care Loop hypothesis, metrics, gates, and non-goals. | Canonical product baseline; implementation not started. |
| [Architecture baseline](./architecture.md) | Verified current architecture and approved target boundaries for identity, consent, lifecycle, Care Loop, notifications, time, and mobile contracts. | Canonical v0.2.0 architecture baseline; target sections are not yet implemented. |
| [v0.2.0 roadmap](./product/v0.2.0-roadmap.md) | Dependency order, live issue mapping, exit criteria, pilot phases, rollback, and deferred work. | Proposed implementation roadmap; documentation complete, implementation not started. |

## v0.2.0 implementation-ready specifications

These are proposed normative contracts for the trust-first v0.2.0 milestone. “Implementation-ready” means sufficiently detailed to plan and test after review; it does not mean implemented or approved for deployment.

| Document | Purpose | Status |
|---|---|---|
| [01 — Trust Boundaries and Auth Identity](./specs/01-trust-boundaries-and-auth-identity.md) | Canonical Clerk/Convex identity resolution, webhook ingestion, role locking, secure invitations, and authorization invariants. | Proposed; Gate 0, implementation not started. |
| [02 — Relationship Lifecycle, Data Rights, and Safety Reset](./specs/02-relationship-lifecycle-data-rights-and-safety-reset.md) | Symmetric unlinking, immediate revocation, per-user chat visibility, export, erasure, retention, and safety reset. | Proposed; Gate 0, implementation not started. |
| [03 — Consent, Sharing, and Care Loop Privacy](./specs/03-consent-sharing-and-care-loop-privacy.md) | Effective-consent rules, recipient-safe share snapshots, non-inference controls, expiry, cancellation, and revocation. | Proposed; Gate 1 privacy dependency, implementation not started. |
| [04 — Care Loop v1 Domain and State Machine](./specs/04-care-loop-v1-domain-and-state-machine.md) | Smallest Care Loop workflow, actor permissions, transitions, data model, idempotency, and validation criteria. | Proposed; Gate 1 product candidate, implementation not started. |
| [05 — Care Event Outbox, Inbox, and Notifications](./specs/05-care-event-outbox-inbox-and-notifications.md) | Durable events, safe inbox, preferences, devices, delivery planning, retries, receipts, cancellation, and legacy Discord isolation. | Proposed; minimum v0.2.0 notification foundation, implementation not started. |

Implementation order is dependency-driven: 01 and 02 before 03; 03 before 04 publication; 01–04 before externally delivered Care Loop events through 05.

## Next candidate

| Document | Purpose | Status |
|---|---|---|
| [06 — Confidence-Aware Cycle Insights](./specs/06-confidence-aware-cycle-insights.md) | Replace exact-looking deterministic predictions with provenance, variability, confidence windows, confirmation, and medical-boundary copy. | Validated next candidate; explicitly excluded from v0.2.0 implementation scope. |

## Deferred decision records

These documents preserve architectural constraints without authorizing implementation.

| Document | Purpose | Status |
|---|---|---|
| [07 — Mobile Contracts, Offline Time, and Device Security](./specs/07-mobile-contracts-offline-time-and-device-security.md) | Future native-client boundaries for shared DTOs, offline writes, timezone semantics, deep links, device security, and push registration. | Deferred architecture decision record; not approved for implementation. |
| [08 — Health Import Provenance and Deletion](./specs/08-health-import-provenance-and-deletion.md) | Future read-only HealthKit/Health Connect import constraints, provenance, conflict handling, consent, export, and deletion. | Deferred discovery/specification; not approved for implementation. |

## Research

| Document | Purpose | Status |
|---|---|---|
| [2026-07-17 Product Gap and Mobile-Readiness Research](./research/2026-07-17-product-gap-and-mobile-readiness.md) | Repository and market analysis that produced the trust-first Care Loop direction and later candidate ideas. | Validated research input; non-canonical and superseded by the PRD, architecture, and numbered specs. |

## Dated plans

Plans describe how a decision was or will be executed. They do not supersede canonical product, architecture, or specification documents.

### Active planning branch

| Document | Purpose | Status |
|---|---|---|
| [2026-07-17 v0.2.0 Product Specifications Design](./plans/2026-07-17-v0.2.0-product-specs-design.md) | Approved decision for separating canonical, candidate, deferred, research, and historical documentation. | Active approved design for the docs-only v0.2.0 planning branch. |
| [2026-07-17 v0.2.0 Product Specifications Implementation Plan](./plans/2026-07-17-v0.2.0-product-specs-implementation.md) | Task-by-task plan for producing and validating the current documentation set. | Active execution plan; completion is established by the branch diff and review, not unchecked prose. |

### Historical plans

| Document | Purpose | Status |
|---|---|---|
| [2026-03-13 Partner Linking UX Design](./plans/2026-03-13-partner-linking-ux-design.md) | Approved design for pairing discoverability, code sharing, and connection status. | Historical approved design; corresponding implementation was completed. |
| [2026-03-13 Partner Linking UX Implementation](./plans/2026-03-13-partner-linking-ux-implementation.md) | File-level implementation steps for partner linking UX improvements. | Historical completed plan; not current roadmap. |
| [2026-05-18 Design Overhaul Implementation Plan](./plans/2026-05-18-cb-connect-design-overhaul.md) | Plan for phase-aware atmosphere, emotional dashboard hierarchy, partner support UX, and shared presentation primitives. | Historical implementation plan; consult current UI and design guidance for present behavior. |
| [2026-06-24 Partner-Assisted Period Logging Design](./plans/2026-06-24-partner-assisted-period-logging-design.md) | Approved consent, ownership, attribution, and correction model for partner-assisted period logging. | Historical delivered design decision; retained for rationale. |
| [2026-06-24 Partner-Assisted Period Logging Implementation](./plans/2026-06-24-partner-assisted-period-logging.md) | Test-first schema, mutation, query, and UI implementation plan for assisted logging. | Historical delivered plan; not current roadmap. |

## Legacy and supplemental documents

| Document | Purpose | Status |
|---|---|---|
| [Legacy Technical PRD v1](./cb-connect-technical-prd.md) | January 2026 technical product draft covering the original application architecture and feature set. | Legacy draft; historical background only, superseded by PRD v2 and architecture. |
| [Design Audit](./cb-connect-design-audit.md) | Point-in-time critique of the MVP interface, trust messaging, hierarchy, and partner experience. | Supplemental audit; non-normative and potentially stale as UI changes. |
| [Design Guidelines](./cb-connect-design-guidelines.md) | Emotional, visual, consent, accessibility, and interaction guidance for the current product language. | Supplemental design reference; defer to the canonical PRD/specs on behavior and privacy rules. |

## Contribution conventions

### Required status header

New canonical documents and specifications must begin with a short metadata block containing:

| Field | Requirement |
|---|---|
| `Status` | One of the controlled statuses below, plus implementation state when relevant. |
| `Owner` | Responsible product/engineering/privacy/design area; use a named person only when ownership is durable. |
| `Milestone` or `Earliest milestone` | Release/gate that owns the decision, or the prerequisite before promotion. |
| `Last validated` | Date and repository commit or deployment evidence used for factual current-state claims. |
| `Dependencies` | Relative links to prerequisite local docs and links to live issues/PRs when applicable. |
| `Authority` | Required when replacing or constraining another canonical or legacy document. |

Research and dated plans may use a prose header, but must still declare date, status, scope/purpose, and source baseline.

### Controlled statuses

- **Canonical:** approved source of current product or architecture truth.
- **Proposed — implementation not started:** normative draft ready for review and execution planning, but not deployed behavior.
- **Active plan:** current sequencing artifact for an approved scope.
- **Validated next candidate:** reviewed future work that is not in the current implementation milestone.
- **Deferred decision record:** constraints are documented, but implementation is not authorized.
- **Validated research input:** evidence and hypotheses that inform decisions but do not set scope.
- **Historical:** completed or superseded plan retained for rationale and audit trail.
- **Legacy:** older baseline retained as background; never use as a current contract.

Do not label a document `Implemented`, `Complete`, or `Canonical` solely because it is detailed. Require reviewed code, tests, migrations/backfills, and live deployment evidence appropriate to the change.

### File and change rules

- Keep one major feature or decision per Markdown file.
- Use lowercase descriptive filenames; prefix normative specs with their dependency-order number.
- Name dated plans and research `YYYY-MM-DD-short-description.md`.
- Use relative Markdown links for repository documents and verify them before review.
- Use `MUST`, `MUST NOT`, `SHOULD`, and `MAY` only for intentional normative requirements.
- Separate verified `CURRENT` behavior from `TARGET` behavior and never describe a target schema as deployed.
- Update affected canonical docs and this index in the same pull request as a material product/architecture decision.
- Preserve historical plans; supersede them through status and links rather than rewriting their original decision record.
- Keep secrets, health values, private messages, user identifiers, and local environment details out of documentation examples.
