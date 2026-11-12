# Shipyard Lessons Learned

## [2026-10-26] Phase Gate 5: ATLAS Mobile Foundation Qualification

### What Went Well
- Running the hosted Clerk flow only against the approved development issuer and target-bound Convex deployment verified real sign-in, refresh, logout, account switching, and cleanup without touching production.
- Recording the Android gated-state screenshots, fixture deletion readback, exact commit, remote head, CI results, and two independent reviews made the qualification auditable.

### Surprises / Discoveries
- Clerk's `iss` belongs to its instance and cannot be changed by a JWT template; a tampered token or a trailing-slash URL is not a valid foreign-issuer test. With only one test instance, an owner-approved, ephemeral RSA-signed `.invalid` issuer rejected live with Convex `NoAuthProvider` is useful evidence, but does not test another hosted issuer's JWKS behavior.
- Mobile `npm audit --omit=dev` can include Expo CLI and other packages that are not in the exported Android bundle; use the Metro source map to check bundle reachability, while keeping the installed toolchain risk visible.

### Pitfalls to Avoid
- Keep test credentials in ignored local files: the primary checkout's `.env.auth-test.local` (mode 600) holds the test Clerk/Convex secrets and target values; `scripts/with-auth-test-env.ts` reads it relative to itself, pins the approved deployment, and removes production credential variables. For an isolated worktree, invoke that primary-checkout wrapper with the worktree script's absolute path instead of copying keys; local Expo settings stay in ignored `apps/mobile/.env.local` (mode 600), and secret values never go in logs or commits.
- A Clerk secret key is not a Platform API key, and an existing Clerk CLI login does not imply Platform API access; identify the exact missing permission once instead of repeating browser sign-in attempts.
- UI snapshots can expose password-field labels; feed fixture credentials through stdin, avoid raw snapshots while a secret field is active, and delete plus verify synthetic fixtures if any credential-bearing diagnostic escapes.

### Process Improvements
- Before auth testing, verify the repository/worktree, branch and full SHA, exact Convex deployment, and effective Clerk issuer through the target-bound wrapper; after testing, verify fixture/session cleanup and redact evidence.
- Reuse green tests and reviews only for the exact commit they cover; rerun or request a new review when the SHA changes or a check fails, not for repeated status updates. Report skipped release-only jobs separately from passing qualification checks.

---

## 2026-08-20 Phase Gate 1: Trustworthy Cycle Facts

### What Went Well
- Keeping cycle facts additive, Convex-authoritative and flag-off by default allowed the implementation to qualify without authorizing production exposure.

### Surprises / Discoveries
- A legacy reason must dominate exact-looking certainty fields on reads; partially annotated historical rows can otherwise become prediction inputs.

### Pitfalls to Avoid
- Never use a server or runner timezone as a fallback for an identified user's calendar date, and never treat a configured duration or later start as an observed end.

### Process Improvements
- Reconcile the dated plan, decision register, evidence report and issue tracker together before opening the PR so implementation status and remaining Gate 2 work cannot drift.

---

## 2026-09-20 Phase Gate 3: Personalized Prediction Planning

### What Went Well
- Product/model behavior was grilled before implementation: personalization, variability, partner-assisted evidence, missing logs, segmentation, confidence, external-data use, model selection, and partner projection are now explicit instead of being left to an implementation agent.
- The benchmark protocol was frozen before real candidate outcomes, preserving a clean development/calibration/locked-evaluation separation.

### Surprises / Discoveries
- The Gate 3 gate-level plan still contained stale pending-primary-confirmation language even though D-009 and the current partner-assisted write path accept authorized partner assistance immediately.
- Gate 3 assumed an active history segment, but current main only implements prediction pause; the private segmentation primitive still needs to be built.
- Open-access papers do not imply their underlying app datasets are redistributable or transferable to CB Connect.

### Pitfalls to Avoid
- Do not turn an internal quality score into a user-visible probability. Only calibrated interval coverage may use probabilistic language.
- Do not let one long/suspicious interval silently become two invented cycles, and do not delete it to improve metrics.
- Do not tune eligibility, subgroup definitions, estimator candidates, calibration rules, or promotion thresholds after opening the locked holdout.
- Do not insert external population-trained parameters into the Gate 3 point predictor; that belongs to Research Gate 7.

### Process Improvements
- Treat the design freeze, literature review, G3-BENCH-V1 protocol, and dated execution plan as one atomic planning packet.
- A missing D-013 authority blocks only real outcome evaluation/promotion; synthetic/golden benchmark machinery and default-off application implementation may proceed.

---
