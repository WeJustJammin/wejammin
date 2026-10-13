# Slice 11 wave 1 (lanes S11-1 contracts, S11-2 data model) — read ORCH/lanes/COMMON.md first (LANE = slice11 checkout)
Inputs: ORCH/s11/s11-brief.md (§1 per-operation briefs with spec citations, §4 lane table), ORCH/s11/lane-s11-0-report.md, the Slice 11
tracker .memory/pipeline/progress/slices/phase-02-slice-11.md (P2-S11-AC-001..122), specs BE03b (CMS-03B-05..09, 15..20, preflight
registry, time authority E8, separation of duties E11, invalidation), BE04c preview verifier, BE05c accessibility vocabulary (DEC-150),
FE03 S11 rows, decisions DEC-108..DEC-155 (.memory/wiki/decisions.md). Lessons from Slice 10 (binding): contract-first TDD with RED
observed; one global lock order (check the Slice 10 order in migrations 20261005013000/016000 before adding locks); typed reason tokens
with violation pointers (Slice 10 convention); never weaken S09/S10 tests; real-composition tests later must not need mock-only fields.
- S11-1 (contracts): owns packages/contracts/src/cms-editorial/** (+ new publication/review modules), platform registry rows
  (packages/contracts/src/platform-registries.ts and siblings), `pnpm contracts:generate` → docs/openapi/openapi.json. Every request,
  resource, error, event, rate/deadline policy for CMS-03B-05..09 and 15..18 (browser) + internal 19/20 schemas; strict Zod; contract
  tests per obligation; pin the tz release per DEC-153 (newest stable IANA tag + SHA-256 of the generated snapshot; append to DEC-153 via
  a new raw record referencing it). No SQL, Worker or web edits.
- S11-2 (data model): owns NEW migrations 20261005017000..20261005017499 and NEW supabase/tests/phase_02_slice_11_* files. Reconcile the
  20260926/20260927 foundation tables (reviews, decisions, assignments, dependency manifests, preflight evidence, settings snapshots,
  schedule leases, preview bindings, publication lineage) to the locked BE03b shapes by forward migration: RLS forced, immutable/append-only
  guards, CAS versions, indexes, grants, SECURITY DEFINER discipline; pgTAP per table rule. No RPC commands (lane 3), no TS.
DB: `ORCH/bin/lane-db.sh LANE [files]` (main stack, shared lock) or `ORCH/bin/lane-db-ev.sh [files]` (second stack, now pointing at
the slice11 checkout). Report: ORCH/s11/lane-s11-<n>-report.md with checkpoints. Final chat ≤6 lines.
