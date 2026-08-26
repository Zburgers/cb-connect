# CB Connect - Project Context

## Project Overview

**CB Connect** is a real-time couples cycle tracking and support web application built with Next.js 15, Convex, and Clerk. The application enables partners to track menstrual cycles, log pain symptoms, and receive phase-specific health guidance with a consent-based data sharing model.

### Core Features
- **Cycle Tracking**: Period event logging with automatic phase detection (menstruation, follicular, ovulation, luteal)
- **Pain Logging**: Daily pain score tracking (0-10) with symptom tags and notes
- **Partner Linking**: 6-digit pairing code system for connecting couples
- **Real-time Dashboards**: Synchronized views for primary users and partners
- **Smart Suggestions**: Context-aware pain management tips and nutrition recommendations
- **Discord Notifications**: Automated notifications via webhooks for key events

### Architecture
- **Frontend**: Next.js 15 (App Router) with React 19
- **Backend**: Convex (serverless real-time database with built-in subscriptions)
- **Authentication**: Clerk (OAuth with Google, session management)
- **Styling**: Tailwind CSS with shadcn/ui component patterns
- **Language**: TypeScript (strict mode)

---

## Building and Running

### Prerequisites
- Node.js 18+ 
- npm/pnpm
- Clerk account (for authentication)
- Convex account (for backend)

### Environment Setup

Create a `.env.local` file with:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOYMENT=xxx
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

### Convex Setup

```bash
# Install Convex CLI globally
npm install -g convex

# Login to Convex
npx convex login

# Deploy Convex functions
npx convex dev

# Seed initial data (pain tips, nutrition tips)
# Run in Convex dashboard or via mutation
```

---

## Project Structure

```
cb-connect/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes (sign-in, sign-up)
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── dashboard/            # Main dashboard page
│   │   └── layout.tsx            # Dashboard layout wrapper
│   ├── api/                      # API routes
│   ├── globals.css               # Global styles + CSS variables
│   ├── layout.tsx                # Root layout (Clerk + Convex providers)
│   └── page.tsx                  # Landing page
├── components/
│   ├── common/                   # Shared UI components
│   │   ├── ErrorBoundary.tsx
│   │   └── LoadingSpinner.tsx
│   ├── dashboard/                # Primary user dashboard components
│   │   ├── CurrentPhase.tsx      # Cycle phase display
│   │   ├── NutritionSuggestions.tsx
│   │   ├── OnboardingFlow.tsx
│   │   ├── PainLogger.tsx        # Pain score input
│   │   └── TipsCard.tsx          # Pain tip display
│   └── partner/                  # Partner view components
│       └── PartnerDashboard.tsx
├── convex/                       # Convex backend
│   ├── _generated/               # Auto-generated Convex types
│   ├── _helpers/                 # Auth & permission helpers
│   ├── actions/                  # External actions (Discord webhooks)
│   │   ├── discord.ts
│   │   └── notifications.ts
│   ├── mutations/                # Write operations
│   │   ├── couples.ts            # Partner linking logic
│   │   ├── misc.ts               # Utility mutations
│   │   ├── painLog.ts            # Pain logging
│   │   ├── periods.ts            # Period tracking
│   │   └── users.ts              # User management
│   ├── queries/                  # Read operations
│   │   ├── couples.ts
│   │   ├── dashboard.ts          # Dashboard data aggregation
│   │   ├── history.ts
│   │   └── users.ts
│   ├── auth.config.ts            # Clerk provider config
│   ├── crons.ts                  # Scheduled jobs
│   ├── schema.ts                 # Database schema definition
│   └── seed.ts                   # Data seeding
├── lib/
│   ├── ConvexClientProvider.tsx  # Convex + Clerk integration
│   └── utils.ts                  # Utility functions (cn, date helpers)
├── docs/
│   └── cb-connect-technical-prd.md  # Full technical specification
├── middleware.ts                 # Next.js middleware (auth protection)
├── next.config.js
├── tailwind.config.js            # Theme config + semantic colors
└── tsconfig.json                 # TypeScript config (strict mode)
```

---

## Database Schema

### Core Tables

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | User profiles (linked to Clerk) | `by_clerk_id`, `by_email` |
| `couples` | Couple linkage metadata | - |
| `coupleMembers` | User↔Couple membership + sharing settings | `by_couple`, `by_user`, `by_couple_and_role` |
| `pairingCodes` | 6-digit partner linking codes | `by_code`, `by_couple`, `by_status_and_expiry` |
| `periodEvents` | Period start/end dates | `by_user`, `by_user_and_start` |
| `painLogs` | Daily pain scores + symptoms | `by_user`, `by_user_and_date` |
| `cycleSettings` | User's cycle/period length | `by_user` |
| `painTips` | Pain management content | `by_phase_and_severity` |
| `nutritionTips` | Nutrition suggestions | `by_phase` |
| `hiddenNutrition` | User-hidden nutrition tips | `by_user`, `by_user_and_tip` |
| `notificationLog` | Discord notification tracking | `by_user`, `by_sent_at` |

