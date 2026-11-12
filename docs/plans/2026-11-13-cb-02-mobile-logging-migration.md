# CB-02 Mobile Logging Migration Plan

> **For Codex:** Use the Shipyard executing-plans skill to implement this plan task by task.

**Goal:** Bring native period and pain history in line with the existing web logging experience while preserving Convex authorization, privacy, and account-local date rules.

**Architecture:** Extend the existing Expo Router logging screen and its public Convex API inventory. Reuse `history.getTimelineHistory` for backend-authorized mixed timeline facts, `periods.deletePeriodEvent` for authorized deletion, and Expo's file system and Sharing modules for CSV export. Do not add backend endpoints, duplicate cycle-state rules, or trust client role state for authorization.

**Tech Stack:** Expo SDK 57, React Native, Convex public API, TypeScript, Vitest, expo-file-system, expo-sharing.

---

## Source-to-native parity map

| Web behavior | Native migration | Safety contract |
| --- | --- | --- |
| 90-day mixed period/pain chronological timeline with phase/status, ongoing state, provenance, certainty, and correction affordance | Render `getTimelineHistory` rows in `LoggingScreen`; preserve distinct loading/empty states and existing log forms | Use server-returned timeline projection; do not reconstruct phase or infer authorization in the client |
| Primary period correction and delete; partner-assisted correction when `canCorrect` | Retain correction flow and add primary-authorized delete via `deletePeriodEvent` with event ID and current `authorityVersion` | Only show actions the server marks `canCorrect`; confirm before delete; surface permission/stale failures without optimistic removal |
| Export CSV with web column order and quoting | Build rows from authorized period history and timeline pain rows, write a cache CSV, invoke native share sheet | Escape every cell; omit partner pain notes; include only backend-visible rows; don't log CSV contents |
| Separate pain history and period history in mobile | Replace display lists with the combined timeline while retaining current period/pain write forms | Keep primary and partner-assisted writes and exact partial-write/offline feedback unchanged |

## Ordered implementation tasks

### Task 1: Timeline and deletion contract types

**Files:**
- Modify `apps/mobile/src/convex/api.inventory.ts`
- Modify `apps/mobile/src/convex/api.d.ts`
- Modify `apps/mobile/src/features/logging/loggingApi.js`
- Test `apps/mobile/src/convex/api.inventory.test.ts`
- Test `apps/mobile/src/convex/api.parity.test-d.ts`

1. Add public inventory entries for `queries.history.getTimelineHistory` and `mutations.periods.deletePeriodEvent`.
2. Define the timeline result type from `convex/queries/history.ts`, including discriminated period/pain rows, phase/status/evidence/reason, certainty, provenance, `canCorrect`, and optional authority version. Define the delete mutation args/result from `convex/mutations/periods.ts`.
3. Export both references through `loggingApi` and assert inventory and actual server contract parity. Keep runtime imports pointed only at the public `api` object.
4. Run focused inventory and parity tests before continuing.

### Task 2: CSV formatter and native share adapter

**Files:**
- Create `apps/mobile/src/features/logging/historyExport.ts`
- Test `apps/mobile/src/features/logging/historyExport.test.ts`
- Modify `apps/mobile/package.json` and `apps/mobile/package-lock.json` only if Expo SDK-matched packages are not already installed.

1. Test the web CSV header order, RFC-style doubled-quote cell escaping, period/pain columns, and partner-note redaction using small fixture rows.
2. Build CSV rows from server-visible history. Preserve current web semantics: period status is open/closed, dates are date-only, source and actor labels are retained, and pain tags use semicolon separators. Do not include pain notes for a partner viewer.
3. Use SDK 57 `File`/`Paths.cache` to write a uniquely named CSV and `Sharing.shareAsync(file.uri)` to open the system share sheet. Catch write/share errors for safe UI copy; never expose the serialized CSV in errors.
4. Install packages only if absent, using `npx expo install expo-file-system expo-sharing` from `apps/mobile` and the repo's documented Node 22/npm 11 toolchain.
5. Run formatter unit tests and Expo dependency validation for the selected package versions.

### Task 3: Mixed history timeline and deletion UI

**Files:**
- Modify `apps/mobile/src/features/logging/LoggingScreen.tsx`
- Modify `apps/mobile/src/features/logging/logging.ts`
- Test `apps/mobile/src/features/logging/LoggingScreen.test.tsx`
- Test `apps/mobile/src/features/logging/logging.test.tsx`

1. Add tests for reverse-chronological mixed rows, primary and partner views, visibility of correction/delete controls, confirmation before delete, stale-authority errors, failed-delete retention, and successful timeline refresh through Convex reactivity.
2. Query `getTimelineHistory` only when connected and account timezone is valid; pass an account-local rolling 90-day date range. Keep `skip` while the session, connection, or actionable timezone is unavailable.
3. Render the timeline DTO directly. Expose phase/status, ongoing state, period certainty and source attribution; show pain score and tags only where present in the server projection. Preserve the existing date-only form, primary/partner write split, and privacy-safe error messages.
4. Add a destructive confirmation step and call `deletePeriodEvent` only when the event has an ID and server-returned authority version. Do not mutate local history optimistically. Map stale and permission failures to clear, retryable messages.
5. Reuse the account timezone and date semantics. Never use UTC as a fallback or send private notes to the partner-facing CSV path.
6. Run focused logging screen tests after each behavior group.

### Task 4: CSV action and final evidence

**Files:**
- Modify `apps/mobile/src/features/logging/LoggingScreen.tsx`
- Test `apps/mobile/src/features/logging/LoggingScreen.test.tsx`
- Review `apps/mobile/src/convex/api.inventory.ts`, `apps/mobile/src/convex/api.d.ts`, and `apps/mobile/src/convex/api.parity.test-d.ts`

1. Test export action availability after all required queries resolve, exact primary CSV contents, partner-visible row filtering, and partner note redaction.
2. Add an accessible Export CSV action to the history header. Disable it until source queries resolve; show a safe completion/error message after the share sheet operation.
3. Verify API inventory parity and run the issue's focused command: `npm run mobile:test -- LoggingScreen.test.tsx logging.test.tsx`.
4. Run `npm run mobile:typecheck` and `npm run typecheck` from the repository root. Do not run device live QA for this PR; record one later synthetic scenario in the PR: primary logs/corrects a period and private pain row, exports CSV; partner sees only consented timeline rows, cannot export private notes, and authorized primary deletion refreshes both views.

## Boundaries

- No backend schema, migration, endpoint, estimator, or authorization change.
- No direct database access from the mobile bundle; all runtime calls use public Convex references and server DTOs.
- Preserve fail-closed auth, server-derived sharing/correction eligibility, authority-version conflict handling, offline write truthfulness, and account-local date semantics.
- Deletion uses the existing authorized mutation only. This plan adds no bulk deletion, purge, or retention behavior.
- No production flag changes, deployment, merge to `main`, emulator/device live-QA cycle, or real-user fixture changes.
- The PR base is `feat/NAK-143-mobile-onboarding`, itself stacked on `gate5/atlas-foundation`.

