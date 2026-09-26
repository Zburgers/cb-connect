# cb-connect

The canonical roadmap and execution readiness are indexed in
[docs/plans/README.md](docs/plans/README.md). The approved
[feature-first delivery design](docs/plans/2026-08-19-feature-first-delivery-design.md)
is the operating policy: every major roadmap area receives a proper execution
plan, while a missing decision blocks only the task that depends on it.

Gate 0 engineering is complete. Its historical evidence remains under
`docs/evidence/reliability-gate-0/`, but operational measurement no longer
blocks additive, default-off feature work. Gates 1 and 2 are merged, and Gate
3 personalized prediction is the active implementation track. See the
[Gate 3 plan](docs/plans/2026-09-20-gate-3-personalized-prediction-implementation.md)
and the current qualification status in [the plan index](docs/plans/README.md).
D-013 blocks real outcome evaluation and estimator promotion; D-012 blocks
production exposure.

Every green merge to `main` automatically deploys the validated Convex release
and exact qualified frontend artifact, then checks production health and
readiness. See [DEPLOYMENT.md](DEPLOYMENT.md).
