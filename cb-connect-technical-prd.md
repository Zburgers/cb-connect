# CB Connect - Technical Product Requirements Document (PRD)

**Version:** 1.0
**Last Updated:** January 31, 2026
**Status:** Draft for Review

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Data Schema](#data-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Core Features - Technical Specifications](#core-features---technical-specifications)
7. [API/Function Specifications](#apifunction-specifications)
8. [Real-time Sync & State Management](#real-time-sync--state-management)
9. [Notification System](#notification-system)
10. [Frontend Architecture](#frontend-architecture)
11. [Business Logic & Algorithms](#business-logic--algorithms)
12. [Error Handling & Validation](#error-handling--validation)
13. [Testing Strategy](#testing-strategy)
14. [Deployment & DevOps](#deployment--devops)
15. [Security Considerations](#security-considerations)
16. [Performance Requirements](#performance-requirements)
17. [Implementation Phases](#implementation-phases)

---

## 1. System Overview

### 1.1 Product Summary
CB Connect is a real-time web application that helps couples track menstrual cycles, manage pain, and receive phase-specific guidance. The system uses a consent-based sharing model where the primary user controls what health data is visible to their partner.

### 1.2 Technical Goals
- **Real-time synchronization** between primary user and partner dashboards
- **Sub-second latency** for data updates across all clients
- **Zero-setup deployment** leveraging serverless architecture
- **Type-safe** end-to-end development with TypeScript
- **Optimistic UI updates** for instant user feedback

---

## 2. Technology Stack

### 2.1 Core Technologies

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14+ (App Router) | Server components, optimal React patterns, built-in routing |
| **UI Framework** | React 18+ | Component-based architecture, hooks for state management |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **Backend** | Convex | Real-time database, serverless functions, built-in subscriptions |
| **Authentication** | Clerk | Managed Google OAuth, session management, webhook support |
| **Notifications** | Discord Webhooks | Simple push notification MVP via Discord channels |
| **Language** | TypeScript | Type safety across frontend and backend |
| **Deployment** | Docker Containerized Services + Convex Cloud | Containerized deployment for scalability and portability, global CDN via Convex |

### 2.2 Development Tools
- **Package Manager:** pnpm or npm
- **Version Control:** Git + GitHub
- **Code Quality:** ESLint, Prettier
- **Type Checking:** TypeScript strict mode
- **Testing:** Vitest (unit), Playwright (E2E)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────────┐                    ┌──────────────┐       │
│  │   Primary    │                    │   Partner    │       │
│  │  Dashboard   │                    │  Dashboard   │       │
│  │  (Next.js)   │                    │  (Next.js)   │       │
│  └──────┬───────┘                    └──────┬───────┘       │
│         │                                    │               │
└─────────┼────────────────────────────────────┼───────────────┘
          │                                    │
          │         Clerk Authentication       │
          │         ┌──────────────┐          │
          └────────►│ Clerk OAuth  │◄─────────┘
                    │  (Google)    │
                    └──────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
┌─────────▼──────────────────────────────────▼─────────┐
│               Convex Backend Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Queries    │  │  Mutations   │  │   Actions  │ │
│  │ (Read ops)   │  │ (Write ops)  │  │ (External) │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                  │                 │        │
│  ┌──────▼──────────────────▼─────────────────▼─────┐ │
│  │         Convex Real-time Database                │ │
│  │  (Auto-syncing, Reactive Subscriptions)          │ │
│  └────────────────────────────────────┬─────────────┘ │
└───────────────────────────────────────┼───────────────┘
                                        │
                    ┌───────────────────▼────────────┐
                    │   Discord Webhook Service      │
                    │   (Notification Delivery)      │
                    └────────────────────────────────┘
```

### 3.2 Data Flow Patterns

#### Write Flow (Primary User Logs Pain)
```
User Action → Optimistic UI Update → Convex Mutation → Database Write
                                              ↓
                                    Trigger Subscriptions
                                              ↓
                           ┌──────────────────┴──────────────┐
                           │                                  │
                   Primary Dashboard                  Partner Dashboard
                   (Re-render with                    (Auto-update if
                    confirmed data)                    sharing enabled)
                           │
                           ↓
                   Discord Webhook
                   (Async notification)
```

#### Read Flow (Partner Views Dashboard)
```
Partner Dashboard Load → Convex Query (with user permissions)
                              ↓
                    Check couple linkage + sharing settings
                              ↓
                    Return filtered data based on consent
                              ↓
                    Real-time subscription established
                              ↓
                    Auto-updates on any relevant changes
```

---

## 4. Data Schema

### 4.1 Convex Schema Definition

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User profiles linked to Clerk
  users: defineTable({
    clerkId: v.string(),        // Clerk user ID
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("primary"), v.literal("partner")),
    createdAt: v.number(),      // Unix timestamp
    lastActiveAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Couple linkage
  couples: defineTable({
    createdAt: v.number(),
    linkedAt: v.optional(v.number()),  // When partner successfully linked
    status: v.union(
      v.literal("pending"),    // Pairing code generated, waiting for partner
      v.literal("active"),     // Both users linked
      v.literal("revoked")     // Primary user revoked access
    ),
  }),

  // Couple membership (2 records per couple)
  coupleMembers: defineTable({
    coupleId: v.id("couples"),
    userId: v.id("users"),
    role: v.union(v.literal("primary"), v.literal("partner")),
    sharingPain: v.boolean(),   // Partner can see pain scores
    sharingPhase: v.boolean(),  // Partner can see cycle phase (default true)
    joinedAt: v.number(),
  })
    .index("by_couple", ["coupleId"])
    .index("by_user", ["userId"])
    .index("by_couple_and_role", ["coupleId", "role"]),

  // Pairing codes for partner linking
  pairingCodes: defineTable({
    code: v.string(),           // 6-digit numeric code
    coupleId: v.id("couples"),
    createdBy: v.id("users"),   // Primary user who generated it
    expiresAt: v.number(),      // Unix timestamp (24 hours from creation)
    status: v.union(
      v.literal("active"),
      v.literal("used"),
      v.literal("expired")
    ),
    usedBy: v.optional(v.id("users")),  // Partner who used it
    usedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_couple", ["coupleId"])
    .index("by_status_and_expiry", ["status", "expiresAt"]),

  // Period tracking events
  periodEvents: defineTable({
    userId: v.id("users"),
    startDate: v.string(),      // ISO date string "YYYY-MM-DD"
    endDate: v.optional(v.string()),  // null if period ongoing
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_start", ["userId", "startDate"]),

  // Daily pain logs
  painLogs: defineTable({
    userId: v.id("users"),
    date: v.string(),           // ISO date string "YYYY-MM-DD"
    painScore: v.number(),      // 0-10
    tags: v.array(v.union(
      v.literal("cramps"),
      v.literal("headache"),
      v.literal("back"),
      v.literal("fatigue"),
      v.literal("other")
    )),
    note: v.optional(v.string()),  // Max 140 chars (validated in mutation)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  // User cycle settings
  cycleSettings: defineTable({
    userId: v.id("users"),
    cycleLength: v.number(),       // 21-40 days (default 28)
    periodLength: v.number(),      // 2-8 days (default 5)
    lastUpdatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Content management for tips and nutrition
  painTips: defineTable({
    phase: v.union(
      v.literal("menstruation"),
      v.literal("follicular"),
      v.literal("ovulation"),
      v.literal("luteal")
    ),
    painSeverity: v.union(
      v.literal("none"),        // 0
      v.literal("mild"),        // 1-3
      v.literal("moderate"),    // 4-6
      v.literal("severe")       // 7-10
    ),
    title: v.string(),
    suggestions: v.array(v.string()),  // 2-4 bullet points
    safetyNote: v.string(),
    isActive: v.boolean(),
    priority: v.number(),       // For ordering multiple tips
  })
    .index("by_phase_and_severity", ["phase", "painSeverity", "isActive"]),

  nutritionTips: defineTable({
    phase: v.union(
      v.literal("menstruation"),
      v.literal("follicular"),
      v.literal("ovulation"),
      v.literal("luteal")
    ),
    foodItem: v.string(),
    reasoning: v.string(),      // One-liner explanation
    isActive: v.boolean(),
    priority: v.number(),
  })
    .index("by_phase", ["phase", "isActive"]),

  // User-specific hidden nutrition suggestions
  hiddenNutrition: defineTable({
    userId: v.id("users"),
    nutritionTipId: v.id("nutritionTips"),
    hiddenUntil: v.number(),    // Unix timestamp (30 days from hide action)
  })
    .index("by_user", ["userId"])
    .index("by_user_and_tip", ["userId", "nutritionTipId"]),

  // Discord notification log (optional, for debugging)
  notificationLog: defineTable({
    userId: v.id("users"),
    type: v.string(),           // "period_prediction", "partner_linked", etc.
    payload: v.any(),
    sentAt: v.number(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_sent_at", ["sentAt"]),
});
```

### 4.2 Derived Data (Computed in Queries)

The following data is **not stored** but computed on-the-fly:

- `currentPhase`: Calculated from most recent period + cycle settings
- `cycleDay`: Day number in current cycle
- `predictedNextPeriodStart`: Date range based on cycle length
- `phaseStartDate`, `phaseEndDate`: Dates for current phase boundaries

---

## 5. Authentication & Authorization

### 5.1 Clerk Integration

#### Setup
```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

#### Convex + Clerk Integration
```typescript
// convex/auth.config.js
export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ]
};
```

### 5.2 Authorization Patterns

#### User Context Helper
```typescript
// convex/_helpers/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
}

export async function getCoupleForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const membership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.neq(q.field("coupleId.status"), "revoked"))
    .first();

  return membership;
}
```

#### Permission Checks
```typescript
// convex/_helpers/permissions.ts
export async function canViewPainData(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  targetUserId: Id<"users">
): Promise<boolean> {
  // User can always view their own data
  if (viewerId === targetUserId) return true;

  // Check if viewer is partner with pain sharing enabled
  const targetMembership = await getCoupleForUser(ctx, targetUserId);
  if (!targetMembership) return false;

  const viewerMembership = await ctx.db
    .query("coupleMembers")
    .withIndex("by_couple_and_role", (q) =>
      q.eq("coupleId", targetMembership.coupleId).eq("role", "partner")
    )
    .filter((q) => q.eq(q.field("userId"), viewerId))
    .unique();

  return viewerMembership?.sharingPain ?? false;
}
```

---

## 6. Core Features - Technical Specifications

### 6.1 Pain & Period Logging

#### Technical Requirements
- **Idempotency:** Multiple logs for the same date should update, not duplicate
- **Validation:** Pain score 0-10, note max 140 chars, date not in future
- **Optimistic Updates:** UI updates immediately, rollback on error
- **Real-time Sync:** Partner dashboard updates if sharing enabled

#### Data Validation Rules
```typescript
// Validation schema
const PAIN_LOG_VALIDATION = {
  painScore: { min: 0, max: 10, type: 'integer' },
  note: { maxLength: 140, type: 'string', optional: true },
  tags: {
    maxItems: 5,
    allowedValues: ['cramps', 'headache', 'back', 'fatigue', 'other']
  },
  date: {
    format: 'YYYY-MM-DD',
    maxDate: 'today',
    minDate: '6 months ago' // Prevent backdating too far
  }
};

const PERIOD_EVENT_VALIDATION = {
  startDate: { format: 'YYYY-MM-DD', maxDate: 'today' },
  endDate: {
    format: 'YYYY-MM-DD',
    maxDate: 'today',
    mustBeAfter: 'startDate',
    maxDaysAfter: 10  // Sanity check
  }
};
```

### 6.2 Cycle Phase Detection

#### Phase Calculation Algorithm

```typescript
// convex/_helpers/cycleCalculations.ts

export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';

export interface CycleInfo {
  phase: CyclePhase;
  cycleDay: number;
  daysUntilNextPeriod: number;
  predictedNextPeriodStart: string;  // ISO date
  predictedNextPeriodEnd: string;    // ISO date range end
  phaseDescription: string;
}

export function calculateCycleInfo(
  lastPeriodStart: string,     // ISO date "YYYY-MM-DD"
  cycleLength: number,         // 21-40
  periodLength: number,        // 2-8
  today: string = new Date().toISOString().split('T')[0]
): CycleInfo {
  const lastPeriodDate = new Date(lastPeriodStart);
  const currentDate = new Date(today);

  // Calculate cycle day (1-indexed)
  const daysSinceLastPeriod = Math.floor(
    (currentDate.getTime() - lastPeriodDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const cycleDay = (daysSinceLastPeriod % cycleLength) + 1;

  // Determine phase using formulaic approach
  let phase: CyclePhase;
  let phaseDescription: string;

  if (cycleDay <= periodLength) {
    // Days 1-5 (assuming 5-day period)
    phase = 'menstruation';
    phaseDescription = 'Your period is here';
  } else if (cycleDay <= 13) {
    // Days 6-13 (follicular phase)
    phase = 'follicular';
    phaseDescription = 'Post-period recovery phase';
  } else if (cycleDay <= 16) {
    // Days 14-16 (ovulation window)
    phase = 'ovulation';
    phaseDescription = 'Ovulation window';
  } else {
    // Days 17+ (luteal phase until next period)
    phase = 'luteal';
    phaseDescription = 'Pre-period phase';
  }

  // Calculate next period prediction
  const daysUntilNextPeriod = cycleLength - cycleDay + 1;
  const nextPeriodDate = new Date(currentDate);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + daysUntilNextPeriod);

  const nextPeriodEndDate = new Date(nextPeriodDate);
  nextPeriodEndDate.setDate(nextPeriodEndDate.getDate() + periodLength - 1);

  return {
    phase,
    cycleDay,
    daysUntilNextPeriod,
    predictedNextPeriodStart: nextPeriodDate.toISOString().split('T')[0],
    predictedNextPeriodEnd: nextPeriodEndDate.toISOString().split('T')[0],
    phaseDescription,
  };
}

export function getPainSeverityBucket(score: number): 'none' | 'mild' | 'moderate' | 'severe' {
  if (score === 0) return 'none';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  return 'severe';
}
```

### 6.3 Partner Linking Flow

#### Sequence Diagram
```
Primary User                     Convex                      Partner User
     │                              │                              │
     │──Generate Pairing Code──────>│                              │
     │                              │                              │
     │<──Return 6-digit code────────│                              │
     │   (e.g., "847293")           │                              │
     │                              │                              │
     │   [Shares code via SMS/etc]  │                              │
     │─────────────────────────────────────────────────────────────>│
     │                              │                              │
     │                              │<──Enter code + Link──────────│
     │                              │                              │
     │                              │──Validate code───>           │
     │                              │  (not expired,               │
     │                              │   not used,                  │
     │                              │   exists)                    │
     │                              │                              │
     │                              │──Create couple membership──> │
     │                              │                              │
     │                              │──Mark code as used────>      │
     │                              │                              │
     │<──Real-time update: Partner linked                          │
     │                              │                              │
     │                              │<──Return success─────────────│
     │                              │                              │
     │                              │──Send Discord notification──>│
     │                              │   "Partner linked!"          │
```

#### Code Generation Algorithm
```typescript
// convex/mutations/generatePairingCode.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUser } from "./_helpers/auth";

export const generatePairingCode = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    // Ensure user is primary
    if (user.role !== "primary") {
      throw new Error("Only primary users can generate pairing codes");
    }

    // Check if user already has an active couple
    const existingMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    let coupleId;

    if (existingMembership) {
      coupleId = existingMembership.coupleId;

      // Invalidate any existing active codes for this couple
      const existingCodes = await ctx.db
        .query("pairingCodes")
        .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      for (const code of existingCodes) {
        await ctx.db.patch(code._id, { status: "expired" });
      }
    } else {
      // Create new couple
      coupleId = await ctx.db.insert("couples", {
        createdAt: Date.now(),
        status: "pending",
      });

      // Create membership for primary user
      await ctx.db.insert("coupleMembers", {
        coupleId,
        userId: user._id,
        role: "primary",
        sharingPain: false,  // Default: don't share pain
        sharingPhase: true,  // Default: share phase
        joinedAt: Date.now(),
      });
    }

    // Generate unique 6-digit code
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      code = Math.floor(100000 + Math.random() * 900000).toString();

      const existing = await ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();

      if (!existing) {
        isUnique = true;
      }
    }

    // Create pairing code (valid for 24 hours)
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await ctx.db.insert("pairingCodes", {
      code: code!,
      coupleId,
      createdBy: user._id,
      expiresAt,
      status: "active",
    });

    return { code: code!, expiresAt };
  },
});
```

### 6.4 Tips & Nutrition System

#### Content Seeding
```typescript
// convex/seedData.ts - Run once to populate initial tips

import { internalMutation } from "./_generated/server";

export const seedPainTips = internalMutation({
  handler: async (ctx) => {
    const tips = [
      {
        phase: "menstruation",
        painSeverity: "moderate",
        title: "Cramp Relief Right Now",
        suggestions: [
          "Apply heat to lower abdomen (heating pad or warm bath)",
          "Gentle yoga poses like child's pose or cat-cow stretches",
          "Stay hydrated with warm herbal tea (ginger or chamomile)",
          "Light walking can help reduce cramps"
        ],
        safetyNote: "Severe or worsening pain? Consider consulting a clinician.",
        isActive: true,
        priority: 1,
      },
      {
        phase: "menstruation",
        painSeverity: "severe",
        title: "Managing Severe Period Pain",
        suggestions: [
          "Rest in a comfortable position with heat therapy",
          "Consider over-the-counter pain relief (follow package directions)",
          "Deep breathing exercises to manage discomfort",
          "Stay in close contact with your healthcare provider"
        ],
        safetyNote: "Severe pain that doesn't improve may need medical attention. Don't hesitate to seek care.",
        isActive: true,
        priority: 1,
      },
      {
        phase: "luteal",
        painSeverity: "moderate",
        title: "PMS Symptom Management",
        suggestions: [
          "Reduce caffeine and salt intake to minimize bloating",
          "Regular exercise can help with mood and energy",
          "Magnesium-rich foods may help reduce symptoms",
          "Maintain consistent sleep schedule"
        ],
        safetyNote: "Severe mood changes or pain? Talk to a healthcare provider.",
        isActive: true,
        priority: 1,
      },
      // Add more tips for other phases...
    ];

    for (const tip of tips) {
      await ctx.db.insert("painTips", tip);
    }
  },
});

export const seedNutritionTips = internalMutation({
  handler: async (ctx) => {
    const tips = [
      {
        phase: "menstruation",
        foodItem: "Dark leafy greens (spinach, kale)",
        reasoning: "Rich in iron to replenish what's lost during menstruation",
        isActive: true,
        priority: 1,
      },
      {
        phase: "menstruation",
        foodItem: "Salmon or other fatty fish",
        reasoning: "Omega-3s can help reduce inflammation and cramping",
        isActive: true,
        priority: 2,
      },
      {
        phase: "follicular",
        foodItem: "Lean proteins (chicken, tofu)",
        reasoning: "Supports estrogen production and tissue repair",
        isActive: true,
        priority: 1,
      },
      {
        phase: "ovulation",
        foodItem: "Colorful vegetables and fruits",
        reasoning: "Antioxidants support egg quality during ovulation",
        isActive: true,
        priority: 1,
      },
      {
        phase: "luteal",
        foodItem: "Complex carbs (sweet potato, quinoa)",
        reasoning: "Helps stabilize blood sugar and support serotonin production",
        isActive: true,
        priority: 1,
      },
      // Add more nutrition tips...
    ];

    for (const tip of tips) {
      await ctx.db.insert("nutritionTips", tip);
    }
  },
});
```

---

## 7. API/Function Specifications

### 7.1 Mutations (Write Operations)

#### createOrUpdatePainLog
```typescript
// convex/mutations/painLog.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUser } from "../_helpers/auth";

export const createOrUpdatePainLog = mutation({
  args: {
    date: v.string(),          // YYYY-MM-DD
    painScore: v.number(),     // 0-10
    tags: v.array(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Validation
    if (args.painScore < 0 || args.painScore > 10) {
      throw new Error("Pain score must be between 0 and 10");
    }

    if (args.note && args.note.length > 140) {
      throw new Error("Note must be 140 characters or less");
    }

    // Check if log already exists for this date
    const existing = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .unique();

    if (existing) {
      // Update existing log
      await ctx.db.patch(existing._id, {
        painScore: args.painScore,
        tags: args.tags,
        note: args.note,
        updatedAt: Date.now(),
      });

      return { logId: existing._id, created: false };
    } else {
      // Create new log
      const logId = await ctx.db.insert("painLogs", {
        userId: user._id,
        date: args.date,
        painScore: args.painScore,
        tags: args.tags,
        note: args.note,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { logId, created: true };
    }
  },
});
```

#### logPeriodStart
```typescript
export const logPeriodStart = mutation({
  args: {
    startDate: v.string(),  // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Check for overlapping period events
    const overlapping = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.or(
          // New period starts during an existing period
          q.and(
            q.lte(q.field("startDate"), args.startDate),
            q.or(
              q.eq(q.field("endDate"), undefined),
              q.gte(q.field("endDate"), args.startDate)
            )
          )
        )
      )
      .first();

    if (overlapping) {
      throw new Error("Period dates overlap with existing period event");
    }

    const eventId = await ctx.db.insert("periodEvents", {
      userId: user._id,
      startDate: args.startDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { eventId };
  },
});
```

#### updateCycleSettings
```typescript
export const updateCycleSettings = mutation({
  args: {
    cycleLength: v.optional(v.number()),
    periodLength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Validation
    if (args.cycleLength !== undefined) {
      if (args.cycleLength < 21 || args.cycleLength > 40) {
        throw new Error("Cycle length must be between 21 and 40 days");
      }
    }

    if (args.periodLength !== undefined) {
      if (args.periodLength < 2 || args.periodLength > 8) {
        throw new Error("Period length must be between 2 and 8 days");
      }
    }

    const existing = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.cycleLength !== undefined && { cycleLength: args.cycleLength }),
        ...(args.periodLength !== undefined && { periodLength: args.periodLength }),
        lastUpdatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("cycleSettings", {
        userId: user._id,
        cycleLength: args.cycleLength ?? 28,
        periodLength: args.periodLength ?? 5,
        lastUpdatedAt: Date.now(),
      });
    }
  },
});
```

#### linkPartnerWithCode
```typescript
export const linkPartnerWithCode = mutation({
  args: {
    code: v.string(),  // 6-digit code
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    // Ensure user is partner role
    if (user.role !== "partner") {
      throw new Error("Only partner users can use pairing codes");
    }

    // Find active pairing code
    const pairingCode = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .filter((q) => q.eq(q.field("status"), "active"))
      .unique();

    if (!pairingCode) {
      throw new Error("Invalid or expired pairing code");
    }

    // Check expiration
    if (pairingCode.expiresAt < Date.now()) {
      await ctx.db.patch(pairingCode._id, { status: "expired" });
      throw new Error("Pairing code has expired");
    }

    // Check if partner already linked to another couple
    const existingMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingMembership) {
      throw new Error("You are already linked to a couple");
    }

    // Create partner membership
    await ctx.db.insert("coupleMembers", {
      coupleId: pairingCode.coupleId,
      userId: user._id,
      role: "partner",
      sharingPain: false,  // Inherit from couple settings or default
      sharingPhase: true,
      joinedAt: Date.now(),
    });

    // Mark code as used
    await ctx.db.patch(pairingCode._id, {
      status: "used",
      usedBy: user._id,
      usedAt: Date.now(),
    });

    // Update couple status
    await ctx.db.patch(pairingCode.coupleId, {
      status: "active",
      linkedAt: Date.now(),
    });

    return { success: true, coupleId: pairingCode.coupleId };
  },
});
```

#### revokePartnerAccess
```typescript
export const revokePartnerAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user.role !== "primary") {
      throw new Error("Only primary users can revoke partner access");
    }

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) {
      throw new Error("You are not part of a couple");
    }

    // Update couple status to revoked
    await ctx.db.patch(membership.coupleId, {
      status: "revoked",
    });

    // Optionally: delete partner membership or keep for audit
    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple_and_role", (q) =>
        q.eq("coupleId", membership.coupleId).eq("role", "partner")
      )
      .unique();

    if (partnerMembership) {
      await ctx.db.delete(partnerMembership._id);
    }

    return { success: true };
  },
});
```

### 7.2 Queries (Read Operations)

#### getDashboardData
```typescript
// convex/queries/dashboard.ts
import { query } from "./_generated/server";
import { getCurrentUser, getCoupleForUser } from "../_helpers/auth";
import { calculateCycleInfo, getPainSeverityBucket } from "../_helpers/cycleCalculations";

