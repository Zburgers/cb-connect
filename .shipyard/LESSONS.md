# Shipyard Lessons Learned

## 2026-08-20 Phase Gate 1: Trustworthy Cycle Facts

### What Went Well
- Keeping cycle facts additive, Convex-authoritative and flag-off by default allowed the implementation to qualify without authorizing production exposure.

### Surprises / Discoveries
- A legacy reason must dominate exact-looking certainty fields on reads; partially annotated historical rows can otherwise become prediction inputs.

### Pitfalls to Avoid
- Never use a server or runner timezone as a fallback for an identified user's calendar date, and never treat a configured duration or later start as an observed end.

### Process Improvements
- Reconcile the dated plan, decision register, evidence report and issue tracker together before opening the PR so implementation status and remaining Gate 2 work cannot drift.

---
