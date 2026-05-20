# Graph Report - cb connect  (2026-05-20)

## Corpus Check
- 82 files · ~41,500 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 659 nodes · 710 edges · 54 communities (50 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `85c8763e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `CB Connect - Technical Product Requirements Document (PRD)` - 23 edges
2. `CB Connect - Project Context` - 12 edges
3. `Partner Linking UX Improvements - Design Document` - 12 edges
4. `Manual Test Execution Results` - 12 edges
5. `CB Connect - Issues & Feature Tracker` - 11 edges
6. `What Is Weak Or Incomplete` - 11 edges
7. `CB Connect - E2E Test Results` - 10 edges
8. `Deployment Guide - CB Connect` - 9 edges
9. `CB Connect Design Overhaul Implementation Plan` - 9 edges
10. `cn()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GlassPanel()` --calls--> `cn()`  [EXTRACTED]
  components/common/GlassPanel.tsx → lib/utils.ts
- `SanctuaryShell()` --calls--> `cn()`  [EXTRACTED]
  components/common/SanctuaryShell.tsx → lib/utils.ts
- `DigitalLocket()` --calls--> `cn()`  [EXTRACTED]
  components/partner/DigitalLocket.tsx → lib/utils.ts
- `LogPage()` --calls--> `formatDate()`  [EXTRACTED]
  app/(dashboard)/dashboard/log/page.tsx → lib/utils.ts
- `PhaseAura()` --calls--> `getPhaseEmoji()`  [EXTRACTED]
  components/dashboard/PhaseAura.tsx → lib/utils.ts

## Communities (54 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (34): sendDiscordNotification, sendDailyPredictions, seedNutritionTips, seedPainTips, canViewPainData(), getCoupleForUser(), getCurrentUser(), getCurrentUserOrNull() (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (26): GlassPanel(), GlassPanelProps, SanctuaryShell(), SanctuaryShellProps, PainLoggerProps, painPhrase(), PhaseAura(), PhaseAuraProps (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (48): Add a new Convex mutation, Add a new dashboard component, Architecture, Authentication & Authorization, Authorization Flow, Browser Testing, Building and Running, CB Connect - Project Context (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (16): convex, DashboardSkeleton(), LoadingSkeletonProps, crons, CurrentPhaseProps, navItems, NutritionSuggestions(), NutritionSuggestionsProps (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (36): 🚀 Active Development, 📋 Backlog, CB Connect - Issues & Feature Tracker, code:markdown (### Feature Name), ✅ Completed, Data Export, Design Principles, Development Guidelines (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (33): Clipboard API not working, code:tsx ("use client";), code:tsx (const handleCopyCode = async (codeToCopy: string) => {), code:tsx (const handleGenerateCode = async () => {), code:bash (git add app/\(dashboard\)/dashboard/partner/page.tsx), code:tsx (const handleRevokeAccess = async () => {), code:bash (git add app/\(dashboard\)/dashboard/partner/page.tsx), code:bash (npm run lint) (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (35): 1. Dashboard Partner Status Card, 2.1 Auto-Copy on Generate, 2.2 Copy & Share Buttons, 2.3 Revoke Confirmation, 2. Partner Page Enhancements, 3. Connection Status Bar, 4. Navigation Flow, Accessibility (+27 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (25): Build errors, CI/CD with GitHub Actions, code:bash (# 1. Clone the repository), code:bash (# Install PM2 globally), code:bash (# View app status), code:env (# Server Configuration), code:bash (# Find and kill the process), code:bash (# Clean and rebuild) (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (24): code:block1 (URL: http://localhost:3000/sign-in?redirect_url=http%3A%2F%2), code:tsx ("Connected with {partnerName}"), code:tsx (<div), code:block12 (b4d8aec docs: update issues.md with testing guide and mark i), code:tsx (// OnboardingFlow.tsx lines 91-106), code:typescript (// lib/utils.ts), code:tsx (// partner/page.tsx), code:tsx (// partner/page.tsx - handleGenerateCode) (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (20): 1. Sanctuary Shell, 2. Phase Aura, 3. Tactile Check-In, 4. Partner Pulse, 5. Digital Locket Pairing, 6. Auth Continuity, 7. Empathy Notification Model, Accessibility Rules (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (21): 14.1 Environment Setup, 14.2 Docker Containerization, 14.3 Deployment Pipeline, 14.4 Container Orchestration, 14.5 Database Migrations, 14.6 Infrastructure as Code, 14. Deployment & DevOps, code:bash (# .env.local) (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (17): 7.1 Mutations (Write Operations), 7.2 Queries (Read Operations), 7. API/Function Specifications, code:typescript (// convex/mutations/painLog.ts), code:typescript (export const logPeriodStart = mutation({), code:typescript (export const updateCycleSettings = mutation({), code:typescript (export const linkPartnerWithCode = mutation({), code:typescript (export const revokePartnerAccess = mutation({) (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (16): Authentication Dependency, Automated Tests Created, Browser Compatibility, CB Connect - E2E Test Results, Conclusion, Convex Function Authentication, Immediate, Known Limitations (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (15): 10. Empty And Error States Need A Voice, 1. The App Still Has A SaaS Skeleton, 2. Landing Page Sells Features Instead Of Trust, 3. Dashboard Does Not Tell A Daily Story, 4. Pain Logging Is Too Clinical, 5. Partner UX Is Still Too Passive, 6. Pairing Feels Like Device Authorization, 7. Clerk Auth Breaks The Mood (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): 6.1 Pain & Period Logging, 6.2 Cycle Phase Detection, 6.3 Partner Linking Flow, 6.4 Tips & Nutrition System, 6. Core Features - Technical Specifications, Code Generation Algorithm, code:typescript (// convex/_helpers/cycleCalculations.ts), code:block11 (Primary User                     Convex                     ) (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (12): 9.1 Discord Webhook Integration, 9.2 Notification Triggers, 9. Notification System, code:typescript (// convex/actions/discord.ts), code:typescript (// Trigger from linkPartnerWithCode mutation), code:typescript (// Trigger from createOrUpdatePainLog mutation), code:typescript (// convex/crons.ts), code:typescript (// convex/actions/notifications.ts) (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (11): 5.1 Clerk Integration, 5.2 Authorization Patterns, 5. Authentication & Authorization, code:typescript (// app/layout.tsx), code:typescript (// convex/auth.config.js), code:typescript (// convex/_helpers/auth.ts), code:typescript (// convex/_helpers/permissions.ts), Convex + Clerk Integration (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (10): 10.1 Project Structure, 10.2 Key Components, 10. Frontend Architecture, code:block28 (cb-connect/), code:typescript (// app/(dashboard)/page.tsx), code:typescript (// components/dashboard/PainLogger.tsx), code:typescript (// components/partner/PartnerDashboard.tsx), Pain Logger Component (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.2
Nodes (9): CB Connect Design Overhaul Implementation Plan, Task 1: Establish Design Tokens And Shell, Task 2: Remove Auth Flashbang, Task 3: Build Phase Aura Dashboard Anchor, Task 4: Replace Pain Slider With Tactile Check-In, Task 5: Reframe Partner Experience, Task 6: Upgrade Pairing Into Digital Locket, Task 7: Document Backend Notification Direction (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (4): metadata, ThemeProvider(), ThemeProviderProps, convex

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (7): AGENTS, Available Skills, Common Commands, Important Paths, Project Context, Stack, Working Notes

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (8): 15.1 Authentication Security, 15.2 Authorization Checks, 15.3 Data Privacy, 15.4 Input Sanitization, 15.5 Rate Limiting, 15. Security Considerations, code:typescript (// BEFORE returning any health data), code:typescript (// Limit pairing code generation to 5 per hour)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): 2.1 Core Technologies, 2.2 Development Tools, 2. Technology Stack, Appendix C: Glossary, CB Connect - Technical Product Requirements Document (PRD), Document Revision History, Table of Contents

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (8): 12.1 Input Validation, 12.2 Error Boundaries, 12.3 Mutation Error Handling, 12. Error Handling & Validation, code:typescript (args: {), code:typescript (if (args.painScore < 0 || args.painScore > 10) {), code:typescript (// components/common/ErrorBoundary.tsx), code:typescript (// Frontend pattern)

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (8): 3.1 High-Level Architecture, 3.2 Data Flow Patterns, 3. System Architecture, code:block1 (┌───────────────────────────────────────────────────────────), code:block2 (User Action → Optimistic UI Update → Convex Mutation → Datab), code:block3 (Partner Dashboard Load → Convex Query (with user permissions), Read Flow (Partner Views Dashboard), Write Flow (Primary User Logs Pain)

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (7): 13.1 Unit Tests (Vitest), 13.2 Integration Tests (Convex Test Mode), 13.3 E2E Tests (Playwright), 13. Testing Strategy, code:typescript (// convex/_helpers/cycleCalculations.test.ts), code:typescript (// convex/tests/painLog.test.ts), code:typescript (// tests/e2e/dashboard.spec.ts)

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (7): 17. Implementation Phases, Phase 1: Foundation (Week 1-2), Phase 2: Cycle Logic (Week 3), Phase 3: Tips System (Week 4), Phase 4: Partner Features (Week 5-6), Phase 5: Notifications (Week 7), Phase 6: Polish & Testing (Week 8)

### Community 28 - "Community 28"
Cohesion: 0.38
Nodes (4): Fixtures, test, UserData, codeInput

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (6): code:block1 (Error: page.goto: net::ERR_NETWORK_CHANGED at http://127.0.0), code:ts (1  | import { test, expect } from "@playwright/test";), Error details, Instructions, Test info, Test source

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): DataModel, Doc, Id, TableNames

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): ActionCtx, DatabaseReader, DatabaseWriter, MutationCtx, QueryCtx

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (6): 16.1 Target Metrics, 16.2 Optimization Strategies, 16.3 Monitoring, 16. Performance Requirements, code:typescript (// Already defined in schema), code:typescript (// Add performance logging to critical paths)

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (6): 8.1 Convex Real-time Subscriptions, 8.2 Optimistic Updates, 8. Real-time Sync & State Management, Client-Side Pattern, code:typescript (// app/dashboard/page.tsx), code:typescript (// hooks/useOptimisticPainLog.ts)

### Community 34 - "Community 34"
Cohesion: 0.4
Nodes (5): 11.1 Cycle Tracking Algorithm, 11.2 Period Auto-End Logic, 11.3 Nutrition Tip Rotation, 11. Business Logic & Algorithms, code:typescript (// Convex scheduled function (runs daily))

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (4): 4.1 Convex Schema Definition, 4.2 Derived Data (Computed in Queries), 4. Data Schema, code:typescript (// convex/schema.ts)

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (4): Actions, Appendix B: API Reference Summary, Mutations, Queries

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (3): emailInput, passwordInput, submitButton

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (3): config, isProtectedRoute, signInUrl

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): 1.1 Product Summary, 1.2 Technical Goals, 1. System Overview

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): Appendix A: Sample Data Structures, code:json ({), Example Dashboard Data Response

## Knowledge Gaps
- **339 isolated node(s):** `path`, `nextConfig`, `isProtectedRoute`, `signInUrl`, `config` (+334 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CB Connect - Technical Product Requirements Document (PRD)` connect `Community 22` to `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 40`, `Community 41`, `Community 10`, `Community 11`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 21`, `Community 23`, `Community 24`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `14. Deployment & DevOps` connect `Community 10` to `Community 22`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `7. API/Function Specifications` connect `Community 11` to `Community 22`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `path`, `nextConfig`, `isProtectedRoute` to the rest of the system?**
  _339 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._