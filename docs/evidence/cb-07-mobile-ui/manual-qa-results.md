# CB-07 manual QA results

This file records actual manual results incrementally. It is limited to the
approved synthetic development environment and the Android emulator. It does
not qualify a production build or physical device.

## Run identity

- Device: local `emulator-5554`, Pixel 7, Android 17 emulator (`physical=false`).
- App: `tech.builtbynaki.cbconnect.beta`.
- Native APK SHA-256: `8c7a5773df3953a3b8160bcd8bfa08a4daa7a711885dd63efc546623154f9499` (x86_64 debug APK; Metro required).
- Metro JavaScript source: `f907e301ccec365122bd3cef1b029dbb63cbb078`.
- Runtime: approved synthetic Clerk development issuer and refreshed synthetic Convex development deployment; no production target used.
- Interaction: pinned `agent-device` session for the local Pixel emulator. ADB was used only to inventory/install and forward `tcp:8081`.
- Sensitive fixture values and raw authenticated payloads are not recorded. No raw screenshots are stored here.

## Actual results

| Case / subcase | Status | Observation / safe evidence | Identity / retest |
|---|---|---|---|
| ENV-01 — install and launch | PASS | Installed the checklist debug APK, verified its SHA-256, enabled the Metro reverse port, and opened the beta app. Metro completed bundling and the authenticated Home accessibility tree loaded without a crash screen. | Pixel emulator; APK hash and Metro source above. |
| ENV-01 — screenshot inspection | BLOCKED | Native screenshots render the app area entirely black while the Android privacy shield is active. The status bar shield remains visible. The accessibility tree remains available. Privacy protection was not weakened. | Applies to visual inspection; revisit only if an approved safe capture path exists. |
| AUTH-01 — existing session and sign-out | PASS | An existing authenticated Home session was present on first launch. Sign out returned to the app's Sign In screen. | Synthetic development runtime. |
| AUTH-01 — hosted sign-in cancellation | PASS | “Sign in with Clerk” opened the hosted Clerk page on the approved development issuer. Closing the hosted tab returned to the native Sign In screen. | UI tree confirmed hosted Sign In and return state. |
| AUTH-01 — invalid identifier | PASS | Submitting a non-existent `.invalid` test address showed “Identifier is invalid.” | No real-person address used. |
| UI-01 — Home content presence | PARTIAL | Accessibility tree exposed Home, support-signal privacy copy, no-period empty state, private-pain empty state, partner-away state, nudges, chat and partner controls. Visual Bloom Glass composition could not be inspected because the secure window is black in screenshots. | Accessibility-tree observation only; not a visual PASS. |
| AUTH-01 — primary synthetic sign-in | PASS | Submitted the protected primary synthetic credentials through the hosted Clerk flow. The callback returned to the authenticated native app and resolved to primary onboarding setup; no further email challenge appeared. | Same Pixel session; Metro JS source `f907e301ccec365122bd3cef1b029dbb63cbb078`. |
| ONB-01 — primary setup initial state | PASS | Authenticated primary sees cycle setup with saved cycle length 28 days and period length 5 days, a labeled last-period date field, exact/approximate certainty choices, and Start Tracking disabled until a date is selected. | Accessibility tree; no writes made. |
| ONB-01 — date bounds and certainty | PASS | Native date picker showed the current device date as Nov 17, allowed selecting Nov 16, and exposed later dates as disabled. Selecting Nov 16 enabled Start Tracking; exact and approximate options switched their selected accessibility state. | Local form only; no write during this subcase. |
| ONB-01 — cycle and period length bounds | PASS | Cycle length stepped from 28 to the minimum 21 and maximum 40; decrement/increment controls disabled at the respective bounds. Period length stepped from 5 to minimum 2 and maximum 8 with matching disabled controls. Values were restored to 28/5 before submission. | Local form only; restored before saving. |
| ONB-02 — initial period and settings save | PASS | Submitted the selected synthetic Nov 16 approximate period with cycle/period settings restored to 28/5. App advanced to “Your primary role is saved” with a Continue action; Home and same-account web showed the Nov 16 open period. | Server readback agrees on period presence/date; certainty outcome recorded below. |
| LOG-01 — synthetic pain entry | PASS | Saved a run-labelled synthetic pain entry for account-local Nov 17 with score 1 and cramps tag. UI reported “Pain entry saved.” The private note appeared in primary history. | Root verified same-account web readback of score, tag, and private note. Partner privacy check pending. |
| LOG-01 — selected certainty persistence | FAIL | Native offered and selected Approximate; saved timeline renders the Nov 16 record as “Legacy fact needs review.” Root confirmed the same Nov 16 open period is on web; exact/approximate certainty was not retained on this legacy backend path. | Confirmed legacy flag-off backend branch. Fixed in owning CB-01 `1c48a37` / CB-02 `8e64a97`, inherited by integrated `1662a3e`; native retest pending. |
| AUTH-02 — app relaunch/session restore | PASS | Relaunched the installed app through `agent-device`; Clerk session restored and Home loaded the same primary account's Menstruation/cycle-day-2 state without another sign-in. | Debug APK plus Metro; emulator only. |
| SET-02 — appearance selection and persistence | PASS | Settings changed Light→Dark→System; System remained selected after app relaunch. Dark selection state was exposed by the accessibility tree. | Visual surface/contrast remains blocked by secure black screenshots. |
| PARTNER-01 — connection and sharing controls presence | PASS | Partner showed connected status, relationship date, a private-to-account nickname control, and sharing switches. Baseline sharing was Cycle phase on, Pain details off, Partner period logging off; Revoke partner access was visible. | No sharing or relationship mutation made yet. |
| INBOX-01 — default-off access | PASS | Home opened Inbox. The screen stated access is unavailable for this account, distinct from device permission/push availability, and showed no entries. | Primary synthetic account; no subscription or mutation attempted. |
| CHAT-01 — composer send | FAIL / retest needed | A run-labelled draft remained in the composer after pressing the enabled Send message control with the keyboard hidden and fresh accessibility refs. Thread stayed empty and no success/error copy appeared. Quick-compose populated the draft. | Historical failure: dock intercepted Send; resolved by the b502e54 retest below. |
| UI-02 — dock/composer geometry | FAIL / fix needed | At viewport 1080×2400 with Android text-size set to Large and keyboard absent, Home/Log/Chat/Partner dock groups each occupy y=1893–2090; Settings wraps to a second row at y=2090–2287. Chat composer scroller occupies y=1553–2010 and its Send control y=1863–1999, overlapping the first dock row by 106 px. The send target center is intercepted by the dock row. | Measured from `agent-device snapshot -i --json`; resolved by explicit rows and the b502e54 retest below. |
| SET-01 — preferred name save and restore | PASS | Saved a temporary run label as the synthetic preferred name, then cleared it to its original blank value and saved again. The save control was enabled for the edit and disabled after each save. | Restored original profile field; root verified the same-account web preferred name was blank again. |
| CHAT-01 — composer send after dock fix | PASS | On Metro source `b502e544ca1bb51c5c810cf2d0752c89c9a55475`, the dock moved to one row and the Send button ended above it. A single run-labelled text send showed “Sending…”, then rendered with sender “YOU” and “Sent”; composer cleared and Send became disabled. | Retest on same debug APK + Metro and synthetic account; not a standalone/release result. |
| UI-02 — dock geometry after fix | PASS | At viewport 1080×2400/Large system text, all five dock groups now share y=2090, height 197; Chat Send occupies y=1863–1999, ending 91 px above the dock. | Root commit `b502e544ca1bb51c5c810cf2d0752c89c9a55475`; Metro JS hot update. |
| PARTNER-02 — partner-side privacy check | PASS | Signed in through the protected synthetic partner Clerk flow on the same Pixel session. Partner Home showed the generic “Pain signal is private” card and “No pain data is shared today”; Partner Log exposed a private-record period-entry form and an empty Shared history section, with no primary pain note/history content in the accessible view. Root independently confirmed the primary pain note was absent from the partner web session and that the partner could see the sent chat message and heart reaction. | Same synthetic pair; device was still using debug APK plus Metro. No settings or records changed. |
| CHAT-02 — partner composer and final action | PARTIAL | Composer accepted a run-labelled draft through its accessibility text field; after a press on the field, agent-device reported the Android keyboard was not visible (Input type: text; owner: app), so on-screen keyboard visibility/layout could not be qualified. With the keyboard hidden, the enabled Send message button was accessible and tappable; it sent the draft, showed the message under YOU with Delivered, and cleared/disabled the composer. | Same Pixel emulator and current Metro JS; message retained as run-labelled synthetic QA data. |
| UI-04 — compact font/layout check | PARTIAL | Agent-device text-size preset `small` was applied; app relaunch retained the authenticated partner session. All five dock destinations stayed in one row at y=2100–2286 on the 1080×2400 emulator. Secure-window screenshots remain black, so visual legibility and content clipping were not assessed. | Same emulator/debug APK/current Metro; baseline before this group was Large. |
| UI-04 — accessibility-large font/layout check | PARTIAL | Agent-device `accessibility-large` text-size preset produced a three-row dock on Home (Home/Log y=1846–1993; Chat/Partner y=1993–2140; Settings y=2140–2287). Accessibility labels remained exposed. A React Native warning/error overlay appeared after relaunch and was dismissed through agent-device; no visual or final-action reachability claim is made at this scale. The preset label was not independently verified as exactly 200%. | Same emulator/debug APK/current Metro; visual contrast not assessable. |
| UI-04 — restore baseline | BLOCKED | Issued agent-device `settings text-size large` successfully, but the emulator then disappeared from adb before a relaunch or readback could verify the restored setting and safe app screen. `device_list` showed the Pixel 7 emulator unbooted; reopening its old `emulator-5554` id failed because the current inventory no longer exposes that id. | Stop device interaction pending supervisor direction; no new device session opened. |
## Pending

