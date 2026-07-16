# CB Connect — Ideation, Product Gap, and Mobile-Readiness Analysis

**Repository:** `Zburgers/cb-connect`  
**Branch reviewed:** `main`  
**Repository HEAD reviewed:** `4afd1ceb0640a7da96396b5488178aa1e7fe4e29`  
**Date:** 2026-07-17  
**Status:** Validated research input; not canonical product scope  
**Superseded by:** `docs/product/cb-connect-prd-v2.md` and `docs/product/v0.2.0-roadmap.md`  
**Purpose:** Decide what CB Connect should become, which features are worth building before mobile launch, and which architectural/PRD gaps must be closed first.

> This report records the ideation that produced the v0.2.0 direction. Claims
> about differentiation and defensibility are hypotheses to test, not proven
> market facts. Canonical requirements live in the linked product and spec docs.

---

## 1. Executive conclusion

CB Connect should **not** position itself as another period tracker with partner access.

The repository already contains enough product primitives to support a stronger category:

> **CB Connect is a private, consent-first care-coordination app for couples. It translates body and cycle context into specific, bounded, useful care—without turning a partner into a monitor.**

The strongest next feature is a closed-loop system called **Care Loop**:

1. The primary user records how today feels.
2. They choose what, if anything, should be shared.
3. They select the kind of care they want—or explicitly ask for space.
4. The partner receives a simple, actionable Care Card.
5. The partner can acknowledge or complete an action.
6. The primary user can say whether it helped.
7. CB Connect gradually learns preferred care patterns without exposing unnecessary raw health data.

This is the strongest product hypothesis identified by this review. It should be
tested against simpler alternatives before it is treated as the product wedge.

### Why this direction fits the existing repository

The current application already has:

- role-based primary and partner experiences;
- independent sharing controls for cycle/phase, pain, and partner-assisted period logging;
- attributed partner-assisted period entries;
- real-time partner presence;
- nudges, a private couple DM, and reactions;
- a consent-aware timeline and CSV export;
- relationship metadata such as nicknames and a connected-since date.

These are the foundations of a care-coordination product, not just a tracker. The schema confirms these capabilities in `convex/schema.ts`, including consent flags, attributed period events, presence, nudges, messages, and reactions.   

### The main strategic recommendation

Build in this order:

1. **Stabilize trust boundaries and data lifecycle.**
2. **Ship Care Loop as the product-defining feature.**
3. **Replace deterministic certainty with confidence-aware insights.**
4. **Build an internal care-event and notification outbox.**
5. **Extract mobile-safe domain contracts.**
6. **Launch the mobile app as the best interface to the same product—not as a second, divergent product.**

---

## 2. What CB Connect is today, based on `main`

### 2.1 Current technical shape

The repository is a Next.js 15.2 and React 19 application backed by Convex and Clerk. It already includes Vitest and Playwright scripts.  

The root `README.md`, however, contains only the project title. The repository therefore has a functioning product and substantial internal documentation, but almost no useful public-facing repository documentation.

### 2.2 Current primary-user experience

The primary dashboard currently renders:

- current cycle phase;
- partner connection status;
- today’s pain logger;
- pain tips for scores of four or higher;
- phase-specific nutrition suggestions.

This is visible directly in the dashboard composition. 

The timeline supports pain and period history, partner-assisted attribution, correction, deletion, and CSV export.  

### 2.3 Current partner experience

The partner dashboard is already framed as “What today asks from you,” which is strategically correct. It surfaces shared phase/pain context and generic tips.  

The gap is that “what today asks” is still inferred from generic content. The primary user does not directly express:

- what kind of help they want;
- what they do not want;
- whether they want contact or space;
- whether a suggested action was accepted;
- whether the action helped.

The current partner experience is therefore **context-aware but not request-aware or outcome-aware**.

### 2.4 Current consent model

The product has three meaningful controls:

- share period/cycle phase;
- share pain data;
- allow the partner to help log period dates.

These are visible in the partner settings UI and represented in `coupleMembers`.  

This is a strong start, but it remains a category-level, persistent consent model. It cannot yet express:

- “share only today”;
- “share the summary, not the exact score”;
- “share this check-in but not my history”;
- “share a care request without sharing the health reason”;
- “allow access until tonight”;
- “show that I want space, but hide all body details.”

### 2.5 Current prediction model

Cycle calculations are based on one latest period start, a user-supplied average cycle length, and a deterministic modulo calculation. Ovulation is placed around the midpoint of the configured cycle. 

This is acceptable as an early MVP approximation. It is not sufficient for a mature health-adjacent product because it lacks:

- multi-cycle variability;
- confidence ranges;
- irregular-cycle handling;
- missing-data quality;
- confirmation state;
- distinction between estimated and observed phase;
- source provenance for imported records.

### 2.6 Current notification model

The schema has a notification log and a single binary `externalNotificationConsent` on the user.  

The settings UI exposes a single “Allow external notification delivery” checkbox rather than preferences by category, channel, recipient, sensitivity, or quiet hours.  

The design audit already states that Discord is not an appropriate long-term product surface and recommends an internal outbox before replacing the delivery adapter. 

### 2.7 Current relationship layer

CB Connect already includes:

- a Digital Locket pairing experience;
- partner nicknames;
- a connected-since date;
- anniversary moments;
- private DM;
- quick messages and reactions;
- real-time presence and nudges.

The schema and partner page show that this layer is real, not aspirational.   

The relationship layer currently lacks stateful workflows. A message can be sent, but there is no concept of a requested action, acknowledgement, completion, outcome, recurring preference, or care boundary.

---

## 3. The market in 2026

### 3.1 The market is converging on five table-stakes capabilities

#### A. Partner cycle sharing

Clue Connect shares basic phases in a calendar, while hiding tracked experiences such as mood, energy, and pain. Its latest release notes also announce multiconnection, although a current support article still describes one-person sharing, indicating rollout or documentation lag.  

