# CB-07 final-stack Android QA and APK delivery

**Current verdict: PARTIAL. Final signed synthetic APK passed targeted Pixel 7 retests. Direct Pixel 7 testing verified Settings, sharing, in-app notification arrival and chat. Production delivery is blocked by the deployed API and Clerk configuration.**

Owner request: manually qualify the complete CB-01–CB-07 stack on Pixel 7,
prepare a standalone APK that interoperates with the deployed web service,
then privately deliver it to the named recipient. Issue: NAK-149; PR: #86.

The final signed synthetic APK installed on the Pixel 7 and restored the primary
session on cold launch without Metro. Native correction and Approximate-date
persistence agreed with authenticated web and API readback. The final build
disables legacy period deletion and still permits correction. Android date and
time windows blocked capture while retaining accessible controls.

The synthetic fixture was restored to its original five flag values, cycle
settings 28/5, predictions unpaused, and a Nov 18 open period. The supplied
test pair and primary private notes were preserved. Remaining acceptance and
each artifact identity are tracked below and in the
[manual results](../evidence/cb-07-mobile-ui/manual-qa-results.md).

Production delivery is **BLOCKED**. The live Convex deployment lacks three
mobile entry points and two required mutation arguments. Production Clerk
reports Native API disabled. The exact dependencies and observed production
identity are recorded in the
[production preflight](../evidence/cb-07-mobile-ui/production-readiness.md).

## Run identity and responsibilities

| Field | Recorded identity |
|---|---|
| Checkout | `worktrees/cb connect/naki-8d3ef4e1-4fae137bcb8c4d75` |
| Branch | `feat/NAK-149-mobile-ui-redesign` |
| Starting source | `026249a773a9599a322e2f0d082a4f0b4c6ffa07` |
| Current app source | `384762ecf8d2861e9cdb8c013b3efe3e1eec5cc9` |
| Current CB-06 base | `7b07bf2f6dc41c9e845c76356789c5cbf20631c8` |
| Accepted CB-06 base | `8371af42b50e0b046bbdd148844cc9891c317ae4` |
| Device | local `emulator-5554`, Pixel 7, Android 17, emulator (not physical) |
| Manual operator | GPT-6 Luna device operator; one operator controls the emulator at a time |
| Supervisor | Root agent: fixes, source checks, build/signing, target verification, delivery |
| Initial debug artifact | x86_64 debug; SHA-256 `8c7a5773df3953a3b8160bcd8bfa08a4daa7a711885dd63efc546623154f9499` |
| Initial runtime | Approved synthetic Clerk and Convex; persistent preview primary/partner pair |
| Internal standalone artifact | Signed `384762e` installed by data-preserving upgrade; exact artifact below; targeted retests passed, remaining manual matrix partial |
| Final production artifact | NOT BUILT / NOT QUALIFIED — production runtime prerequisites below remain unresolved |
| Production interoperability | NOT RUN — separate from synthetic mutation QA |

### Remediated stack app snapshots

These are the app snapshots qualified before evidence-only closeout commits.
The final APK embeds the CB-07 source below; later documentation commits do not
change that APK or inherit unrun native evidence.

| Lane | PR | App snapshot |
|---|---|---|
| CB-01 | #79 | `1c48a371931c57b5c2aeb2e575c46f411181eb94` |
| CB-02 | #81 | `66ca3239286c8e73cf725ebb02d6e3b07722ae8b` |
| CB-03 | #82 | `8337321635621a57fadeec305b44db6f11a4a559` |
| CB-04 | #83 | `2e2f00d9cab8850f85bbb63d78e1e4db2ef31174` |
| CB-05 | #84 | `69f4cc04b79f1320031f52bcfe4076be8a119a40` |
| CB-06 | #85 | `7b07bf2f6dc41c9e845c76356789c5cbf20631c8` |
| CB-07 | #86 | `384762ecf8d2861e9cdb8c013b3efe3e1eec5cc9` |

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
| PAIR-02 | Edit/save/clear permitted nickname and relationship date; cancel native picker; inspect server updates | Cancel preserves state; viewer-private nickname and shared relationship date follow server truth; role permissions | NOT RUN |
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

