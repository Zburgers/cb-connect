# CB Connect conventions

- Keep App Router routing in `app/`; use the existing dashboard layout rather than introducing a parallel shell (`AGENTS.md`, `app/(dashboard)/layout.tsx`).
- Use Convex public function validators and derive authorization from `ctx.auth`; keep private scheduled/webhook helpers internal (`convex/_generated/ai/guidelines.md`, `convex/`).
- Prefer indexed and bounded Convex reads; avoid unbounded `.collect()` for user-facing lists (`convex/_generated/ai/guidelines.md`).
- Use existing providers from `app/layout.tsx` and `lib/ConvexClientProvider.tsx` for Clerk and Convex integration.
- Use theme variables for glass surfaces and foreground text as specified in `AGENTS.md`; do not hardcode white translucent overlays for dynamic text.
- Record evidence-backed unresolved work in `issues.md`, preserving the existing `--` separator convention.
