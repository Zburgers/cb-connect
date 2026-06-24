# Partner-Assisted Period Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task.

**Goal:** Add consent-gated partner assistance for period start/end dates with attribution and primary-only correction.

**Architecture:** Extend existing memberships and period events rather than creating a parallel workflow. Enforce all permissions and ownership in Convex, project legacy-safe attribution in queries, and reuse the current mobile glass UI with progressive date actions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Convex, Clerk, Tailwind CSS, Framer Motion, Vitest, convex-test, Playwright.

---

### Task 1: Install the Convex function test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`

1. Add `vitest` and `convex-test` as development dependencies.
2. Add a `test:unit` script that runs the Convex and helper tests once.
3. Configure Vitest for the Node environment and Convex module loading.
4. Run the existing timeline test through Vitest and confirm it passes.

### Task 2: Define permission and attribution behavior test-first

**Files:**
- Create: `convex/mutations/periods.test.ts`
- Create: `convex/mutations/couples.test.ts`
- Create: `convex/queries/history.test.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/mutations/couples.ts`
- Modify: `convex/mutations/periods.ts`
- Modify: `convex/queries/couples.ts`
- Modify: `convex/queries/history.ts`

1. Write failing tests for write permission dependencies and safe defaults.
2. Run the focused tests and verify they fail because fields/functions are absent.
3. Add optional schema fields and explicit membership defaults.
4. Implement effective sharing validation and `getCoupleStatus.periodWrite`.
5. Write failing tests for assisted start/end ownership and attribution.
6. Implement assisted mutations with active-couple and primary-membership checks.
7. Write failing tests for primary-only update/delete behavior.
8. Implement correction mutations and date validation.
9. Write failing tests for query attribution and legacy defaults.
10. Implement history/timeline attribution projections.
11. Run all unit tests and refactor only while green.

### Task 3: Add the consent controls and privacy snapshot

**Files:**
- Modify: `app/(dashboard)/dashboard/partner/page.tsx`
- Modify: `app/(dashboard)/dashboard/settings/page.tsx`

1. Add the assisted logging toggle beneath period visibility.
2. Disable it with explanatory text while phase visibility is off.
3. Ensure turning phase visibility off sends both flags as false immediately.
4. Add the assisted logging card to the settings privacy snapshot.
5. Verify keyboard focus, loading/error copy, and 320px layout.

### Task 4: Replace the period logger with role-aware quick actions

**Files:**
- Modify: `app/(dashboard)/dashboard/log/page.tsx`

1. Add self and assisted mutation hooks plus correction hooks.
2. Implement Today, Yesterday, and Choose date selection for start/end.
3. Render the primary "Today's check-in" card.
4. Render partner read-only or assisted cards based on both permissions.
5. Keep pain history and existing primary pain behavior unchanged.
6. Add source/creator columns to CSV period rows.

### Task 5: Add timeline attribution and correction

**Files:**
- Modify: `app/(dashboard)/dashboard/log/page.tsx`

1. Render period-specific attribution text without changing pain entries.
2. Add primary-only Edit actions.
3. Add a compact inline editor for start date, optional end date, save, delete,
   and cancel.
4. Preserve source attribution after correction and surface updater copy.
5. Verify partner users never receive correction controls.

### Task 6: Validate generated types and application behavior

**Files:**
- Modify: `convex/_generated/api.d.ts` and related generated files if produced

1. Run Convex code generation/typechecking against the dev deployment.
2. Run `npm run test:unit`.
3. Run `npm run lint`.
4. Run `npm run build`.
5. Run `npm run test:e2e` when the configured Clerk environment supports it.
6. Run targeted browser checks for primary, read-only partner, and permitted
   partner states.

### Task 7: Deploy in controlled order

1. Confirm the dev selector and push schema/functions to dev.
2. Validate function metadata, schema acceptance, and representative read-only
   queries on dev.
3. Identify or create the repository's isolated test/staging deployment without
   changing production configuration.
4. Push and validate test/staging.
5. Confirm branch, intended diff, green validation, and production selector.
6. Deploy to production.
7. Validate production function metadata and legacy-safe query behavior without
   mutating user data.

### Task 8: Commit and publish

1. Commit backend/schema/tests as `feat(convex): add assisted period logging`.
2. Commit UI changes as `feat(log): add consent-based assisted period updates`.
3. Run `graphify update .`.
4. Review `git status` and `git log --oneline -5`.
5. Push `main` to `origin`.