## Progress by checklist row

Each of the 38 rows counts once. A passing subcheck does not close a row
with open scenarios. These counts include evidence gathered across the
consolidated run. The manual log records the APK used for each result.

| Status | Count | Checklist IDs |
|---|---:|---|
| Verified | 12/38 | ENV-01, AUTH-01–03, LOG-01, PAIR-02–03, CHAT-01, INBOX-01, REM-01, WEB-01, APK-03 |
| Synthetic coverage still open | 20/38 | ONB-01–02, LOG-02–03, PAIR-01, CHAT-02–03, INBOX-02, SET-01–05, UI-01–02/04, A11Y-01–02, PRIV-01–02 |
| Deferred by owner | 1/38 | UI-03 on-screen keyboard matrix |
| Production dependent | 5/38 | PROD-01–02, APK-01–02, DEL-01 |

The signed synthetic build has passed install, cold launch, session restoration
and targeted fixes. APK-01 and APK-02 above track the production build. The
300 passing mobile tests are reported separately from the live checklist.

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
| Certainty legacy mismatch — initial attempt | FAIL → FIXED / signed UI retest PASS | Legacy flag-off backend discarded offered Approximate. CB-01/CB-02 now respect server capability; no backend flag changed | CB-01 `1c48a37`; CB-02 `8e64a97`; integrated `1662a3e` |
| Internal APK static/build checks | PASS | Owner-signed, embedded JS, non-debuggable, arm64/x86_64; expected synthetic public key, no signing password/source maps in APK | Superseded `f907e30` artifact; not runtime or production acceptance |
| Device recovery — historical interruption | BLOCKED at that attempt | Pixel 7 dropped offline during font checks. Recovery reported insufficient disk; own generated caches removed. Retry still closed during boot; awaiting build completion and resource recovery | Same Pixel 7 AVD; no user/AVD data deleted |
| Manual matrix remainder — interruption checkpoint | BLOCKED / NOT RUN at that attempt | One Luna operator is retained; per-case actual results and outstanding scope are in `docs/evidence/cb-07-mobile-ui/manual-qa-results.md` | No overall full-QA PASS |

## Defects and retests

| Defect | Owning lane | Cause / remediation | Retest |
|---|---|---|---|
| Dock covers Chat Send | CB-07 | Fractional widths plus flex wrapping created an unexpected second row. Explicit rows in `b502e54` | PASS on Pixel 7: Send ends 91 px above dock; native send and web readback succeed |
| Approximate date becomes legacy unknown | CB-01 / CB-02 | UI offered certainty while server capability was off. Capability-aware controls/writes in `1c48a37` / `8e64a97` | Source tests PASS; signed APK legacy notice/hidden certainty retest PASS; enabled-mode writes remain separate |

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


### Historical internal candidate — build checkpoint before owner restart

`cb-connect-synthetic-1662a3e8e405.apk`, source
`1662a3e8e4052bbda16fb314aac7e1d0a9c1cb33`; SHA-256
`312f48c10e1755540440d35f3ff8ba7a23bd5ea0089586c24647a4fde43d82e7`.
Android beta package/version/ABIs and owner certificate match the identity above.
Signature verification, embedded Hermes JS, expected synthetic public key,
production-key absence, no source maps/signing password in the APK and
non-debuggable manifest all pass. Backup is disabled and the configured
legacy storage/overlay permissions are absent. Build completed in 15m 2s.

At this build checkpoint the emulator was unavailable, so standalone runtime
was pending. This is historical; the resumed signed run below supersedes that
blocker. The artifact remains synthetic and has not been uploaded or emailed.
Production contract/auth prerequisites remain unresolved.


### Standalone run resumed — 2026-11-18

Root device connection succeeded after the child requests were cancelled. The
same Luna operator uses its exact pinned command in the same task. Large text
baseline was verified. Only the disposable internal beta app was replaced to
switch from debug signing to owner release signing; the AVD, other apps and
persistent backend accounts/records were preserved. Signature was reverified;
install succeeded, package version `0.0.1` / code `1` is non-debuggable with
backup disabled. No Metro process or reverse mapping was present. Luna's cold
launch reached native Sign In without a missing-script screen (APK-02 launch
subcase PASS). Remaining auth/journey acceptance is in progress in the manual
results log; a launch subcase does not complete the whole APK-02 case.


