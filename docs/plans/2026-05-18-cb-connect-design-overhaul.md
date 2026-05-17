# CB Connect Design Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first coherent premium design foundation for CB Connect: phase-aware atmosphere, emotionally translated dashboard surfaces, partner support UX, and auth continuity.

**Architecture:** Keep the current Next.js App Router, Clerk, and Convex data flow. Add reusable presentation primitives first, then replace current card-heavy components with phase-aware, consent-aware components that still call the existing Convex queries and mutations.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Convex, Clerk.

---

### Task 1: Establish Design Tokens And Shell

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.js`
- Create: `components/common/SanctuaryShell.tsx`
- Create: `components/common/GlassPanel.tsx`

**Steps:**

1. Add typography, phase palette, glass, aura, and shadow CSS variables.
2. Add reusable shell component that accepts `phase?: string`, `intensity?: "soft" | "medium" | "heavy"`, and `children`.
3. Add reusable glass panel component with `variant?: "quiet" | "elevated" | "warm"`.
4. Run `npm run build`.

**Acceptance:**

- Build passes.
- Existing pages still render if new components are unused.
- Reduced motion disables decorative loops.

### Task 2: Remove Auth Flashbang

**Files:**
- Modify: `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Modify: `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**Steps:**

1. Wrap Clerk forms in `SanctuaryShell`.
2. Pass Clerk `appearance` matching CB Connect tokens.
3. Add short privacy/trust copy beside or above auth card.
4. Run `npm run build`.

**Acceptance:**

- No white default auth card.
- Auth pages visually match landing and dashboard.
- Clerk still redirects to `/dashboard`.

### Task 3: Build Phase Aura Dashboard Anchor

**Files:**
- Create: `components/dashboard/PhaseAura.tsx`
- Modify: `components/dashboard/CurrentPhase.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Steps:**

1. Build phase aura component using existing `phase`, `cycleDay`, `description`, `daysUntilNextPeriod`, `nextPeriodStart`, and optional `painScore`.
2. Keep semantic labels for accessibility.
3. Replace dashboard header/current phase card with the aura.
4. Run `npm run build`.

**Acceptance:**

- Dashboard first read is phase/mood, not stacked cards.
- No existing Convex data shape changes.

### Task 4: Replace Pain Slider With Tactile Check-In

**Files:**
- Create: `components/dashboard/TactilePainLogger.tsx`
- Modify: `components/dashboard/PainLogger.tsx`

**Steps:**

1. Preserve `createOrUpdatePainLog` mutation behavior.
2. Replace numeric-first slider with feeling-first bands.
3. Keep optional exact number controls available.
4. Improve tags and note copy.
5. Run `npm run build`.

**Acceptance:**

- User can still save date, score, tags, and note.
- Partner/dashboard data stays compatible.
- UI reads as care logging, not ER intake.

### Task 5: Reframe Partner Experience

**Files:**
- Create: `components/partner/PartnerPulse.tsx`
- Modify: `components/partner/PartnerDashboard.tsx`
- Modify: `components/dashboard/PartnerStatusCard.tsx`

**Steps:**

1. Add partner pulse hero with support copy and care action chips.
2. Preserve consent limitations from `getDashboardData`.
3. Replace "Pain Status" framing with "How today feels."
4. Update empty states to explain next action.
5. Run `npm run build`.

**Acceptance:**

- Partner screen gives actionable empathy.
- Privacy state is visible.
- No backend schema changes required for this phase.

### Task 6: Upgrade Pairing Into Digital Locket

**Files:**
- Create: `components/partner/DigitalLocket.tsx`
- Modify: `app/(dashboard)/dashboard/partner/page.tsx`

**Steps:**

1. Keep existing code generation/linking mutations.
2. Wrap the code in a locket/pattern UI.
3. Improve copy and confirmation states.
4. Keep copy/share behavior.
5. Run `npm run build`.

**Acceptance:**

- Pairing feels intentional but remains reliable.
- No QR/deep-link dependency yet.

### Task 7: Document Backend Notification Direction

**Files:**
- Modify: `docs/cb-connect-design-guidelines.md`
- Optional future: `convex/schema.ts`, `convex/mutations/careEvents.ts`, `convex/queries/careEvents.ts`

**Steps:**

1. Leave Discord code untouched in this pass unless product asks to remove it.
2. Document `careEvents` and preferences schema for the next backend phase.
3. Use Convex MCP to verify deployment schema before implementing backend changes.

**Acceptance:**

- No accidental notification regression.
- Clear next backend phase exists.

### Task 8: Final Verification

**Files:**
- All touched files.

**Steps:**

1. Run `npm run build`.
2. If Playwright target is available, run the relevant auth/onboarding specs.
3. Review git diff for accidental unrelated edits.
4. Request code/design review.

**Acceptance:**

- Build passes.
- No unrelated user changes reverted.
- Final summary lists implemented surfaces, docs, verification, and remaining backend work.
