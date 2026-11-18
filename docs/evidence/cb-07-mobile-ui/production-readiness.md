# Production APK compatibility preflight

Read-only observation on 2026-11-17. This records release prerequisites; no
production functions, flags, auth settings or accounts were changed.

| Check | Result | Evidence |
|---|---|---|
| Web health/readiness | PASS | `https://cb.builtbynaki.tech/api/health` and `/api/ready` HTTP 200 (browser user agent); readiness `ready` |
| Web identity | PASS | Frontend `a7756d8909434b460183c1f7bf16ae9d06cc5e20`, build `run-38642524156-1`; backend `prod:festive-malamute-715`, compatibility `v1` |
| Production Convex URL | PASS | Convex deployment discovery: `https://festive-malamute-715.convex.cloud` |
| Deployed mobile entry points | FAIL | 47/50 inventory references present; missing `queries.mobileAccess.getGuardState`, `queries.messages.listPageForMobile`, `queries.notifications.getMyInboxAvailability` |
| CB-06 conditional cycle contract | FAIL | Deployed `mutations.periods.updateCycleSettings` lacks `expectedCurrent`; source requires it for conditional settings saves |
| CB-04 relationship-bound clear contract | FAIL | Deployed `mutations.messages.clear` lacks the optional `relationshipGeneration` argument used by the native clear control |
| Clerk production instance | PASS | Public FAPI environment identifies production, home `https://cb.builtbynaki.tech` |
| Clerk native auth | BLOCKED | Public FAPI `auth_config.native_settings.api_enabled` is `false`; native application/callback registration still needs verification |
| Clerk token/redirect preflight | PARTIAL | Current production instance/domain confirmed through read-only API; Convex JWT template exists; SSO redirect list is empty |
| Production sign-in/readback | NOT RUN | Missing native auth and backend contracts prevent a valid release journey |
| Production APK delivery | BLOCKED | Cannot qualify or distribute as working production while required runtime/auth contracts are absent |

The owner's new request authorizes a production-compatible APK and private
delivery to the named recipient. Packaging work now uses an explicit
`production` profile with an exact live Clerk issuer and Convex endpoint.
The default remains the approved `synthetic` profile. Mixed issuer/endpoint
combinations and unknown profiles fail closed. Production app ID is
`tech.builtbynaki.cbconnect`; the synthetic `.beta` app remains separate.
Profiles are build-time inputs, not an in-app environment switch.

Required next acceptance: the existing stack must be accepted and its compatible
backend released through the established deployment path; native production
Clerk registration/API and token integration must be verified; then the signed
standalone APK must pass the production rows of the canonical QA checklist.
No UI workaround or fallback to test accounts resolves these prerequisites.

Rechecked mobile public-function metadata during the resumed 2026-11-18 run: the same three references remain absent; deployed cycle-save and chat-clear argument schemas differ from the qualified synthetic target. This is metadata evidence, not authenticated production acceptance.

A further 2026-11-18 refresh used the Convex connector's explicitly read-only
production selector and function metadata (no user-data reads or writes).
Synthetic exposes all 50 required mobile references; production still exposes
47. The same three names are missing, with no kind/visibility differences in
the remaining references; cycle-save and chat-clear argument schemas still
differ. Public web readiness remains HTTP 200/ready at the recorded frontend
`a7756d8` and backend deployment timestamp, and the production Clerk public
environment still reports native API disabled. Unauthenticated public query
errors are generic server errors and were not treated as authenticated or
contract evidence; the metadata comparison is the basis for this finding.

The current Clerk hosted-auth setup guide requires enabling Native API and
registering the native app before creating its production build. This client
uses `useHostedAuth` without a custom redirect; the default callback derives
from the Android namespace/package, and the Clerk Expo plugin registers its
intent filter. Production namespace/package is `tech.builtbynaki.cbconnect`.
Native-app registration must be verified in Clerk's Native applications page;
an empty SSO redirect list alone does not establish that registration state.
See https://clerk.com/docs/guides/account-portal/hosted-auth. No production auth
setting or registration was changed by this preflight.


Fresh supervisor recheck during the final signed-build run on 2026-11-18:
public health/readiness remain HTTP 200 at frontend `a7756d8`, build
`run-38642524156-1`, compatibility `v1`, backend `prod:festive-malamute-715`.
The explicitly read-only production metadata selector still lacks the same
three mobile entries; conditional cycle and generation-bound clear arguments
remain absent. Public Clerk native API remains false. No production setting,
data, account, function or registration was changed. The new synthetic APK
cannot satisfy production interoperability against that deployed contract.
