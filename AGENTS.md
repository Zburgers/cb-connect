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

### Feature-first delivery contract

- Read `docs/plans/2026-08-19-feature-first-delivery-design.md` and the current
  dated execution plan before roadmap implementation.
- Keep one proper, ordered execution plan per major roadmap area. A missing
  decision blocks only its dependent task, not unrelated default-off or
  non-destructive work.
- Every green `main` CI run automatically deploys Convex and the exact qualified
  frontend artifact. Preserve exact target validation, secrets isolation,
  backward-compatible data changes, readiness verification, and previous-
  release rollback.
- Gate 0 evidence and `docs/execution/gate-0-agent-log.md` are historical and
  append-only. Do not use their former promotion switches or blocked status as
  current operating instructions.
- D-012 blocks destructive deletion/migration behavior until resolved. It does
  not block additive Gate 1 schema, helpers, tests, compatibility, or feature-
  flagged UI work.

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

## Shared local toolchains

Verified on the shared Linux host on 2026-10-27. Check these user-wide installs before downloading or installing another copy; separate agents and worktrees on this host can reuse them.

### Node and npm

- Root CI uses Node `20.19.1` / npm `10.8.2`.
- Mobile CI uses Node 22 / npm 11. This host has Node `22.23.1` / npm `11.21.1` installed in the shared `nvm` directory.
- Activate the existing versions from the repository root or mobile directory as appropriate:

  ```sh
  source /home/naki/.nvm/nvm.sh
  nvm use --delete-prefix 20.19.1 --silent # root
  nvm use --delete-prefix 22.23.1 --silent # apps/mobile
  ```

- `--delete-prefix` avoids this host's npm prefix/globalconfig warning in the active shell; do not rewrite the user's npm config to work around it.
- npm's shared package-download cache is `/home/naki/.npm/_cacache` (2.4 GB after the 2026-10-27 cleanup). The transient `_npx` execution cache (4.29 GiB before cleanup) was removed after checking there were no active users; npx tools can be recreated from package cache or fetched again. Run `npm ci` against each lockfile for reproducible installs. Keep each worktree's `node_modules` isolated; do not globally install app dependencies or share a `node_modules` directory between worktrees. Inspect for active npm/npx processes before pruning shared caches.
- Gradle's shared cache is `/home/naki/.gradle/caches` (3.6 GB at the 2026-10-27 check). Preserve it for other builds; check for active Gradle work before pruning.

### Android and Java

- Android SDK: `/home/naki/Android/Sdk`. Installed components include platforms 36 and 37.0, build-tools 35.0.0 and 36.0.0, command-line tools, platform-tools, emulator, and NDK 27.1.12297006. `sdkmanager` is at `/home/naki/Android/Sdk/cmdline-tools/latest/bin/sdkmanager`. On this host its inventory command bootstrapped `/home/naki/.android/bin/android-cli`; avoid invoking the legacy wrapper just to inspect packages.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are not set by default. For this app's Android build, the existing Gradle-provisioned JDK 17 at `/home/naki/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2` passed `assembleDebug` for the Pixel 7 emulator (`x86_64`, SDK 36, Build Tools 36.0.0, NDK 27.1.12297006) on 2026-10-27. Reuse it in the task shell:

  ```sh
  export ANDROID_HOME=/home/naki/Android/Sdk
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  export JAVA_HOME=/home/naki/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2
  export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
  ```

- The remaining Homebrew JDK is OpenJDK `27` at `/home/linuxbrew/.linuxbrew/opt/openjdk`; Homebrew `gradle` and `apktool` depend on it, so keep it. OpenJDK `21` was removed on 2026-10-27 after confirming no Homebrew dependents or running processes used it. System Java `25` is RPM-managed and has no `javac`; do not remove it as a project JDK. Check current React Native/Gradle requirements before selecting a JDK for other projects or installing another copy.
- The available `Pixel_7` is an Android emulator, not a physical device. Emulator presence alone is not device qualification.
