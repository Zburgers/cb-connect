# Partner-Assisted Period Logging Design

## Decision

Extend the existing `coupleMembers` and `periodEvents` models. Partner-assisted
updates apply immediately to the primary user's real cycle history, while
server-enforced consent, durable attribution, and primary-only correction keep
the primary user in control.

The supplied feature specification selects this approach ("Option B") and is
the approved product baseline.

## Approaches considered

1. **Extend the existing period model — selected.** One cycle history continues
   to drive dashboard state, predictions, timeline, and export. Attribution and
   correction are fields and actions on the existing records.
2. **Store partner suggestions in a separate table.** This provides isolation,
   but introduces reconciliation, duplicate states, and a second source of
   truth. It conflicts with the requirement that updates apply immediately.
3. **Create pending period events requiring confirmation.** This gives stronger
   approval semantics but adds workflow and notification complexity explicitly
   excluded from the MVP.

## Permission and ownership model

- `sharingPhase` controls period/cycle visibility.
- `sharingPeriodWrite` controls assisted start/end logging and defaults to
  false, including when absent on legacy membership records.
- The primary membership is authoritative for both flags.
- Disabling `sharingPhase` atomically disables `sharingPeriodWrite`.
- Enabling `sharingPeriodWrite` while effective `sharingPhase` is false fails.
- Assisted mutations require an active couple, a partner caller, a primary
  membership, visibility, and write permission.
- Every `periodEvents.userId` remains the primary user's ID.
- Pain, symptoms, mood, notes, cycle settings, and primary preferences remain
  outside partner write access.

## Attribution model

Period events gain optional creator, updater, source, and confirmation fields.
New self-created events use `source: "self"`; assisted events use
`source: "partner_assist"`; automated closure uses `source: "system"` only when
the system created the event, while an automatic end records no human updater.
Legacy rows are projected as self-created and confirmed without requiring a
backfill.

Editing an assisted event preserves its original source while recording the
primary user as the updater. This supports "Added by partner" and "Corrected by
you" at the same time.

## Backend flow

Shared helpers validate calendar dates, resolve the active primary/partner
relationship, and project safe attribution defaults.

`assistLogPeriodStart` closes the primary user's current open period one day
before the selected date, inserts the attributed event, and writes an in-app
notification log for the primary user in the same transaction.

`assistLogPeriodEnd` validates and closes the primary user's open event and
writes the corresponding notification. It does not rewrite the event source.

`updatePeriodEvent` and `deletePeriodEvent` require event ownership. Partners
cannot revise submitted events.

Queries resolve creator/updater names in bounded batches, expose `canCorrect`
only to the owner, and attach period metadata to timeline entries.

## Interface design

The current app's variable-driven glass surfaces, typography, spacing, Lucide
icons, and restrained motion remain unchanged.

- Primary users receive a progressive "Today's check-in" card with Today,
  Yesterday, and Choose date actions.
- Partners see either a read-only explanation or a tightly scoped assisted
  logging card. Pain controls are never rendered for partners.
- Timeline attribution is a quiet secondary line. Primary users receive an
  explicit Edit action and a compact inline correction editor.
- Sharing controls use three vertically separated consent rows. Assisted
  logging is disabled with an explanation until visibility is enabled.
- The settings snapshot adds assisted logging as a third state card.
- Touch targets remain at least 44px, controls have visible focus states, and
  mobile actions reflow rather than wrap labels.

## Error handling

Mutation errors use clear product language for missing active couples,
permissions, invalid dates, absent open periods, and ownership failures. UI
messages stay local to the action card and preserve the selected date after a
failure so the user can correct it.

## Verification

- Automated Convex tests cover permission dependencies, ownership,
  attribution, primary-target writes, corrections, and legacy query defaults.
- Existing timeline helper tests remain green.
- `npm run lint`, unit tests, `npm run build`, and supported Playwright tests
  run before any production deployment.
- Convex deploys proceed dev, isolated test/staging deployment, then production.
  Each target is identified explicitly before deployment and validated through
  function metadata plus read-only data checks.

