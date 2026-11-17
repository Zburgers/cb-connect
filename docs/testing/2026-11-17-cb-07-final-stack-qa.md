# CB-07 final-stack Android QA and APK delivery

**Current verdict: PARTIAL — Pixel 7 is online again; device-access requests were cancelled, preventing QA continuation. No production APK qualified or delivered.**

Owner request: manually qualify the complete CB-01–CB-07 stack on Pixel 7,
prepare a standalone APK that interoperates with the deployed web service,
then privately deliver it to the named recipient. Issue: NAK-149; PR: #86.

## Run identity and responsibilities

| Field | Recorded identity |
|---|---|
| Checkout | `worktrees/cb connect/naki-8d3ef4e1-4fae137bcb8c4d75` |
| Branch | `feat/NAK-149-mobile-ui-redesign` |
| Starting source | `026249a773a9599a322e2f0d082a4f0b4c6ffa07` |
| Integrated source | `1662a3e8e4052bbda16fb314aac7e1d0a9c1cb33` |
| Current CB-06 base | `a12cb3a625d4b7341e86370c57ee1c6d69d5663b` |
| Accepted CB-06 base | `8371af42b50e0b046bbdd148844cc9891c317ae4` |
| Device | local `emulator-5554`, Pixel 7, Android 17, emulator (not physical) |
| Manual operator | One resumed GPT-6 Luna agent; reuse this agent for retests |
| Supervisor | Root agent: fixes, source checks, build/signing, target verification, delivery |
| Initial debug artifact | x86_64 debug; SHA-256 `8c7a5773df3953a3b8160bcd8bfa08a4daa7a711885dd63efc546623154f9499` |
| Initial runtime | Approved synthetic Clerk and Convex; persistent preview primary/partner pair |
| Internal standalone artifact | Signed `1662a3e` candidate built; static checks PASS; install/runtime NOT RUN |
| Final production artifact | NOT BUILT / NOT QUALIFIED — production runtime prerequisites below remain unresolved |
| Production interoperability | NOT RUN — separate from synthetic mutation QA |

Record every source/build/runtime change in the run log. A later documentation
commit does not alter app source; a changed app source invalidates affected
results until retested. Never call the debug/Metro APK a distributable release.

## Operating rules

1. Read `AGENTS.md`, the dated Gate 5 execution plan, the CB-07 plan and
   `.agents/skills/cb-connect-browser-qa/SKILL.md`. Use the existing public API
   inventory, strict parity, negative compilation and server-import checks.
   These complement manual evidence and cannot replace it.
2. Use `device_list` then `device_open` for `local` / `emulator-5554`. Use its
   returned `agent-device` command for app launch, links, taps, typing, system
   settings and screen capture. Open the app before snapshot/input. ADB is
   limited to inventory, install, logs and port forwarding. Do not commandeer
   another device session. Follow a device tool's recovery advice once; record
   persistent failure and stop that device track.
3. Use only the persistent synthetic pair in the primary checkout's ignored,
   mode-600 `.env.mobile-preview.local` for mutation/negative QA. Do not create
   or delete that pair. Never print credentials, tokens, account IDs, pairing
   codes or raw authenticated payloads. Keep raw screenshots/logs local and
   ignored; sanitize evidence before sharing or committing.
4. The owner's later request authorizes production-compatible packaging and
   private delivery. It does not turn synthetic results into production
   evidence or authorize migrations, real health-data edits, broad flag
   changes, merging or deployment. Verify production config/backend readiness
   read-only; use authorized credentials for production sign-in/readback.
5. Preserve guards, sharing/revocation, relationship generation, authoritative
   timezone/history, default-off inbox, truthful offline/partial-save copy,
   privacy shield and account-keyed caches/drafts. Report feature defects to
   their owning CB lane; fix the smallest verified cause and retest it.

## Result and evidence format

**PASS** = steps completed and expected result observed. **FAIL** = product
behavior differs. **BLOCKED** = missing dependency prevents execution.
**NOT RUN** = not attempted. No aggregate full-QA PASS while a required row is
unresolved. Physical-device and iOS acceptance remain separate from Android
emulator results.

For each case, append an actual-results row: case ID; status; source/APK/runtime
identity; observed behavior; safe evidence reference; defect/retest reference.
Use a separate row for each subcase, account role, appearance and retest.