Cycles Partner Connect similarly allows a partner to view cycle information while keeping logs, observations, and sexual activity private. 

**Implication:** Basic phase sharing is no longer differentiated.

#### B. Partner education and proactive tips

Flo for Partners provides the partner with medical insights and proactive tips. Premium expands this into articles, stories, videos, quizzes, and polls. The partner cannot see or edit symptoms, notes, or historical/future calendar details.   

**Implication:** Generic partner education is useful, but it is also becoming table stakes.

#### C. Broader symptom tracking and predictive analysis

Clue’s current release notes include pain intensity, predictions for several pain categories based on the past three to four cycles, weight charts, more health conditions, and biometric overlays. 

**Implication:** A single pain score and five pain tags will look thin in a mature mobile product.

#### D. Wearable and health-platform integration

Clue’s release notes include integrations with Fitbit, Whoop, Polar, Garmin through Health Connect, Oura, and other devices. Stardust describes Apple Health and wearable-driven insights across sleep, energy, and activity.  

Apple HealthKit and Android Health Connect both expose menstrual-cycle data types. Android Health Connect additionally includes flow, basal body temperature, ovulation tests, spotting, resting heart rate, HRV, sleep, skin temperature, and source metadata.   

**Implication:** Mobile health-platform integration should be part of the architecture now, even if it is not the first feature shipped.

#### E. Daily relationship rituals

Paired is built around short daily check-ins and a large library of expert-led quizzes, games, questions, exercises, relationship insights, timeline entries, and special dates.  

**Implication:** Generic couple engagement is a crowded field. CB Connect should not compete by copying a large content library.

### 3.2 Competitor positioning matrix

| Product | Publicly emphasized strength | Publicly visible limitation or trade-off | CB Connect opportunity |
|---|---|---|---|
| **Clue Connect** | Scientific cycle tracking, basic phase sharing, growing multiconnection and wearable support | Shared view is primarily calendar context; tracked mood, energy, and pain are hidden from the connection | Share a user-authored care signal instead of simply revealing more raw data |
| **Flo for Partners** | Medical education, proactive tips, pregnancy/TTC/cycle modes, polished content | Partner cannot see symptoms or notes; partner mode is incompatible with Anonymous Mode; public support says it is designed around one tracked cycle in a male-female couple | More inclusive relationship model, granular consent, and a privacy-preserving care request that does not require raw symptom exposure |
| **Cycles** | Private cycle following, fertility context, clear boundary around logs and sexual activity | Primarily visibility and reminders; public materials do not describe a closed-loop care workflow | Turn visibility into an explicit action and feedback loop |
| **Stardust** | Strong identity, social/partner sharing, playful brand, Apple Health and wearable trends | Public materials emphasize personality and sharing more than structured, accountable care | Pair emotional design with a rigorous consent and action model |
| **Paired** | Daily rituals, expert content, couple questions, games, relationship insights | Does not have live body/cycle context | Trigger the right micro-ritual from the user’s actual context rather than a generic daily prompt |
| **CB Connect today** | Granular category consent, attributed partner assistance, real-time shared space, timeline, DM, nudges | Deterministic cycle model, limited symptoms, generic care tips, no closed-loop action state, incomplete notification and lifecycle architecture | Become the consent-aware “care operating system” for couples |

### 3.3 The whitespace

The reviewed public product descriptions did not clearly advertise all four of
these as one first-class workflow:

1. **Body context**
2. **User-authored consent**
3. **Specific requested care**
4. **Outcome feedback**

This is a product-gap hypothesis CB Connect can test. Public pages cannot prove
that no competitor has shipped or is testing a similar private workflow.

The goal is not to expose more health data than competitors. The goal is to expose **less raw data while producing more useful care**.

---

## 4. Proposed category and product promise

### Category

**Consent-first care coordination for couples**

### Primary promise

> Know what helps today—without guessing, oversharing, or monitoring.

### Jobs to be done

#### Primary user

- “Help me communicate what I need without explaining everything from scratch.”
- “Let me decide what my partner knows and for how long.”
- “Help me see patterns in my body without pretending predictions are certain.”
- “Let my partner help without taking control of my health record.”

#### Partner user

- “Tell me what would actually help, not just which phase it might be.”
- “Help me act without being intrusive or making assumptions.”
- “Let me acknowledge a request so my partner does not need to repeat it.”
- “Teach me over time, but do not make me feel like I am monitoring them.”

#### Couple

- “Reduce recurring friction caused by guessing, forgotten context, and mismatched support.”
- “Create a private, low-effort ritual around care.”

---

## 5. Flagship idea: Care Loop

### 5.1 Concept

Care Loop converts a check-in into an explicit, consented, temporary support protocol.

It should feel lighter than a medical form and more concrete than a generic relationship prompt.

### 5.2 User flow

#### Step 1 — “How is today landing?”

The primary user can optionally record:

- body comfort;
- energy/capacity;
- mood bandwidth;
- selected symptoms;
- a private note.

The product should not require every dimension every day. A two-tap check-in must be valid.

#### Step 2 — “What should cross the bridge?”

For each check-in, the user chooses one of:

- **Private** — save for personal patterns only;
- **Care summary** — partner sees a plain-language summary but no score or symptom list;
- **Selected details** — partner sees explicitly selected fields;
- **Care request only** — partner sees the request but not the underlying body context.

The default should inherit existing sharing settings but remain overridable per check-in.

#### Step 3 — “What would help?”

Suggested care categories:

- Check in later
- Bring water or tea
- Handle food
- Take over one task
- Offer warmth or a heat pack
- Quiet company
- Physical affection
- Give me space
- Listen, no advice
- Help me remember medication
- Help with transport or an appointment
- Custom request

#### Step 4 — “What should not happen?”

