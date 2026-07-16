# CB Connect Product Requirements Document v2

**Status:** Canonical product baseline; approved for v0.2.0 planning
**Owner:** CB Connect Product and Engineering
**Milestone:** v0.2.0, trust-first pilot
**Last validated:** 2026-07-17 against `main` commit `4afd1ceb0640a7da96396b5488178aa1e7fe4e29`
**Implementation status:** Not started; Care Loop is a gated product hypothesis
**Dependencies:** Gate 0 trust specifications, Care Loop privacy/domain specifications, notification idempotency, and reliable authenticated E2E coverage
**Authority:** This is canonical product truth for current direction and v0.2.0. `docs/cb-connect-technical-prd.md` is historical background, not a current implementation contract.

## 1. Product decision

CB Connect is a private, consent-first care-coordination product for couples.
It helps a primary user communicate a bounded request for care while deciding
what body or cycle context, if any, crosses to their partner.

> Know what helps today without guessing, oversharing, or monitoring.

v0.2.0 is trust-first. It closes known identity, authorization, consent,
lifecycle, and notification risks before testing a small Care Loop workflow.
Care Loop is the strongest current hypothesis, not a proven differentiator or permission to collect more sensitive data.

## 2. Current product

CB Connect is a Next.js App Router web application using React, TypeScript,
Clerk, Convex, Tailwind CSS, Vitest, and Playwright (`package.json`).

### 2.1 Current capabilities

Primary users can:

- record period dates and daily pain;
- view cycle phase, predictions, pain guidance, and nutrition guidance;
- review, correct, delete, and export timeline history;
- independently control phase, pain, and partner-assisted period permissions;
- revoke partner access.

Partners can:

- join through a time-limited pairing code;
- view only enabled phase and pain categories;
- assist with period logging only when separately authorized;
- send nudges, direct messages, and reactions;
- see relationship metadata and presence.

The implemented schema confirms role, consent, period attribution, presence,
nudges, messages, and reactions in `convex/schema.ts`. The primary user remains
the owner of partner-assisted records, with actor attribution and confirmation
state in `convex/mutations/periods.ts` and `convex/queries/history.ts`.

### 2.2 Current limitations

- Clerk-to-Convex identity and webhook boundaries need one canonical,
  server-verified contract (`convex/_helpers/auth.ts`,
  `app/api/webhook/clerk/route.ts`).
- Role and relationship lifecycle invariants are incomplete.
- Either member can clear shared chat for both people
  (`convex/mutations/messages.ts`).
- Pairing-code resistance, mutation date validation, and scheduled notification
  idempotency have open defects.
- Notifications use one coarse consent flag and a Discord delivery path
  (`convex/actions/notifications.ts`, `convex/actions/discord.ts`).
- Cycle predictions are deterministic and show no confidence or data-quality
  context (`convex/_helpers/cycleCalculations.ts`).
- Consent is persistent and category-level; there is no recipient-specific,
  expiring share receipt (`convex/schema.ts`).
- Authenticated E2E coverage is not yet a reliable release gate (`e2e/`).

These are release prerequisites, not optional polish.

## 3. Jobs to be done

### Primary user

- Help me express what would help without a long explanation or unwanted health
  disclosure.
- Let me know who can see a request, what they see, when access ends, and how to
  stop sharing immediately.
- Keep me as the source of truth when my partner helps with tracking.
- Let me leave, revoke access, preserve my private history, and stop future
  disclosure without the other person’s approval.

### Partner user

- Tell me the requested care and boundary without making me infer from a cycle
  phase or monitor private health data.
- Let me acknowledge the request or say I cannot help.
- Make expired, cancelled, and revoked requests unavailable without revealing
  private data or blaming either person.

### Couple

Reduce friction caused by guessing, repeated explanation, and mismatched care
while preserving autonomy. Care must never become obligation, surveillance,
ranking, or proof of relationship quality.

## 4. v0.2.0 scope

v0.2.0 has two dependency-ordered gates. Gate 1 cannot enter a user pilot until
Gate 0 passes.

### 4.1 Gate 0: committed trust foundation

The release must:

1. Establish one canonical Clerk-to-Convex identity mapping and verify Clerk
   webhook input before any user-sync mutation.