Supervisor checks for the resumed signed run: installed base-APK bytes match
SHA-256 `312f48c10e1755540440d35f3ff8ba7a23bd5ea0089586c24647a4fde43d82e7`;
crash buffer has no new entries after installation (the earlier scrcpy helper
failure predates it). Fresh synthetic deployment inventory still matches all
50 mobile public names, kinds and visibility, including conditional cycle args.
Local web liveness is HTTP 200; readiness is HTTP 503 because this development
server has no qualified release metadata. It is not a production readiness
result. An unauthenticated protected Settings request redirects to the approved
Clerk sign-in host. No credential-bearing URLs or raw auth logs are retained
in this report.

### Fixture identity audit — 2026-11-18

Read-only Clerk email lookup found one existing account for each protected
login email. Both saved fixture ID fields are stale; the working credentials
and accounts were preserved. Supplemental API readback bound each unique
login to its token subject, backend Clerk subject and expected primary/partner
role, then checked bidirectional linkage and matching relationship generation.
Those checks passed. Backend display email metadata differs from login email
and was not used as the auth identity. No fixture file/account/pair was changed.
Only short-lived sessions created for this audit were revoked. This audit is
programmatic identity/readback evidence, separate from Luna's hosted native
sign-in and manual UI results.

### Signed-run connectivity interruption

After system accessibility navigation, the signed native app intermittently
returned to its offline guard. It briefly recovered to Home, then the guard
persisted. No save was submitted in this interval. Host synthetic web/backend
liveness remained HTTP 200. Native logs reported WebSocket close code 1006 /
software-caused connection abort, with no new app crash, auth error or render
error pattern in the inspected log window. The device operator is checking
airplane/Wi-Fi and Chrome connectivity before classifying this as an emulator
network problem or app-recovery defect. Pending native/web draft concurrency
was not executed during this interruption.

The same operator then confirmed emulator Chrome could load both local
`/api/health` (status `ok`) and a public HTTPS page. With airplane OFF and Wi-Fi
ON, the native gate cleared on foreground open, Continue returned Home. No
reinstall or reset was required. The recovery subcase passed; this does not
prove failed-save draft retention or rule out intermittent reconnection issues.

### Native/web settings conflict — signed APK

Luna held an unsaved native cycle-length draft of 29 against saved 28/5. Root
used the separate authenticated primary web UI to save 30/5. Native retained
the 29 draft, displayed “These cycle settings changed elsewhere. Reload before
saving.”, exposed Reload cycle settings and disabled Save. This conflict and
no-silent-overwrite subcase passed. Explicit reload and original 28/5 restoration
are recorded separately after observation; this is not yet the entire SET-04
failed-save/pending matrix.

Luna explicitly reloaded cycle settings to 30; root then restored 28/5 in the
actual web UI. Supplemental backend readback and native refresh both verified
28/5/unpaused again, no conflict and disabled Save. The same mounted-draft
scenario for preferred name also passed: blank baseline, native run-labelled
draft held, distinct web run-labelled value saved, native draft preserved with
changed-elsewhere warning, Reload control and disabled Save. The warning was
initially outside the current accessibility viewport; scrolling to the profile
panel exposed it. That navigation delay was not a product defect.

Profile explicit Reload adopted the web label and disabled Save; root restored
blank through web, and supplemental backend readback verified both accounts'
names blank and 28/5/unpaused baselines.

### Reminder and enabled inbox preparation

Luna's native primary reminder baseline was unset (picker default was not a
saved value). Native selected and saved 07:30; root's separate authenticated
web time field independently displayed 07:30. Root cleared and saved the web
time field, restoring unset. Native restoration readback is recorded in the
operator log. In-app reminder consent stayed off; no scheduled/push delivery
is claimed.

