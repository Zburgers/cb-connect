# CB Connect - Issues & Feature Tracker

**Last Updated:** March 13, 2026

---

## 🚀 Active Development

### Partner Linking UX Improvements
**Status:** In Progress  
**Design Doc:** `docs/plans/2026-03-13-partner-linking-ux-design.md`

**Current Sprint:**
- [ ] Create `PartnerStatusCard` component
- [ ] Add card to main dashboard
- [ ] Implement auto-copy on code generation
- [ ] Add share button with Web Share API
- [ ] Add connection status bar
- [ ] Create issues.md tracker

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
