# CB Connect Design Guidelines

## Design Thesis

CB Connect is not a health dashboard with partner sharing. It is a private emotional space for two people navigating a sensitive body rhythm together.

The product should translate cycle data into calm, timely, actionable support. If a screen feels like admin software, medical intake, a ticketing system, or a crypto dashboard, it is wrong.

## Product Principles

1. Ambient before analytical
   The first read should be mood, phase, and support context. Numbers are secondary.

2. Consent is visible, not buried
   Sharing state must be obvious wherever partner-visible data appears. Privacy controls should feel protective, not legalistic.

3. Partner UX is action, not surveillance
   Partners should see what helps them act with care. Avoid passive monitoring language.

4. Logging must feel lightweight
   Daily tracking should be a gesture, tap, or short reflection. Long forms are reserved for setup and settings.

5. The app should remember tenderness
   Empty states, errors, and confirmations should reduce loneliness. Never leave users in a black void.

6. Data is interpreted
   Do not show raw clinical state without translation. "Pain 7/10" needs "rough day, low energy, help with dinner."

## Visual Direction

Name: Private Observatory

The interface should feel like a soft, living locket: layered glass, warm atmospheric light, organic motion, and quiet editorial typography. Avoid neon-purple SaaS glass. Use glass sparingly over phase-aware light fields.

### Surface Language

- Backgrounds use soft radial gradients and blurred aura fields.
- Cards use translucent warm glass with subtle borders and hue-shifted shadows.
- Major components should have large rounded radii: `28px`, `36px`, and full pill forms.
- Avoid thin outlined cards stacked everywhere. A screen should have one dominant emotional object and supporting satellites.
- Use warm/cool depth: warm foreground accents, cooler recessed shadows.

### Color System

Phase color is not decoration. It is app state.

| Phase | Mood | Primary Hues | Avoid |
| --- | --- | --- | --- |
| Menstruation | protected, warm, low-energy | clay, oxblood, rosewood, cream | alarm red, hospital red |
| Follicular | lighter, rebuilding | apricot, blush, honey, soft green | neon green |
| Ovulation | expressive, luminous | coral, gold, hibiscus, champagne | warning yellow |
| Luteal | grounded, sensitive | fig, mauve, indigo, dusk blue | default purple SaaS |

Functional colors stay conventional:

- Error: red, but softened and text-explicit.
- Success: green, paired with copy or icon.
- Warning: amber, never used as a phase color alone.
- Links/actions: brand coral or phase-aware action color.

### Typography

Use editorial contrast.

- Display: warm serif stack for emotional headings.
- Body/UI: crafted geometric or humanist sans stack.
- Numeric/data: tabular geometric stack.
- Do not let every label share the same weight and size.

Recommended CSS stacks:

```css
--font-display: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
--font-ui: "Avenir Next", Avenir, "Helvetica Neue", Helvetica, sans-serif;
--font-mono: "SFMono-Regular", "Cascadia Mono", "Roboto Mono", monospace;
```

### Motion

Motion should communicate state and emotional texture.

- Page entry: slow fade + upward drift, 360-520ms.
- Phase aura: continuous but subtle; slower and heavier during high pain.
- Logs: tactile snap, not generic bounce.
- Partner events: soft pulse and arrival, not alert banners.
- Reduced motion must disable decorative loops.

## Core Artifacts

### 1. Sanctuary Shell

Purpose: App-wide background, typography, phase-aware atmosphere, and glass primitives.

Files:

- `app/globals.css`
- `tailwind.config.js`
- `components/common/SanctuaryShell.tsx`
- `components/common/GlassPanel.tsx`

Requirements:

- Supports `phase` and `intensity`.
- Works for auth, landing, dashboard, and partner screens.
- Keeps content readable in light and dark modes.

### 2. Phase Aura

Purpose: Replace "Current Phase" dashboard cards with a living state object.

Behavior:

- Shows phase, cycle day, period estimate, and emotional interpretation.
- Uses a large blurred orb with phase-specific gradients.
- Pain intensity affects pulse speed, scale, and contrast.
- Partner sees the same aura with support-oriented copy.

Files:

- `components/dashboard/PhaseAura.tsx`
- Replace or wrap `components/dashboard/CurrentPhase.tsx`

### 3. Tactile Check-In

Purpose: Replace numeric-first pain logging with a feeling-first interaction.

Behavior:

- User chooses a plain-language state first: "Clear", "Tender", "Heavy", "Rough".
- Numeric score remains available but subordinate.
- Symptom chips use body-language labels, not database terms only.
- Save confirmation should feel like relief, not form submission.

Files:

- `components/dashboard/TactilePainLogger.tsx`
- Replace or wrap `components/dashboard/PainLogger.tsx`

### 4. Partner Pulse

Purpose: Convert partner dashboard from monitoring to care action.

Behavior:

- Shows "what today asks from you."
- Provides care chips: "Send check-in", "Plan quiet evening", "Pick up comfort food", "Give space".
- Explains visibility: "Shared with consent."
- Avoids raw surveillance language.

Files:

- `components/partner/PartnerPulse.tsx`
- `components/partner/PartnerDashboard.tsx`

### 5. Digital Locket Pairing

Purpose: Make partner linking feel like creating a shared private space.

Behavior:

- Primary sees a visual locket/pattern and code.
- Partner enters code into a matching ritual UI.
- Existing 6-digit code remains for MVP reliability.
- Future: QR/deep link and real-time fusion animation.

Files:

- `components/partner/DigitalLocket.tsx`
- `app/(dashboard)/dashboard/partner/page.tsx`

### 6. Auth Continuity

Purpose: Remove Clerk flashbang.

Behavior:

- Auth pages use the Sanctuary Shell.
- Clerk appearance variables match CB Connect tokens.
- Copy explains privacy before sign-in.

Files:

- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

### 7. Empathy Notification Model

Purpose: Replace Discord as the product notification surface.

MVP:

- Keep notification logging table.
- Stop framing Discord as product UX.
- Add an internal `partnerEvents` or `careEvents` table before push notifications.

Future schema:

- `careEvents`: sender, recipient, couple, type, message, createdAt, readAt.
- `notificationPreferences`: user, partner nudges, pain threshold, quiet hours.
- `partnerActions`: action type, payload, createdAt.

## UX Copy Rules

Do:

- "Rough afternoon. A quiet check-in would help."
- "Shared with consent."
- "Today looks like a low-energy day."
- "Invite your partner into this space."

Do not:

- "Pain Status: 7/10"
- "Partner Dashboard"
- "Generate Pairing Code"
- "User has logged high pain"
- "Revoke access" without softer context and confirmation

## Accessibility Rules

- Minimum touch target: `44px`.
- Never encode phase by color alone; include label and icon/text.
- Decorative aura elements are `aria-hidden`.
- Motion respects `prefers-reduced-motion`.
- All custom controls must support keyboard interaction or expose native inputs.

## Design Review Checklist

- Is there one dominant emotional anchor on the screen?
- Does the screen explain what the partner should do next?
- Can the primary user tell what is shared?
- Does the empty state feel human?
- Does the UI avoid clinical language unless medically necessary?
- Does the phase color change meaningfully without harming readability?
- Are raw numbers translated into plain-language support?
- Does this feel private enough for menstrual and relationship data?