For inbox/chat paging fixture preparation, root recorded the exact original
values of cycle-facts and four notification flags as false and confirmed no
GitHub job in progress. Only the approved synthetic deployment's notification
outbox/projection/delivery/inbox flags are temporarily enabled. Cycle-facts,
scheduler and production settings are untouched in this phase. The planned
public-API fixture preparation uses only the verified persistent pair and
run-labelled chat messages, with partner Message activity restored afterward.
This setup is programmatic; manual inbox/pagination results remain separate.
All flag originals must be restored and read back before ending this run.

Luna verified native preferred name blank/Save disabled/no stale warning and
reminder Choose a time/Save disabled with consent off after web restoration.
Root then prepared 45 CB07-labelled primary chat messages (48 total); every
message remains run-labelled. Supplemental inbox readiness shows primary
empty, partner first page 20 with `isDone=false`, establishing a real second
page for the manual operator. No manual inbox PASS is inferred from that API
read. Root's real authenticated web DM independently displays the signed
native primary send from this run; private-thread readback succeeds.

The settings-bounds attempt accidentally advanced an unsaved local cycle draft
to 33 through repeated stale targeting; no Save was pressed. The operator
restored 28 using fresh single-action references and observed disabled Save.
This is a test-operation correction, not a server write or a successful full
bounds test. Remaining bounds coverage must be stated separately.

### History and same-account setup resume

The operator ended the run-created initial period, opened correction and
verified cancellation, then cancelled deletion (record remained) before
confirming deletion of only that run-created period. Empty history returned
the same primary account to existing-role cycle setup. Replacement setup
completed with original 28/5 settings and capability-aware legacy copy. Root's
authenticated web Log independently showed the replacement open period and
retained private pain entry. Correction-save, CSV and partner phases remain
separate cases in the operator log.

### Local fixture metadata correction

After repeating unique-email, JWT-subject, backend-subject/role and
bidirectional-pair checks successfully, root atomically corrected only the
two stale local Clerk ID metadata fields in the protected fixture file.
Ignored status and mode 600 were preserved; all other keys were compared
unchanged before writing. Credentials, accounts, relationship and server data
were unchanged. Earlier “file unchanged” statements describe the audit stage
before this correction. No account provisioning or deletion occurred.

### Android date-selection finding — owning CB-02 fix pending integration

With TalkBack verified OFF, the correction picker displayed the newly selected
day in its header; after confirmation the form still showed its old date on
two bounded attempts. No uncertain correction was saved. The owning CB-02
candidate `4dae60b` uses the supported Android imperative picker so unrelated
renders do not reopen/reset an unconfirmed selection; cancellation/unmount
dismissal and iOS behavior are retained. The old-source bridge regression
fails on selected-day retention and passes with the change; CB-02 mobile
TypeScript and 29 files / 198 tests pass. No backend/API/dependency change.
The same final-stack run must retest the next signed artifact before accepting
correction saves. CB-03–CB-06 were locally restacked with identical lane patches
by range-diff; no branch has been pushed for this finding yet.

### Partner inbox, paging and clear

On signed `1662a3e`, the operator loaded the enabled synthetic partner inbox,
marked a notice read, dismissed it, opened its Messages destination and used
Load more. Supplemental public-API readback found 44 unique remaining notices
in pages 20/20/4, with primary inbox empty. This is separate from the UI result
and does not prove every native row was visually inspected. Partner Message
activity was toggled off/on/off through native Settings, restoring false.
Chat Load older messages exposed older run-labelled messages. Clear cancel
preserved all 48 run-labelled messages; confirmed Clear produced the native
empty state. Root verified zero visible messages for both accounts and that
old source-bound inbox notices no longer appeared.

For the pending-notice revocation case, root temporarily re-enabled only the
partner Message activity preference and sent one run-labelled message through
the real authenticated primary web DM. It rendered and the web composer
cleared. Revocation/relink of the same existing accounts is coordinated next;
preference and relationship-field baselines must be restored afterward.