## Manual checklist

Execute in this order so auth/runtime failures are resolved before dependent
journeys. Restore reversible synthetic settings after each group. Destructive
actions apply only to dedicated synthetic records created during this run.

| ID | Steps | Expected outcome | Initial status |
|---|---|---|---|
| ENV-01 | Confirm device, install identity, launch native app and inspect JS/native logs | Correct app/build/target; no crash or red screen | NOT RUN |
| AUTH-01 | Open Sign In, cancel hosted flow, retry; submit invalid credentials then preview primary credentials | Truthful errors/cancellation; Clerk callback returns to native authenticated screen | NOT RUN |
| AUTH-02 | Background, resume, terminate/relaunch and allow session/token renewal | Session restores safely; authorized Convex data loads without bypass | NOT RUN |
| AUTH-03 | Sign out; sign in as partner; repeat A→B→A in place | No prior account data, drafts, errors, chat or permission leakage | NOT RUN |
| ONB-01 | Inspect both role paths; exact/approximate initial date, invalid/future/boundary dates and lengths | Correct role copy, valid bounds, explicit date semantics; no invented actionable UTC date | NOT RUN |
| ONB-02 | Interrupt/resume onboarding and simulate offline/partial save | Resume reflects server state; exact saved/unsaved portions and retry; no false success | NOT RUN |
| LOG-01 | Primary: create synthetic period and pain entries; inspect history | Exact account-local dates, source/provenance and private notes; web readback agrees | NOT RUN |
| LOG-02 | Correct history, end entry; inspect overlap/invalid ranges; cancel then confirm deletion of run-created record | Bounds, confirmation, permissions and visible history remain accurate | NOT RUN |
| LOG-03 | Preview/export CSV; background/sign out after export | Correct synthetic data and sharing affordance; temporary export cleanup; no other account's file | NOT RUN |
| PAIR-01 | Inspect/copy/share pairing code; test invalid/expired inputs and valid pair only if fixture supports reversible pairing | Clear validation; no unauthorized relationship; clipboard cleanup | NOT RUN |
| PAIR-02 | Edit nickname and partner date; cancel; test conflict/explicit choice | Cancel preserves state; authoritative primary calendar or explicit date choice; role permissions | NOT RUN |
| PAIR-03 | Toggle synthetic sharing, inspect partner, revoke and restore authorized sharing | Live revocation; no stale sensitive data; private data remains private | NOT RUN |
| CHAT-01 | Both accounts: send run-labelled text/quick compose/emoji, add/remove reaction; read on web | Correct sender and relationship, realtime sync; no false offline send | NOT RUN |
| CHAT-02 | Scroll history/load older pages; change focus and inspect unread/read receipt | Stable order/no missing or duplicated pages; focused receipts; generation fencing | NOT RUN |
| CHAT-03 | Open clear; cancel; confirm only run-created conversation if safely isolated; retry offline | Cancel truthful; authorized clear; failed/partial writes reported exactly | NOT RUN |
| INBOX-01 | Inspect default-off account and navigation/subscriptions | Inbox stays unavailable and gated; no unauthorized subscription or deep-link exposure | NOT RUN |
| INBOX-02 | If enabled synthetic fixture exists: read/dismiss/load more/open destinations | Server availability governs; correct account/pagination/destination | NOT RUN |
| REM-01 | Inspect reminder and account timezone; edit synthetic time and restore | Account-local time persists and agrees with web; no UTC fallback | NOT RUN |
| SET-01 | Edit permitted names/enums/cycle lengths with valid/invalid values for both roles | Correct bounds and role-specific controls; no silent coercion | NOT RUN |
| SET-02 | Change Light→Dark→System and restart | Whole app/native controls agree; preference persists; dock contrast readable | NOT RUN |
| SET-03 | Toggle pause/private context/sharing and restore | Correct copy and web readback; no expanded access | NOT RUN |
| SET-04 | Pending save, failure and reconnect while editing; concurrent web cycle/profile edits | Draft retained; stale cycle CAS recovery; accepted best-effort profile warning; no silent overwrite claim | NOT RUN |
| SET-05 | Switch A→B with equal then unequal server baselines and pending/failed drafts | Fresh account draft/state regardless of equal values; no A data shown for B | NOT RUN |
| UI-01 | Inspect Home, Onboarding, Log, Partner, Chat, Inbox, Settings in Light/Dark | Bloom hierarchy, coral/amber/sage, distinct rims, correct content/empty/error states | NOT RUN |
| UI-02 | Scroll patterned scene content under dock; switch tabs slowly/quickly | Visible backdrop sampling/translucency and reflection; smooth active capsule; correct selection/access | NOT RUN |
| UI-03 | Keyboard on every editable screen; scroll final content and Chat composer | Dock hides/reserved inset adjusts; focused inputs/actions remain reachable; no jumps/overlap | NOT RUN |
| UI-04 | Compact/large display and largest practical font scale; landscape if supported | Content wraps, labels remain legible, controls reachable, safe-area/dock padding correct | NOT RUN |
| A11Y-01 | Enable TalkBack; traverse tabs/forms/dialogs/errors | Correct names/roles/order/selected state; focus and announcements usable | NOT RUN |
| A11Y-02 | Enable reduced motion; inspect selection. Inspect supported transparency fallback | No spring under reduced motion; supported solid fallback remains readable | NOT RUN |
| PRIV-01 | Background/Recents, screenshot attempt, lock/resume and sign-out | Shield before sensitive screen; native screenshot/Recents protection; no stale screen flash | NOT RUN |
| PRIV-02 | Copy code/export; background/sign out/account switch | Sensitive clipboard/temporary files cleaned according to policy; no cross-account leakage | NOT RUN |
| WEB-01 | Same synthetic accounts in web and native; compare settings/history/chat and reversible updates both ways | Shared server truth and authorization; no divergent account/relationship/date semantics | NOT RUN |
| PROD-01 | Read-only deployed web readiness, production Clerk issuer, Convex target and mobile function inventory/validators | Exact production identity and complete compatible deployed mobile contract | NOT RUN |
| PROD-02 | Final production APK: hosted Clerk sign-in/callback, restart, authorized account data compared to deployed web | Same production account/data; no synthetic target; no unauthenticated fallback | NOT RUN |
| APK-01 | Build signed standalone arm64-compatible release; inspect manifest/signature/embedded JS/config | Non-debuggable; JS/assets bundled; verified production endpoints; recoverable private signing custody; version recorded | NOT RUN |
| APK-02 | Install exact release on Pixel 7, stop Metro/reverse, cold launch, auth/readback; inspect crash logs | Works without developer server; no dev menu/cleartext dependency; correct runtime | NOT RUN |
| APK-03 | Reinstall/upgrade same signing lineage; offline launch and reconnect | Installation succeeds; account state/privacy safe; offline writes fail truthfully | NOT RUN |
| DEL-01 | Hash qualified APK; private recipient-specific upload/email; verify sent message/download access | Exact qualified file delivered only to authorized recipient; user receives file/link and SHA-256 | NOT RUN |

