# CB Connect architecture map

## Request and data flow

```text
Browser -> ClerkProvider / middleware -> App Router pages
        -> ConvexProviderWithClerk -> authenticated Convex queries and mutations
Clerk webhook -> Svix verification -> Convex user synchronization
Convex crons/actions -> internal user-scoped data access -> notification logging/delivery
```

## Boundaries

- Public and auth pages live in `app/page.tsx` and `app/(auth)/`; the landing page redirects signed-in users to `/dashboard`.
- `app/(dashboard)/layout.tsx` is the authenticated shell. It ensures the user exists, redirects incomplete onboarding, sends presence heartbeats, and mounts the partner chat launcher.
- `app/onboarding/page.tsx` writes the selected role and, for primary users, initial cycle settings before routing into the dashboard.
- Dashboard pages compose domain components from `components/dashboard/` and `components/partner/`, while Convex modules own authorization and persistence.
- `convex/_helpers/` contains shared authorization, couple-space, date, and cycle-calculation logic. The database model is defined in `convex/schema.ts`.

## Core user journeys

1. Unauthenticated visitor: `/` -> Clerk sign-in/sign-up.
2. New user: protected route -> `ensureUser` -> `/onboarding` -> role selection.
3. Primary user: optional period setup -> `/dashboard` -> pairing code generation.
4. Partner user: onboarding -> `/dashboard/partner` -> six-digit code entry -> linked couple.
5. Linked couple: sharing controls, partner view, presence, bounded private messages, reactions, and delivery/read state.
6. Operations: `/api/health` for liveness and `/api/webhook/clerk` for verified identity synchronization.

Authorization is enforced in Convex through the authenticated identity and couple membership helpers; UI state is not the security boundary (`convex/_helpers/auth.ts`, `convex/_helpers/coupleSpace.ts`).