All other manual checklist cases remain **NOT RUN** until individually recorded.
Production interoperability, standalone APK qualification, physical-device
privacy, and delivery are separate gates and are not evidenced by this run.


## Interrupted device track

Pixel 7 disappeared during the enlarged-text checks. The Large text restore was
issued but not observed afterward. Automated recovery first reported insufficient
disk space, then failed with `adb shell getprop: error: closed`. Only this task's
reproducible dependencies/build outputs were cleared; no AVD/user data or shared
caches were deleted. Clearing a stale panel entry did not recover boot. The
operator stopped after bounded recovery attempts. An owner GUI restart is needed;
no alternate input driver, new device, or replacement agent was used.

The integrated `1662a3e` APK is signed and statically checked, but has not been
installed/launched. Its standalone runtime acceptance remains pending. The same
Luna agent remains available for continuation; the report is not an overall pass.

## Remaining canonical coverage

A partial result above does not complete a multi-step canonical case. The next
pass must explicitly cover the following; the device outage prevents continuation.

| Cases | Outstanding scope |
|---|---|
| AUTH-03, SET-05 | A→B→A, equal/unequal baselines, pending/failed drafts and cache isolation |
| ONB-01, ONB-02 | Partner role selection; capability-aware legacy UI retest; interruption, partial save and offline |
| LOG-02, LOG-03 | End/correct/delete confirmation and bounds; CSV/share/temporary-file cleanup |
| PAIR-01–03 | Valid/invalid/expired pairing, code clipboard/share, nickname/date/cancel/conflict, sharing/revocation/restoration |
| CHAT-01–03 | Emoji and reaction remove roundtrip; older pages/unread/focused receipts; clear cancel/confirm and offline failures |
| INBOX-02, REM-01 | Enabled synthetic inbox/read/dismiss/load more/destinations; account-local reminder save/readback |
| SET-01, SET-03, SET-04 | Remaining role/enums/bounds; pause/context/sharing; offline/pending/conflict draft retention and web concurrency |
| UI-01–04 | Remaining screen states, actual composited glass/contrast/motion, on-screen keyboard, compact/large layouts and font baseline restore |
| A11Y-01, A11Y-02 | TalkBack traversal/announcements, reduced motion and supported transparency fallback |
| PRIV-01, PRIV-02 | Recents/background/lock/resume and clipboard/export cleanup; physical-device evidence remains separate |
| WEB-01 | Remaining two-way/concurrent journey readback beyond the observed period/pain/profile/chat/privacy cases |
| PROD-01, PROD-02 | Deployed mobile contracts and native production auth prerequisites; production APK sign-in/readback |
| APK-02, APK-03, DEL-01 | Standalone install/cold launch without Metro, reinstall/upgrade/offline; final qualified delivery |

## Scoped source review while device was unavailable

GPT-6 Luna reviewed exact `1662a3e` against `b502e54` without editing or running
new tests. No actionable P0/P1/P2 regression was found in the capability guards,
independent pain readiness, conditional certainty writes, explicit dock rows,
profile validation, signing guard or backup/permission configuration. Unusual
horizontal safe-area layouts remain unqualified. Source review does not provide
native runtime or physical-device evidence.


## Resume checkpoint — 2026-11-18

The owner restarted the same Pixel 7 without wiping its data. Fresh Device
inventory and ADB inventory independently confirmed `emulator-5554` online,
Android 17, emulator rather than physical hardware. The existing Luna operator
was resumed; no replacement agent was created. Both of its `device_open`
attempts returned `user cancelled MCP tool call`, before a pinned UI session
could be obtained. It stopped without UI interaction or APK installation.
The signed candidate hash still matches the recorded `312f48c1…` artifact.

Current continuation blocker is device access, not emulator startup. The owner
was asked to allow the device-access request or report that no prompt appeared.
No new native case passed, no app/AVD data was reset and no APK was emailed.
