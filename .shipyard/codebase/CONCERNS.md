# CB Connect concerns and operational risks

## High-risk paths

- Authentication spans Clerk middleware, Clerk-to-Convex token wiring, Convex identity derivation, and webhook synchronization (`middleware.ts`, `lib/ConvexClientProvider.tsx`, `convex/_helpers/auth.ts`, `app/api/webhook/clerk/route.ts`). Any one-user/two-user claim requires authenticated testing.
- Couple privacy depends on server-side membership and sharing checks across period, pain, presence, and message functions (`convex/_helpers/coupleSpace.ts`, `convex/queries/`, `convex/mutations/`). Treat UI hiding as presentation only.
- Presence and chat are high-churn state. They use dedicated tables, but browser lifecycle events and real-time receipt updates need mobile/desktop smoke coverage (`convex/schema.ts`, `components/partner/PartnerChat.tsx`, `convex/mutations/presence.ts`, `convex/mutations/messages.ts`).

## Delivery risks

- Local build success does not establish Clerk authentication, Convex production connectivity, webhook delivery, or PM2 persistence (`DEPLOYMENT.md`).
- The first baseline typecheck raced `.next/types`; the stable order is build, then typecheck, then tests as appropriate.
- `issues.md` records pending authenticated chat production verification, cron verification, and signup fixture work. These remain explicit release gates until fresh evidence closes them.

## Shipyard/Codex compatibility

- The installed Shipyard plugin manifest exposes skills only and declares no command registry (`.codex` plugin manifest is external to this repository). Codex therefore cannot expose Claude-style `/shipyard:*` commands from project files.
- The supported equivalent is invoking the relevant Shipyard skill in the Codex session and storing project state under `.shipyard/`. This initialization uses `config.json` plus the codebase map; no fake shell aliases are added that would claim to dispatch unavailable UI commands.
