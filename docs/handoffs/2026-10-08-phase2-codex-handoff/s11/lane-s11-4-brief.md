# Lane S11-4 — Slice 11 Worker/API runtime (read ORCH/lanes/COMMON.md first; LANE = slice11 checkout)
Inputs: ORCH/s11/s11-brief.md §1 (per-operation briefs 05-09, 15-20 with BE03b citations), ORCH/codex/s11-rpc-plan.md §3-§5 (RPC names
and JSON shapes — Codex draft, verify), ORCH/s11/helpers-api.md (frozen SQL helper names), ORCH/lanes/NOTES.md rulings DEC-156..158,
ORCH/s11/lane-s11-1-report.md (the contract module: operation IDs, route policy rows, schemas, rate/deadline policies, preflight registry,
tz pin), BE03b, BE05c (cms.a11y.structural v1 checker rules, run states healthy|blocked|failed, DEC-150), BE04c (preview verifier seam,
Slice 15 consumer — Slice 11 ships the verifier port/adapter only), Slice 11 criteria AC001-AC122.
Ownership: apps/worker/src/cms-editorial/** (new route modules per operation, ports, stages), apps/worker/src/cms-editorial-production-*
(production ports/transport/error tokens/rate/telemetry for the new operations), NEW apps/worker/src/cms-editorial/a11y-structural/**
(D25 checker module, reused unchanged by Slice 16 per DEC-134), NEW apps/worker/src/cms-publication-schedule-sweep*.ts and the scheduled
wiring line in apps/worker/src/index.ts (follow runProductionCmsReviewAuthoritySweep exactly), the time-authority resolver module (E8: pinned
snapshot + hash verified at module load; consume lane S11-1's pinned artifact — if lane 1 only recorded tag/hash, you own the resolver and
its snapshot module; never fetch tz data at runtime). Colocated Worker tests. No SQL, no web, no packages/contracts edits (ask via NOTES).
Deliver: Hono routes for CMS-03B-05..09 and 15..18 matching the package route policy registry exactly (method, path, headers, statuses
201/200/202, no-store, rate classes, deadlines, Tier); typed error projection for every BE03b refusal token (incl. 401 STEP_UP_REQUIRED that
reserves no idempotency, 503 retryable preflight unavailability, 409 VERSION_MISMATCH with safe versions); server-derived actor/context;
production adapters calling the platform_api RPCs named in the plan (single-JSON convention, DEC-156); CMS-03B-19 verifier port + adapter
(hash the token Worker-side; plaintext never reaches the RPC); CMS-03B-20 scheduled sweep: every minute, batch 25, per claimed record run
the Worker-resident preflight provider (D25 checker) to produce PreflightEvidence bound by JCS hash, call execute with expected version +
lease, 15-second deadline, retry ladder is SQL-side; one principal per DEC-156 (architecture test: only the sweep imports claim/execute,
only the delivery adapter imports the verifier); telemetry redaction (no tokens, content, comments, authority graphs). 19/20 never appear
in the browser route inventory.
Method: contract-first TDD, RED observed then GREEN, per operation; 100% coverage is a canonical gate — cover every branch you add or
prove it unreachable and remove it. Real-PostgREST verification (ORCH/bin/lane-api.sh) only after lanes 3a/3b/3c land their wrappers;
until then production adapters are tested against the transport fakes the Slice 10 production tests use. Report ORCH/s11/lane-s11-4-report.md
with checkpoints per operation. Final: pnpm type-check, lint, format:check. Final chat <=6 lines.
