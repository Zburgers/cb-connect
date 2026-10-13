## Current Task
Continue Gate 4 core implementation on branch `gate-4/contract-and-integration` in `/home/naki/Desktop/Devsandbox/worktree/cb-connect/gate-4-contract-and-integration`. The approved plan is `docs/plans/2026-09-27-gate-4-event-privacy-retention-execution.md`. The work currently freezes N1 event taxonomy and the initial N1b delivery contract; Gate 4 is not complete.

The contract checkpoint before this handoff is `47770f150ded9eea91615262b194ff79deb46e78` (`feat: freeze G4 delivery contract`), preceded by `4191fb3` (event catalog) and `38c7531` (plan approval). The branch descends from current `origin/main` and includes required Gate 3 ancestor `275b4075f00e3c95ca6662f1e9be5a9ad0ff3c8b`.

## Approach
Follow the approved dated execution plan as the contract freeze. Re-fetch `origin`, inspect current PR/file ownership and issues before shared-file edits, and re-read `AGENTS.md`, the plan/index, decision register, and `convex/_generated/ai/guidelines.md` before Convex edits. Use additive, indexed, default-off changes only. Do not enable production prediction flags or any Gate 4/external delivery flag. No external provider adapter or health Discord delivery is allowed. Keep recipient user identity separate from destination identity; keep event, inbox item, logical delivery, and attempt as distinct concepts. Do not make retention/deletion or production exposure claims while D-012 is open; D-011 gates health-adjacent copy exposure, D-015 gates pilot sizing.

The delivery contract already restricts rendering to code-owned copy keys and defines strict record validators. Event, logical-delivery, and provider idempotency scopes are distinct; a delivery retry is not the source of truth. It does not claim exactly-once physical delivery.

## Tried
- Confirmed the approved plan and implementation-base ancestry on current `origin/main`; Gate 3 merge `275b4075f00e3c95ca6662f1e9be5a9ad0ff3c8b` is an ancestor.
- Confirmed no uncommitted code changes were present before writing this handoff.
- Ran `npx vitest run convex/_helpers/notificationTypes.test.ts convex/_helpers/notificationDelivery.test.ts`: 2 files and 22 tests passed.
- Ran `npm run typecheck`: passed.
- Ran `git diff --check origin/main...HEAD`: passed before adding this handoff.
- The handoff commit and remote push are recorded in Git history after this document is added.

## Remaining
1. Resume N2a using TDD: add additive schema, strict validators, recipient-scoped mutations/queries, bounded indexes, default-off preferences/controls, and synthetic fixture cleanup as specified. Recheck shared-file ownership first.
2. Implement N2c recovery policy and source-authority helpers/tests, including finite operational limits, fencing/retry/unknown behavior, kill switches, current authorization, and external-channel denial. Freeze and validate the lane interfaces.
3. Only after N2a/N2c are green, publish the exact contract checkpoint for CHRONOS/MUSE as the plan specifies. Do not claim `G4 N1/N2 CONTRACT FREEZE READY` until those requirements are met.
4. Continue N2d/N2e, then N3 transactional domain outbox and N6 Discord shutdown in the approved dependency order. Do not take CHRONOS scheduler or MUSE template/UI ownership outside the documented integration handoffs.
5. Reconcile issues #9/#11/#12 against the final architecture; finish N2b fixture cleanup and remaining integration work. Run focused and full applicable validation, inspect the final diff, record rollback/evidence, and open the focused PR only when the core branch is green and review-ready.

## Open Questions
No owner decision blocks the safe additive/default-off engineering tasks above. D-011 still requires qualified content approval before health-adjacent copy is enabled; D-012 still requires privacy/legal and product authority for retention/deletion and affected production exposure; D-015 still requires product/operator approval before a pilot. Keep these as explicit dependent blockers and continue unrelated safe work. D-013 continues to block real-outcome evaluation/promotion and accuracy claims; it does not authorize changing any Gate 3 production flag.
