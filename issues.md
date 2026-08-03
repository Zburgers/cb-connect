# CB Connect - Issues & Feature Tracker

**Last Updated:** May 21, 2026
Update with Github issues on the parent repo

## Active implementation issues

--

### Couple DM message-state and reaction UX
**Status:** In implementation; production verification pending
**Evidence:** The prior chat surface counted all loaded messages for the launcher badge, had no delivery/read state, rendered repeated sender metadata and reaction buttons, and collected all couple reactions without a message bound.
**Scope:** Add unread-only state, monotonic delivery/read receipts, grouped messages, bounded grouped reactions, accessible progressive-disclosure controls, and authenticated test coverage.
**Exit evidence:** Unit/typecheck/build gates, authenticated two-user E2E at mobile and desktop widths, and production Convex two-user smoke verification.

--
---

## ✅ Completed

### Partner Linking UX Improvements
**Status:** Complete
**Completed:** March 13, 2026
**Design Doc:** `docs/plans/2026-03-13-partner-linking-ux-design.md`
**Implementation Plan:** `docs/plans/2026-03-13-partner-linking-ux-implementation.md`

**Completed Tasks:**
- [x] Create `PartnerStatusCard` component
- [x] Add card to main dashboard
- [x] Implement auto-copy on code generation
- [x] Add share button with Web Share API
- [x] Add connection status bar
- [x] Add "Already have a pairing code?" button for partner users
- [x] Create issues.md tracker

**Commits:**
- `8dda176` fix: add 'Already have a pairing code?' button for partner users
- `6db6e79` docs: add design docs and issues tracker
- `2e2fcd0` feat: enhance partner page with auto-copy and share functionality
- `84f316d` feat: add clipboard and Web Share API helper functions
- `382fade` feat: integrate PartnerStatusCard into main dashboard

**Testing Notes:**
- Auth protection working correctly (redirects to sign-in)
- TypeScript compilation passes
- Manual testing required for full flow (see Testing Guide below)

---

## 📖 Manual Testing Guide

### Prerequisites
- Running dev server: `npm run dev`
- Convex running: `npx convex dev`
- Two test Clerk accounts (or use Google OAuth with different accounts)

### Test Flow 1: Primary User Generates Code

1. **Sign in as Primary User**
   - Navigate to `http://localhost:3000`
   - Click "Sign In" with Google
   - Complete onboarding:
     - Select "I'm tracking my cycle"
     - Enter last period date on `/onboarding`
     - Adjust cycle settings (28 days, 5 days)
     - Click "Start Tracking"

2. **Verify Dashboard**
   - Should see PartnerStatusCard showing "Let your special one take care of you"
   - Click "Invite Partner →"
   - Should navigate to `/dashboard/partner`

3. **Generate Pairing Code**
   - Click "Generate Pairing Code"
   - Verify:
     - Code appears in large font (e.g., "847293")
     - Toast message: "Code generated and copied to clipboard!"
     - Copy button shows "Copied!" with checkmark
     - Share button visible

4. **Test Copy Button**
   - Click "Copy" button
   - Verify: "Code copied to clipboard!" message
   - Paste somewhere to verify code copied

5. **Test Share Button**
   - Click "Share" button
   - Desktop: Should fallback to copy
   - Mobile: Should open native share dialog

### Test Flow 2: Partner User Links

1. **Sign in as Partner User** (new incognito window)
   - Navigate to `http://localhost:3000`
   - Sign in with different Google account
   - Complete onboarding:
     - Select "I'm a supportive partner"
     - Should navigate directly to `/dashboard/partner`

2. **Enter Pairing Code**
   - Enter the 6-digit code from Primary user
   - Click "Link Account"
   - Verify:
     - Success message: "Successfully linked!"
     - Redirected to dashboard
     - PartnerStatusCard shows "Connected with {partnerName}"

### Test Flow 3: Linked Dashboard View

1. **Primary User Dashboard**
   - Should see PartnerStatusCard: "Connected with {partnerName}"
   - Shows: "Sharing: ✓ Phase ✓ Pain" (or whichever enabled)
   - Click "Manage Sharing" → goes to partner page

2. **Partner User Dashboard**
   - Should see PartnerStatusCard: "Connected with {partnerName}"
   - Shows: "Check in on her current phase and pain levels"
   - Can view partner's cycle data

### Test Flow 4: Sharing Settings

1. **Primary User Toggles Sharing**
   - Go to `/dashboard/partner`
   - Uncheck "Share pain data"
   - Verify partner dashboard updates (pain data hidden)
   - Re-check to restore