## Deterministic checks and coverage limits

Prior source `026249a`: root typecheck PASS; mobile typecheck/strict parity PASS;
mobile tests 33 files / 278 PASS; Expo Doctor 21/21 PASS; Android Hermes export
PASS; x86_64 debug compile PASS. These are inherited results from the CB-07
evidence record, not rerun manual results. Rerun affected checks after fixes.

The final artifact also needs deployed public function inventory/contract
compatibility, signing/manifest inspection and runtime acceptance. An emulator
cannot prove physical-device screenshot/Recents/clipboard safety or iOS
behavior. Do not label those PASS from source tests or Android compilation.

## Actual results

| Case / attempt | Status | Observation / evidence | Identity |
|---|---|---|---|
| Initial preflight | PASS | User-started Pixel 7 is online; prior SIGSEGV boot blocker superseded | Device inventory; source `026249a` |
| ENV-01 initial launch | PASS | Luna reports native Home loaded through Metro; initial APK hash matched | Initial debug APK; synthetic backend |
| AUTH-01 hosted cancellation | PASS | Luna opened Clerk hosted sign-in and closed it; native Sign In returned | Initial debug APK; synthetic Clerk |
| WEB-01 auth prerequisite | PASS | Headless system Chrome completed standard sign-in and development test-email verification; web shows Initial Setup | Local web port 3007; same synthetic primary |
| PROD-01 | FAIL | 47/50 deployed mobile references; conditional cycle argument absent; production Native API disabled. See production-readiness evidence | Web `a7756d8`; `prod:festive-malamute-715` |
| Dock and Chat Send retest | PASS | Explicit rows fixed measured overlap; all five tabs share one row, Send is above dock, send renders and clears composer | Native Metro `b502e54`; same initial debug APK |
| WEB-01 native-to-web readback | PASS | Same synthetic accounts agreed on initial period/phase, private pain entry, restored blank name, chat message and heart reaction; partner did not see private pain note | Local web port 3007; approved synthetic backend |
| Certainty legacy mismatch | FAIL → FIXED IN SOURCE / RETEST PENDING | Legacy flag-off backend discarded offered Approximate. CB-01/CB-02 now respect server capability; no backend flag changed | CB-01 `1c48a37`; CB-02 `8e64a97`; integrated `1662a3e` |
| Internal APK static/build checks | PASS | Owner-signed, embedded JS, non-debuggable, arm64/x86_64; expected synthetic public key, no signing password/source maps in APK | Superseded `f907e30` artifact; not runtime or production acceptance |
| Device recovery | BLOCKED | Pixel 7 dropped offline during font checks. Recovery reported insufficient disk; own generated caches removed. Retry still closed during boot; awaiting build completion and resource recovery | Same Pixel 7 AVD; no user/AVD data deleted |
| Manual matrix remainder | BLOCKED / NOT RUN | One Luna operator is retained; per-case actual results and outstanding scope are in `docs/evidence/cb-07-mobile-ui/manual-qa-results.md` | No overall full-QA PASS |

