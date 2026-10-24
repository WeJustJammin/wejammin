# Lane `claude_s12_repair_a` — Slice 12 composition/pattern suites green on the full WIP stack

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-repair-a-report.md` (checkpoint early, after every run).

## Situation

Root ran every pgTAP file with all WIP lanes staged
(`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202`): 426 files, 27,178 tests, 22 failing files.
TAP: `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202-023928-3189723.tap`.
Since then three more WIP lanes landed GREEN: `dec205`, `dec206`, `governed-recheck`.

Your files (Slice 12) in that run:
- `phase_02_slice_12_composition_authority.sql`, `…_composition_instance_guards.sql`,
  `…_composition_owner_integrity.sql`: exit 3, no plan (abort) — ALSO aborted at the promoted-only baseline,
  so likely a harness/fixture defect, not WIP.
- `phase_02_slice_12_pattern_placement.sql` 10 failed / 605; `…_pattern_update_diff.sql` 47 / 527;
  `…_pattern_updates.sql` 30 / 1,293. The `pattern-updates` WIP (10 files, 2026-10-14) predates DEC-193; the
  `dec193` WIP (45 files) was written on top of it by Codex. Many of these assertions may be pre-DEC-193
  oracles superseded by owner decisions DEC-193 (and its "Honor each choice" clarification), DEC-198–DEC-201.

## Goal

Every Slice 12 pgTAP file green on the full WIP stack, each failure classified (harness / stale oracle
superseded by a cited decision or spec line / genuine defect), with minimal justified changes:
- genuine defect → fix the WIP SQL (unpromoted WIP files of `pattern-updates`, `dec193`, `dec202`, `dec206`
  may be edited in place — they are not applied anywhere permanent; list every edited file with before/after
  SHA-256) or add a fix-forward file in YOUR WIP dir;
- stale oracle → test correction with the exact superseding decision/spec line (never weaken; listed under
  `## Test corrections`);
- harness defect → fix the harness in the Slice 12 test files.

## Runs

Staged lane list for every run (exact):
`pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,repair-a`
(create `supabase/migrations-wip/repair-a/` even if empty, range `20261022060000`–`069999`). First run: the
six failing files above to get fresh, current counts. Final run: ALL 69+ `supabase/tests/phase_02_slice_12*.sql`
files on that stack — must be 0 failures. Background runs; never `timeout`; never loop; one run per
deliberate change.

## Claim

- `supabase/tests/phase_02_slice_12_composition_*`, `…_pattern_placement*`, `…_pattern_update_diff*`,
  `…_pattern_updates*`, `…_dec193_*` (+ their dirs) — corrections only, listed.
- WIP SQL: `supabase/migrations-wip/{pattern-updates,dec193,dec202,dec206}/` (edit in place, listed) and NEW
  `supabase/migrations-wip/repair-a/`.
- Do NOT edit Slice 09/10/11 tests or the WIP dirs `dec194,dec195,locale-gate,dec197,dec205,governed-recheck`
  (lane `claude_s12_repair_b` owns those). If a root cause lies in a file you don't own, write it under
  `## Requests to root` with the exact proposed diff.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, final full-S12 counts, files, Requests to root.