2. **Revoke Access**
   - Click "Revoke Partner Access"
   - Confirm dialog appears
   - Click OK
   - Verify: Partner removed, status shows "Not linked"

### Expected Results Checklist

- [ ] PartnerStatusCard appears on dashboard for all users
- [ ] Unlinked primary sees "Let your special one take care of you"
- [ ] Unlinked partner sees "Connect with your partner now"
- [ ] Linked users see "Connected with {partnerName}"
- [ ] Clicking card navigates to partner page
- [ ] Code auto-copies on generation
- [ ] Copy button shows feedback
- [ ] Share button works (or fallback)
- [ ] Partner onboarding routes directly to `/dashboard/partner`
- [ ] Entering valid code links successfully
- [ ] Sharing settings update in real-time
- [ ] Revoke confirmation dialog appears

---

## 🚀 Active Development

### None currently

---

## 📋 Backlog

### Phase 2: Gender & Relationship Fields
**Priority:** Medium
**Estimated Effort:** 2-3 days

- [x] Add `gender` field to users table (`convex/schema.ts`)
  - Type: `"male" | "female" | "other" | "prefer_not_to_say"`
  - Optional field with default `null`
- [x] Add `partnerType` field
  - Type: `"boyfriend" | "girlfriend" | "spouse" | "partner" | "other"`
  - Used for gendered messaging
- [x] Add settings controls to collect optional gender and relationship term
  - Optional with "prefer not to say"
- [x] Implement gendered messaging in PartnerStatusCard
  - Male partner: "Connect with your partner now"
  - Female partner: "Let your special one take care of you"
  - Linked boyfriend: "Show {partner} some love"
  - Linked girlfriend: "Let {partner} know how you're feeling today"

---

### Phase 3: Relationship Milestones
**Priority:** Low
**Estimated Effort:** 3-4 days

- [ ] Add `relationshipStartDate` field to `coupleMembers` table
  - Type: `v.number()` (Unix timestamp)
  - Optional field
- [ ] Calculate and display relationship duration
  - "Together for 2 weeks" / "3 months" / "1 year"
  - Show in PartnerStatusCard header
- [ ] Add anniversary tracking
  - Store anniversary dates
  - Show reminder notifications
- [ ] Add special date tracking (birthdays, etc.)
  - New table: `specialDates`
  - Fields: `userId`, `partnerId`, `date`, `type`, `title`
- [ ] Celebration UI for milestones
  - Confetti animation on anniversaries
  - Special badges/achievements

---

### Phase 4: Personalization
**Priority:** Low
**Estimated Effort:** 4-5 days

- [ ] Add partner nicknames
  - Field in `coupleMembers`: `nickname` (optional string)
  - Display nickname instead of full name in UI
- [ ] Custom relationship status messages
  - User-defined messages for partner
  - Stored in `coupleMembers` or new table
- [ ] Partner photo/avatar
  - Upload profile picture for partner view
  - Store in Convex file storage or external CDN
- [ ] Special date notifications
  - Discord webhook for upcoming birthdays/anniversaries
  - In-app notifications
  - Email reminders (future)

---

## 🐛 Known Issues

### Partner signup test fails before reaching the app
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Evidence:** `e2e/signup-repro.spec.ts`, `playwright.config.ts`, `playwright.local.config.ts`

The checked-in Playwright result shows `e2e/signup-repro.spec.ts` failing during the Clerk signup repro flow before the app can be verified. The signup repro also hardcodes `http://127.0.0.1:3001`, while the standard Playwright config uses `http://localhost:3000`.

- [ ] Reproduce the full Clerk credential flow with `npx playwright test e2e/signup-repro.spec.ts`
- [x] Align the repro spec with Playwright `baseURL` or document why it needs port 3001
- [x] Determine whether the checked-in failure was caused by config mismatch vs app code
- [ ] Update the test fixture/setup so auth-dependent E2E tests are reliable
- [x] Remove stale failure artifacts once the repro is resolved

---

