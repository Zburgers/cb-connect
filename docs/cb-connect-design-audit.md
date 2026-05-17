# CB Connect Design Audit

## Executive Read

CB Connect has working MVP mechanics: auth, Convex sync, cycle data, pain logging, partner pairing, and partner-visible dashboard state. The product problem is not functionality. The problem is that the interface still behaves like a database client with a wellness skin.

A premium couples app needs a point of view: "Here is what today means, here is how to care, here is what is private." The current app often says: "Here are rows, scores, toggles, and a pairing code."

## What Is Weak Or Incomplete

### 1. The App Still Has A SaaS Skeleton

The dominant pattern is stacked rounded cards with gradients. This is usable, but it is not memorable. The UI repeats the same glass-card pattern for phase, pain, nutrition, tips, partner status, and empty states. When every object has similar weight, nothing feels important.

Direction:

- One emotional hero per screen.
- Supporting modules should be quieter.
- Cards should not be the default answer to every layout problem.

### 2. Landing Page Sells Features Instead Of Trust

"Cycle tracking," "pain logging," "notifications," and "privacy" are table stakes. They do not explain why a couple should trust this app with intimate health and relationship data.

Direction:

- Lead with the emotional promise: fewer awkward guesses, more useful care.
- Show consent and partner asymmetry immediately.
- Avoid feature-grid sameness.

### 3. Dashboard Does Not Tell A Daily Story

The primary dashboard currently lists modules. A high-value dashboard should answer four questions within seconds:

- What phase is today?
- How does the body feel?
- What should I do now?
- What can my partner do without being intrusive?

Direction:

- Phase Aura becomes the main anchor.
- Pain check-in becomes feeling-first.
- Tips and nutrition become secondary contextual support.

### 4. Pain Logging Is Too Clinical

A 0-10 slider is valid data entry, but as the leading interaction it feels like emergency-room triage. It also fails to capture emotional nuance.

Direction:

- Lead with plain-language states: Clear, Tender, Heavy, Rough.
- Keep numeric scoring for history and compatibility.
- Make notes partner-aware without forcing sharing.

### 5. Partner UX Is Still Too Passive

The partner experience is mostly "view status." That risks surveillance. A partner does not need a mirrored dashboard; they need a support mode.

Direction:

- Replace "Pain Status" with "How today feels."
- Add care actions and anti-actions.
- Surface consent state near shared data.

### 6. Pairing Feels Like Device Authorization

The 6-digit code is fine as infrastructure, but the screen should make linking feel like opening a private shared space, not pairing a TV remote.

Direction:

- Keep the code for reliability.
- Wrap it in a Digital Locket visual.
- Explain expiry, privacy, and what happens after linking.

### 7. Clerk Auth Breaks The Mood

Default auth pages make the product feel unfinished. For sensitive health-adjacent apps, auth is part of trust design.

Direction:

- Match auth surface to the Sanctuary Shell.
- Add short privacy copy before sign-in/sign-up.
- Style Clerk appearance variables.

### 8. Discord Notifications Are Product-Wrong

Discord webhooks are acceptable for an MVP delivery adapter, but they are the wrong user-facing mental model for menstrual and relationship data. They create privacy risk and emotional mismatch.

Direction:

- Do not rip out the backend path without a replacement.
- Add an outbox and consent model first.
- Move toward in-app care events and push notifications later.

### 9. Consent Is Technically Present But Visually Weak

The backend has sharing flags, but the UI does not consistently show what is shared at the moment of use. In an intimate app, hidden consent controls are not enough.

Direction:

- Every partner-visible block should explain why it is visible.
- Sharing settings should use plain language.
- Revocation should be protective, not scary.

### 10. Empty And Error States Need A Voice

"No data yet" is lonely. "Invalid code" is abrupt. "Not linked" is mechanical. These are high-emotion states and should be designed.

Direction:

- Empty states should explain the next caring action.
- Errors should say what happened and what to do next.
- Avoid blame and surveillance framing.

## Priority Fixes

1. Establish design foundations: tokens, shell, typography, phase palette.
2. Replace the dashboard hero with Phase Aura.
3. Replace pain logging with Tactile Check-In.
4. Reframe partner dashboard around care actions.
5. Upgrade pairing into Digital Locket.
6. Style auth to match the product.
7. Add visible consent language to partner surfaces.
8. Plan backend notification replacement through outbox, preferences, and care events.

## Non-Negotiable Product Rules

- Do not show sensitive body data without translating it into care context.
- Do not make partner visibility feel like monitoring.
- Do not use Discord as a long-term product notification surface.
- Do not hide consent in settings only.
- Do not let generic glassmorphism replace actual hierarchy.
- Do not use phase colors as decoration without meaning.