Anti-actions are equally important:

- No advice
- Do not ask repeatedly
- No physical touch
- Do not mention my cycle
- Do not solve anything
- Do not share this outside the app
- Custom boundary

#### Step 5 — Partner Care Card

The partner sees something like:

> **Today is low-capacity.**  
> Shared by Naki until 10:00 PM.  
> **Helpful:** handle dinner, check in once after 7 PM.  
> **Avoid:** repeated questions or advice.  
> Body details remain private.

The partner can:

- acknowledge;
- accept one action;
- mark it done;
- say they cannot do it;
- ask one bounded clarification;
- send a supportive note.

#### Step 6 — Outcome pulse

Later, the primary user can respond:

- Helped
- Not now
- Missed the moment
- Too much
- Prefer something else next time

This feedback should improve future suggestions but should not become a score of the partner.

### 5.3 Defensibility hypothesis

A potential source of defensibility is not the list of care actions, but an
accumulated, consented **care preference graph**:

- which actions help in which contexts;
- which boundaries matter;
- when a check-in should expire;
- how much detail the user normally shares;
- whether the partner tends to acknowledge requests;
- which suggestions should be suppressed.

This data may become valuable because it is relationship-specific and
user-authored. That claim depends on repeated use, retention, user willingness to
store it, and safe deletion controls. It should never be framed as diagnosing
the user or grading the partner.

### 5.4 Minimal first release

The original first-release concept included:

- one daily check-in per primary user;
- optional energy and emotional bandwidth fields alongside existing pain;
- up to three requested actions;
- up to three anti-actions;
- private, summary, or selected-detail visibility;
- expiry at end of day or a chosen time;
- partner acknowledge/accept/done states;
- one outcome pulse;
- in-app care event feed;
- complete audit attribution.

The v0.2.0 validation reduced this further to one active request-only Care Card,
up to three helpful and three avoid items, acknowledgement or inability-to-help
responses, and owner cancellation/revocation. Selected health-detail sharing,
completion tracking, outcomes, and learned preferences remain deferred until a
pilot establishes demand and safety.

Do **not** start with a generic rules engine, AI coach, complex automation builder, or universal attribute-based access-control system.

---

## 6. Supporting feature concepts

### 6.1 Confidence-aware cycle insights

Replace exact-looking predictions with:

- predicted window;
- confidence level;
- data quality explanation;
- cycle variability;
- “estimated from N confirmed cycles”;
- observed versus predicted dates;
- confirmation prompts after an estimated period end.

#### Example

> Your next period is most likely between August 12–15.  
> Confidence: moderate, based on four confirmed cycles with a five-day variation.

This is more honest than a single deterministic date.

### 6.2 Body pattern explorer

Expand beyond pain without becoming an 80-field form.

Recommended initial dimensions:

- pain location/intensity;
- flow;
- energy;
- sleep quality;
- mood bandwidth;
- headache/migraine;
- digestive discomfort;
- temperature sensation;
- medication/self-care used;
- custom symptom.

Use progressive disclosure. The daily surface should show only the user’s most-used dimensions.

### 6.3 “What usually helps” memory

After enough completed Care Loops, show private insights such as:

- “Quiet company was marked helpful three times during high-pain days.”
- “You often prefer no advice when energy is low.”
- “Evening check-ins work better than immediate follow-ups.”

The user should be able to delete, correct, or disable these memories.

### 6.4 Weekly couple recap

A five-minute recap, not a generic relationship quiz:

- care requests sent;
- requests acknowledged;
- what helped;
- one appreciation prompt;
- one preference to carry forward.

No partner score, streak shame, or public ranking.

### 6.5 Provider share pack

The repository already provides CSV export, while its backlog still lists PDF reports, provider sharing, and historical analysis as incomplete. 

A provider pack should include only user-selected data:

- period history;
- cycle variability;
- symptom frequency and severity;
- medications/self-care recorded;
- important notes;
- explicit “not a diagnosis” statement;
- generated date and included date range.

The partner should never generate or transmit this report unless explicitly authorized for that instance.

### 6.6 Care-safe notification center

Notification preferences need:

- category: care request, reminder, period window, high symptom, anniversary, DM;
- recipient: self or partner;
- channel: in-app, push, optional email;
- sensitivity: generic lock-screen text versus detailed in-app text;
- quiet hours;
- deduplication;
- expiry;
- pause-all control.

Example lock-screen-safe notification:

> A new care request is waiting in CB Connect.

Not:

> Naki logged severe cramps at 8/10.

### 6.7 Safety reset

A user should be able to perform one protective action that:

- immediately revokes partner access;
- invalidates active invite codes;
- removes active device sessions where supported;
- stops pending external deliveries;
- hides the app’s sensitive lock-screen content;
- preserves the user’s own history;
- offers a clear choice for shared-message visibility and deletion.

This is not only a privacy feature. It is a relationship-lifecycle feature.

### 6.8 Mobile health import — read-only first

The first HealthKit/Health Connect integration should import only user-approved, high-value data:

- menstruation period/flow;
- sleep duration;
- resting heart rate/HRV;
- optional basal body temperature;
- optional spotting or ovulation tests.

Imported data needs:

- source platform;
- source record ID/client ID;
- source version;
- recorded-at timestamp;
- zone offset;
- import status;
- conflict policy;
- user ability to disconnect and remove imported copies.

Android explicitly provides client IDs, client record versions, data origin, recording method, and zone offsets to support synchronization and provenance. 

---

## 7. PRD gaps

The technical PRD is Version 1.0, dated January 31, 2026, and still marked “Draft for Review.” Its implementation phases remain an unchecked eight-week MVP plan.  

`AGENTS.md` explicitly warns that the PRD is background rather than current implementation truth. 

The PRD should be replaced or superseded, not incrementally patched.

### 7.1 Product-definition gaps

The current PRD lacks:

