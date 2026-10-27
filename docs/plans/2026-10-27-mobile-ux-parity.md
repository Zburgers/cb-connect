# Mobile UX parity checklist

Baseline: `b851ff19c93810b7c29cab0386fb2a245030829e`. The matrix records source-level parity; runtime evidence for the candidate is below.

| Journey | Mobile coverage | Remaining gap |
| --- | --- | --- |
| Cycle home | Server-derived cycle state and prediction, with a log shortcut | Web nutrition and pain guidance and partner care actions are absent. |
| Logging and history | Period start/end, pain, history and authorized correction; primary date shortcuts | Dates are still text fields; pain uses a numeric input and stepper; history is not the web timeline and CSV export is absent. Deletion remains blocked by D-012. |
| Partner and chat | Pairing, presence, sharing controls, revoke, nudges and chat | Relationship date, nickname, native code sharing and chat clearing are absent. Replacement-partner isolation remains subject to D-018. |
| Inbox | Server-gated inbox, read/dismiss and partner/settings navigation | Inbox availability is default-off; push is not implemented. |
| Settings | Name, time zone, notification preferences, prediction pause and baseline, sharing | Cycle and period lengths and other web personalization controls are absent. |
| Onboarding | Server-confirmed role and time zone, then pairing | Initial period setup is deferred to logging; the web has a richer setup flow. |

**Out of scope for this PR:** physical-device qualification and screen-capture privacy qualification. The existing app privacy shield remains unchanged; this sprint makes no claim about its screenshot or recording effectiveness. Emulator product screenshots and authenticated journeys are recorded below.

## Candidate runtime evidence (2026-10-28)

- **PASS:** Android 17 emulator sign-in with the persistent synthetic primary and partner accounts; role onboarding; primary-to-partner pairing; same-device account switching.
- **PASS:** Native partner chat send followed by partner-session readback (`Read` confirmation). The message appears in the evidence screenshots.
- **PASS:** Period logging screen, partner sharing controls, and settings navigation render on the device.
- **BLOCKED by test backend availability:** Home receives no cycle-state presentation for either role, and Inbox says access is unavailable. Mobile shows the safe empty state and does not synthesize health predictions.
- **NOT RUN:** Physical-device and screen-capture privacy qualification. Both are explicitly outside this PR's scope.

Screenshots and capture notes: `docs/evidence/mobile-ux/README.md`.

## Shortest path to an owner-only Android beta

1. Complete emulator UI screenshots and authenticated synthetic two-account journeys, including revocation and account switching, on the exact candidate.
2. Resolve or explicitly disposition applicable dependency advisories and D-018; obtain the required exact-head source review. D-012 still blocks destructive behavior.
3. Separately authorize and verify the owner-only production authentication/backend configuration, then build and verify an owner-controlled signed Android artifact and its install/update path. Keep broader distribution and production changes outside this sprint.
