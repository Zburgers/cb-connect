# Feature-First Delivery Implementation Plan

**Execution status:** Local implementation and complete qualification passed on
2026-08-19. PR/CI/production verification remain to be recorded.

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Make every green `main` merge deploy Convex and the qualified frontend automatically, while ensuring missing future decisions block only the tasks that depend on them.

**Architecture:** Keep the existing build-once artifact, production-target checks, PM2 promotion, readiness verification, and previous-release rollback. Remove manual promotion switches and allow the first managed release to establish the rollback chain. Reconcile roadmap documents around feature-first execution without removing product scope or the requirement for a detailed execution plan before each roadmap area.

**Tech Stack:** GitHub Actions, Bash policy tests, Next.js 15, Convex, PM2, Markdown roadmap documents.

---

### Task 1: Make green `main` builds deploy automatically

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/tests/deploy-workflow.test.sh`

**Step 1: Write the failing workflow-policy assertions**

Require the deploy job to run for a successful push-triggered `main` CI run without `PROMOTE_PRODUCTION`, and require Convex preflight, dependency installation, runtime-secret sync, target validation, and deployment without `DEPLOY_CONVEX` conditions. Add negative assertions that neither variable remains in the workflow.

**Step 2: Run the policy test and verify it fails**

Run: `bash scripts/tests/deploy-workflow.test.sh`

Expected: FAIL because `.github/workflows/deploy.yml` still references `PROMOTE_PRODUCTION` and `DEPLOY_CONVEX`.

**Step 3: Implement the minimal workflow change**

Remove the production-promotion variable from the job condition. Remove every `if: vars.DEPLOY_CONVEX == 'true'` condition so the existing validated Convex release path always runs after qualified `main` CI. Preserve exact selector checks, secret validation, serialized deployment, artifact verification, and post-deploy identity checks.

**Step 4: Run focused verification**

Run:

```bash
bash scripts/tests/deploy-workflow.test.sh
bash scripts/tests/ci-workflow.test.sh
npx actionlint .github/workflows/ci.yml .github/workflows/deploy.yml
```

Expected: all commands exit 0.

**Step 5: Commit**

```bash
git add .github/workflows/deploy.yml scripts/tests/deploy-workflow.test.sh
git commit -m "ci: deploy every qualified main release"
```

### Task 2: Bootstrap the managed rollback chain safely

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/tests/deploy-workflow.test.sh`
- Modify: `docs/runbooks/release-rollback.md`

**Step 1: Write the failing first-release assertions**

Require a missing `current` symlink to be classified as `first_release=true`, permit that exact case to continue, and reject malformed or out-of-root `current` pointers. Require later releases to verify the prior manifest before promotion. Assert that `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK` is absent.

**Step 2: Run the policy test and verify it fails**

Run: `bash scripts/tests/deploy-workflow.test.sh`

Expected: FAIL because the current workflow requires the manual first-promotion override.

**Step 3: Implement first-release behavior**

Change rollback-candidate resolution to emit `first_release=true` only when the managed `current` pointer is absent. Continue automatically for that case. Preserve hard failure for an invalid existing pointer or unverifiable previous manifest. Keep automatic rollback conditional on a verified prior release, and record the first verified release as `current` after live verification.

**Step 4: Update the rollback runbook**

Document that the first managed release establishes the rollback chain, subsequent releases retain automatic frontend rollback, and Convex changes must remain backward-compatible because frontend rollback does not reverse deployed data.

**Step 5: Run focused verification**

Run:

```bash
bash scripts/tests/deploy-workflow.test.sh
bash scripts/tests/package-release.test.sh
bash scripts/tests/verify-release.test.sh
bash scripts/tests/pm2-config.test.sh
```

Expected: all commands exit 0, including first-release, prior-release, and malformed-pointer fixtures.

**Step 6: Commit**

```bash
git add .github/workflows/deploy.yml scripts/tests/deploy-workflow.test.sh docs/runbooks/release-rollback.md
git commit -m "ci: bootstrap first managed production release"
```

### Task 3: Reconcile the roadmap around feature-first execution

**Files:**
- Modify: `docs/plans/2026-08-01-cb-connect-major-release-program.md`
- Modify: `docs/plans/2026-08-01-01-production-reliability-foundation.md`
- Modify: `docs/plans/2026-08-01-02-trustworthy-cycle-facts.md`
- Modify: `docs/plans/2026-08-12-gate-1-trustworthy-cycle-facts-execution.md`
- Modify: `docs/handoffs/2026-08-06-gate-0-to-gate-1.md`
- Modify: `docs/evidence/reliability-gate-0/REPORT.md`
- Modify: `docs/decisions/major-release-decision-register.md`
- Modify: `docs/plans/README.md`
- Modify: `issues.md`