- a crisp category definition;
- primary user segments;
- partner user segments;
- jobs to be done;
- explicit non-goals;
- a differentiated market position;
- relationship lifecycle scenarios;
- mobile-specific requirements;
- success and failure criteria for partner support.

### 7.2 Consent-specification gaps

The PRD describes sharing booleans but does not define:

- consent duration;
- per-entry overrides;
- summary versus exact visibility;
- derived-data visibility;
- revocation propagation;
- notification privacy after revocation;
- consent audit records;
- what happens to previously shared chat and history after unpairing;
- emergency/safety reset behavior.

### 7.3 Prediction and medical-boundary gaps

The PRD does not specify:

- uncertainty and confidence;
- irregular-cycle behavior;
- minimum data required for a prediction;
- algorithm versioning;
- evaluation metrics;
- false-certainty prevention;
- red-flag escalation copy;
- clinical review process for tips;
- prohibited claims;
- pregnancy/TTC/perimenopause scope.

### 7.4 Data lifecycle gaps

The PRD needs explicit requirements for:

- account deletion;
- couple unlinking;
- per-user versus shared-data ownership;
- message deletion/hiding;
- retention periods;
- backups and restoration expectations;
- export completeness;
- imported-health-data deletion;
- third-party processor inventory;
- breach-response workflow.

This is urgent because the current shared-chat clear operation can delete the whole thread for both users, and an open issue documents the data-loss risk. 

### 7.5 Notification PRD gaps

The PRD still centers Discord delivery and does not define:

- event creation versus delivery;
- idempotency;
- retry policy;
- delivery receipts;
- category preferences;
- quiet hours;
- lock-screen redaction;
- device-token lifecycle;
- revoked consent handling.

Open issue #9 confirms that scheduled notifications currently lack an idempotency key or pre-send deduplication. 

### 7.6 Mobile PRD gaps

The PRD has no requirements for:

- iOS and Android target versions;
- deep links and universal links;
- push notifications;
- biometric app lock;
- offline and reconnect behavior;
- secure local storage;
- screenshot/app-switcher privacy;
- timezones and travel;
- HealthKit/Health Connect permissions;
- imported data provenance;
- background sync;
- app-store privacy disclosures;
- mobile accessibility;
- release-channel strategy.

### 7.7 Metrics gaps

The repository tracker lists DAU, partner-link conversion, feature adoption, retention, function performance, load time, error rate, and OCC conflict rate, but all remain unchecked. 

The PRD needs event definitions, not only metric names.

Recommended product metrics:

- check-in completion rate;
- percentage of check-ins shared;
- care-request acknowledgement rate;
- median time to acknowledgement;
- care-action completion rate;
- “helped” outcome rate;
- partner-notification mute rate;
- consent override/revocation rate;
- seven-day and thirty-day couple retention;
- number of days with useful interaction, not raw session count.

Guardrail metrics:

- unwanted notification reports;
- accidental-sharing corrections;
- unpairing friction;
- repeated ignored requests;
- support reports involving privacy or coercion;
- prediction correction rate;
- data-import conflicts.

---

## 8. Architecture gaps

### 8.1 Dashboard query is becoming a product monolith

`getDashboardData` currently handles:

- current-user resolution;
- partner target selection;
- cycle settings;
- latest period;
- cycle calculation;
- today’s pain;
- permission filtering;
- pain-tip selection;
- nutrition-tip filtering and rotation.

This is manageable today, but adding care requests, insights, notification state, import provenance, and mobile-specific payloads will make it hard to test and evolve. 

#### Recommendation

Split domain reads into typed modules:

- `cycle.getTodayContext`
- `checkIns.getToday`
- `care.getActiveCard`
- `sharing.getEffectiveVisibility`
- `insights.getSummary`
- `notifications.getInboxSummary`

A composed `home.getPrimaryHome` and `home.getPartnerHome` can then assemble stable DTOs.

### 8.2 Untyped frontend boundary

`PartnerDashboardProps` currently uses `data: any`. 

This is risky for mobile extraction because web and native clients need explicit, versionable contracts.

#### Recommendation

Define shared TypeScript DTOs for:

- `PrimaryHomeDto`
- `PartnerHomeDto`
- `CareCardDto`
- `PrivacySummaryDto`
- `TimelineEntryDto`

Keep database documents internal to Convex functions.

### 8.3 Cycle model has no provenance or algorithm version

The current output is calculated on demand from a latest period and fixed settings. There is no record of:

- which algorithm produced a prediction;
- what source data it used;
- whether the user confirmed it;
- confidence or variance;
- whether imported data changed it.

#### Recommendation

Add a small `cycleProfiles` projection rather than storing every derived day:

```ts
cycleProfiles: {
  userId,
  confirmedCycleCount,
  averageCycleLength,
  cycleLengthStdDev,
  averagePeriodLength,
  lastConfirmedPeriodStart,
  predictionWindowStart,
  predictionWindowEnd,
  confidence,
  algorithmVersion,
  computedAt
}
```

Recompute after relevant period changes.

### 8.4 No user timezone or event zone offset

The schema has date strings but no user timezone. The dashboard accepts a client-supplied `todayDate`. Mobile devices may travel, cross midnight offline, or import records with distinct zone offsets.

Android Health Connect explicitly models start and end zone offsets so history remains consistent when a user travels. 

#### Recommendation

Add:

- `users.timeZone` as an IANA zone;
- `users.locale`;
- optional event `zoneOffsetMinutes` for imported/timestamped records;
- a single server-side calendar-date validation library;
- explicit tests around DST, travel, and midnight.

### 8.5 Coarse persistent sharing flags

The three existing flags should remain as defaults, but they are not expressive enough for Care Loop.

#### Pragmatic recommendation

Do not introduce a generic policy engine immediately.

Phase 1:

