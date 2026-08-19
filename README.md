# cb-connect

The canonical roadmap and execution readiness are indexed in
[docs/plans/README.md](docs/plans/README.md). The approved
[feature-first delivery design](docs/plans/2026-08-19-feature-first-delivery-design.md)
is the operating policy: every major roadmap area receives a proper execution
plan, while a missing decision blocks only the task that depends on it.

Gate 0 engineering is complete. Its historical evidence remains under
`docs/evidence/reliability-gate-0/`, but operational measurement no longer
blocks additive, default-off feature work. The existing
[Gate 1 execution plan](docs/plans/2026-08-12-gate-1-trustworthy-cycle-facts-execution.md)
is the next feature plan. D-012 still blocks destructive deletion/migration,
not safe additive work.

Every green merge to `main` automatically deploys the validated Convex release
and exact qualified frontend artifact, then checks production health and
readiness. See [DEPLOYMENT.md](DEPLOYMENT.md).
