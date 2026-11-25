# CB-05 Native In-App Notifications and Reminder Schedule Parity

**Issue:** [NAK-147](https://linear.app/nakii/issue/NAK-147/cb-05-in-app-notifications-and-reminder-schedule-parity)
**Base:** CB-04 PR #83 head `a9c3355317f281f5022ffc7638aafb762478ed53`
**Scope:** One stacked feature PR; no push delivery, backend/schema changes, new notification generation, or external delivery channel.

## Contract

- Mirror web `components/notifications/NotificationPreferences.tsx`: the supported scheduled purpose is `period_window_approaching`; save the selected `HH:mm` value through the existing `notifications.setMyPreference` mutation and preserve the current `inAppEnabled` value.
- Treat `HH:mm` as an account-local wall-clock value. Show the saved account timezone beside the selector and use it to interpret the native picker’s `Date` carrier. Persist and send the unchanged `HH:mm` string, never a timestamp or timezone/device timezone. Existing account timezone changes keep the same stored wall-clock preference.
- Keep primary/partner purpose visibility, disabled default-off inbox states, and server-derived inbox availability unchanged.
- Audit inbox loading, no-item, read, dismiss, pagination, and settings/partner navigation. Add behavioral coverage and change inbox production code only for a demonstrated parity gap.
- Preserve save/loading/error feedback. Do not create or deliver notification events from the client.

## Ordered tasks

### 1. Add failing reminder-time and inbox parity checks

Files: create `apps/mobile/src/features/settings/reminderTime.ts` and its test; extend `apps/mobile/src/features/settings/settings.test.ts` and `apps/mobile/src/features/notifications/inbox.test.tsx`.

Test strict `HH:mm` parsing/formatting and mapping picker values to the same wall-clock string across IANA timezones. Assert the Settings view labels the clock with the saved profile timezone, only presents the scheduled selector to primary users, preserves the enabled state and current value when saving, and reports load/save/error states. Exercise inbox routes, read, dismiss, disabled availability, and empty state with the existing public API references; retain partner-purpose filtering coverage.

Run the focused tests and confirm each new assertion fails for the missing behavior or coverage before implementation.

### 2. Implement the native scheduled time selector

Files: modify `apps/mobile/src/features/settings/Settings.tsx`; use the already-installed `@react-native-community/datetimepicker`; add the pure conversion helpers from Task 1.

Render an accessible time picker and explicit save action for primary `period_window_approaching` only. Hydrate from the server preference, keep draft changes separate, save using the existing mutation with the current enabled value, preserve the prior value on failure, and disable conflicting actions while saving. Display the account timezone from `getMe`; never fall back to the device timezone for reminder scheduling and never send a timezone argument.

Run settings tests and mobile typecheck.

### 3. Verify inbox parity and final scope

Files: change `Inbox.tsx` only if Task 1 exposes a functional gap; otherwise keep changes test-only.

Ensure loading, unavailable/default-off, empty, mark-read, dismiss, pagination, and Settings/Partner navigation match the existing web contract, and role visibility remains server/contract-derived. Run `npm run mobile:test -- inbox.test.tsx presentation.test.ts settings.test.ts`, `npm run mobile:typecheck`, `npm run typecheck`, and `git diff --check`. No emulator/two-account live QA for this PR.

Deferred consolidated live QA: a synthetic primary changes the cycle-window reminder time in native Settings, confirms the saved `HH:mm` and account timezone in web/native preferences, then verifies a synthetic inbox item can be read, dismissed, and navigated; a linked partner sees only partner-eligible purposes.