- add `visibilityMode`, `sharedFields`, and `expiresAt` directly to a daily check-in;
- use existing membership flags as maximum/default permissions;
- store an immutable consent snapshot on the shared Care Card.

Phase 2, only when multiple recipients or more scopes exist:

- introduce generalized `sharingGrants`.

### 8.6 No care-event outbox

The current notification log records delivery attempts, but the product needs a durable separation between:

1. an event that occurred;
2. a user’s permission to be notified;
3. a delivery attempt through a channel.

#### Recommended tables

```ts
careEvents: {
  type,
  actorUserId,
  recipientUserId,
  coupleId?,
  entityType,
  entityId,
  redactedPreview,
  dedupeKey,
  createdAt,
  expiresAt?
}

notificationDeliveries: {
  eventId,
  recipientUserId,
  channel,
  destinationId?,
  status,
  attemptCount,
  nextAttemptAt?,
  deliveredAt?,
  failureCode?
}
```

This directly addresses the repository’s known notification idempotency gap.

### 8.7 No notification inbox/read model

The schema has no first-class notification inbox and no `readAt` state. The chat launcher badge uses the total message count, not an unread count. 

#### Recommendation

Add per-user read cursors or receipts rather than duplicating read state on every message.

### 8.8 Shared-message lifecycle is unsafe

The current UI calls a shared clear mutation after a browser confirmation. 

#### Recommendation

Replace global clear with:

- “Hide this conversation for me” using a per-user cursor/state;
- sender-only delete for recent messages if desired;
- optional two-person destructive deletion workflow;
- retention policy and export behavior defined in the PRD.

### 8.9 Content has no clinical governance metadata

`painTips` and `nutritionTips` have content and activation fields, but no reviewer, evidence source, revision, jurisdiction, or review date. 

#### Recommendation

Add:

- content version;
- reviewed by;
- reviewed at;
- evidence/reference ID;
- safety classification;
- applicable modes;
- locale;
- retirement date.

### 8.10 Mobile import requires source-aware idempotency

Health Connect exposes data-origin, client ID, and record version metadata specifically to support synchronization and conflict resolution. 

CB Connect therefore needs a generic import identity:

```ts
source: "manual" | "partner_assist" | "healthkit" | "health_connect"
sourceRecordId?: string
sourceRecordVersion?: string
sourceDeviceId?: string
importedAt?: number
```

This should be introduced before writing HealthKit or Health Connect data into the same tables as manual events.

### 8.11 Documentation and implementation have drifted

The repository has:

- a one-line README;
- a January draft PRD;
- a May tracker whose “active development” section says none;
- a June graph report built from an older commit;
- active GitHub issues and a draft PR.

The newest repository work includes assisted period logging, while the old PRD still describes the original MVP. Recent commits confirm that assisted logging and the consent-aware timeline were added in June.  

#### Recommendation

Create three canonical documents:

1. `README.md` — current product, setup, architecture, commands, trust model.
2. `docs/product-prd-v2.md` — current product and forward plan.
3. `docs/architecture.md` — current backend domains, permission boundaries, event flows, and mobile direction.

Archive or clearly mark older plans as historical.

---

## 9. Mobile architecture recommendation

### 9.1 Recommended client stack

Use **Expo / React Native with Expo Router**, while retaining the existing Convex backend and Clerk identity provider.

This is compatible with the current repository choices:

- Convex officially supports React Native through the same React client package and documents Expo setup.  
- Convex’s Clerk integration supports React-based Clerk SDKs, including Expo. 
- Clerk has a current Expo SDK. Its prebuilt native components are still marked beta, so a production decision should be made consciously rather than adopting them by default.  
- Expo supports local and remote notifications and can deliver through Expo Push Service, FCM, or APNs.  

### 9.2 Do not rewrite the web app first

Recommended migration sequence:

1. Keep the existing Next.js application operating.
2. Extract pure TypeScript domain logic and DTOs from UI code.
3. Create mobile-specific screens that call the same Convex functions.
4. Share validation, types, copy tokens, and domain rules—not DOM components.
5. Move to npm workspaces only when the mobile app is created, in a dedicated migration PR.

Suggested eventual structure:

```text
apps/
  web/                 # existing Next.js application
  mobile/              # Expo / React Native
packages/
  domain/              # pure TS types, validators, cycle/care rules
  contracts/           # stable DTOs and shared API-facing types
  design-tokens/       # colors, spacing, typography semantics
  test-fixtures/       # reusable domain fixtures
convex/                 # one shared backend
```

Do not move the repository into this layout before the domain seams exist. A premature monorepo migration would create noise without solving the product problem.

### 9.3 Mobile MVP scope

The first native release should include:

- sign-in and onboarding;
- today dashboard;
- Care Loop creation and response;
- period and symptom logging;
- partner pairing through universal/deep links with code fallback;
- partner dashboard;
- in-app notification inbox;
- push notifications with generic lock-screen copy;
- timeline read and edit;
- privacy snapshot and revoke access;
- biometric app lock;
- cached last-known dashboard and explicit offline state.

Defer from first native release:

- full provider PDF customization;
- complex wearable correlations;
- write-back to HealthKit/Health Connect;
- large relationship-content library;
- AI chat coach;
- multi-partner relationships;
- community/social feed.

### 9.4 Push architecture

Do not make push delivery a direct side effect of health logging.

Flow:

```text
Mutation commits domain state
        ↓
Care event created with dedupe key
        ↓
Preference and consent evaluator
        ↓
Delivery record created
        ↓
Push adapter sends generic preview
        ↓
Receipt updates delivery status
        ↓
Tap deep-links to authenticated in-app detail
```

Track both device tokens and provider-specific status. Expo’s own guidance recommends storing both Expo and native device tokens if flexibility may be needed later. 

### 9.5 HealthKit and Health Connect strategy

#### Read first

Read approved records, normalize them, and show provenance.

