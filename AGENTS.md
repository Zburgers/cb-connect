# AGENTS

<skills_system priority="1">

## Project Context

This repository is a Next.js App Router application for CB Connect, a couples cycle-tracking app.

### Stack

- Next.js 15.5.x
- React 19
- TypeScript
- Tailwind CSS
- Convex
- Clerk
- Lucide React
- Playwright for E2E tests

### Common Commands

- `npm run dev` - start the local Next.js dev server
- `npm run build` - production build
- `npm run start` - run the production server on port 6050
- `npm run serve` - alias for the production server on port 6050

### Important Paths

- `app/` - route handlers, layouts, and pages
- `app/(auth)/` - sign-in and sign-up flows
- `app/(dashboard)/` - authenticated dashboard routes
- `app/api/` - API routes and webhooks
- `convex/` - Convex schema, auth config, crons, and seed data
- `lib/` - shared client-side helpers and providers
- `docs/` - technical PRD and implementation plans
- `e2e/` - Playwright specs and manual test scripts

### Working Notes

- Prefer updating the existing App Router structure instead of introducing parallel routing patterns.
- Keep Clerk and Convex integration consistent with the current providers in `app/layout.tsx` and `lib/ConvexClientProvider.tsx`.
- Treat `docs/cb-connect-technical-prd.md` as product background, not as guaranteed current implementation truth.
- Always use variable-driven theme glass (`var(--color-glass)` and `var(--color-glass-border)`) for components with dynamic text instead of hardcoded white oklch values (like `oklch(100% 0 0 / 0.55)`). This prevents contrast-mismatch bugs where light text overlays light backgrounds in dark mode.
- Use `color: hsl(var(--foreground))` instead of `hsl(var(--muted-foreground))` for `.phase-badge` to guarantee badge readability on atmospheric-warm cards.
- The repo currently has minimal root documentation beyond this file and `README.md`, so project-specific instructions should live here.

### Gate 0 execution-log contract

- Current state: the Gate 0 implementation packet is closed, its report is
  blocked for production promotion, and Gate 1 is not plan-ready. Do not resume
  the old first-packet task sequence or create a Gate 1 execution plan from the
  gate-level document.
- Before any release or follow-on review, read `README.md`,
  `docs/plans/README.md`, `docs/evidence/reliability-gate-0/REPORT.md`, and
  `docs/handoffs/2026-08-06-gate-0-to-gate-1.md`.
- A push or merge must not imply production promotion. The deployment workflow
  remains disabled unless `PROMOTE_PRODUCTION=true`; do not set that variable,
  `ALLOW_FIRST_PROMOTION_WITHOUT_ROLLBACK`, or `DEPLOY_CONVEX` without a
  separately authorized release operation and the documented prerequisites.

- Before doing Gate 0 work, read `docs/execution/gate-0-agent-log.md`, the plan index, the Gate 0 detailed execution plan, and the decision register.
- Work only in the dedicated worktree `/home/naki/Desktop/itsthatnewshit/cb-connect-gate-0` on branch `gate-0/reliability-2026-08-04` unless the user explicitly approves a replacement.
- Use the worktree's ignored `.env.local` and its isolated Convex development deployment for local Convex work. Never infer permission to use production or copy production data/secrets into development.
- Append one `---`-delimited entry to `docs/execution/gate-0-agent-log.md` before every handoff, including read-only reviews and blocked attempts. Never rewrite, reorder, or delete prior entries.
- Each entry must record timestamp, agent/session identity when available, task/plan IDs, starting and ending commit, files changed, commands and outcomes, Convex deployment class (`dev`, `preview/test`, or `production`) without secrets, decisions made, unresolved blockers, and the exact next safe action.
- A successful command is evidence only for what it tested. Do not label Gate 0 or production ready unless the plan's complete exit evidence and approvals exist.

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>design-for-ai</name>
<description>|</description>
<location>project</location>
</skill>

<skill>
<name>playwright-cli</name>
<description>Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.</description>
<location>project</location>
</skill>

<skill>
<name>gstack</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>investigate</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>open-gstack-browser</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>plan-ceo-review</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>plan-design-review</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>plan-eng-review</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>qa</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>setup-gbrain</name>
<description>|</description>
<location>global</location>
</skill>

<skill>
<name>ship</name>
<description>|</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- shipyard-codex-compatibility -->

## Shipyard under Codex

- Use the installed native `Shipyard:*` skills directly. Do not tell contributors to run Claude-style `/shipyard:*` commands; this Codex harness does not expose that command surface.
- Do not invent Shipyard state, configuration keys, hooks, command registries, or plugin fields. Read the existing `.shipyard/` files and installed skill guidance before changing them.
- Keep Shipyard compatibility changes project-local unless the user explicitly asks to modify the global Codex installation or upstream plugin. Never edit the cached plugin as a workaround.

<!-- shipyard-codex-compatibility-end -->
