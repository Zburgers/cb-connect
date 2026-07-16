# Confidence-Aware Cycle Insights

| Field | Value |
|---|---|
| Status | Validated next-candidate; excluded from the v0.2.0 implementation scope |
| Owner | CB Connect product, data, and clinical-content review |
| Milestone | After the v0.2.0 trust and Care Loop pilot gates |
| Last validated | 2026-07-17 against `main` at `4afd1ceb0640a7da96396b5488178aa1e7fe4e29` |
| Dependencies | Trust Gate 0; consistent date/time semantics; confirmed period history; approved medical-boundary copy |

## Decision

Replace exact-looking deterministic dates with evidence-aware windows only after
v0.2.0. The current prediction should not gain more apparent precision before
the product can distinguish observed data, user confirmation, variability, and
algorithm version.

This is product information, not diagnosis, contraception guidance, or a claim
that a future event will occur.

## Current behavior

`convex/_helpers/cycleCalculations.ts` calculates today from the most recent
period start and fixed user-configured cycle/period lengths. The result is
composed in `convex/queries/dashboard.ts`. Current storage does not record:

- confirmed-cycle count or variability;
- observed versus estimated boundaries;
- prediction provenance or input revision;
- confidence or data-quality reason;
- algorithm version and evaluation result;
- IANA timezone or event zone offset.

The model is acceptable as an early approximation but must not be described as
personalized predictive evidence.

## Product contract

### Minimum inputs

A projection may be computed only from valid, owner-confirmed period starts.
Partner-assisted `unreviewed` events do not enter the confirmed sample until the
owner confirms them. Imported records, if later supported, require provenance
and explicit confirmation policy.

The first algorithm uses:

- at least three confirmed completed cycles;
- at most the most recent twelve eligible cycles;
- cycle length derived between consecutive confirmed starts;
- average period length from confirmed ends only;
- data revision, timezone, and algorithm version.

With fewer than three eligible cycles the UI says that more confirmed history is
needed and shows no projected date/window.

### Output contract

```ts
type CycleConfidence = "low" | "moderate" | "high";

type CycleProjectionDto = {
  status: "insufficient_data" | "available" | "stale";
  windowStart?: string; // YYYY-MM-DD in owner time zone
  windowEnd?: string;
  confidence?: CycleConfidence;
  confirmedCycleCount: number;
  cycleLengthAverage?: number;
  cycleLengthVariationDays?: number;
  explanation: string;
  algorithmVersion?: string;
  computedAt?: number;
  inputRevision?: number;
};
```

The partner receives a separate DTO only when phase sharing permits it. It must
not include raw period dates or a confidence explanation that reveals hidden
history.

## Initial confidence policy

An initial implementation candidate uses transparent thresholds, not machine
learning:

| Eligible history | Variation | Output |
|---|---:|---|
| Fewer than 3 cycles | Any | Insufficient data; no window |
| 3-5 cycles | Up to 7 days | Low confidence; wider observed-range window |
| 6+ cycles | 5-7 days | Moderate confidence; observed-range window |
| 6+ cycles | Up to 4 days | High confidence; never narrower than three calendar days |
| Any | More than 7 days | Low confidence or suppress when the observed range is not useful |

Variation and thresholds must be reviewed with an appropriate health-content
expert before implementation. They are product-display rules, not clinical
classification.

The implementation stores the policy version. A later policy change creates a
new version; it never silently rewrites the historical meaning of an older
projection.

## Proposed projection record

```ts
cycleProfiles: defineTable({
  ownerUserId: v.id("users"),
  confirmedCycleCount: v.number(),
  averageCycleLength: v.optional(v.number()),
  cycleLengthVariationDays: v.optional(v.number()),
  averagePeriodLength: v.optional(v.number()),
  predictionWindowStart: v.optional(v.string()),
  predictionWindowEnd: v.optional(v.string()),
  confidence: v.optional(
    v.union(v.literal("low"), v.literal("moderate"), v.literal("high"))
  ),
  status: v.union(
    v.literal("insufficient_data"),
    v.literal("available"),
    v.literal("stale")
  ),
  inputRevision: v.number(),
  algorithmVersion: v.string(),
  computedAt: v.number(),
}).index("by_owner_user_id", ["ownerUserId"])
```