#### Never auto-share imported data

Imported health data must remain private until the primary user explicitly shares a derived summary or selected record.

#### Avoid write-back initially

Writing cycle data into system health stores introduces source-of-truth, duplicate, correction, and user-expectation risks. Read-only import is enough to validate product value.

#### Use platform privacy rules as architecture inputs

Apple states that health and fitness data is especially sensitive, requires collection disclosure, cannot be used for advertising/data mining, and personal health information may not be stored in iCloud.  

---

## 10. Privacy, safety, and regulatory readiness

This section is product architecture guidance, not legal advice.

### 10.1 Health-app rules must be treated as launch requirements

The FTC explains that most consumer health apps not covered by HIPAA may still fall under the FTC Act and, depending on their data flows and multiple-source capabilities, the Health Breach Notification Rule. The updated rule covers unauthorized disclosure as well as conventional security breaches.   

Adding HealthKit, Health Connect, or wearable imports makes the product’s data-flow inventory and breach-response plan more important, not less.

### 10.2 Required product controls before broad mobile launch

- Privacy policy matching actual data flows
- In-app account deletion
- Complete data export
- Partner unlink and safety reset
- Device/session management
- Data-retention statement
- Processor inventory
- Consent history
- Notification redaction
- Security incident playbook
- Age policy
- Health-content review policy
- App-store data-disclosure inventory

### 10.3 Coercion-aware design

Consent-first means accounting for coercion, not merely exposing toggles.

Required rules:

- Partner cannot see whether private data exists.
- “No data” and “not shared” should remain intentionally ambiguous to the partner.
- Partner cannot repeatedly request access through nagging prompts.
- Sharing changes should not trigger a detailed partner notification.
- Revocation should be immediate.
- A partner should not be able to prevent account deletion or unpairing.
- Care requests must be cancellable.
- “Give me space” is a valid complete care request.
- No streaks or scores should punish a user for not sharing.

The current partner dashboard already uses a good ambiguity pattern: absence of pain data may mean it was not logged or was kept private. 

---

## 11. Prioritized feature assessment

The original numeric scorecard implied a precision that the research method did
not support. The validated assessment uses dependency and evidence categories:

| Idea | Decision | Reason |
|---|---|---|
| Trust, identity, and relationship lifecycle | **Committed prerequisite** | Known authorization and data-lifecycle defects block safe expansion |
| Lean Care Loop validation slice | **Candidate for v0.2.0** | Strong fit with existing consent and partner primitives; value remains a hypothesis |
| Care-event outbox and safe inbox | **Candidate foundation** | Needed for reliable Care Loop notifications and future push |
| Confidence-aware cycle windows | **Next candidate** | Corrects current false precision but is not required for the first Care Loop pilot |
| Provider share pack | **Later discovery** | Valuable adjacent job with separate privacy and clinical-content requirements |
| Weekly recap and learned preferences | **Defer pending evidence** | Requires repeated Care Loop use, deletion controls, and minimum-sample rules |
| Mobile app | **Deferred decision record** | Requires stable contracts, time semantics, identity, and retry behavior |
| Read-only health import | **Deferred mobile beta** | Requires mobile demand, provenance, deletion, and app-store privacy readiness |
| Large symptom library or multi-connection | **Defer** | Expands privacy and permission scope before the core workflow is validated |
| Generic quizzes, AI coach, or community | **Do not pursue for v0.2.0** | Weak fit or disproportionate safety, moderation, and clinical-risk surface |

---

## 12. Recommended delivery roadmap

### Gate 0 — Trust and correctness

Do not expand sensitive data collection before closing the known trust-boundary backlog.

Current open or partially addressed issues include:

- raw-body Clerk webhook verification;
- future-date validation;
- pain-log date validation;
- notification idempotency;
- pairing-code entropy and distributed guessing resistance;
- shared-chat deletion;
- role-change constraints;
- server-side user-sync boundary.

The current draft PR #8 addresses the webhook raw-body issue and future period dates, but remains open and draft. 

#### Exit criteria

- All high-confidence auth/data-integrity issues resolved or explicitly accepted.
- No single partner can irreversibly delete shared history for both.
- Pairing uses stronger tokens or an equivalent robust invite flow.
- Notification side effects are idempotent.
- Pain and period mutation date validation is consistent.
- Account deletion and unlink behavior is specified.
- Authenticated E2E setup is reliable.

### Gate 1 — Product-defining Care Loop

Build:

- daily check-in v2;
- care request and anti-action selection;
- per-check-in visibility and expiry;
- partner Care Card;
- acknowledgement/action states;
- outcome pulse;
- in-app care-event feed.

#### Exit criteria

- A primary user can request care without sharing a pain score.
- A partner always knows whether an action is requested, optional, completed, or cancelled.
- Every partner-visible Care Card shows scope and expiry.
- Revocation removes access immediately.
- All state transitions have authorization and audit tests.

### Gate 2 — Insight and notification foundation

Build:

- multi-cycle statistics;
- confidence windows;
- data-quality explanation;
- initial expanded body dimensions;
- notification outbox;
- granular preferences;
- safe in-app inbox;
- provider share pack v1.

#### Exit criteria

- No exact-looking prediction without confidence context.
- Notifications never include sensitive lock-screen content by default.
- Every delivery has a dedupe key and status.
- User can export and delete collected data.

### Gate 3 — Mobile foundation

Build:

- Expo app shell;
- Clerk/Convex authentication;
- typed home DTOs;
- Care Loop flows;
- logging and timeline;
- pairing deep links;
- push notifications;
- secure local session handling;
- biometric lock;
- offline/reconnect UI.

#### Exit criteria

- Web and mobile use the same permission and domain tests.
- Mobile cannot bypass server authorization.
- Deep links cannot expose a reusable sensitive code in analytics/logs.
- Lost/revoked devices stop receiving meaningful notifications.
- Timezone and travel tests pass.

