# Gate 2 cycle-state rollout

Gate 2 is an additive, default-off capability. The authenticated Convex
`getCapabilities` query returns the independent `cycleFactsV1` and
`cycleStateV1` booleans. The server enables Gate 2 only when
`CB_CONNECT_CYCLE_STATE_V1` is exactly `true`; absent, empty, false, and any
non-literal value are disabled. There is no `NEXT_PUBLIC_` mirror.

## Server exposure boundary

The dashboard query applies the Gate 1 and Gate 2 capabilities together and
projects partner state on the Convex/server boundary. A partner receives only
the enumerated `PartnerCycleProjection` or `null`; the primary-only
`coveringEventId` and legacy `cycleInfo` payload do not cross the enabled
partner boundary. React does not sanitize a primary state after receipt.

While D-011 remains unapproved, the v1 payload is technically limited to the
existing isolated fixture/test audience: the viewer and target must carry the
same non-empty `fixtureRunId`, and both server capabilities must be literal
`true`. Ordinary users do not have a fixture marker and receive no Gate 2
state. This is an engineering qualification path, not ordinary-user approval
or D-015 pilot authorization.

An exact open period records only its observed start date. A later date is not
treated as ongoing Recorded coverage without an observed end or explicit
coverage input; configured `periodLength` never fabricates that end. Future
starts remain Unknown, dates within the prediction bound remain Calendar
estimate, and the day after the latest bound is Late.

## Flag-off rollback

Set `CB_CONNECT_CYCLE_STATE_V1=false` in the target Convex environment and
restart or reload the application through the normal release workflow. Verify
the authenticated capability query returns `cycleStateV1: false`, the layout
reports the disabled state, and the legacy dashboard/history adapters render.
Keep `CB_CONNECT_CYCLE_FACTS_V1` independent; do not change it as part of a
Gate 2 rollback.

The flag-off dashboard selects the newest history-visible Gate 1 fact. A
tombstoned fact is never eligible for the legacy compatibility projection, so
rollback cannot resurrect a deleted event.

## Compatibility reads and data rules

Gate 2 reads existing Gate 1 facts and keeps legacy fields available for old
clients and the flag-off path. These backward-compatible reads make the
capability and render path additive; old clients continue to read the legacy
shape. Flag-off changes presentation and routing only. It does not convert
certainty, infer an ending, delete rows, or reverse data.

There is no data reversal during rollback. Do not remove optional fields,
rewrite historical facts, or restore modulo rollover as the long-term
authority. Any later correction must follow the Gate 1 fact authority and the
four-phase state contract.

## Stop conditions

Keep Gate 2 disabled and stop the rollout on any fabricated Recorded state,
modulo rollover, privacy mismatch, dashboard/history mismatch, missing
disclaimer, or unexplained Late/Unknown spike. Also stop if the capability
query is not exactly the two independent booleans or if a public environment
mirror appears.

## Decision boundaries

- D-011 blocks enabling or presenting unapproved health-adjacent copy to
  ordinary users. It does not block default-off implementation or isolated
  engineering qualification.
- D-015 blocks pilot cohort selection and rollout percentages. It does not
  block default-off deployment, synthetic comparison, rollback testing, or
  staff/test qualification.

Exposure approval and pilot authorization remain separate from engineering
qualification. Until those boundaries are satisfied, keep the capability
disabled for ordinary users and do not select a pilot cohort.
