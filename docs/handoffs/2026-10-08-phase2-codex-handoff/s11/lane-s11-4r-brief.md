# Lane S11-4R — Slice 11 Worker real-composition verification (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Why: lane S11-4 built the Worker routes, production adapters, the CMS-03B-19 verifier adapter and the CMS-03B-20 sweep, tested only against
transport fakes (ORCH/s11/lane-s11-4-report.md). The SQL wrappers now exist (lanes 3a/3b/3c reports; NOTES "WORKER <-> SQL CONTRACT" and
DEC-159). Memory lesson (e2e-mock-masked-production-defect): a mock once emitted a header the real Worker never sent; verify through REAL
composition: the production Worker adapters -> real PostgREST -> real DB.
Ownership: apps/worker/src/cms-editorial/**, apps/worker/src/cms-editorial-production-*, apps/worker/src/cms-publication-schedule-*
(S11-4 is finished; you own its files), NEW tests/postgrest/phase-02-slice-11-*.apispec.ts (+ support files under tests/postgrest/support/
named phase-02-slice-11-*). No SQL, contracts or web edits — if the SQL side is wrong, write a failing apispec, then a precise
"S11-4R -> ORCHESTRATOR" NOTES entry (file:line, request, expected vs actual) and continue.
Deliver: one real-stack apispec suite per browser operation (05,06,07,08,09,15,16,17,18) and for 19/20, driving the PRODUCTION adapter
(the same composition the deployed Worker uses; follow the existing worker-round-trip apispec and tests/postgrest/support/cms-isolated-owner.ts
for an isolated owner), covering success, every refusal family the route maps (typed reason, 401 step-up before any idempotency reservation,
409 version mismatch with safe versions, committed refusal envelope DEC-159(2), 503 preflight with Retry-After), idempotent replay
(x-cms-idempotent-replay), and the response passing the strict contract schema. For the sweep: claim -> checker -> execute through real RPCs,
including null evidence -> failed_retryable. Fix every adapter mismatch you find in apps/worker (RED apispec first).
Runner: ORCH/bin/lane-api.sh LANE [files] (real PostgREST; shared lock; wait for PostgREST readiness after reset as other suites do).
Final: run all phase-02-slice-11 apispecs + the S09/S10 apispecs once (full `lane-api.sh LANE`), pnpm type-check/lint/format:check.
Usage is tight: be economical. Report ORCH/s11/lane-s11-4r-report.md with checkpoints per operation. Final chat <=5 lines.
