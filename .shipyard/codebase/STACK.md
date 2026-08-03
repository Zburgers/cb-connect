# CB Connect technology map

## Runtime and framework

- Next.js 15 App Router with React 19 and TypeScript (`package.json`, `app/`).
- Tailwind CSS with project CSS variables and Framer Motion for interaction polish (`tailwind.config.js`, `app/globals.css`, `package.json`).
- Clerk supplies authentication and middleware protection (`app/layout.tsx`, `middleware.ts`, `app/(auth)/`).
- Convex supplies the schema, queries, mutations, actions, cron jobs, and generated client API (`convex/schema.ts`, `convex/`, `lib/ConvexClientProvider.tsx`).

## Tooling

- `npm run dev` starts the Turbopack development server.
- `npm run build` performs the production Next.js build and type validation.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test:unit` runs Vitest and Convex tests; `npm run test:e2e` runs Playwright.
- Production-like serving uses port 6050 (`package.json`, `DEPLOYMENT.md`, `pm2.config.js`).

## External integrations

- Clerk JWTs are passed to Convex through `ConvexProviderWithClerk` (`lib/ConvexClientProvider.tsx`).
- Clerk webhooks are verified with Svix before syncing users to Convex (`app/api/webhook/clerk/route.ts`).
- Optional Discord/notification actions and Convex scheduled work are defined under `convex/actions/` and `convex/crons.ts`.
