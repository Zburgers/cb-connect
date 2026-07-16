# Mobile Contracts, Offline Time, and Device Security

| Field | Value |
|---|---|
| Status | Deferred architecture decision record; not approved for implementation |
| Owner | CB Connect product, mobile, backend, and security |
| Earliest milestone | After v0.2.0 Gate 0, Care Loop pilot evidence, and stable DTO contracts |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | Specs 01-05 deployed; stable DTO/time/idempotency contracts; approved mobile product decision |
| Candidate stack | Expo / React Native with Expo Router, Clerk, and the existing Convex backend |

## Decision

Do not create the mobile app or reorganize the repository during v0.2.0.
Record the backend contracts that prevent web and native from diverging, then
promote this document only after Care Loop proves useful and the trust gates are
complete.

The eventual mobile app is another client of the same product and permission
model. It is not a second backend, a WebView wrapper, or a reason to weaken
server authorization.

## Promotion prerequisites

- Canonical token identity and relationship lifecycle are deployed.
- Owner and partner home/Care Card DTOs are typed and stable.
- Care Loop pilot meets its usefulness and privacy guardrails.
- Server time, IANA timezone, calendar date, revision, and idempotency semantics
  are implemented on web first.
- Notification event/outbox and device revocation contracts are approved.
- Product has staffed iOS/Android accessibility, security, privacy, and release
  operations.

## Contract decisions that affect current backend work

### Stable role-specific DTOs

Define versionable `PrimaryHomeDto`, `PartnerHomeDto`, `CareOwnerRequestDto`,
`CareCardDto`, `PrivacySummaryDto`, and `TimelineEntryDto`. The two Care Loop
contracts retain the canonical names and meanings from spec 04. Database
documents remain private. New fields are additive; removing or changing meaning
requires a contract version.

### Time model

- Persist a user IANA `timeZone` and `locale`.
- Store local calendar dates separately from occurrence timestamps.
- Record server receipt time for ordering and audit.
- Preserve source zone offset for imported/timestamped events.
- Never trust a client-supplied date as authorization or expiry truth.
- Define travel behavior: historical events retain original calendar context;
  active expiry uses the absolute server timestamp shown in the user's current
  locale.

### Offline mutation envelope

```ts
type ClientMutationEnvelope = {
  clientMutationId: string;
  expectedRevision?: number;
  occurredAt?: number;
  localDate?: string;
  timeZone: string;
};
```

The server authenticates the actor, validates the calendar/time relationship,
deduplicates by actor plus mutation ID, and rejects stale revisions with a safe
conflict DTO. Retrying the same envelope returns the committed result. A client
cannot choose owner, relationship, or recipient IDs as authority.

### Offline read behavior

The app may cache a redacted last-known home DTO with its server timestamp and
contract version. It must visibly label offline/stale state. Partner Care Cards
are never assumed valid from cache after expiry or revocation; opening one while
offline shows an unavailable state until authorization is refreshed.

## Device and privacy requirements

- Clerk session tokens use platform-secure storage; no token enters logs,
  analytics, screenshots, or crash metadata.
- Biometric app lock gates local presentation but is not server auth.
- App-switcher snapshots obscure private screens.
- Lock-screen notifications are generic by default.
- Device registration has owner, platform, provider token, last-seen,
  app-version, and revoked-at state.
- Sign-out, account deletion, safety reset, and provider invalid-token receipts
  revoke the device route.
- Clipboard use for invites is explicit and time-limited; deep links contain a
  single-use invite secret, never health data.
- Analytics and crash reporting scrub routes, custom care text, notifications,
  and identifiers.

## Deep links

Use universal/app links with an HTTPS fallback. Invite secrets are high entropy,
single use, short-lived, and exchanged for relationship state only after auth.
Care/inbox links contain an opaque entity reference and resolve through an
authenticated server query; the URL never carries request or health content.

Revoked, redeemed, expired, or disabled links return one generic failure state.
Avoid link values in analytics, referrers, and support logs.

## Initial mobile scope if promoted

- sign-in and onboarding;
- primary and partner home;
- lean Care Loop publish/respond/cancel;
- period and pain logging;
- pairing by link with code fallback;
- timeline read/correct within existing permissions;
- in-app inbox and generic push;
- privacy summary, unlink, and safety reset;
- explicit offline/reconnect states and biometric local lock.

Provider report customization, broad symptom tracking, learned care insights,
health import, AI, social features, and write-back remain separate decisions.

## Acceptance criteria for promotion

- [ ] Web and candidate mobile clients pass the same server permission matrix.
- [ ] Duplicate/offline writes are idempotent and stale edits cannot broaden
  sharing.
- [ ] Expired, cancelled, unlinked, or revoked Care Cards are unavailable even
  when cached.
- [ ] DST, timezone change, midnight, delayed sync, and clock-skew cases pass.
- [ ] Deep links cannot be replayed or disclose sensitive content.
- [ ] Lost/revoked devices stop receiving meaningful notifications.
- [ ] Screen reader, dynamic type, reduced motion, contrast, one-hand use, and
  platform target-size checks pass on supported iOS and Android versions.
- [ ] App-store disclosures and privacy policy match observed data flows.

## Test strategy

Share server fixtures and contract tests, not DOM/native components. Add native
tests for secure storage, app-state snapshot privacy, offline queues, conflict
resolution, deep links, notification taps, device revocation, accessibility,
and supported OS versions. Run two-device E2E for primary/partner races.

## Rollout and rollback

Use internal builds, then an allowlisted beta with independent server feature
flags. Unsupported/outdated contract versions receive a safe upgrade state.
Rollback disables new registrations, push routes, and mobile-only entry points;
it does not fork or rewrite shared data.

## Open decisions

1. Supported iOS/Android versions and Expo SDK at promotion time?
2. Expo push service first, native APNs/FCM, or a provider abstraction?
3. Which non-sensitive DTO fields may be cached and for how long?
4. Is biometric lock opt-in or default for returning users?
5. When does workspace migration create more value than repository churn?