2. Enforce roles, active membership, ownership, and actor permissions
   server-side for every sensitive read and mutation.
3. Define and implement partner leave, primary revoke, unlink, relink, and
   account-deletion behavior.
4. Replace unilateral shared-chat destruction with per-user hiding or another
   explicitly approved ownership model.
5. Strengthen pairing-code entropy and distributed guessing resistance.
6. Apply consistent server-side date validation to pain and period mutations.
7. Make scheduled and retryable notification effects idempotent.
8. Define auditable consent, immediate revocation propagation, and generic
   notification previews.
9. Make authenticated primary/partner E2E tests a release gate.

### 4.2 Gate 1: lean Care Loop pilot candidate

After Gate 0 passes, the pilot includes only:

- one active, expiring Care Card per primary user;
- request-only sharing as the default and only initial share mode;
- one to three helpful actions and zero to three avoid actions;
- an explicit recipient and immutable partner-visible share snapshot;
- partner responses limited to `acknowledged` or `cannot_help`;
- primary-user cancellation and immediate revocation;
- complete actor attribution, domain events, and audit history;
- idempotent retries and stale-revision rejection;
- a partner-safe read model containing no private check-in document.

A Care Card may say what would help and what to avoid. It must not require or imply pain, symptoms, energy, mood, medication, cycle phase, or a private note.

### 4.3 Minimum event and notification support

- Separate committed domain events from delivery attempts.
- Use stable deduplication keys.
- Provide an in-app path to the active Care Card.
- Use generic external preview text if external delivery is enabled.
- Recheck authorization and expiry immediately before delivery.
- Cancel pending disclosure after expiry, cancellation, unlinking, or
  revocation.

This does not commit v0.2.0 to a full multi-channel notification platform.

## 5. Non-goals

v0.2.0 excludes:

- selected health-detail sharing or health-derived care summaries;
- partner accept, complete, or `done` states;
- Care Card chat or clarification threads;
- in-product outcome scoring, learned preferences, or weekly recaps;
- care streaks, partner scores, or relationship grading;
- expanded symptom, medication, sleep, mood, or energy tracking;
- confidence-aware cycle prediction changes;
- new provider reports;
- multi-partner support;
- AI coaching, quizzes, games, community, or social feeds;
- native mobile, push launch, HealthKit, or Health Connect;
- health-platform write-back;
- a package bump, deployment, tag, release, or merge from this documentation
  branch.

Deferred items require their own evidence and approved specification. They must
not enter Care Loop as implementation convenience.

## 6. Product hypotheses

| ID | Hypothesis | Supporting signal | Falsifying signal |
|---|---|---|---|
| H1 | A request-only card reduces explanation. | Most surveyed primary users say their partner understood without added health context. | Users routinely leave the app to explain or require health-detail sharing. |
| H2 | Helpful and avoid items feel safer than inferred guidance. | Users say the published card represented their request and boundary. | Users avoid publishing, cancel immediately, or report pressure from the choices. |
| H3 | Two partner responses are sufficient initially. | Partners respond honestly and primary users understand the state. | Users repeatedly require accept, completion, clarification, or scheduling states. |
| H4 | Expiry and revocation increase willingness to share. | Users predict when access ends and can stop it successfully. | Users misunderstand persistence, cannot stop access, or share less due to lifecycle uncertainty. |
| H5 | Care coordination works without raw health data. | Useful cards remain request-only through the pilot. | The workflow only works when private health context is disclosed. |

No hypothesis asserts clinical benefit, diagnosis, prediction accuracy, or
relationship improvement.

## 7. Pilot metrics and guardrails

### 7.1 Pilot boundary

- Use a disabled-by-default server feature flag and explicit allowlist.
- Start with synthetic accounts, then a small invited cohort.
- Do not promote Care Loop publicly during the pilot.
- Require at least 15 activated couples and 50 published cards before a
  graduation decision; record any threshold change before reviewing results.
- Pair event metrics with interviews or a privacy-safe survey. Do not infer
  emotional outcomes from clicks.

An activated couple has two authenticated members in an active relationship
who can reach the pilot. Synthetic events are excluded.

### 7.2 Initial decision thresholds