### Daily prediction cron cannot read per-user cycle settings
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/actions/notifications.ts`, `convex/queries/history.ts`, `convex/crons.ts`

`sendDailyPredictions` calls `api.queries.history.getCycleSettings`, but that query depends on the current authenticated user. Cron/internal actions do not run as each user, so the implementation currently only logs placeholder output and cannot send real period prediction notifications.

- [x] Add an internal query that accepts a `userId` and returns that user's cycle settings and latest period data
- [x] Implement prediction logic for upcoming periods
- [x] Log notification delivery results through `notificationLog`
- [ ] Add a test or manual verification path for the cron behavior
- [ ] Add phase-change and ovulation-window notifications

---

### Clerk webhook uses public Convex mutation without authentication context
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `app/api/webhook/clerk/route.ts`, `convex/mutations/users.ts`

The Clerk webhook verifies Svix correctly, then calls `api.mutations.users.createOrUpdateUser` through `ConvexHttpClient`. That mutation is public and accepts arbitrary `clerkId`, `email`, `name`, and optional `role`, so any caller with Convex access could create or modify users if the function is exposed.

- [x] Convert webhook sync to an internal mutation or add an explicit server-side authorization guard
- [x] Keep role assignment out of webhook sync unless the caller is trusted
- [ ] Add a regression test or documented manual verification for forged user sync attempts

---

### Public Convex utility functions need an authorization audit
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/queries/users.ts`, `convex/mutations/misc.ts`, `convex/mutations/users.ts`

Several functions appear intended for internal/server use but are exported as public Convex functions. `getAllPrimaryUsers` exposes all primary users, `logNotification` can write arbitrary notification audit rows, and `createOrUpdateUser` can create/update users by supplied Clerk id.

- [x] Convert server-only functions to `internalQuery` / `internalMutation` where possible
- [x] Add explicit auth/role checks to any function that must stay public
- [x] Confirm client bundles cannot call operational/admin functions
- [ ] Add tests or documented checks for unauthorized access

---

### Pairing code redemption has no brute-force throttle
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/mutations/couples.ts`, `convex/schema.ts`

Pairing codes are 6-digit numeric values with 24-hour expiry, and code generation is rate-limited for primary users. The redemption path does not appear to throttle failed attempts per partner, IP, user, or code, so an attacker with an account could repeatedly try codes.

- [x] Add failed-attempt tracking for `linkPartnerWithCode`
- [x] Rate-limit redemption attempts per authenticated user and/or code window
- [ ] Consider increasing entropy or using alphanumeric invite tokens
- [ ] Add tests for too many failed pairing attempts

---

### Partner period history can leak when phase sharing is disabled
**Priority:** High
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/queries/history.ts`, `app/(dashboard)/dashboard/log/page.tsx`

`getPeriodHistory` initializes `targetUserId` to the partner's own user id and only switches to the primary user when `sharingPhase` is enabled. For linked partner accounts with sharing disabled, this returns the partner's own period history instead of an explicit empty/private state, which is confusing and can expose partner-entered data if a partner previously had records.

- [x] Return an empty array or explicit privacy response when a partner is not allowed to view phase data
- [x] Update `/dashboard/log` to show a clear "not shared" state instead of generic history
- [ ] Add coverage for partner views with `sharingPhase: false`

---