Current local integrated source `88281931f0fd99d33dd28588f931cd1b7076155a`
passes 34 files / 295 mobile tests, native TypeScript/strict contract parity and
root TypeScript. Its next signed APK is still building; existing device cases
remain attributed to `1662a3e`. The previously documented JDK17 directory was
absent; Gradle9.3.1 now launches from the existing Studio JBR25 (officially
supported), and the project's configured Java17 compiler was automatically
provisioned. Initial build attempts failed before compilation on that missing
path / wrapper download timeout; no candidate was installed from those attempts.

### Live revoke, normal relink and restoration

Root revoked the synthetic relationship through the actual primary web UI
while Luna held the partner's unread inbox notice. Native immediately showed
only the unpaired connection form; inbox, Home, Chat and dock were absent.
Android Back did not reopen protected content. Read-only identity checks
confirmed both existing accounts remained intact and unlinked.

Malformed input showed bounded-code validation; a first invitation expired by
web regeneration produced “Invalid or expired pairing code” without linking.
Native primary Copy confirmed success; Share opened the chooser and was
cancelled without external delivery. A code-bearing action diff exposed one
synthetic invitation; root invalidated it by regeneration before further use.
Its replacement stayed in a private mode-600 relay, and the SAME partner
linked successfully through normal UI. No account was created or deleted.

Post-link native and supplemental API checks found no prior chat/inbox
contents. Both profile names/nicknames and relationship date are blank/unset;
cycle baselines are 28/5/unpaused, reminder unset, Message activity off.
Original sharing baseline is phase on, pain off, period assistance off. The
three task-created relay files were removed after successful relink. Android
clipboard read was unsupported; its contents were preserved, and clipboard
cleanup remains unqualified. Test notification flags are being restored to
their exact original false values before ending the enabled phase.

### Picker-window privacy finding and later candidate

A supervisor inspected the stored synthetic date-dialog capture: the calendar
was visible while the Activity behind it was black. Source confirms Expo sets
FLAG_SECURE only on the Activity, and the pinned date/time picker creates
separate unprotected windows. CB-02 candidate `bcfa02c` adds version/source-hash
guarded, idempotent native dialog inheritance before display. The dependency
version is unchanged; the lockfile only records the new project postinstall.
CB-02 postinstall, TypeScript and 30 files / 201 tests pass. Native compile and
modal-capture retest are still required; physical-device claims remain separate.

The intermediate date-selection candidate `8828193` built successfully with
Temurin17 in 24m43s (1490s including packaging), after transient toolchain
recovery. SHA-256 `eb9bd35cb54df97fd3b9a49c6826690b15373a9ed9757fe4a1ee760691501008`;
owner certificate, embedded Hermes, synthetic key, both ABIs, non-debuggable /
backup-disabled manifest and source-map/password/blocked-permission exclusions
pass. It does NOT contain the later native modal privacy fix. It is internal
and has not been uploaded or emailed.


### Latest integrated source and review remediation — 2026-11-18

Current app source `384762ecf8d2861e9cdb8c013b3efe3e1eec5cc9`, CB-06 base
`7b07bf2f6dc41c9e845c76356789c5cbf20631c8`. A fresh CB-02 review correctly
identified that legacy Delete invoked irreversible backend deletion while
cycle-facts was disabled. Owning CB-02 `66ca323` disables Delete/Confirm and
independently rejects the handler under that capability. An already-open
confirmation cannot submit after capability loss; date corrections remain
available. No backend change. Two interaction regressions pass. CB-03–CB-06
lane patches remain identical by range-diff after restacking.

Integrated validation: **35 files / 300 mobile tests PASS**, native TypeScript,
strict public contract parity and root TypeScript PASS. Updated stack refs were
pushed atomically with exact leases and linked. Exact-head CI must be checked
separately. Production release jobs remain outside this synthetic qualification.

Signed `c0dc24d` build completed in 16m48s (1016s including packaging). File:
`build/mobile/synthetic/c0dc24d99059/cb-connect-synthetic-c0dc24d99059.apk`;
SHA-256 `918f1d368d105ab6fcd820af66ceb22f128353a67d424fbd1c873e8e0979020c`;
69,956,981 bytes. Owner certificate, embedded Hermes, both ABIs, synthetic public
key / production-key absence, non-debuggable / backup-disabled manifest and
blocked-permission/source-map/signing-password exclusions pass. ADB `install -r`
succeeded on the same Pixel 7 with no app-data or AVD wipe; no Metro reverse
mapping is present. Luna's upgrade/modal/correction results retain this artifact
identity. Its successor `384762e` is building and requires targeted legacy-delete
and final-upgrade acceptance before it can replace this candidate.

