# Common rules for every Slice 10+ lane (recreated 2026-10-07 after a host reboot wiped /tmp)
ORCH = /home/rob/.codex/worktrees/phase2-slice10/orchestration   (durable; old /tmp scratchpad paths are GONE)
LANE = /home/rob/.codex/worktrees/phase2-slice11/WeJammin        (Slice 11 checkout, branch claude/phase2-slice11, based on main 3640b506 — preserve uncommitted work)
- Shell cwd resets every call: every command starts `cd LANE && export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH" && ...`.
- Never edit /home/rob/Projects/WeJammin (primary checkout). No git commit/stage/stash/checkout/reset/branch.
- DB: only via `ORCH/bin/lane-db.sh LANE [supabase/tests/x.sql ...]` (locks, resets shared DB to LANE migrations, runs pgTAP) and
  `ORCH/bin/lane-api.sh LANE [tests/postgrest/x.apispec.ts ...]` (real PostgREST vitest). Never pnpm db:*/supabase/psql to mutate the DB.
  Exception: `flock /tmp/wejammin-supabase-ci.lock bash -c 'pnpm db:reset && pnpm db:types'` for type regeneration.
- Focused vitest: `pnpm exec vitest run <paths>`. No coverage/validate/build/full playwright (orchestrator runs them).
- Method: contract-first TDD; RED test observed failing for the right reason → fix → GREEN; never weaken security/RLS/concealment/
  idempotency/CAS/deadline/audit/typed-error assertions; harness-only repairs and decision-cited fixture cascades are allowed and must
  be explained. Production-grade only (no TODO/placeholder). SECURITY DEFINER: search_path='', owner wejammin_cms_definer, revoke/grant.
- Specs: .memory/wiki/specs/{be/03b-editorial-workflow-publication.md, be/03a-content-schema-registry.md, ia/03-cms-content-modeling.md,
  fe/03-cms-content-modeling.md}; decisions: LANE/.memory/pipeline/progress/verification/2026-10-07-slice-10-gap-resolutions.md
  (DEC-139..146), LANE/.memory/raw/events/2026-10-07.jsonl (DEC-132..146).
- Checkpoint discipline: append to ORCH/lanes/lane-<x>-report.md after every finished item (item, files, RED→GREEN); keep a
  "Remaining" list current; never leave a half-edited file during long commands. Re-read ORCH/lanes/NOTES.md before each item/DB run.
- Final: pnpm type-check, pnpm lint, pnpm format:check (report honestly; name other lanes' in-flight breakages). Final chat ≤6 lines.
