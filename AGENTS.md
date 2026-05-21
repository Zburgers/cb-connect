# AGENTS

<skills_system priority="1">

## Project Context

This repository is a Next.js App Router application for CB Connect, a couples cycle-tracking app.

### Stack

- Next.js 15.2.x
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
- The repo currently has minimal root documentation beyond this file and `README.md`, so project-specific instructions should live here.

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