export const getDashboardData = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    // Get target user (primary) - if partner, get primary user's data
    let targetUserId = user._id;
    let isPartnerView = false;

    if (user.role === "partner") {
      const membership = await getCoupleForUser(ctx, user._id);
      if (!membership) {
        throw new Error("Partner not linked to any couple");
      }

      const primaryMembership = await ctx.db
        .query("coupleMembers")
        .withIndex("by_couple_and_role", (q) =>
          q.eq("coupleId", membership.coupleId).eq("role", "primary")
        )
        .unique();

      if (!primaryMembership) {
        throw new Error("Couple has no primary user");
      }

      targetUserId = primaryMembership.userId;
      isPartnerView = true;
    }

    // Get cycle settings
    const cycleSettings = await ctx.db
      .query("cycleSettings")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    // Get most recent period event
    const recentPeriod = await ctx.db
      .query("periodEvents")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .first();

    if (!recentPeriod) {
      return {
        hasData: false,
        message: "No period data yet. Log your last period to get started.",
      };
    }

    // Calculate current cycle info
    const cycleInfo = calculateCycleInfo(
      recentPeriod.startDate,
      cycleLength,
      periodLength
    );

    // Get today's pain log
    const today = new Date().toISOString().split('T')[0];
    const todayPainLog = await ctx.db
      .query("painLogs")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).eq("date", today)
      )
      .unique();

    // Check sharing permissions if partner view
    let painData = null;
    if (isPartnerView) {
      const membership = await getCoupleForUser(ctx, user._id);
      if (membership?.sharingPain && todayPainLog) {
        painData = {
          score: todayPainLog.painScore,
          severity: getPainSeverityBucket(todayPainLog.painScore),
        };
      }
    } else {
      painData = todayPainLog ? {
        score: todayPainLog.painScore,
        severity: getPainSeverityBucket(todayPainLog.painScore),
        tags: todayPainLog.tags,
        note: todayPainLog.note,
      } : null;
    }

    // Get relevant tips
    const painSeverity = painData ? getPainSeverityBucket(painData.score) : 'none';

    const painTip = await ctx.db
      .query("painTips")
      .withIndex("by_phase_and_severity", (q) =>
        q.eq("phase", cycleInfo.phase)
         .eq("painSeverity", painSeverity)
         .eq("isActive", true)
      )
      .order("desc")
      .first();

    // Get nutrition tips (3 random per day, deterministic)
    const allNutritionTips = await ctx.db
      .query("nutritionTips")
      .withIndex("by_phase", (q) =>
        q.eq("phase", cycleInfo.phase).eq("isActive", true)
      )
      .collect();

    // Deterministic shuffle based on date
    const seed = parseInt(today.replace(/-/g, ''), 10);
    const shuffled = [...allNutritionTips].sort((a, b) => {
      const hashA = (seed + a._id.toString().charCodeAt(0)) % 1000;
      const hashB = (seed + b._id.toString().charCodeAt(0)) % 1000;
      return hashA - hashB;
    });

    const nutritionTips = shuffled.slice(0, 3);

    return {
      hasData: true,
      isPartnerView,
      cycleInfo,
      painData,
      painTip,
      nutritionTips,
    };
  },
});
```

#### getCoupleStatus
```typescript
export const getCoupleStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    const membership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) {
      return { isLinked: false };
    }

    const couple = await ctx.db.get(membership.coupleId);

    if (!couple || couple.status === "revoked") {
      return { isLinked: false };
    }

    // Get partner info if exists
    const partnerMembership = await ctx.db
      .query("coupleMembers")
      .withIndex("by_couple", (q) => q.eq("coupleId", membership.coupleId))
      .filter((q) => q.neq(q.field("userId"), user._id))
      .first();

    let partnerInfo = null;
    if (partnerMembership) {
      const partnerUser = await ctx.db.get(partnerMembership.userId);
      partnerInfo = {
        name: partnerUser?.name,
        email: partnerUser?.email,
      };
    }

    return {
      isLinked: true,
      status: couple.status,
      role: membership.role,
      sharingSettings: {
        pain: membership.sharingPain,
        phase: membership.sharingPhase,
      },
      partner: partnerInfo,
    };
  },
});
```

---

## 8. Real-time Sync & State Management

### 8.1 Convex Real-time Subscriptions

Convex automatically handles real-time sync via reactive queries. No additional configuration needed.

#### Client-Side Pattern
```typescript
// app/dashboard/page.tsx
'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function DashboardPage() {
  // This query automatically re-runs when underlying data changes
  const dashboardData = useQuery(api.queries.dashboard.getDashboardData);

  const logPain = useMutation(api.mutations.painLog.createOrUpdatePainLog);

  // Optimistic update pattern
  const handleLogPain = async (painScore: number) => {
    try {
      await logPain({
        date: new Date().toISOString().split('T')[0],
        painScore,
        tags: [],
      });
      // UI automatically updates via subscription
    } catch (error) {
      console.error("Failed to log pain:", error);
      // Show error toast
    }
  };

  if (dashboardData === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <CurrentPhase phase={dashboardData.cycleInfo.phase} />
      {dashboardData.painData && (
        <PainIndicator score={dashboardData.painData.score} />
      )}
      <PainLogButton onLog={handleLogPain} />
    </div>
  );
}
```

### 8.2 Optimistic Updates

```typescript
// hooks/useOptimisticPainLog.ts
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState } from 'react';

