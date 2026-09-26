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

## Gate 3 prediction seam

Current merged Gate 2 path:

```text
Gate 1 exact eligible facts
  -> cycleReadModel
  -> legacy configured PredictionBounds
  -> cycleState reducer
  -> primary/reduced partner presentation
```

Planned Gate 3 path:

```text
Gate 1 exact eligible facts
  -> private active prediction segment
  -> cycleIntervals
  -> predictionEstimators
  -> predictionIntervals + predictionQuality
  -> immutable prediction snapshot
  -> periodPrediction V2 / PredictionBounds V2
  -> existing cycleState reducer
  -> primary + reduced partner + notification projections
```

Architectural rules:

- `periodEvents` remains observation storage; predictions never become observed facts.
- `cycleState` remains the semantic state machine; Gate 3 replaces the bounds-generation seam rather than duplicating state logic.
- prediction segment metadata is primary-private and stored separately from events.
- snapshot core fields are immutable; later outcome/supersession information is append-only assessment data.
- partner output is a reduced server-side projection and never exposes private segment, residual, internal score, or research metadata.
- the notification action must consume the same versioned prediction source instead of maintaining independent date arithmetic.
- population-trained probabilistic modelling remains Research Gate 7 and outside the request path.