### Gate 4 — Health-platform beta

Build:

- read-only HealthKit import;
- read-only Health Connect import;
- provenance and conflict UI;
- user-controlled import scope;
- disconnect and delete-imported-data flow;
- optional correlation insights.

#### Exit criteria

- No imported data is shared automatically.
- Duplicate records are idempotently handled.
- Source and last sync are visible.
- App-store disclosures and privacy policy match the implementation.

---

## 13. Proposed minimal data model for Care Loop

This is deliberately narrow.

```ts
careCheckIns: defineTable({
  ownerUserId: v.id("users"),
  coupleId: v.optional(v.id("couples")),
  localDate: v.string(),
  timeZone: v.string(),

  painScore: v.optional(v.number()),
  energyLevel: v.optional(v.number()),
  bandwidth: v.optional(
    v.union(
      v.literal("open"),
      v.literal("limited"),
      v.literal("low"),
      v.literal("need_space")
    )
  ),
  symptomTags: v.array(v.string()),
  privateNote: v.optional(v.string()),

  visibilityMode: v.union(
    v.literal("private"),
    v.literal("care_summary"),
    v.literal("selected_details"),
    v.literal("request_only")
  ),
  sharedFields: v.array(v.string()),
  shareExpiresAt: v.optional(v.number()),

  requestedCare: v.array(v.string()),
  avoidCare: v.array(v.string()),
  customRequest: v.optional(v.string()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_owner_date", ["ownerUserId", "localDate"])
  .index("by_couple_date", ["coupleId", "localDate"]);

careActions: defineTable({
  checkInId: v.id("careCheckIns"),
  coupleId: v.id("couples"),
  requestedByUserId: v.id("users"),
  responderUserId: v.id("users"),
  actionType: v.string(),
  status: v.union(
    v.literal("open"),
    v.literal("acknowledged"),
    v.literal("accepted"),
    v.literal("done"),
    v.literal("declined"),
    v.literal("cancelled")
  ),
  acknowledgedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_check_in", ["checkInId"])
  .index("by_responder_status", ["responderUserId", "status"]);

careOutcomes: defineTable({
  checkInId: v.id("careCheckIns"),
  actionId: v.optional(v.id("careActions")),
  ownerUserId: v.id("users"),
  outcome: v.union(
    v.literal("helped"),
    v.literal("not_now"),
    v.literal("missed"),
    v.literal("too_much"),
    v.literal("different_next_time")
  ),
  note: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_check_in", ["checkInId"]);
```

### Important constraints

- `privateNote` is never returned to the partner.
- Partner queries compute a partner-safe DTO server-side.
- `sharedFields` is validated against an allowlist.
- Existing sharing flags act as upper bounds.
- Expired check-ins disappear from partner reads.
- Care actions cannot outlive their check-in.
- Outcome feedback remains private by default.
- No raw database document is sent directly to a client.

---

## 14. Suggested API surface

### Mutations

```text
checkIns.createOrUpdateToday
checkIns.setVisibility
checkIns.cancelShare
care.acknowledgeAction
care.acceptAction
care.completeAction
care.declineAction
care.cancelAction
care.recordOutcome
notifications.markRead
notifications.registerDevice
notifications.unregisterDevice
privacy.revokePartnerAccessAndDeliveries
```

### Queries

```text
home.getPrimaryHome
home.getPartnerHome
checkIns.getTodayForOwner
care.getActiveCardForPartner
care.getOwnerOutcomePrompt
insights.getCycleConfidence
notifications.listInbox
privacy.getCurrentSharingSnapshot
```

### Internal functions

```text
internal.cycle.recomputeProfile
internal.events.createCareEvent
internal.notifications.planDeliveries
internal.notifications.sendPending
internal.notifications.applyProviderReceipt
internal.imports.upsertHealthRecord
```

---

## 15. What not to build before mobile launch

### 15.1 Generic AI coach

An AI coach would introduce medical-claim, hallucination, privacy, evaluation, and emotional-dependence risks before the basic care loop is validated.

A later AI feature should be constrained to user-owned data transformation, for example:

- summarize my selected history for me;
- help me rewrite a care request;
- explain a chart using approved content;
- suggest questions to ask a clinician.

It should not diagnose, predict emergencies, judge the relationship, or autonomously message a partner.

### 15.2 Large social community

This would create a moderation, abuse, identity, safety, and privacy surface unrelated to the product wedge.

### 15.3 Full Paired-style content library

CB Connect should not spend months writing generic quizzes and games. One context-triggered weekly reflection is more aligned with the product than 1,000 generic prompts.

### 15.4 Full multi-partner support now

The existing relationship and role model assumes primary/partner semantics. Multiple connections affect permissions, notifications, relationship ownership, UI, and safety. The repository itself already identifies this as a significant architectural change. 

Design identifiers and permissions so a future migration is possible, but do not delay the mobile product for it.

### 15.5 Write-back to health platforms

Read-only imports provide most early value with far less conflict and liability.

### 15.6 Gamified care scores

Do not rank partners, measure love, penalize missed requests, or expose streak failures. This would convert care into surveillance and obligation.

---

## 16. Release gates for a mobile-quality product

### Product

- Care request can be created in under 30 seconds.
- Partner can understand the requested action without seeing raw health data.
- “Give me space” works as a complete flow.
- User can override sharing per check-in.
- All partner-visible content shows scope/expiry.

### Privacy

- Account deletion is self-service.
- Data export is complete.
- Revocation is immediate.
- Push previews are redacted.
- Imported data is never auto-shared.
- Consent receipts are queryable.

### Correctness

- Prediction windows include confidence.
- Mutation dates are server-validated.
- Timezone/DST/travel cases are tested.
- Notification sends are idempotent.
- Pairing is resistant to distributed guessing.