## Defects and retests

| Defect | Owning lane | Cause / remediation | Retest |
|---|---|---|---|
| Dock covers Chat Send | CB-07 | Fractional widths plus flex wrapping created an unexpected second row. Explicit rows in `b502e54` | PASS on Pixel 7: Send ends 91 px above dock; native send and web readback succeed |
| Approximate date becomes legacy unknown | CB-01 / CB-02 | UI offered certainty while server capability was off. Capability-aware controls/writes in `1c48a37` / `8e64a97` | Source tests PASS; integrated native retest pending |

Preserve previous attempts; do not convert an unexecuted case to PASS.

## Final artifact and delivery record

Pending qualification. Record filename, source SHA, ABI, app ID, versionName /
versionCode, signing certificate SHA-256 (never private key), APK SHA-256,
Clerk/Convex target identity, standalone launch evidence, unresolved limits,
recipient access verification and sent-message ID. Do not send a test-only or
Metro-dependent APK under a production-ready label.


### Internal candidate identity (superseded, never delivered)

Source `f907e301ccec365122bd3cef1b029dbb63cbb078`; Android package
`tech.builtbynaki.cbconnect.beta`, version `0.0.1` / code `1`; arm64-v8a and
x86_64; embedded Hermes JS, non-debuggable; synthetic Clerk/Convex. SHA-256:
`8147edf9deb6be0cd008c1eefc90879743149bda02f9d04cd13d87bf80c0914b`.
Owner RSA-3072 certificate SHA-256:
`286645f10054d5bb6477de5124d5adc1e8838aeb51c593e9d782d52078988c2d`.
Private signing custody and a local recovery copy were verified outside Git;
off-host backup is NOT VERIFIED. This candidate predates the live QA fixes and
is not a delivery artifact. No email or Drive upload has been performed.


### Current internal candidate (runtime pending)

`cb-connect-synthetic-1662a3e8e405.apk`, source
`1662a3e8e4052bbda16fb314aac7e1d0a9c1cb33`; SHA-256
`312f48c10e1755540440d35f3ff8ba7a23bd5ea0089586c24647a4fde43d82e7`.
Android beta package/version/ABIs and owner certificate match the identity above.
Signature verification, embedded Hermes JS, expected synthetic public key,
production-key absence, no source maps/signing password in the APK and
non-debuggable manifest all pass. Backup is disabled and the configured
legacy storage/overlay permissions are absent. Build completed in 15m 2s.

This is an internal synthetic artifact. Standalone install, cold launch and
journeys were not run because the emulator is unavailable. It is not the
requested working production APK and was not uploaded or emailed. Production
contract/auth blockers are unchanged. The owner has been asked to restart the
same emulator without wiping data; the existing Luna agent will resume.
