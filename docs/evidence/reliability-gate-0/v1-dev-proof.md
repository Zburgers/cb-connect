# V1 isolated Convex identity proof

- Recorded: 2026-08-06T04:05:00+05:30
- Deployment class: isolated development only
- Selector: `dev:hallowed-hummingbird-284`
- Function-spec policy: deploy workflow requires `getBackendIdentity` in the selected deployment specification
- Identity query: `queries/system:getBackendIdentity {}` returned deployment `dev:hallowed-hummingbird-284`, compatibility `v1`, and deployed-at `2026-08-06T04:05:00.000Z`
- Production execution: not run; `prod:festive-malamute-715` remains protected by the workflow opt-in and owner boundary
- Secrets and user/health data: omitted
