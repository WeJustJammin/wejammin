# Lane `claude_s12_repair_b` — Slice 10/11 suites green on the full Slice 12 WIP stack

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-repair-b-report.md` (checkpoint early, after every run).

## Situation

Root ran every pgTAP file with all WIP lanes staged: 426 files, 27,178 tests, 22 failing files. TAP:
`.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202-023928-3189723.tap`.
Since then `dec205`, `dec206`, `governed-recheck` WIP also landed. Your files in that run:

- Slice 10: `phase_02_slice_10_compare_lineage_domains.sql` (1/19), `…_comparison_domains.sql` (1/14),
  `…_ev_eb_publication_scope.sql` (1/6), `…_restore_transform_revalidation.sql`, `…_write_path_locks.sql` (1/27).
- Slice 11: `phase_02_slice_11_checker_render_plan.sql` (2/29), `…_helpers_manifest.sql` (13/92),
  `…_preflight_registry_schema.sql` (2/26), and three aborts (exit 3): `…_recheck_index.sql`, `…_recheck_run.sql`,
  `…_rpc_reads_gate.sql` (the 2026-10-14 baseline traced S11 aborts to a `cms_pattern_versions.lifecycle_version`
  fixture; check whether that is still the cause).

Slice 12 deliberately changes behaviour Slices 10/11 pinned as fail-closed placeholders: BE03c §"Receiving
obligations from Slice 10 (DEC-141)" (taxonomy-version resolution, restore translation of composition
instances and term assignments, revision append carry-over DEC-198/200/201, taxonomy value encoder) and the
Slice 12 preflight providers replacing `preflight.reference_gate` (§"Preflight providers registered by
Slice 12"; DEC-192, DEC-199), the render plan (DEC-165/185/193), the event relay (DEC-166). An S10/S11
assertion that pinned the old placeholder behaviour is a stale oracle ONLY if a cited BE03c/BE03b line or
decision now requires the new behaviour; otherwise the change is a regression and the SQL must be fixed.

## Goal

Every listed Slice 10/11 file green on the full WIP stack with each failure classified (harness / stale
oracle with the exact superseding spec line or DEC / genuine regression) and minimally fixed. Note the
handoff obligation: these Slice 10/11 suites are Slice 12's *receiving* evidence — prefer evolving an
assertion to prove the new required behaviour over deleting it.

## Runs

Staged lane list for every run (exact):
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,repair-b`
(create `supabase/migrations-wip/repair-b/`, range `20261022070000`–`079999`). First run: the eleven files above.
Final run: ALL `supabase/tests/phase_02_slice_10*.sql` and `phase_02_slice_11*.sql` on that stack — 0
failures. Background runs; never `timeout`; never loop; one run per deliberate change.

## Claim

- `supabase/tests/phase_02_slice_10*` and `phase_02_slice_11*` test files and dirs — corrections only,
  listed with spec citations. NOT shared helpers (`phase_02_slice_10*` helper dirs and
  `phase_02_slice_11_helpers/` are shared: request root with exact diff if a helper must change).
- WIP SQL: `supabase/migrations-wip/{dec194,dec195,locale-gate,dec197,dec205,governed-recheck}/` (edit in place,
  listed with before/after SHA-256) and NEW `supabase/migrations-wip/repair-b/`.
- Do NOT edit `pattern-updates`, `dec193`, `dec202`, `dec206` WIP or Slice 12 tests (lane
  `claude_s12_repair_a` owns those). If a root cause lies there, write the exact proposed diff under
  `## Requests to root`. Do NOT edit Slice 09 tests (root integration owns the S09 inventory pins).

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, final S10+S11 counts, files, Requests to root.