### Reliability

- Authenticated E2E tests cover both roles.
- Offline state is explicit.
- Failed mobile mutations can be retried safely.
- Push receipts and invalid tokens are processed.
- Schema migrations are backwards compatible.

### Accessibility

- WCAG 2.2 AA for web.
- Dynamic type and screen-reader labels on mobile.
- Reduced motion respected.
- Color is not the only phase/pain indicator.
- Care actions remain usable with one hand and large text.

---

## 17. Concrete recommended epics

### Epic A — Trust-boundary cleanup

- Resolve open auth, pairing, date-validation, notification, and shared-deletion issues.
- Add account deletion specification.
- Consolidate onboarding responsibilities.
- Add CI gates for unit, typecheck, build, and authenticated E2E.

### Epic B — PRD v2 and architecture baseline

- Write `docs/product-prd-v2.md`.
- Write `docs/architecture.md`.
- Rewrite `README.md`.
- Define canonical glossary and trust model.
- Define event/metric taxonomy.

### Epic C — Care Loop v1

- Daily check-in v2.
- Share mode and expiry.
- Care/anti-care selections.
- Partner Care Card.
- Action state machine.
- Outcome pulse.
- Authorization/unit/E2E tests.

### Epic D — Care-event inbox and push-ready outbox

- Event table.
- Delivery table.
- Preferences.
- In-app inbox.
- Dedupe/retry logic.
- External Discord adapter isolated and deprecated.

### Epic E — Confidence-aware cycle model

- Cycle profile projection.
- Variability and confidence.
- Predicted window.
- User confirmation.
- Algorithm version.
- Accuracy/correction metrics.

### Epic F — Data rights and safety reset

- Export package.
- Account deletion.
- Unpairing choices.
- Per-user chat hide.
- Safety reset.
- Consent history.

### Epic G — Mobile foundation

- Workspace migration.
- Expo app.
- Clerk + Convex integration.
- Shared DTOs/domain package.
- Push registration.
- Deep links.
- biometric lock.
- offline/reconnect UX.

### Epic H — Health import beta

- HealthKit adapter.
- Health Connect adapter.
- source-aware import tables.
- permissions education.
- provenance/conflict UI.
- delete/disconnect flow.

---

## 18. Final recommendation

CB Connect is closest to product-market differentiation when it does **less tracking and more translation**.

The next release should not be sold as:

> “We added energy, mood, sleep, and more symptoms.”

It should be sold as:

> **“Tell your partner what helps today—without explaining everything or sharing more than you want.”**

That promise is supported by the repository’s strongest existing work:

- consent controls;
- partner-specific presentation;
- attributed assistance;
- real-time shared state;
- care-oriented copy;
- private relationship space.

Care Loop completes the architecture those features are already pointing toward.

The mobile app should then make that loop immediate through:

- fast check-ins;
- push notifications;
- deep-link pairing;
- biometric privacy;
- optional health-platform context;
- reliable offline/reconnect behavior.

The strategic sequence is therefore:

> **Trust foundation → Care Loop → confidence and notification architecture → mobile → health integrations.**

That sequence gives CB Connect a real product identity before it enters the app stores, rather than shipping a competent but interchangeable cycle tracker.

---

## 19. Evidence and sources

### Repository evidence reviewed

- [`README.md`](../../README.md)
- [`package.json`](../../package.json)
- [`AGENTS.md`](../../AGENTS.md)
- [`docs/cb-connect-technical-prd.md`](../cb-connect-technical-prd.md)
- [`docs/cb-connect-design-audit.md`](../cb-connect-design-audit.md)
- [`issues.md`](../../issues.md)
- [`convex/schema.ts`](../../convex/schema.ts)
- [`convex/queries/dashboard.ts`](../../convex/queries/dashboard.ts)
- [`convex/_helpers/cycleCalculations.ts`](../../convex/_helpers/cycleCalculations.ts)
- [`app/(dashboard)/dashboard/page.tsx`](../../app/(dashboard)/dashboard/page.tsx)
- [`app/(dashboard)/dashboard/partner/page.tsx`](../../app/(dashboard)/dashboard/partner/page.tsx)
- [`app/(dashboard)/dashboard/settings/page.tsx`](../../app/(dashboard)/dashboard/settings/page.tsx)
- [`app/(dashboard)/dashboard/log/page.tsx`](../../app/(dashboard)/dashboard/log/page.tsx)
- [`components/partner/PartnerDashboard.tsx`](../../components/partner/PartnerDashboard.tsx)
- [`components/partner/PartnerChat.tsx`](../../components/partner/PartnerChat.tsx)
- [Current GitHub issues](https://github.com/Zburgers/cb-connect/issues)
- [Draft PR #8](https://github.com/Zburgers/cb-connect/pull/8)

### Market and platform sources reviewed

- [Clue Connect sharing](https://support.helloclue.com/hc/en-us/articles/14582034397597-How-can-I-share-my-cycle-with-someone-using-Clue-Connect)
- [Clue release notes](https://support.helloclue.com/hc/en-us/articles/18141097264413-What-s-new-in-the-Clue-app)
- [Flo for Partners support](https://help.flo.health/hc/en-us/sections/19871950630420-Using-Flo-for-Partners)
- [Cycles Partner Connect](https://cycles.app/articles/explore-cycles/all-about-partner-connect)
- [Cycles privacy policy](https://cycles.app/privacy-policy)
- [Stardust FAQ](https://stardust.app/faq)
- [Paired product overview](https://support.paired.com/en/articles/164632-what-is-paired)
- [Convex React Native guide](https://docs.convex.dev/quickstart/react-native)
- [Expo Clerk guide](https://docs.expo.dev/guides/using-clerk/)
- [Expo push-notification overview](https://docs.expo.dev/push-notifications/overview/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Android Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [FTC Mobile Health Apps Interactive Tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