| Metric | Threshold |
|---|---|
| Card creation time | Median at or below 30 seconds. |
| Repeat creation | At least 40% of activated couples publish on two or more days. |
| Partner response | At least 60% of unrevoked cards receive a response before expiry. |
| Request comprehension | At least 70% of surveyed primary users say no added health explanation was needed. |
| Boundary representation | At least 80% of surveyed primary users say the card matched their sharing intent. |

Thresholds are pilot decision aids, not product-market-fit claims.

Track publication attempts/success, time to response, response type,
cancellation, expiry without response, duplicate suppression, stale-revision
rejection, delivery states, opt-out, and feature disablement. Cancellation,
`cannot_help`, and expiry are valid outcomes, not partner failure.

### 7.3 Guardrails

| Guardrail | Response |
|---|---|
| Cross-user, cross-couple, or post-revocation disclosure | Stop pilot; disable partner reads and deliveries. |
| Private health or note content in a partner DTO, log, event, analytics, or notification | Stop pilot and begin incident handling. |
| Expired or cancelled card remains accessible | Disable publication and partner access until verified fixed. |
| Unwanted-sharing report | Review individually; any severe or reproducible case blocks expansion. |
| More than 5% of cards need correction because displayed scope differed from intent | Pause expansion; review defaults, copy, and snapshot creation. |
| More than 25% opt out because of privacy or pressure | Do not graduate; return to discovery. |
| Notification preview reveals request content by default | Disable external Care Loop delivery. |

Telemetry may use workflow IDs and bounded event properties. It must not contain
private notes, custom request text, health fields, or detailed notification
content.

## 8. Product and privacy invariants

1. Derive the authenticated actor server-side; client IDs never grant authority.
2. Private check-ins and partner-visible shares are separate records.
3. Publishing creates an immutable, recipient-specific snapshot with source
   revision, allowed fields, publication time, and expiry.
4. Existing category flags do not implicitly authorize Care Loop sharing.
5. A partner cannot tell whether private health data is absent or withheld.
6. Private notes and raw health data never enter partner DTOs, notifications,
   delivery logs, domain events, or analytics.
7. Every partner read/action rechecks relationship, recipient, expiry,
   cancellation, and revocation.
8. Reads enforce expiry even if scheduled processing is delayed.
9. Cancellation, revocation, unlinking, and deletion stop future reads, actions,
   and pending deliveries immediately.
10. Retried mutations are idempotent; stale revisions are rejected.
11. Care events measure workflow state, never partner worth or relationship
    quality.
12. The primary user retains private health history through unlinking or
    revocation.

## 9. Acceptance criteria

### 9.1 Gate 0

- Webhook verification precedes user-sync writes.
- Sensitive functions use canonical identity and a server-derived actor.
- Unauthorized role changes and stale/revoked memberships are rejected.
- Leave, revoke, unlink, relink, and deletion behavior is tested.
- No member can unilaterally erase the other member’s message history.
- Relevant lifecycle transitions invalidate active pairing credentials.
- Pain and period date rules are consistent and tested.
- Notification retries cannot create duplicate external effects.
- Revocation prevents later reads and pending disclosure.
- Authenticated E2E covers both roles and critical lifecycle paths.
- High-severity trust defects are closed or explicitly risk-accepted by the
  owner.

### 9.2 Care Loop

- A primary user can publish with zero health fields.
- Publication enforces one to three helpful and zero to three avoid items;
  custom text has a separate bounded validator.
- A second active card requires an explicit replace/cancel path.
- The partner sees exactly the immutable recipient snapshot.
- The partner can respond once; duplicate retries return the existing result.
- A partner cannot complete, edit, republish, or infer private data.
- Owner cancellation immediately blocks partner reads and actions.
- Expiry blocks reads/actions regardless of scheduler delay.
- Stale edits cannot alter a published snapshot.
- Unlink, revoke, deletion, or feature disablement safely closes the workflow.
- Allowed and rejected transitions record actor, entity, reason, and time
  without sensitive text.

### 9.3 Quality

- Unit tests cover validators, permissions, transitions, expiry, revocation,
  stale revisions, and retries.
- Integration tests cover publication, partner-safe reads, events, inbox, and
  delivery suppression.
- E2E covers publish, response, cancellation, expiry, revocation, and error
  states.
