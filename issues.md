# CB Connect - Issues & Feature Tracker

**Last Updated:** March 13, 2026

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
     - Click "Continue"
     - Enter last period date
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
     - Click "Continue"
     - Should see "You're all set!" screen

2. **Verify "Already have a pairing code?" Button**
   - Should see button with Heart icon
   - Text: "Already have a pairing code?"
   - Click button
   - Should navigate to `/dashboard/partner`

3. **Enter Pairing Code**
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
- [ ] Partner onboarding has "Already have a pairing code?" button
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

- [ ] Add `gender` field to users table (`convex/schema.ts`)
  - Type: `"male" | "female" | "other" | "prefer_not_to_say"`
  - Optional field with default `null`
- [ ] Add `partnerType` field
  - Type: `"boyfriend" | "girlfriend" | "spouse" | "partner" | "other"`
  - Used for gendered messaging
- [ ] Update onboarding flow to collect gender info
  - Add step after role selection
  - Make optional with "prefer not to say"
- [ ] Implement gendered messaging in PartnerStatusCard
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

### None currently tracked

---

## 💡 Feature Requests

### Smart Notifications
**Requested:** Send contextual notifications based on cycle phase
- Ovulation window reminder
- Period prediction alerts (2 days before)
- Pain management tips when pain score is high

### Data Export
**Requested:** Export cycle data as PDF/CSV
- Monthly cycle reports
- Share with healthcare provider
- Historical data analysis

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
