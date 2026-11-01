# Review V14 — `placement-perf` and `nestable-read` WIP (+ the nestable-read contracts/Worker/web) before promotion

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. READ-ONLY
except your report `docs/handoffs/2026-10-22-claude-s12/review-v14-report.md` (Bash heredoc if Write refuses). You may run
the staged ALT pgTAP runner (background, wait; keep runs lean — skip the 12-minute `governed_schedule_ladder` unless a
finding needs it) and focused Vitest.

## Input

1. `supabase/migrations-wip/placement-perf/` (five migrations `20261024150000`–`150400`) and the tests
   `supabase/tests/phase_02_slice_12_placement_perf_equivalence.sql`, `…_placement_perf_effective_state.sql` — report
   `docs/handoffs/2026-10-22-claude-s12/lane-placement-perf-report.md` (defect D1: BE03c line ~1813 "512-node pattern
   bounds … RPC <300ms"). Behaviour must be IDENTICAL to the old bodies: check the equivalence suite really compares the
   old bodies (verbatim copies) on adversarial inputs (position ceiling, path collisions, nested roots, block-rule
   violations at every depth), that no check, lock, audit or grant changed, and that the duplicated single-row effective-state
   derivation cannot drift from the set form (root accepted the duplication, pinned by the agreement test — judge the pin).
2. `supabase/migrations-wip/nestable-read/` (three migrations `20261027100000`, `100010`, `100020`) and
   `supabase/tests/phase_02_slice_12_nestable_read*` — report `docs/handoffs/2026-10-22-claude-s12/lane-nestable-read-report.md`
   (incl. `## Follow-ups`). Spec: BE03c every `cmsPatternNestableRead` site + the CMS-03C-13 paragraph + the DEC-232
   consistency changelog row (cursor faults 400; bounds 422; `nestable` reserved key); DEC-196/DEC-232 raw records. Also the
   contracts, OpenAPI, Worker route/adapter, web proxy, `CmsPatternNestedPicker` and designer wiring, the registry-parity
   fixture, the closeout test and the 12 test corrections the lane lists.
3. Sibling WIP dirs staged together (`taxonomy-integrity`, `gaps-db2`, `node-pointers`): any function patched by two dirs
   must compose in timestamp order (e.g. `cms_create_pattern_version`: node-pointers 140000 and nestable 100020;
   `cms_insert_pattern_instance`: placement-perf). Prove the stacked result with one combined run.

## Check

Spec conformity; security posture (definer, `search_path = ''`, grants service_role only, `app.cms_rpc` set/restore,
PAT-031 context-cleared tests, owner scoping — no other-owner pattern ever listed); cursor binding (type set as a set,
actor, sort, limit); every-type compatibility both ways; the reserved-key constraint change on existing data (does the
re-added CHECK validate cleanly on a populated database? see the populated-DB witness pattern); performance claims
re-measured once; bundle impact; Worker/web tests vs FE03.

## Output

Findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; verdict per WIP dir PROMOTE /
PROMOTE-WITH-CONDITIONS / DO-NOT-PROMOTE; ACCEPT/REJECT per test correction. Final message to root: verdicts, report path +
SHA-256, counts, top findings.
