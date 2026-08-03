# Shipyard in this Codex checkout

This dirty checkout contains project-local Shipyard 4.12.4 configuration and a codebase map under `.shipyard/`. Those files are currently planning work that must be reviewed and committed deliberately. Resumable Shipyard workflow state is not present because `.shipyard/STATE.json`, `HISTORY.md`, `ROADMAP.md` and `PROJECT.md` are absent. The installed plugin provides skills, not Claude Code slash-command registrations.

## How to run workflows here

Use the corresponding Shipyard skill by name in Codex. The practical mappings are:

| Claude-style command | Codex equivalent |
| --- | --- |
| `/shipyard:init` | Review the existing `.shipyard/config.json` and codebase map; create state only when an approved workflow requires it |
| `/shipyard:map` | `shipyard:shipyard-map` |
| `/shipyard:status` | `shipyard:shipyard-state` and an explicit state read |
| `/shipyard:verify` | `shipyard:shipyard-verification` |
| `/shipyard:review` | `shipyard:shipyard-review` |
| `/shipyard:audit` | `shipyard:security-audit` |
| `/shipyard:plan` | `shipyard:shipyard-writing-plans` |
| `/shipyard:build` | `shipyard:shipyard-executing-plans` |
| `/shipyard:ship` | `shipyard:shipyard-ship` |

Codex runs multi-agent Shipyard phases as inline sequential roles because it has no Claude `Task`/slash-command runtime. Adding a project-local alias can provide a reminder, but it cannot register commands in the Codex UI or invoke a skill automatically; this project therefore keeps the mapping explicit instead of adding a misleading wrapper.

The canonical planning dashboard is `docs/plans/README.md`. Do not invent state merely because the repository has a config/map; load or create state only according to the native Shipyard state guidance and the user's authorized workflow.

## Local quality gates

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:e2e
```

For authenticated flows, configure Clerk/Convex credentials and the Playwright auth state before treating E2E output as representative.
