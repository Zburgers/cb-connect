# Mobile UX parity checklist

Baseline: `b851ff19c93810b7c29cab0386fb2a245030829e`. This is a source-level checklist, not evidence of completed native journeys.

| Journey | Mobile coverage | Remaining gap |
| --- | --- | --- |
| Cycle home | Server-derived cycle state and prediction, with a log shortcut | Web nutrition and pain guidance and partner care actions are absent. |
| Logging and history | Period start/end, pain, history and authorized correction; primary date shortcuts | Dates are still text fields; pain uses a numeric input and stepper; history is not the web timeline and CSV export is absent. Deletion remains blocked by D-012. |
| Partner and chat | Pairing, presence, sharing controls, revoke, nudges and chat | Relationship date, nickname, native code sharing and chat clearing are absent. Replacement-partner isolation remains subject to D-018. |
| Inbox | Server-gated inbox, read/dismiss and partner/settings navigation | Inbox availability is default-off; push is not implemented. |
| Settings | Name, time zone, notification preferences, prediction pause and baseline, sharing | Cycle and period lengths and other web personalization controls are absent. |
| Onboarding | Server-confirmed role and time zone, then pairing | Initial period setup is deferred to logging; the web has a richer setup flow. |

Native capture protection remains unqualified: see `docs/security/2026-10-27-gate-5-android-qualification.md` and `issues.md`. Emulator, synthetic-account, physical-device and release evidence are separate.

## Shortest path to an owner-only Android beta

1. Complete the native UI and authenticated synthetic two-account journeys, including revocation and account switching, on the exact candidate; fix the capture inconsistency and verify privacy on physical Android.
2. Resolve or explicitly disposition applicable dependency advisories and D-018; obtain the required exact-head privacy review. D-012 still blocks destructive behavior.
3. Separately authorize and verify the owner-only production authentication/backend configuration, then build and verify an owner-controlled signed Android artifact and its install/update path. Keep broader distribution and production changes outside this sprint.