This is still synthetic internal qualification. No production APK, upload,
email, merge or production deployment has occurred.


Supervisor verified installed c0dc24d base-APK bytes match its recorded hash.
Crash-buffer review found an earlier app-process Fabric `addViewAt`
`IndexOutOfBoundsException` at 04:50, before the current APK's 04:59 install;
it is a historical intermediate-build incident with trigger unverified. No
current-install crash appears in that inspected buffer. Do not erase the old
incident or infer that the current app is crash-free from the bounded check.
The new time-picker capture is fully black except system chrome/shield, while
the operator can read/interact with its controls through accessibility. Cancel
left reminder unset with Save disabled. Date-picker acceptance remains separate.


Current-head CI refresh: PR81–86 all match the pushed remediated heads and have
successful deterministic qualification and mobile probe. PR82–86 also have
older duplicate cancelled deterministic runs, superseded by the successful
runs. Skipped authenticated-release/production-artifact jobs remain skipped,
not production acceptance. PR67 was rechecked OPEN/DRAFT.


Primary correction-save acceptance on signed `c0dc24d`: native changed only the
run-created open period from Nov18 to Nov17 and saved. Supplemental API readback
for both linked accounts returned Nov17/open/legacy_unknown; the separate actual
authenticated primary web Log displayed “Period in progress since Nov17,2026”
and an active Nov17 timeline entry. Native date-picker capture is fully black
except system bars/shield while selection/bounds remain accessible. This proves
the date-selection/save and modal-protection subcases; it does not qualify the
later legacy-delete guard or composited glass. The operator is restoring Nov18.


Correction restoration: Luna used the same native correction control to return
the run-created open period to Nov18, without deletion. The mounted actual
primary web Log independently updated to “Period in progress since Nov18,2026”
and no longer showed the previous Nov17 progress status. No historical Fabric
crash trigger could be tied to a visible operator action; the earlier bounded
crash-buffer finding remains an unresolved historical incident, not a reproduced
current-build defect.


### Final synthetic candidate — 384762e

Signed build PASS: 15m48s Gradle build, 955s including packaging. File
`build/mobile/synthetic/384762ecf8d2/cb-connect-synthetic-384762ecf8d2.apk`,
source `384762ecf8d2861e9cdb8c013b3efe3e1eec5cc9`, 69,957,209 bytes;
SHA-256 `6f9f2505b5c18f5693b28873c55ea130e442029151f2e6ba890f95afb1feb765`.
Android beta app/version `tech.builtbynaki.cbconnect.beta` / `0.0.1` / code1;
arm64-v8a + x86_64; owner certificate unchanged. All static inspection assertions
pass: manifest hash, owner cert, non-debuggable, backup disabled, embedded
Hermes, exact synthetic public key, production-key absence, no source maps or
keystore, no signing passwords in JS and blocked storage/overlay permissions
absent. This is an internal synthetic APK; it is not a qualified production
release and has not been uploaded or emailed. Install/targeted acceptance follows
only after the operator reaches a clean form state.


Final384 data-preserving `adb install -r` completed successfully after the
operator confirmed clean primary Settings/28/5 with Save disabled. No AVD data,
app data or account was cleared. Prior c0dc bounds check reached cycle minimum21
and restored28; maximum40 and period bounds remain NOT RUN for that attempt.
Pause was not changed. Final upgrade/session and capability-guard results are
recorded separately by the same Luna operator.


Final384 runtime retests: primary session restored on cold relaunch; legacy
history showed enabled Correct, disabled Delete and the deletion-unavailable
notice. Installed bytes independently match the final SHA and reverse-port
mapping is empty. Root then enabled ONLY test `CB_CONNECT_CYCLE_FACTS_V1` and
read back true. On the same sole run-created Nov18 record, native enabled Delete;
Cancel preserved the entry, then confirmed Delete removed it. Supplemental
public history readback is empty for both linked accounts. This uses the
cycle-facts-enabled deletion path; no production flag or notification flag was
enabled. Approximate same-role setup/persistence is being tested before cleanup
and exact original flag restoration.


