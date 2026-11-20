# CB-03 Mobile Partner Connection Implementation Plan

> **For Codex:** Use the Shipyard executing-plans skill to implement this plan task-by-task.

**Goal:** Port the partner connection details and pairing-code actions exposed by the web partner page into the native partner screen while preserving current Convex authorization and relationship-generation guards.

**Architecture:** Keep pairing, connected-since date, nickname, sharing, and revocation server-authoritative through existing public Convex references. Add only the two existing date/nickname mutation references to the mobile public API inventory, extend the existing connected-since mutation narrowly to clear a date and cancel its notification source, use native date input and system clipboard/share APIs, and scope editable partner details to the currently active relationship generation.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, Convex, Clerk Expo, Vitest.

---

## Source-to-native parity checklist

| Web `app/(dashboard)/dashboard/partner/page.tsx` | Mobile target | Contract |
|---|---|---|
| Generate a pairing code and show expiry | Primary pairing panel | `generatePairingCode` action and server-returned expiry |
| Copy/share generated code | Primary pairing panel | Native clipboard and system share sheet; never log/store code |
| Enter 6/12-character code | Partner pairing panel | Normalize whitespace/case, bound input to 12 chars, let server validate and consume |
| Revoke partner access | Active primary view | Existing mutation and access resolver remain authoritative |
| Relationship date and anniversary | Active relationship view for both members | Existing `getCoupleStatus` DTO and `updateConnectedSinceDate` |
| Private partner nickname | Active relationship view for both members | Existing viewer-local `partner.nickname` and `updatePartnerNickname` |
| Sharing settings | Active primary view | Existing `updateSharingSettings` state remains server-backed |

No Convex schema, query, authorization, or dashboard cycle projection changes are in scope. The existing connected-since mutation accepts an empty string to clear the optional date, preserves a monotonically increasing setting version, and cancels the previous source notification without creating a replacement event.

## Task 1: Extend the typed mobile API boundary

**Files:**
- Modify: `apps/mobile/src/convex/api.d.ts` (public `mutations.couples` declarations)
- Modify: `apps/mobile/src/convex/api.inventory.ts`
- Modify: `apps/mobile/src/convex/api.parity.test-d.ts`
- Test: existing API inventory and parity tests under `apps/mobile/src/convex/`

**Steps:**
1. Add public type-only references for `couples.updateConnectedSinceDate({ connectedSinceDate: string })` and `couples.updatePartnerNickname({ nickname: string })`, matching Convex server args and return DTOs exactly.
2. Add both references to the inventory and both mobile/server sides of the parity fixture.
3. Run the focused API inventory/parity tests and mobile typecheck; resolve only contract drift introduced by these entries.

**Verification:** `npm --prefix apps/mobile test -- --run src/convex` and `npm run mobile:typecheck` → PASS.

## Task 2: Add focused pairing input and relationship detail behavior

**Files:**
- Modify: `apps/mobile/src/features/partner/PartnerControls.tsx`
- Modify: `apps/mobile/src/features/partner/partner.test.ts`
- Modify: `convex/mutations/couples.ts`
- Test: `convex/mutations/couples.test.ts`
- Create: `apps/mobile/src/features/partner/partnerDetails.ts` (pure normalization/date/presentation helpers only if needed for focused tests)
- Test: `apps/mobile/src/features/partner/partner.test.ts`

**Steps:**
1. Add failing tests for code normalization (trim, case normalization, allowed lengths 6/12, reject other lengths), anniversary/date display, nickname length/clear semantics, and connected-since date clearing/cancellation.
2. Run the focused partner tests and confirm the new cases fail.
3. Implement the smallest helper/UI changes: primary and partner active relationship detail fields, connected date picker/save/clear, nickname edit/save/clear, anniversary display, and role-based controls. Extend only the existing Convex date mutation to accept clear, remove the optional date field, retain the version tombstone, and cancel pending source deliveries.
4. Keep the active partner view keyed and gated by current `relationshipGeneration`; render private nickname only from server-returned viewer DTO and never broadcast the local input.
5. Run focused partner tests and typecheck.

**Verification:** `npm --prefix apps/mobile test -- --run src/features/partner/partner.test.ts src/features/partner/PartnerControls.interactions.test.tsx`, `npm run test:unit -- convex/mutations/couples.test.ts`, and `npm run mobile:typecheck` → PASS.

## Task 3: Native pairing-code copy/share and full PR evidence

**Files:**
- Modify: `apps/mobile/package.json` and `apps/mobile/package-lock.json` (add Expo SDK-compatible `expo-clipboard`)
- Modify: `apps/mobile/src/features/partner/PartnerControls.tsx`
- Modify: `apps/mobile/src/features/partner/partner.test.ts`
- Test: `apps/mobile/src/features/partner/PartnerControls.interactions.test.tsx`

**Steps:**
1. Add failing checks for accessible copy/share actions, expiry display, disabled states, and no code leakage to logs.
2. Install SDK-compatible `expo-clipboard`; use `Clipboard.setStringAsync` and React Native `Share.share` for native actions.
3. Normalize code before submission; do not trust local length checks as server authorization. Surface safe failures and retain no more code in React state than needed for the active pairing view.
4. Run focused partner interaction/helper tests, Convex date-clearing tests, mobile typecheck, root typecheck, `git diff --check`, and API parity tests.
5. Review the final diff against this checklist and prepare a PR description containing the exact changed API contract inventory, focused verification output, and one deferred synthetic live-QA scenario.

**Verification:** `npm --prefix apps/mobile test -- --run src/features/partner/partner.test.ts src/features/partner/PartnerControls.interactions.test.tsx`, `npm run test:unit -- convex/mutations/couples.test.ts`, `npm run mobile:typecheck`, `npm run typecheck`, `git diff --check` → PASS.

## Deferred synthetic live-QA scenario

After the CB-01/02/03 stack is integrated: a synthetic primary creates, copies and shares a code; a synthetic partner links; both see the server-provided relationship date/anniversary; each changes their own nickname and confirms the other account does not see it; primary changes sharing then revokes; both clients confirm stale relationship details and private views disappear after the relationship-generation/access update.

Do not run an emulator/device cycle for this PR. Do not deploy or merge to `main`.