export function useOptimisticPainLog() {
  const [optimisticData, setOptimisticData] = useState(null);
  const logPain = useMutation(api.mutations.painLog.createOrUpdatePainLog);

  const logPainOptimistic = async (args: { painScore: number; tags: string[]; note?: string }) => {
    // Immediately update UI
    setOptimisticData({
      score: args.painScore,
      tags: args.tags,
      note: args.note,
      pending: true,
    });

    try {
      await logPain({
        date: new Date().toISOString().split('T')[0],
        ...args,
      });
      // Clear optimistic state once mutation succeeds
      setOptimisticData(null);
    } catch (error) {
      // Rollback on error
      setOptimisticData(null);
      throw error;
    }
  };

  return { logPainOptimistic, optimisticData };
}
```

---

## 9. Notification System

### 9.1 Discord Webhook Integration

#### Setup
```typescript
// convex/actions/discord.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendDiscordNotification = action({
  args: {
    userId: v.id("users"),
    type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user data for personalization
    const user = await ctx.runQuery(api.queries.users.getUserById, {
      userId: args.userId,
    });

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("Discord webhook URL not configured");
      return { success: false };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**${user?.name || 'User'}**: ${args.message}`,
          embeds: [{
            title: `CB Connect - ${args.type}`,
            description: args.message,
            color: getColorForNotificationType(args.type),
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }

      // Log notification
      await ctx.runMutation(api.mutations.notifications.logNotification, {
        userId: args.userId,
        type: args.type,
        payload: { message: args.message },
        status: 'sent',
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to send Discord notification:", error);

      await ctx.runMutation(api.mutations.notifications.logNotification, {
        userId: args.userId,
        type: args.type,
        payload: { message: args.message },
        status: 'failed',
        errorMessage: error.message,
      });

      return { success: false, error: error.message };
    }
  },
});

function getColorForNotificationType(type: string): number {
  const colors = {
    'partner_linked': 0x00ff00,     // Green
    'period_started': 0xff0000,     // Red
    'high_pain_logged': 0xffaa00,   // Orange
    'period_prediction': 0x0099ff,  // Blue
  };
  return colors[type] || 0x808080;  // Default gray
}
```

### 9.2 Notification Triggers

#### Partner Linked Notification
```typescript
// Trigger from linkPartnerWithCode mutation
export const linkPartnerWithCode = mutation({
  // ... existing args and validation
  handler: async (ctx, args) => {
    // ... existing linking logic

    // After successful link, schedule notification
    await ctx.scheduler.runAfter(0, api.actions.discord.sendDiscordNotification, {
      userId: pairingCode.createdBy,  // Primary user
      type: 'partner_linked',
      message: `🎉 Your partner has successfully linked their account!`,
    });

    return { success: true, coupleId: pairingCode.coupleId };
  },
});
```

#### High Pain Notification
```typescript
// Trigger from createOrUpdatePainLog mutation
export const createOrUpdatePainLog = mutation({
  // ... existing code
  handler: async (ctx, args) => {
    // ... existing logging logic

    // If pain score is >= 7, notify
    if (args.painScore >= 7) {
      await ctx.scheduler.runAfter(0, api.actions.discord.sendDiscordNotification, {
        userId: user._id,
        type: 'high_pain_logged',
        message: `⚠️ High pain level logged (${args.painScore}/10). Consider checking in.`,
      });
    }

    return { logId, created };
  },
});
```

#### Period Prediction Notification (Daily Cron)
```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "send period predictions",
  { hourUTC: 9, minuteUTC: 0 },  // 9 AM UTC
  api.actions.notifications.sendDailyPredictions
);

export default crons;
```

```typescript
// convex/actions/notifications.ts
export const sendDailyPredictions = action({
  handler: async (ctx) => {
    const allUsers = await ctx.runQuery(api.queries.users.getAllPrimaryUsers);

    for (const user of allUsers) {
      const cycleInfo = await ctx.runQuery(api.queries.dashboard.getCycleInfo, {
        userId: user._id,
      });

      // Notify 3 days before predicted period
      if (cycleInfo && cycleInfo.daysUntilNextPeriod === 3) {
        await ctx.runAction(api.actions.discord.sendDiscordNotification, {
          userId: user._id,
          type: 'period_prediction',
          message: `📅 Your period is predicted to start in 3 days (${cycleInfo.predictedNextPeriodStart})`,
        });
      }
    }
  },
});
```

---

## 10. Frontend Architecture

### 10.1 Project Structure

```
cb-connect/
├── app/
│   ├── layout.tsx                 # Root layout with ClerkProvider
│   ├── page.tsx                   # Landing page
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard layout (protected)
│   │   ├── page.tsx              # Home dashboard
│   │   ├── log/page.tsx          # Pain/period logging
│   │   ├── partner/page.tsx      # Partner linking & settings
│   │   └── settings/page.tsx     # Cycle settings
│   └── api/
│       └── webhook/
│           └── clerk/route.ts    # Clerk webhook handler
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/
│   │   ├── CurrentPhase.tsx
│   │   ├── PainLogger.tsx
│   │   ├── TipsCard.tsx
│   │   └── NutritionSuggestions.tsx
│   ├── partner/
│   │   ├── PairingCodeDisplay.tsx
│   │   ├── PairingCodeInput.tsx
│   │   └── PartnerDashboard.tsx
│   └── common/
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── convex/
│   ├── schema.ts
│   ├── auth.config.js
│   ├── queries/
│   ├── mutations/
│   ├── actions/
│   ├── _helpers/
│   └── crons.ts
├── lib/
│   ├── utils.ts
│   └── constants.ts
└── hooks/
    ├── useOptimisticPainLog.ts
    └── useCycleInfo.ts
```

### 10.2 Key Components

#### Primary Dashboard
```typescript
// app/(dashboard)/page.tsx
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import CurrentPhase from '@/components/dashboard/CurrentPhase';
import PainLogger from '@/components/dashboard/PainLogger';
import TipsCard from '@/components/dashboard/TipsCard';
import NutritionSuggestions from '@/components/dashboard/NutritionSuggestions';

export default function DashboardPage() {
  const data = useQuery(api.queries.dashboard.getDashboardData);

  if (data === undefined) {
    return <LoadingSpinner />;
  }

  if (!data.hasData) {
    return <OnboardingFlow />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <CurrentPhase
        phase={data.cycleInfo.phase}
        cycleDay={data.cycleInfo.cycleDay}
        description={data.cycleInfo.phaseDescription}
        nextPeriodStart={data.cycleInfo.predictedNextPeriodStart}
      />

      <PainLogger
        currentPain={data.painData}
      />

      {data.painTip && data.painData?.score >= 4 && (
        <TipsCard tip={data.painTip} />
      )}

      <NutritionSuggestions
        tips={data.nutritionTips}
        phase={data.cycleInfo.phase}
      />
    </div>
  );
}
```

#### Pain Logger Component
```typescript
// components/dashboard/PainLogger.tsx
'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function PainLogger({ currentPain }) {
  const [painScore, setPainScore] = useState(currentPain?.score ?? 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentPain?.tags ?? []);
  const [note, setNote] = useState(currentPain?.note ?? '');
  const [isLogging, setIsLogging] = useState(false);

  const logPain = useMutation(api.mutations.painLog.createOrUpdatePainLog);

  const handleSubmit = async () => {
    setIsLogging(true);
    try {
      await logPain({
        date: new Date().toISOString().split('T')[0],
        painScore,
        tags: selectedTags,
        note: note || undefined,
      });
      // Success feedback
    } catch (error) {
      console.error(error);
      // Error feedback
    } finally {
      setIsLogging(false);
    }
  };

  const painLabels = ['None', 'Mild', 'Moderate', 'Severe', 'Unbearable'];
  const painColor = painScore <= 3 ? 'green' : painScore <= 6 ? 'yellow' : 'red';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Log Today's Pain</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Pain Level: {painScore}/10 ({painLabels[Math.floor(painScore / 2.5)]})
          </label>
          <Slider
            value={[painScore]}
            onValueChange={(value) => setPainScore(value[0])}
            max={10}
            step={1}
            className={`pain-slider-${painColor}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What type of pain?
          </label>
          <div className="flex gap-2 flex-wrap">
            {['cramps', 'headache', 'back', 'fatigue', 'other'].map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  );
                }}
                className={`px-4 py-2 rounded-full ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Notes (optional, max 140 chars)
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder="e.g., 'Sharp pain, worse when sitting'"
            rows={3}
          />
          <p className="text-sm text-gray-500 mt-1">{note.length}/140</p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isLogging}
          className="w-full"
        >
          {isLogging ? 'Saving...' : 'Log Pain'}
        </Button>
      </div>
    </div>
  );
}
```

#### Partner Dashboard Component
```typescript
// components/partner/PartnerDashboard.tsx
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function PartnerDashboard() {
  const data = useQuery(api.queries.dashboard.getDashboardData);

  if (data === undefined) return <LoadingSpinner />;
  if (!data.hasData) return <div>No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-2">Partner Dashboard</h1>
        <p className="text-lg">How you can support today</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Current Phase</h2>
        <div className="flex items-center gap-4">
          <div className="text-6xl">{getPhaseEmoji(data.cycleInfo.phase)}</div>
          <div>
            <p className="text-2xl font-bold capitalize">{data.cycleInfo.phase}</p>
            <p className="text-gray-600">{data.cycleInfo.phaseDescription}</p>
            <p className="text-sm text-gray-500 mt-2">
              Day {data.cycleInfo.cycleDay} of cycle
            </p>
          </div>
        </div>
      </div>

      {data.painData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pain Status</h2>
          <p className="text-lg">
            Current pain level: <span className="font-bold">{data.painData.severity}</span>
          </p>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">How to Support Today</h2>
        <SupportSuggestions
          phase={data.cycleInfo.phase}
          painSeverity={data.painData?.severity}
        />
      </div>
    </div>
  );
}

function getPhaseEmoji(phase: string) {
  const emojis = {
    menstruation: '🩸',
    follicular: '🌱',
    ovulation: '🌸',
    luteal: '🌙',
  };
  return emojis[phase] || '📅';
}
```

---

## 11. Business Logic & Algorithms

### 11.1 Cycle Tracking Algorithm

See section 6.2 for the complete `calculateCycleInfo` function.

**Key Assumptions:**
- Ovulation occurs on day 14 (midpoint of default 28-day cycle)
- Ovulation window is 3 days (days 14-16)
- Follicular phase: day (period end + 1) to day 13
- Luteal phase: day 17 to day (cycle length)

### 11.2 Period Auto-End Logic

```typescript
// Convex scheduled function (runs daily)
export const autoEndPeriods = internalMutation({
  handler: async (ctx) => {
    // Find periods that started more than 8 days ago and haven't ended
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 8);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const openPeriods = await ctx.db
      .query("periodEvents")
      .filter((q) =>
        q.and(
          q.eq(q.field("endDate"), undefined),
          q.lt(q.field("startDate"), cutoffDateStr)
        )
      )
      .collect();

    for (const period of openPeriods) {
      // Get user's average period length
      const settings = await ctx.db
        .query("cycleSettings")
        .withIndex("by_user", (q) => q.eq("userId", period.userId))
        .unique();

      const periodLength = settings?.periodLength ?? 5;

      // Auto-end the period
      const endDate = new Date(period.startDate);
      endDate.setDate(endDate.getDate() + periodLength - 1);

      await ctx.db.patch(period._id, {
        endDate: endDate.toISOString().split('T')[0],
        updatedAt: Date.now(),
      });
    }
  },
});
```

### 11.3 Nutrition Tip Rotation

Deterministic shuffle algorithm (see section 7.2) ensures:
- Same 3 tips shown all day for a given user
- Different tips each day
- All tips get equal exposure over time

---

## 12. Error Handling & Validation

### 12.1 Input Validation

All mutations use Convex's built-in validators:
```typescript
args: {
  painScore: v.number(),  // Type check
  // Additional runtime check
}
```

Runtime validation:
```typescript
if (args.painScore < 0 || args.painScore > 10) {
  throw new Error("Pain score must be between 0 and 10");
}
```

### 12.2 Error Boundaries

```typescript
// components/common/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 12.3 Mutation Error Handling

```typescript
// Frontend pattern
const handleLogPain = async (painScore: number) => {
  try {
    await logPain({ painScore, date: today, tags: [] });
    toast.success('Pain logged successfully');
  } catch (error) {
    if (error.message.includes('must be between')) {
      toast.error('Invalid pain score');
    } else if (error.message.includes('Unauthenticated')) {
      router.push('/sign-in');
    } else {
      toast.error('Failed to log pain. Please try again.');
    }
  }
};
```

---

## 13. Testing Strategy

### 13.1 Unit Tests (Vitest)

```typescript
// convex/_helpers/cycleCalculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCycleInfo, getPainSeverityBucket } from './cycleCalculations';

describe('Cycle Calculations', () => {
  it('correctly calculates menstruation phase', () => {
    const result = calculateCycleInfo(
      '2026-01-15',  // Last period
      28,            // Cycle length
      5,             // Period length
      '2026-01-17'   // Today (day 3)
    );

    expect(result.phase).toBe('menstruation');
    expect(result.cycleDay).toBe(3);
  });

  it('correctly calculates follicular phase', () => {
    const result = calculateCycleInfo(
      '2026-01-01',
      28,
      5,
      '2026-01-10'  // Day 10
    );

    expect(result.phase).toBe('follicular');
  });

  it('predicts next period correctly', () => {
    const result = calculateCycleInfo(
      '2026-01-01',
      28,
      5,
      '2026-01-15'
    );

    expect(result.predictedNextPeriodStart).toBe('2026-01-29');
  });
});

describe('Pain Severity Bucket', () => {
  it('categorizes pain correctly', () => {
    expect(getPainSeverityBucket(0)).toBe('none');
    expect(getPainSeverityBucket(2)).toBe('mild');
    expect(getPainSeverityBucket(5)).toBe('moderate');
    expect(getPainSeverityBucket(9)).toBe('severe');
  });
});
```

### 13.2 Integration Tests (Convex Test Mode)

```typescript
// convex/tests/painLog.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

test("pain log creation and retrieval", async () => {
  const t = convexTest(schema);

  // Create user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      role: "primary",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  // Mock auth
  t.withIdentity({ subject: "test-user-1" });

  // Create pain log
  const result = await t.mutation(api.mutations.painLog.createOrUpdatePainLog, {
    date: "2026-01-15",
    painScore: 7,
    tags: ["cramps"],
    note: "Sharp pain",
  });

  expect(result.created).toBe(true);

  // Verify log exists
  const logs = await t.run(async (ctx) => {
    return await ctx.db
      .query("painLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  });

  expect(logs).toHaveLength(1);
  expect(logs[0].painScore).toBe(7);
});
```

### 13.3 E2E Tests (Playwright)

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('primary user can log pain and see tips', async ({ page }) => {
  // Sign in
  await page.goto('/sign-in');
  await page.fill('input[name="identifier"]', 'test@example.com');
  await page.fill('input[name="password"]', 'testpassword');
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await expect(page.locator('h1')).toContainText('Dashboard');

  // Log pain
  await page.locator('input[type="range"]').fill('7');
  await page.click('button:has-text("Log Pain")');

  // Verify tips appear
  await expect(page.locator('.tips-card')).toBeVisible();
  await expect(page.locator('.tips-card')).toContainText('Cramp Relief');
});

test('partner linking flow', async ({ page, context }) => {
  // Primary user generates code
  await page.goto('/partner');
  await page.click('button:has-text("Generate Pairing Code")');

  const code = await page.locator('[data-testid="pairing-code"]').textContent();

  // Partner user links
  const partnerPage = await context.newPage();
  await partnerPage.goto('/sign-in');
  // ... partner signs in
  await partnerPage.goto('/partner/link');
  await partnerPage.fill('input[name="code"]', code);
  await partnerPage.click('button:has-text("Link")');

  // Verify link success
  await expect(partnerPage.locator('.success-message')).toBeVisible();

  // Verify primary user sees partner linked
  await expect(page.locator('.partner-status')).toContainText('Partner Linked');
});
```

---

## 14. Deployment & DevOps

### 14.1 Environment Setup

```bash
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 14.2 Docker Containerization

The application will be deployed using Docker containers for improved scalability, portability, and consistency across environments.

#### Dockerfile
```dockerfile
# Use official Node.js runtime as base image
FROM node:18-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy application code
COPY . .

# Build the Next.js application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy package files and dependencies from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/pnpm-lock.yaml ./

# Copy built application from base stage
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]
```

#### Docker Compose for Local Development
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
      - CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
    restart: unless-stopped
    depends_on:
      - redis
    networks:
      - cbconnect-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - cbconnect-network

volumes:
  redis_data:

networks:
  cbconnect-network:
    driver: bridge
```

### 14.3 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install -g pnpm && pnpm install

      - name: Run tests
        run: pnpm test

  build-and-push:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ghcr.io/${{ github.repository_owner }}/cb-connect
          tags: |
            type=raw,value=latest
            type=sha,prefix=

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to Kubernetes
        run: |
          # Deploy to Kubernetes cluster using kubectl
          # Configuration details would be specific to your infrastructure
          echo "Deploying to Kubernetes cluster..."

      - name: Deploy Convex
        run: npx convex deploy --prod
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

### 14.4 Container Orchestration

For production deployment, the application will be orchestrated using Kubernetes with the following specifications:

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cb-connect
  labels:
    app: cb-connect
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cb-connect
  template:
    metadata:
      labels:
        app: cb-connect
    spec:
      containers:
      - name: cb-connect
        image: ghcr.io/{username}/cb-connect:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          valueFrom:
            secretKeyRef:
              name: cb-connect-secrets
              key: clerk-publishable-key
        - name: CLERK_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: cb-connect-secrets
              key: clerk-secret-key
        - name: NEXT_PUBLIC_CONVEX_URL
          valueFrom:
            secretKeyRef:
              name: cb-connect-secrets
              key: convex-url
        - name: CONVEX_DEPLOYMENT
          valueFrom:
            secretKeyRef:
              name: cb-connect-secrets
              key: convex-deployment
        - name: DISCORD_WEBHOOK_URL
          valueFrom:
            secretKeyRef:
              name: cb-connect-secrets
              key: discord-webhook-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: cb-connect-service
spec:
  selector:
    app: cb-connect
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

### 14.5 Database Migrations

Convex handles schema evolution automatically. For major changes:

```typescript
// convex/migrations/001_add_sharing_settings.ts
import { internalMutation } from "../_generated/server";

export const addSharingSettings = internalMutation({
  handler: async (ctx) => {
    const members = await ctx.db.query("coupleMembers").collect();

    for (const member of members) {
      if (member.sharingPain === undefined) {
        await ctx.db.patch(member._id, {
          sharingPain: false,
          sharingPhase: true,
        });
      }
    }
  },
});
```

Run migration:
```bash
npx convex run migrations/001_add_sharing_settings:addSharingSettings
```

### 14.6 Infrastructure as Code

Infrastructure will be managed using Terraform for consistent and reproducible deployments:

#### Terraform Configuration
```hcl
# terraform/main.tf
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

resource "docker_registry_image" "cb_connect" {
  name = "ghcr.io/${var.github_username}/cb-connect:latest"

  build {
    context = "${path.module}/../"
    dockerfile = "Dockerfile"
  }
}

resource "kubernetes_namespace" "app" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "cb-connect-secrets"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    clerk-publishable-key = var.clerk_publishable_key
    clerk-secret-key      = var.clerk_secret_key
    convex-url            = var.convex_url
    convex-deployment     = var.convex_deployment
    discord-webhook-url   = var.discord_webhook_url
  }
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = "cb-connect"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "cb-connect"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        app = "cb-connect"
      }
    }

    template {
      metadata {
        labels = {
          app = "cb-connect"
        }
      }

      spec {
        container {
          name              = "cb-connect"
          image             = docker_registry_image.cb_connect.name
          image_pull_policy = "Always"

          port {
            container_port = 3000
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "clerk-publishable-key"
              }
            }
          }

          env {
            name = "CLERK_SECRET_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "clerk-secret-key"
              }
            }
          }

          env {
            name = "NEXT_PUBLIC_CONVEX_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "convex-url"
              }
            }
          }

          env {
            name = "CONVEX_DEPLOYMENT"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "convex-deployment"
              }
            }
          }

          env {
            name = "DISCORD_WEBHOOK_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "discord-webhook-url"
              }
            }
          }

          resources {
            requests = {
              memory = "256Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "500m"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "app" {
  metadata {
    name      = "cb-connect-service"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  spec {
    selector = {
      app = "cb-connect"
    }

    port {
      port        = 80
      target_port = 3000
    }

    type = "LoadBalancer"
  }
}
```

Variables file for Terraform:
```hcl
# terraform/variables.tf
variable "namespace" {
  description = "Kubernetes namespace for the application"
  type        = string
  default     = "cb-connect"
}

variable "github_username" {
  description = "GitHub username for the container registry"
  type        = string
}

variable "clerk_publishable_key" {
  description = "Clerk publishable key"
  type        = string
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key"
  type        = string
  sensitive   = true
}

variable "convex_url" {
  description = "Convex URL"
  type        = string
  sensitive   = true
}

variable "convex_deployment" {
  description = "Convex deployment identifier"
  type        = string
  sensitive   = true
}

variable "discord_webhook_url" {
  description = "Discord webhook URL for notifications"
  type        = string
  sensitive   = true
}
```

Outputs file for Terraform:
```hcl
# terraform/outputs.tf
output "service_external_ip" {
  description = "External IP address of the service"
  value       = kubernetes_service.app.status.0.load_balancer.0.ingress.0.ip
}
```

---

## 15. Security Considerations

### 15.1 Authentication Security

- **Clerk manages:** Password hashing, session tokens, OAuth flows
- **Our responsibility:**
  - Validate `clerkId` in every protected mutation/query
  - Never expose sensitive data in unauthenticated endpoints
  - Use Clerk webhooks to sync user deletions

### 15.2 Authorization Checks

All data access goes through permission helpers:
```typescript
// BEFORE returning any health data
const canView = await canViewPainData(ctx, viewerId, targetUserId);
if (!canView) {
  throw new Error("Unauthorized");
}
```

### 15.3 Data Privacy

**MVP Security Posture:**
- Encryption at rest: Provided by Convex (AES-256)
- Encryption in transit: HTTPS/WSS (TLS 1.3)
- No end-to-end encryption (future consideration)
- Consent-based sharing enforced in queries
- Partner can never write to primary user's data

### 15.4 Input Sanitization

- All user inputs validated server-side
- XSS prevention via React's default escaping
- SQL injection: N/A (NoSQL database, parameterized queries)
- Note field limited to 140 chars, no HTML allowed

### 15.5 Rate Limiting

Convex provides built-in rate limiting. Additional application-level limits:

```typescript
// Limit pairing code generation to 5 per hour
const recentCodes = await ctx.db
  .query("pairingCodes")
  .withIndex("by_couple", (q) => q.eq("coupleId", coupleId))
  .filter((q) => q.gt(q.field("createdAt"), Date.now() - 3600000))
  .collect();

if (recentCodes.length >= 5) {
  throw new Error("Too many pairing codes generated. Try again in an hour.");
}
```

---

## 16. Performance Requirements

### 16.1 Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard Load Time | < 2s | Time to interactive |
| Mutation Response Time | < 500ms | Pain log submission |
| Real-time Update Latency | < 1s | Partner sees primary's update |
| Convex Query Latency | < 200ms | 95th percentile |

### 16.2 Optimization Strategies

**Frontend:**
- Use Next.js server components for static content
- Lazy load non-critical components
- Optimize images with next/image
- Code splitting by route

**Backend:**
- Index frequently queried fields
- Minimize query complexity (use specific indexes)
- Cache computed data when appropriate

**Database Indexes:**
```typescript
// Already defined in schema
.index("by_user_and_date", ["userId", "date"])  // Fast pain log lookups
.index("by_phase_and_severity", ["phase", "painSeverity", "isActive"])  // Fast tip queries
```

### 16.3 Monitoring

```typescript
// Add performance logging to critical paths
export const createOrUpdatePainLog = mutation({
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // ... mutation logic

      const duration = Date.now() - startTime;
      if (duration > 500) {
        console.warn(`Slow pain log mutation: ${duration}ms`);
      }
    } catch (error) {
      // Log error with context
      console.error('Pain log mutation failed:', {
        error,
        args,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  },
});
```

---

## 17. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Auth, database, basic UI

- [ ] Set up Next.js project with Clerk
- [ ] Configure Convex with schema
- [ ] Implement user creation webhook
- [ ] Build basic dashboard layout
- [ ] Create pain logging UI
- [ ] Implement period logging

**Deliverable:** Users can sign in and log period/pain data

---

### Phase 2: Cycle Logic (Week 3)
**Goal:** Phase detection and predictions

- [ ] Implement `calculateCycleInfo` function
- [ ] Build cycle settings page
- [ ] Create onboarding flow (first period date entry)
- [ ] Display current phase on dashboard
- [ ] Show next period prediction

**Deliverable:** Users see accurate cycle phase and predictions

---

### Phase 3: Tips System (Week 4)
**Goal:** Pain management and nutrition guidance

- [ ] Seed pain tips database
- [ ] Seed nutrition tips database
- [ ] Implement tip retrieval queries
- [ ] Build tips UI components
- [ ] Add nutrition tip hiding functionality

**Deliverable:** Users receive phase/pain-appropriate tips

---

### Phase 4: Partner Features (Week 5-6)
**Goal:** Couple linking and partner dashboard

- [ ] Implement pairing code generation
- [ ] Build code entry flow
- [ ] Create partner dashboard
- [ ] Add sharing permission toggles
- [ ] Implement revoke access
- [ ] Build support suggestions for partners

**Deliverable:** Couples can link accounts and partner sees relevant info

---

### Phase 5: Notifications (Week 7)
**Goal:** Discord webhook integration

- [ ] Set up Discord webhook action
- [ ] Implement partner linked notification
- [ ] Add high pain notification
- [ ] Create daily cron for period predictions
- [ ] Build notification log UI (admin view)

**Deliverable:** Key events trigger Discord notifications

---

### Phase 6: Polish & Testing (Week 8)
**Goal:** Production readiness

- [ ] Write comprehensive tests
- [ ] Perform security audit
- [ ] Optimize performance (lazy loading, caching)
- [ ] Add error boundaries
- [ ] Implement analytics tracking
- [ ] User acceptance testing
- [ ] Fix bugs and edge cases

**Deliverable:** Production-ready MVP

---

## Appendix A: Sample Data Structures

### Example Dashboard Data Response
```json
{
  "hasData": true,
  "isPartnerView": false,
  "cycleInfo": {
    "phase": "luteal",
    "cycleDay": 22,
    "daysUntilNextPeriod": 7,
    "predictedNextPeriodStart": "2026-02-07",
    "predictedNextPeriodEnd": "2026-02-11",
    "phaseDescription": "Pre-period phase"
  },
  "painData": {
    "score": 5,
    "severity": "moderate",
    "tags": ["cramps", "fatigue"],
    "note": "Cramps started this afternoon"
  },
  "painTip": {
    "title": "PMS Symptom Management",
    "suggestions": [
      "Reduce caffeine and salt intake",
      "Regular exercise can help with mood",
      "Magnesium-rich foods may help",
      "Maintain consistent sleep schedule"
    ],
    "safetyNote": "Severe mood changes or pain? Talk to a healthcare provider."
  },
  "nutritionTips": [
    {
      "foodItem": "Complex carbs (sweet potato, quinoa)",
      "reasoning": "Helps stabilize blood sugar and support serotonin"
    },
    {
      "foodItem": "Dark chocolate",
      "reasoning": "Magnesium content may help with PMS symptoms"
    },
    {
      "foodItem": "Leafy greens",
      "reasoning": "B vitamins support mood regulation"
    }
  ]
}
```

---

## Appendix B: API Reference Summary

### Mutations
- `createOrUpdatePainLog(date, painScore, tags, note)`
- `logPeriodStart(startDate)`
- `logPeriodEnd(eventId, endDate)`
- `updateCycleSettings(cycleLength?, periodLength?)`
- `generatePairingCode()`
- `linkPartnerWithCode(code)`
- `revokePartnerAccess()`
- `updateSharingSettings(sharingPain, sharingPhase)`
- `hideNutritionTip(nutritionTipId)`

### Queries
- `getDashboardData()` → Dashboard data for current user
- `getCoupleStatus()` → Couple linkage info
- `getPainHistory(startDate, endDate)` → Historical pain logs
- `getPeriodHistory()` → Historical periods

### Actions
- `sendDiscordNotification(userId, type, message)`
- `sendDailyPredictions()` (cron)

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Cycle Day** | Day number in current menstrual cycle (1-indexed) |
| **Phase** | Current stage of menstrual cycle (menstruation, follicular, ovulation, luteal) |
| **Primary User** | Person who menstruates and logs health data |
| **Partner User** | Person who views shared data (read-only) |
| **Pairing Code** | 6-digit code for linking partner account |
| **Pain Severity Bucket** | Categorical grouping of pain score (none/mild/moderate/severe) |
| **Sharing Consent** | Permission settings for what partner can see |

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Technical Team | Initial technical PRD created |

---

**End of Technical PRD**
