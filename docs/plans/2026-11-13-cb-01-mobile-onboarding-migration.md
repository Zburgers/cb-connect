# CB-01 Mobile Onboarding Migration Plan

> **For Codex:** Use the Shipyard executing-plans skill to implement this plan task by task.

**Goal:** Bring native onboarding to the current web primary setup behavior while preserving public Convex authorization and mobile date/privacy rules.

**Architecture:** Keep onboarding in the existing Expo Router route and feature screen. Reuse public `getMe`, `getPeriodHistory`, `getCycleSettings`, `logPeriodStart`, and `updateCycleSettings` references; do not add server APIs, local persistence, or a second cycle rules implementation. Use the existing native date picker and an explicit certainty choice.

**Tech Stack:** Expo Router, React Native, Convex public API, TypeScript, Vitest.

---

## Source-to-native parity map

| Web source behavior | Native behavior | Source/API |
| --- | --- | --- |
| Choose cycle tracker or supportive partner | Keep role choice, role locking, timezone save, and backend-confirmed receipt | `components/dashboard/OnboardingFlow.tsx`; `users.updateUserRole`, `users.updateUserTimeZone` |
| Primary enters last period start date; cannot choose a future local date | Native `DateField`, account-device IANA date maximum | `app/onboarding/page.tsx`; `DateField.tsx`; `periods.logPeriodStart` |
| Primary sets average cycle length, default 28, range 21–40 | Accessible decrement/increment buttons with same default and bounds | Web range input; `periods.updateCycleSettings` |
| Primary sets average period length, default 5, range 2–8 | Accessible decrement/increment buttons with same default and bounds | Web range input; `periods.updateCycleSettings` |
| Web writes the initial start as exact (certainty not exposed in its current setup UI) | Native offers exact/approximate certainty, matching existing mobile Log controls and the mutation contract | `LoggingScreen.tsx`; `periods.logPeriodStart.startCertainty` |
| Partner finishes onboarding without primary cycle setup | Partner continues to the app; no cycle period or settings mutation | Web role branch; server primary-role guards remain authoritative |
| Primary with no period can enter the dashboard and later use Log | Native role receipt survives restart; if authorized period history is empty, show initial setup; existing history completes setup | `queries.history.getPeriodHistory`; existing app Log route |
| Signed-in app cold start checks whether primary setup finished | `(app)` entry guard waits for current authenticated primary period history, routes empty history to onboarding, and leaves partners/primary history unchanged | `app/(app)/_layout.tsx`; `navigation/accessResolver.ts` |

## Ordered implementation tasks

### Task 1 — Pure setup rules and retry contract

**Files:**
- Modify `apps/mobile/src/features/onboarding/onboardingModel.ts`
- Test `apps/mobile/src/features/onboarding/onboarding.test.tsx`

1. Test default/range constants, no-period versus existing-period state, timezone/date-only behavior, validation, same-date retry, and partial failures between settings and period writes.
2. Save cycle settings before logging the initial period. If settings fail, do not create a period. If period logging fails after settings succeed, keep setup visible and restore saved settings from `getCycleSettings` after restart.
3. If a period with the selected start date already appears in authorized history, skip the duplicate period write. A period created by this setup can appear only after settings have succeeded.
4. Validate settings client-side for a clear UI error; Convex remains the final validator.
5. Verify with `npm run mobile:test -- onboarding.test.tsx`.

### Task 2 — Native onboarding UI and role routing

**Files:**
- Modify `apps/mobile/src/features/onboarding/OnboardingScreen.tsx`
- Reuse `apps/mobile/src/features/logging/DateField.tsx`
- Test `apps/mobile/src/features/onboarding/onboarding.test.tsx`

1. Keep existing auth loading, role selection, role lock, timezone assignment, accessibility and theme behavior.
2. Query period history and cycle settings only for an authenticated primary. Do not show completion until both queries resolve; hydrate the form from server settings so a restart after a failed period write can retry. In the signed-in `(app)` layout, hold primary access while period history is loading and redirect empty history to onboarding; partners bypass this check.
3. Route partners to completion. Route primary users with existing period history to completion. Route primary users without period history, including after restart, to setup.
4. Expose start date, exact/approximate certainty, cycle and period lengths, and explicit Start Tracking action. Show a visible selected certainty style as well as selected accessibility state. Disable submission without a date or while saving.
5. Reject writes when the Convex connection is offline, both before settings and after its receipt before period logging. Disable Start Tracking and show offline guidance while disconnected. If the connection drops between writes, retain the settings receipt and report that the period was not submitted.
6. Report other partial writes accurately. Require settings success before period logging; if period logging then fails, state that settings saved and the period receipt could not be confirmed, and keep setup retryable. A retry reuses persisted settings and creates exactly one event.
7. Verify focused onboarding and entry-routing tests plus mobile typecheck.

### Task 3 — Contract and release evidence

**Files:**
- Review `apps/mobile/src/convex/api.inventory.ts`
- Review `apps/mobile/src/convex/api.d.ts`
- Review `apps/mobile/src/convex/api.inventory.test.ts`

All three query/mutation paths are already inventoried. Correct the existing `updateCycleSettings` type in `apps/mobile/src/convex/api.d.ts` to include the server's optional `cycleLength` and `periodLength` numbers alongside `predictionPaused`; the parity assertion must check it against the actual server reference. Do not runtime-import server implementations.

Run `npm run mobile:test -- onboarding.test.tsx accessResolver.test.ts api.inventory.test.ts`, `npm run mobile:typecheck`, and `npm run typecheck`. PR CI must be green. Do not start a new emulator/device cycle for this PR. Deferred synthetic QA: fresh primary completes setup, sees the exact/certain event in Log and Home, offline-before-submit causes no writes, and a disconnect after settings receipt blocks period logging while accurately reporting settings saved; partner completes onboarding without period writes and remains governed by server privacy projections.

## Safety and scope

- No schema/data migration, new mutation, estimation logic, or production flag change.
- Do not infer UTC when the device IANA timezone is unavailable; fail closed for period submission.
- Date is calendar-date data, not a timestamp. The backend validates date and primary role.
- Settings write is first; period write follows. The period event is the completion receipt, so a saved period proves settings succeeded. If period logging fails, the existing settings query restores the form after restart.
- The native connection state is checked before each mutation. No offline write acknowledgement or delayed period submission is shown.
- Keep synthetic-only QA deferred until the consolidated two-account mobile QA stage specified by the CB-01 issue.
- Stack the single feature PR on `gate5/atlas-foundation`; the PR base must be that branch.