### Key Relationships
- 1 `couple` ↔ 2 `coupleMembers` (primary + partner)
- 1 `user` → many `painLogs`, `periodEvents`
- 1 `couple` → many `pairingCodes` (historical)

---

## Authentication & Authorization

### Clerk Integration
- **Provider**: Clerk with Google OAuth
- **Issuer URL**: `https://holy-clam-29.clerk.accounts.dev`
- **Protected Routes**: `/dashboard/*` (via `middleware.ts`)

### Authorization Flow
```typescript
// convex/_helpers/auth.ts pattern
const identity = await ctx.auth.getUserIdentity();
const user = await ctx.db
  .query("users")
  .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
  .unique();
```

### Permission Model
- **Primary users**: Can generate pairing codes, control sharing settings
- **Partner users**: View shared data based on primary's consent
- **Data visibility**: Enforced at query level via `coupleMembers.sharingPain` and `sharingPhase` flags

---

## Development Conventions

### TypeScript
- **Strict mode** enabled
- **Path aliases**: `@/*` maps to project root
- **No emit**: Type-checking only (Next.js handles compilation)

### Code Style
- **Functional components** with hooks
- **Server Components** by default, `"use client"` for interactivity
- **Convex patterns**:
  - Queries for reads (auto-subscribing)
  - Mutations for writes (optimistic updates)
  - Actions for external APIs (Discord webhooks)

### Component Patterns
```tsx
// Dashboard components follow this pattern:
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MyComponent() {
  const data = useQuery(api.queries.myQuery.getData, { param: value });
  
  if (!data) return <LoadingSpinner />;
  
  return <div>{/* render */}</div>;
}
```

### Utility Functions (`lib/utils.ts`)
- `cn(...classes)`: Tailwind class merger (clsx + tailwind-merge)
- `formatDate(dateString)`: Consistent date formatting
- `getPhaseEmoji(phase)`: Phase emoji mapping
- `getPhaseColor(phase)`: Phase-specific Tailwind classes

---

## Key Business Logic

### Cycle Phase Calculation
```typescript
// convex/_helpers/cycleCalculations.ts
menstruation:  cycleDay <= periodLength (days 1-5)
follicular:    periodLength < cycleDay <= 13 (days 6-13)
ovulation:     13 < cycleDay <= 16 (days 14-16)
luteal:        cycleDay > 16 (days 17+)
```

### Pain Severity Buckets
- **none**: 0
- **mild**: 1-3
- **moderate**: 4-6
- **severe**: 7-10

### Partner Linking Flow
1. Primary generates 6-digit code (24h expiry)
2. Partner enters code
3. System validates (not expired/used)
4. Creates `coupleMembers` records
5. Marks code as `used`
6. Real-time dashboard update

---

## Testing

### Browser Testing
Use the **playwright-cli** skill for browser automation and E2E testing:
- **Location**: `.claude/skills/playwright-cli/SKILL.md`
- **Quick start**: `playwright-cli open` to launch browser, then use `goto`, `click`, `fill`, `snapshot` commands
- **Snapshots**: After each command, a YAML snapshot shows current page state with element refs (e.g., `e15`)
- **Key commands**:
  ```bash
  playwright-cli open                          # Launch browser
  playwright-cli goto https://localhost:3000   # Navigate
  playwright-cli click e15                     # Click element by ref
  playwright-cli fill e5 "text"                # Fill input
  playwright-cli snapshot                      # Capture page state
  playwright-cli console                       # View console logs
  playwright-cli close                         # Close browser
  ```

### Other Testing
- **Unit tests**: Vitest (recommended per PRD)
- **E2E tests**: Playwright (`.playwright/` directory exists)

---

## Deployment

### Convex
```bash
bash scripts/convex-safe-exec production -- deploy
```

### Next.js (Vercel or custom)
```bash
npm run build
npm run start
```

### Environment Variables (Production)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `DISCORD_WEBHOOK_URL` (optional, for notifications)

---

## Common Tasks

### Add a new Convex mutation
1. Create file in `convex/mutations/` or add to existing module
2. Export typed mutation using `mutation` or `internalMutation`
3. Import via `api.mutations.moduleName.functionName` in components

### Add a new dashboard component
1. Create component in `components/dashboard/`
2. Use `useQuery` with appropriate query from `convex/queries/`
3. Handle loading states with `LoadingSpinner`
4. Add to `app/(dashboard)/dashboard/page.tsx`

### Modify database schema
1. Update `convex/schema.ts`
2. Run `npx convex dev` to sync
3. Add migration/seeding if needed

---

## References
- **Full PRD**: `docs/cb-connect-technical-prd.md`
- **Convex Docs**: https://docs.convex.dev/
- **Clerk Docs**: https://clerk.com/docs
- **Next.js 15**: https://nextjs.org/docs