- Tests prove private data is absent from partner and telemetry surfaces.
- UI covers loading, empty, validation, offline/retry, expired, cancelled,
  revoked, success, and feature-disabled states.
- Keyboard, screen-reader, focus, reduced-motion, non-color status, and touch
  target requirements pass.
- No release-critical action fails silently.

## 10. Release gates

### A. Documentation and review

- Canonical product, architecture, trust, lifecycle, Care Loop, and notification
  specs are approved and consistent.
- Current-state claims match the implementation and live issue/PR state.
- Security, engineering, privacy, and design reviews have no blocker.

### B. Trust implementation

- Gate 0 criteria pass in CI and the target environment.
- Data repair/backfill is measured, rehearsed, and reversible.
- Logs reconstruct identity, membership, revocation, and delivery decisions
  without sensitive text.

### C. Internal validation

- Synthetic accounts pass allowed, denied, duplicate, stale, expired,
  cancelled, revoked, and delivery-suppression paths.
- Server-side disablement stops publication and partner disclosure without a
  schema rollback.
- Support has a privacy-incident runbook.

### D. Invited pilot and graduation

- Access is allowlisted and cohorts expand only after guardrail review.
- Minimum evidence thresholds are met before evaluation.
- Graduation requires an explicit product decision considering interviews,
  incidents, operational load, and whether request-only cards produced value.

## 11. Dependencies

Product/spec dependencies:

- `docs/specs/01-trust-boundaries-and-auth-identity.md`
- `docs/specs/02-relationship-lifecycle-data-rights-and-safety-reset.md`
- `docs/specs/03-consent-sharing-and-care-loop-privacy.md`
- `docs/specs/04-care-loop-v1-domain-and-state-machine.md`
- `docs/specs/05-care-event-outbox-inbox-and-notifications.md`
- `docs/product/v0.2.0-roadmap.md`

Repository dependencies at the validated baseline:

- issues #1/#3: Clerk identity and webhook verification;
- issue #2: role restrictions;
- issue #5: shared-chat deletion;
- issue #6: pairing security;
- issues #7/#10: period and pain date validation;
- issue #9: notification idempotency;
- draft PR #8: partial webhook/future-period-date remediation;
- stable Convex deployment, Clerk JWT configuration, and authenticated
  Playwright fixtures.

Refresh live issue and PR state before implementation or release decisions.

## 12. Rollout

1. **Trust preparation:** implement Gate 0 independently, rehearse migrations,
   deploy backward-compatible server changes, and regression-test existing
   period, pain, timeline, pairing, and messaging flows.
2. **Internal validation:** deploy Care Loop disabled by default, enable only
   synthetic/team accounts, and exercise retry, stale, expiry, cancellation,
   unlink, revocation, and notification redaction.
3. **Invited pilot:** enable up to five couples, review guardrails, then expand
   incrementally toward the target cohort. Keep request-only sharing and two
   response states fixed during measurement unless safety requires change.
4. **Evaluation:** exclude synthetic activity, review metrics and interviews,
   then explicitly graduate, revise and re-pilot, or stop.

## 13. Rollback

Immediately stop for cross-couple disclosure, private-data leakage, failed
revocation/cancellation/expiry, sensitive notification previews, authorization
regression, or repeated coercion/scope-confusion reports.

Rollback is server-side feature disablement, not destructive schema rollback:

1. Reject new Care Card publication.
2. Block partner reads and actions.
3. Cancel unsent deliveries and suppress retries.
4. Preserve primary-owned private data and audit evidence under the approved
   retention policy.
5. Keep unrelated features available unless the incident shares their trust
   boundary.
6. Show a privacy-safe unavailable state without confirming a request exists.

Data/schema rollback requires a separately reviewed migration. Disabling Care Loop must not delete user records or rewrite audit history.

## 14. Ownership and change control

- Product owns scope, hypotheses, pilot design, and graduation.
- Engineering owns implementation safety, operations, and rollback.
- Privacy/security may block rollout when an invariant or guardrail fails.
- Design owns comprehension, accessibility, and coercion-aware review.
- Changes to share modes, health exposure, partner states, analytics content,
  or cohort require a recorded PRD/spec update before implementation.

Revalidate this PRD whenever the implementation baseline, trust backlog, Care Loop scope, or pilot decision changes.