This is a replaceable projection, not the source of truth. Period events and
their confirmation/provenance remain canonical. Explanatory text is rendered
from bounded reason codes and locale, not stored as arbitrary health content.

## Recompute and correction flow

1. A valid period create, correction, confirmation, deletion, or import change
   increments the owner's input revision transactionally.
2. A scheduled internal function recomputes the profile from a bounded indexed
   history query.
3. The computation writes only if the expected input revision is still current.
4. Reads return `stale` while a newer revision is pending and do not present the
   old window as current.
5. User confirmation of an observed start records the evaluation difference
   against the projection version that was visible at that time.

Deleting or correcting source data recomputes the projection; it does not leave
deleted dates embedded in a cached explanation or analytics payload.

## Privacy and medical boundaries

- Never describe a projected day as certain, late, abnormal, safe, fertile, or
  diagnostic.
- Do not use the projection for contraception, emergency triage, or pregnancy
  claims.
- Do not notify a partner of a correction, low-confidence label, or missing
  history unless an independently authorized feature requires it.
- Do not put exact projected dates in lock-screen notifications by default.
- Store only the statistics required to explain the result.
- Allow the owner to correct, exclude, export, and delete source records.

## Acceptance criteria

- [ ] Fewer than three confirmed cycles produces no projected window.
- [ ] Unreviewed partner-assisted events are excluded.
- [ ] Every visible projection shows a window, confidence, source count, and
  plain-language data-quality explanation.
- [ ] Windows widen or disappear as variability increases; no single exact date
  is presented as the prediction.
- [ ] Corrections and deletions invalidate the old input revision.
- [ ] Owner and partner DTOs enforce independent visibility rules.
- [ ] Algorithm and policy versions are recorded and rollback-safe.
- [ ] Timezone, DST, travel, leap-day, month-end, and future-date cases pass.
- [ ] Copy and thresholds receive product, privacy, and health-content review.

## Test plan

1. Unit-test date ordering, completed-cycle derivation, variation, thresholds,
   minimum sample, window bounds, and deterministic versioned output.
2. Test missing end dates, duplicate starts, corrected dates, unreviewed partner
   records, legacy rows, and deleted source records.
3. Test revision races: two source edits, stale recompute, retry, and rollback to
   an older algorithm version.
4. Test owner/partner DTOs with phase sharing on, off, revoked, and expired.
5. Test calendar behavior in multiple IANA zones across DST and midnight.
6. E2E-test insufficient, low, moderate, high, stale, corrected, and hidden
   states with non-color accessibility cues.

## Telemetry and evaluation

Track aggregate counts by algorithm version and confidence band, computation
latency, stale duration, correction rate, and absolute window miss distance.
Do not send period dates, window dates, health notes, user identifiers, or small
cohort slices to general analytics.

Promotion requires a predeclared evaluation set and acceptable calibration: a
confidence label must correspond to measured coverage, not marketing language.

## Rollout and rollback

Build the projection additively and keep the current calculation behind a
server flag during internal comparison. Begin with owner-only display. Enable
partner-safe display only after permission tests and copy review.

Rollback disables the new projection read and leaves source events untouched.
Do not delete versioned evaluation evidence or restore an exact-looking date as
if it were equally trustworthy.

## Open decisions

1. Which variability statistic and thresholds pass health-content review?
2. Should the maximum eligible history be six, twelve, or a time-bounded set?
3. When should high variability suppress a window instead of showing low
   confidence?
4. Which projection details, if any, are useful and safe in the partner view?
5. What calibration threshold is required before external release?
