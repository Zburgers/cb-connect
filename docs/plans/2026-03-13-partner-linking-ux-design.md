# Partner Linking UX Improvements - Design Document

**Date:** March 13, 2026  
**Status:** Approved  
**Author:** CB Connect Team

---

## Overview

This document outlines the design for improving partner linking discoverability and user experience in CB Connect. The partner linking functionality is fully implemented but lacks visibility from the main dashboard.

---

## Problem Statement

The partner linking feature exists at `/dashboard/partner` but users have no discovery path from the main dashboard. Users won't know this feature exists unless they manually navigate to the Partner tab.

---

## Goals

1. **Increase discoverability** - Make partner linking visible from main dashboard
2. **Streamline code sharing** - Auto-copy and share functionality for pairing codes
3. **Provide clear status** - Show connection status and partner info at a glance
4. **Gender-neutral messaging** - Use inclusive language until gender fields are added

---

## Design Decisions

### 1. Dashboard Partner Status Card

**Location:** Main dashboard, positioned after `CurrentPhase` and before `PainLogger`

**Component:** `components/dashboard/PartnerStatusCard.tsx` (new)

**States:**

#### State A: Not Linked (Primary User)
```
┌─────────────────────────────────────────────┐
│  💕 Let your special one take care of you   │
│                                             │
│  Share your cycle journey with your partner │
│  • Real-time phase updates                  │
│  • Pain symptom tracking                    │
│  • Personalized support tips                │
│                                             │
│  [Invite Partner →]                         │
└─────────────────────────────────────────────┘
```

#### State B: Not Linked (Partner User)
```
┌─────────────────────────────────────────────┐
│  💕 Connect with your partner now           │
│                                             │
│  Stay informed and support her journey      │
│                                             │
│  [Connect Now →]                            │
└─────────────────────────────────────────────┘
```

#### State C: Linked (Both Users)
```
┌─────────────────────────────────────────────┐
│  💕 Connected with {partnerName}            │
│     Sharing: ✓ Phase  ✓ Pain                │
│                                             │
│  Your partner is here to support you        │
│                                             │
│  [Manage Sharing]                           │
└─────────────────────────────────────────────┘
```

**Design Specifications:**
- Glass-morphism card style matching existing components
- Rounded-3xl corners, shadow-sm border
- Icon: Heart (outline for not-linked, filled for linked)
- CTA button: Primary color (purple gradient)
- Clicking CTA navigates to `/dashboard/partner`

---

### 2. Partner Page Enhancements

**Location:** `app/(dashboard)/dashboard/partner/page.tsx`

#### 2.1 Auto-Copy on Generate

When primary user generates a pairing code:
1. Automatically copy code to clipboard
2. Show toast notification: "Code copied to clipboard!"
3. Add visual highlight animation on code display

#### 2.2 Copy & Share Buttons

```
┌─────────────────────────────────────────┐
│  Your pairing code:                     │
│     8 4 7 2 9 3                         │
│  [📋 Copy]  [🔗 Share]                  │
│  Valid for 24 hours                     │
└─────────────────────────────────────────┘
```

**Copy Button:**
- Copies code to clipboard
- Shows toast: "Code copied!"
- Icon: Clipboard/Lucide `Copy`

**Share Button:**
- Opens Web Share API dialog
- Pre-filled message: "Join me on CB Connect! Use pairing code: 847293"
- Fallback: Copy to clipboard if Web Share API not supported
- Icon: Lucide `Share2`

#### 2.3 Revoke Confirmation

- Browser confirm dialog on revoke action
- Message: "Are you sure you want to revoke partner access? They will no longer be able to see your data."
- Destructive button styling (red border, red text)

---

### 3. Connection Status Bar

**Location:** Integrated into PartnerStatusCard header (not separate component)

**Design:**
```
┌─────────────────────────────────────────┐
│ 💕 Connected with Sarah  •  14 days     │
│ Sharing: ✓ Phase  ✓ Pain                │
└─────────────────────────────────────────┘
```

**Future Enhancements (TODO):**
- Show relationship duration ("14 days together")
- Partner nicknames
- Special date tracking (anniversaries, birthdays)

---

### 4. Navigation Flow

```
User clicks "Invite Partner" on Dashboard
              ↓
Navigate to /dashboard/partner
              ↓
If Primary & not linked:
- Auto-scroll to code generation section
- Highlight "Generate Pairing Code" button
              ↓
Code generated:
- Auto-copy to clipboard
- Show toast notification
- Display code with Copy/Share buttons
              ↓
Partner enters code:
- Validate and link
- Show success state
- Both users see updated dashboard
```

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `components/dashboard/PartnerStatusCard.tsx` | Main status card component |
| `issues.md` | Track future enhancements |

### Files to Modify

| File | Changes |
|------|---------|
| `app/(dashboard)/dashboard/page.tsx` | Add PartnerStatusCard import and render |
| `app/(dashboard)/dashboard/partner/page.tsx` | Add auto-copy, share button, enhanced UX |
| `lib/utils.ts` | Add clipboard helper, share helper functions |

### Helper Functions

```typescript
// lib/utils.ts

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareText(text: string, title?: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Clipboard API not supported | Fallback: Select text + show "Press Ctrl+C" |
| Share API not supported | Fallback: Copy + "Share this code manually" |
| Network error on generate | Show error toast with retry option |
| Invalid partner code | Show inline error, shake animation on input |
| Code expired | Show "Code expired, generate new one" message |

---

## Accessibility

- ARIA labels for all buttons (`aria-label="Copy pairing code"`)
- Screen reader announcements for copy success (`aria-live="polite"`)
- Keyboard navigation for all interactive elements
- Focus management on navigation
- Sufficient color contrast (WCAG AA)

---

## Future Enhancements (Track in issues.md)

### Phase 2: Gender & Relationship Fields
- [ ] Add `gender` field to users table
- [ ] Add `partnerType` field (boyfriend/girlfriend/spouse)
- [ ] Add gendered messaging based on user preferences

### Phase 3: Relationship Milestones
- [ ] Add `relationshipStartDate` field
- [ ] Show "together for X days/weeks/months"
- [ ] Add anniversary reminders
- [ ] Add birthday tracking

### Phase 4: Personalization
- [ ] Add partner nicknames
- [ ] Custom relationship status messages
- [ ] Photo/avatar for partner
- [ ] Special date notifications

---

## Success Metrics

- **Discovery rate:** % of users who click partner link from dashboard
- **Linking conversion:** % of users who complete partner linking after viewing card
- **Code sharing:** % of users who use Copy/Share buttons
- **Time to link:** Average time from dashboard view to successful linking

---

## Related Documentation

- Technical PRD: `docs/cb-connect-technical-prd.md`
- Database Schema: `convex/schema.ts`
- Partner Mutations: `convex/mutations/couples.ts`
- Partner Queries: `convex/queries/couples.ts`

---

## Approval

- [x] Design reviewed and approved
- [ ] Implementation plan created
- [ ] Implementation complete
- [ ] Testing complete