**Step 1: Add a failing consistency scan**

Create a temporary review command that reports stale global blockers:

```bash
rg -n "Gate 1 remains blocked|Gate 1 is blocked|28-day.*block|not executable|PROMOTE_PRODUCTION|ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK|DEPLOY_CONVEX" \
  docs/plans docs/handoffs docs/evidence/reliability-gate-0 docs/decisions issues.md
```

Expected: matches identify status text that conflicts with the approved feature-first design.

**Step 2: Update authority and status**

Make `2026-08-19-feature-first-delivery-design.md` the operating-policy authority. Mark Gate 0 engineering complete, keep operational measurements as non-blocking follow-up, and make the existing Gate 1 execution plan executable for additive, default-off, non-destructive work.

**Step 3: Preserve actual product scope and planning discipline**

Retain Gates 1-6 and the ML research track. Retain the requirement for a detailed execution plan before implementing each roadmap area. Replace global decision blocking with the rule that a missing decision blocks only its dependent task. Keep D-012 blocking destructive deletion/migration behavior, not additive Gate 1 work.

**Step 4: Remove duplicated approval machinery**

Point readers to CI, deployment runs, and Git history as default evidence. Keep the existing historical Gate 0 evidence intact, clearly labeled as historical closeout rather than a live feature-development gate.

**Step 5: Run documentation checks**

Run:

```bash
rg -n "Gate 1 remains blocked|Gate 1 is blocked|not executable" docs/plans docs/handoffs issues.md
rg -n "PROMOTE_PRODUCTION|ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK|DEPLOY_CONVEX" docs README.md DEPLOYMENT.md
git diff --check
```

Expected: no active-status or manual-promotion instructions remain; historical references are explicitly labeled and do not instruct operators to set removed variables; `git diff --check` exits 0.

**Step 6: Commit**

```bash
git add docs/plans docs/handoffs/2026-08-06-gate-0-to-gate-1.md docs/evidence/reliability-gate-0/REPORT.md docs/decisions/major-release-decision-register.md issues.md README.md DEPLOYMENT.md
git commit -m "docs: unblock feature-first roadmap execution"
```

### Task 4: Qualify and ship the simplified delivery path

**Files:**
- Modify only if verification exposes a defect in the files changed above.

**Step 1: Run the complete local qualification**

Run:

```bash
npm ci
npm run build
npm run typecheck
npm run test:unit -- --run
npm audit --omit=dev
bash scripts/tests/ci-workflow.test.sh
bash scripts/tests/deploy-workflow.test.sh
bash scripts/tests/package-release.test.sh
bash scripts/tests/pm2-config.test.sh
bash scripts/tests/verify-release.test.sh
bash scripts/tests/rehearse-rollback.test.sh
bash scripts/tests/auth-fixtures.test.sh
bash scripts/tests/release-smoke-workflow.test.sh
bash scripts/tests/standalone-runtime.test.sh
git diff --check
```

Expected: every command exits 0.

**Step 2: Review the branch diff**

Run: `git diff --stat origin/main...HEAD && git diff --check origin/main...HEAD`

Expected: changes are limited to delivery policy, its tests/runbook, and roadmap-status reconciliation.

**Step 3: Push and open the pull request**

```bash
git push -u origin plan/feature-first-delivery
gh pr create --base main --head plan/feature-first-delivery --title "Simplify delivery and unblock feature work" --body-file /tmp/cb-connect-feature-first-pr.md
```

Expected: a PR URL is returned and production remains unchanged until the PR is reviewed, green, and merged.

**Step 4: Merge after green protected checks**

Merge only when deterministic qualification and authenticated release smoke pass. The resulting green `main` run automatically deploys Convex and the qualified frontend, verifies the live release, and establishes or advances the managed rollback pointer.

**Step 5: Verify the live deployment**

Run read-only checks against `https://cb.nakshatraneuratech.dev/api/health` and `/api/ready`, then inspect the GitHub deployment run and managed `current` release pointer.

Expected: health is 200, readiness is 200 with matching frontend/backend compatibility identity, the deployment run is green, and `current` resolves inside `/home/naki/cb-connect-releases/releases/`.