### UTC date handling can shift cycle and log boundaries
**Priority:** Medium
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/_helpers/cycleCalculations.ts`, `convex/queries/dashboard.ts`, `components/dashboard/TactilePainLogger.tsx`, `app/onboarding/page.tsx`, `app/(dashboard)/dashboard/log/page.tsx`

The app uses `new Date().toISOString().split("T")[0]` and `T00:00:00` date parsing in multiple places. This is UTC-oriented and can create off-by-one behavior around local midnight for users outside UTC, affecting today's pain log, period dates, and phase calculations.

- [x] Define whether cycle dates are user-local dates or UTC dates
- [x] Store/derive dates consistently using browser-local calendar dates and UTC-safe calendar arithmetic
- [ ] Add tests for users near local midnight and non-UTC timezones
- [x] Avoid mixing browser-local date inputs with UTC `toISOString()` day extraction

---

### CORS headers are overly broad
**Priority:** Medium
**Status:** Resolved
**Detected:** May 20, 2026
**Files:** `next.config.js`, `middleware.ts`, `DEPLOYMENT.md`

The app applies permissive CORS headers broadly (`Access-Control-Allow-Origin: *`) and middleware also answers OPTIONS requests globally. That may be more permissive than needed for a Clerk/Convex-backed app and can make future API routes easier to misuse.

- [x] Identify which routes actually need cross-origin access
- [x] Restrict allowed origins to known production and development origins
- [x] Keep webhook/API-specific CORS separate from page routes
- [x] Update deployment docs with the accepted origin list

---

### Deployment documentation conflicts with package scripts
**Priority:** Medium
**Status:** Resolved
**Detected:** May 20, 2026
**Files:** `DEPLOYMENT.md`, `package.json`, `AGENTS.md`

`DEPLOYMENT.md` says production runs on port 6000, while `package.json`, `AGENTS.md`, and `npm run start`/`npm run serve` use port 6050. This can cause failed smoke tests, misconfigured reverse proxies, or incorrect environment setup.

- [x] Pick one production port and update `DEPLOYMENT.md`, `package.json`, `pm2.config.js`, and project instructions consistently
- [x] Add a health-check example using the chosen port

---

### Partner linking manual test guide is stale
**Priority:** Medium
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `issues.md`, `app/onboarding/page.tsx`, `components/dashboard/OnboardingFlow.tsx`

The manual testing guide references an onboarding flow with "Continue" and "You're all set!" states plus an "Already have a pairing code?" button inside `OnboardingFlow`. The current `app/onboarding/page.tsx` immediately routes partner users to `/dashboard/partner`, and `components/dashboard/OnboardingFlow.tsx` is used for primary users who skipped period setup.

- [x] Rewrite the manual testing guide to match the current onboarding implementation
- [x] Clarify the difference between `/onboarding` and the dashboard `OnboardingFlow` component
- [ ] Re-run the manual checklist after the docs are corrected

---

### Build and lint scripts are incomplete for the documented workflow
**Priority:** Medium
**Status:** Resolved
**Detected:** May 20, 2026
**Files:** `package.json`, `e2e/TEST-RESULTS.md`, `issues.md`

The docs claim TypeScript and lint verification passed, but `package.json` only exposes `dev`, `build`, `start`, `start:prod`, and `serve`. There is no `lint`, `typecheck`, or `test` script for repeatable local/CI validation.

- [x] Add `typecheck`, `lint`, and Playwright test scripts
- [x] Update docs to reference commands that actually exist
- [x] Decide whether skipped auth E2E tests should remain skipped or move behind a documented test-auth setup

---

### Discord notification path is not consent-modeled for sensitive health data
**Priority:** Medium
**Status:** Partially resolved
**Detected:** May 20, 2026
**Files:** `convex/mutations/painLog.ts`, `convex/actions/discord.ts`, `docs/cb-connect-design-audit.md`

High pain logs currently schedule Discord webhook notifications containing pain score, date, user name, and tags. The design audit already flags Discord as product-wrong for intimate health-adjacent data, and the current implementation has no user-facing notification consent/preferences model.

- [x] Add explicit notification preferences before sending health-adjacent data externally
- [ ] Replace direct Discord delivery with an internal care-event/outbox model
- [x] Minimize payload content sent to third-party webhooks

---

### Pain history query has no visible product surface
**Priority:** Medium
**Status:** Resolved
**Detected:** May 20, 2026
**Files:** `convex/queries/history.ts`, `app/(dashboard)/dashboard/log/page.tsx`

`getPainHistory` supports date-range pain history reads, including partner permission handling, but no current page or component appears to call it. Users can log today's pain, but there is no visible pain-history timeline, trend, or report surface.

- [x] Decide whether pain history belongs on `/dashboard/log`, the main dashboard, or a separate insights/report page
- [x] Add a UI that uses `getPainHistory` for the primary user
- [x] Define the partner-visible behavior when `sharingPain` is enabled
- [ ] Add coverage for empty, private, and populated pain-history states

---

### Notification log has no review or admin UI
**Priority:** Medium
**Status:** Resolved
**Detected:** May 20, 2026
**Files:** `convex/schema.ts`, `convex/mutations/misc.ts`, `convex/actions/discord.ts`

Discord delivery attempts are stored in `notificationLog`, but there is no user-facing or admin-facing way to inspect sent/failed notifications. This makes webhook failures and sensitive-data delivery hard to audit from the app.

- [x] Decide whether notification history is an admin-only view, user-visible activity log, or developer diagnostic endpoint
- [x] Add a query with appropriate authorization checks
- [x] Add UI or documented operational workflow for reviewing failures
- [x] Include notification type, status, sent time, and redacted payload details

---

### Simulated partner presence indicator in dashboard layout
**Priority:** Low
**Status:** ✅ Completed (May 26, 2026)
**Files:** `app/(dashboard)/layout.tsx`, `components/dashboard/PhaseAura.tsx`, `app/(dashboard)/dashboard/page.tsx`

**Completed:** Implemented real-time presence tracking via Convex.

**Implementation:**
- [x] Designed and implemented a Convex `presence` table/schema tracking last-seen heartbeats for couples.
- [x] Created `convex/mutations/presence.ts` with `heartbeat()` mutation that upserts presence records every 30s.
- [x] Created `convex/queries/presence.ts` with `isPartnerPresent()` query checking if partner heartbeat within 60s.
- [x] Connected `app/(dashboard)/layout.tsx` to real-time Convex presence query with automatic heartbeat.
- [x] Implemented animated presence indicator (glow, pulsing border, live dot) on `PhaseAura` card when `partnerPresent === true`.
- [x] Fixed log page sharing flags by removing `isLinked` gate (now reads sharingSettings directly).

**Features:**
- Automatic 30-second heartbeat from authenticated users
- Real-time presence query with 60-second timeout
- Animated phase card with blue glow and pulsing border when partner online
- Live indicator dot in top-right corner of phase card
- Framer Motion animations with reduced-motion support

---

### Duplicate onboarding surfaces can drift
**Priority:** Medium
**Status:** Open
**Detected:** May 20, 2026
**Files:** `app/onboarding/page.tsx`, `components/dashboard/OnboardingFlow.tsx`, `app/(dashboard)/dashboard/page.tsx`

There are two onboarding implementations: `/onboarding` handles role selection plus initial cycle setup, while `OnboardingFlow` is embedded on the dashboard for primary users with no period data. They overlap conceptually but are separate code paths with different copy, validation, and navigation behavior.

- [ ] Define the intended responsibility of each onboarding path
- [ ] Extract shared cycle setup UI or logic if both paths need to remain
- [ ] Remove stale partner-onboarding assumptions from dashboard fallback flow
- [ ] Add tests for primary setup, partner setup, and skipped-period recovery

---

### Graphify report may be stale relative to current working tree
**Priority:** Low
**Status:** Open
**Detected:** May 20, 2026
**Files:** `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`

`graphify-out/GRAPH_REPORT.md` was built from commit `85c8763e`, while the working tree currently has untracked project files and test artifacts. The graph is useful for orientation but should not be treated as fully current.

- [x] Run `graphify update .` after deciding which generated artifacts should stay in the repo
- [x] Exclude noisy transient artifacts such as `test-results/` if they should not be part of the knowledge graph

---

## 💡 Feature Requests

### Smart Notifications
**Requested:** Send contextual notifications based on cycle phase
- Ovulation window reminder
- Period prediction alerts (2 days before)
- Pain management tips when pain score is high

### Data Export
**Requested:** Export cycle data as PDF/CSV
- [x] CSV export from `/dashboard/log`
- [ ] PDF monthly reports
- [ ] Healthcare-provider share package
- [ ] Historical data analysis

### Multiple Partner Support
**Requested:** Support for polyamorous relationships
- Schema changes required (current: 1:1 couple mapping)
- Complex permission model
- **Note:** Significant architectural change, requires careful planning

---

## 🔧 Technical Debt

### Schema Migration
**Issue:** Adding new fields requires careful migration strategy
- Need backward-compatible changes
- Migration scripts for existing users
- Testing plan for data integrity

### Testing Coverage
**Issue:** Limited E2E test coverage
- Add Playwright tests for partner linking flow
- Test edge cases (expired codes, network failures)
- Accessibility testing automation

### Performance Optimization
**Issue:** Dashboard queries could be optimized
- Consider caching for cycle calculations
- Reduce Convex function calls
- Implement pagination for historical data

---

## 📊 Metrics to Track

### User Engagement
- [ ] Daily active users (DAU)
- [ ] Partner linking conversion rate
- [ ] Feature adoption rate (pain logging, phase tracking)
- [ ] Retention rate (7-day, 30-day)

### Technical Metrics
- [ ] Convex function execution time
- [ ] Dashboard load time
- [ ] Error rate (failed mutations, queries)
- [ ] OCC conflict rate

---

## 📝 Notes

### Design Principles
1. **Inclusive by default** - Gender-neutral messaging until user specifies
2. **Consent-first** - Primary user controls all data sharing
3. **Delightful interactions** - Animations, confetti, positive reinforcement
4. **Accessible** - WCAG 2.2 AA compliance

### Development Guidelines
- All new features need tests
- Design docs required for major features
- Accessibility review before merge
- Performance budget: < 3s dashboard load time

---

## 🗓️ Release History

### v1.0.0 - Initial Release
- Core cycle tracking
- Pain logging
- Partner linking (basic)
- Discord notifications

### v1.1.0 - Upcoming
- Partner linking UX improvements
- Auto-copy & share functionality
- Connection status bar
- Enhanced onboarding

---

**Template:** Use this format for new feature requests:

```markdown
### Feature Name
**Priority:** High/Medium/Low
**Estimated Effort:** X days

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
```