Enabled certainty acceptance PASS on exact final384 APK: same primary setup
selected Nov18 Approximate, retained28/5 and completed Start tracking/Continue.
Independent API readback for both accounts returns one Nov18/open period with
`startCertainty: approximate` and aggregate `certainty: approximate`, no legacy
period. Actual authenticated primary web Log displays “Approximate observation.”
This resolves the positive enabled-capability persistence subcase, separately
from the previous flag-off UI acceptance. Only test cycle-facts is temporarily
true; cleanup of this run-created record and flag restoration are in progress.


Final384 Approximate cleanup completed while the test cycle-facts flag was
still true; both accounts' public histories were empty. The target-bound
restoration script then completed and independently read back ALL FIVE original
flags false, including cycle-facts and inbox/outbox/projection/delivery. No
scheduler or production setting changed. The same primary account is replacing
its run-created baseline period at Nov18/28/5 under legacy-mode copy.


Scope alignment: NAK-145 requires viewer-private nickname and shared
relationship-date edit/save/clear, server validation, anniversary information,
pair-code actions and revocation/generation guards. It does not introduce an
atomic relationship-field conflict or CAS contract. PAIR-02 tests those actual
contracts; CB-06 cycle CAS/profile best-effort warning remains separately tested.
No new relationship-field conflict feature is added by this QA run.


Final384 settings acceptance: native cycle maximum40 and period minimum2 /
maximum8 reached their disabled edge controls. The earlier minimum21 test is
attributed to c0dc24d; these unchanged control paths belong to one consolidated
run. Native then saved temporary29/6. Root independently reloaded the actual
primary web Settings, whose labels and range input values both show29/6, and
API readback agrees. Partner's own cycle settings remain28/5. Native restoration
to28/5 and separate enum/pause/sharing checks follow; do not call temporary test
values final restored state before independent readback.


Runtime identity follow-up: the default shell resolves Node22. The supervisor
explicitly selected Node20.19.1/npm10.8.2 with nvm and reran root TypeScript and
strict contract parity: PASS. Native TypeScript was separately rerun with
absolute Node22.23.1: PASS. The 300-test integrated mobile run already used
absolute Node22. Native build helper also pins its PATH to Node22/JDK17.
No app source changed during these checks.


Continuation readback confirmed the legacy replacement persisted as Nov18/open
with legacy-unknown certainty, sharing phase on, pain and period assistance off,
both profile names blank, default profile choices, reminder unset and chat empty.
Both existing synthetic accounts remain linked. The primary has two pain entries
in the checked window, with notes. The partner has no pain entries in that window.
The original operator reported the device stopped after the run. The owner
requested new Luna operators. Device operation and independent evidence review
are assigned separately, with a single operator authorized to drive Pixel 7.

The continuation operator could not boot Pixel 7. The device tool reported that the emulator process exited with code 1 before coming online, and follow-up inventory remained offline. Remaining Settings enum, pause, sharing, keyboard and accessibility checks are blocked pending recovery of the same AVD.

The root operator subsequently opened the available Pixel 7 directly. Native
profile selections persisted for each role and were restored. Native primary
pause and pain sharing saved and were restored. Partner API denied private
notes and raw identity fields while sharing was enabled and returned no pain
entries after it was switched off. Partner Home confirmed the private state.
This closes PAIR-03 in combination with the prior live revoke and relink
evidence. The manual log records the remaining Settings, keyboard and offline
limits and the Save tap intercepted near the dock.

The final signed synthetic APK received a fresh in-app Message activity
notification with synthetic delivery enabled and partner consent on. Mark as
read, opening the matching Chat and dismissing passed. Default-off behavior,
restored preferences and an empty test conversation were verified afterward.
Android system push is unsupported in this build. The owner deferred the
on-screen keyboard matrix. The manual evidence records the separate dock hit
observation and outstanding full native inbox pagination.
