# cb-connect

The canonical major-release status, readiness gates, decision blockers and
handoffs are indexed in [docs/plans/README.md](docs/plans/README.md).

Gate 0 implementation is closed on `gate-0/reliability-2026-08-04`, but its
[production-promotion verdict](docs/evidence/reliability-gate-0/REPORT.md) is
blocked pending direct CI, production, recovery and 28-day baseline evidence.
Gate 1 is gate-level scope only and is not plan-ready. Read the
[Gate 0-to-Gate 1 handoff](docs/handoffs/2026-08-06-gate-0-to-gate-1.md)
before proposing later work.

Safe local qualification commands and the fail-closed promotion boundary are
documented in [DEPLOYMENT.md](DEPLOYMENT.md). Production promotion is disabled
unless the protected repository opt-in is explicitly enabled.
