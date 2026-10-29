# Review V13 — `gaps-db2` and `node-pointers` WIP (+ the web-impl Worker/web changes) before promotion

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. READ-ONLY
except your report `docs/handoffs/2026-10-22-claude-s12/review-v13-report.md` (Bash heredoc if Write refuses). You may run
the staged ALT pgTAP runner named in the lane rules (background, wait) and focused Vitest to confirm findings or mutants.

## Input

1. `supabase/migrations-wip/gaps-db2/` (four migrations `20261024130000`–`130300`) — report
   `docs/handoffs/2026-10-22-claude-s12/lane-gaps-db2-report.md` (incl. `## Follow-ups`): 130000 AC-195 guard refusing a
   direct state / lifecycle move of governed template, pattern and taxonomy versions inside the RPC context; 130100 AC-248
   outbox claims by exact aggregate type; 130200 AC-276 CMS-03C-01 lock position 1 (`cms_lock_governed_authority`);
   130300 AC-276 lock-failure (40P01, 55P03, same-key advisory wait) → CONFLICT in the define-template, create-revision,
   resolve-conflict and restore-revision wrappers. The two corrected existing tests: `phase_02_slice_12_fix_template_per_owner.sql`
   (a trigger-disabling privileged fixture helper — check it cannot hide a defect) and `phase_02_slice_12_template_authority.sql` #36.
2. `supabase/migrations-wip/node-pointers/` (two migrations) — report `docs/handoffs/2026-10-22-claude-s12/lane-web-impl-report.md`:
   DEC-228 offending-node pointers for `pattern_cycle`, `pattern_depth_exceeded`, `pattern_nodes_exceeded` (BE03c field
   matrix CMS-03C-12 `blockTree` row; DEC-228 raw record in `.memory/raw/events/2026-10-24.jsonl`; root confirmed: a nested
   pattern node is the offending request node when its own stored tree reaches level 9, and is weighed by its stored
   `node_count`), plus the Worker relay, web proxy and designer changes, `CmsLoadingRegion` (AC-271), the AC-110 restart and
   the AC-045/117 composition changes in the same report.
3. Spec: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (Slice 12 lock order, governed state
   machine and direct-write rules, outbox/event schemas, the CMS-03C-12 matrix rows), FE03 for the web items.

## Check

Spec conformity; that each guard closes the defect without blocking a legitimate path (every RPC that must still move
state: activation, retirement, scheduled execution, invalidation, supersession — run their suites); anchored patches with
inverse checks against the NEWEST live definition, and no overlap or ordering conflict with sibling WIP dirs
(`taxonomy-integrity/`, `placement-perf/`, `nestable-read/`) that patch the same functions; lock order; SQLSTATE coverage
(is 57014 meant to convert?); PAT-031 context-cleared tests; the trigger-disabling fixture helper's blast radius; the web
changes' tests vs FE03; bundle impact named.

## Output

Findings BLOCKER / MAJOR / MINOR / NIT with file:line, evidence and a proposed fix; verdict PROMOTE / PROMOTE-WITH-CONDITIONS /
DO-NOT-PROMOTE per WIP dir; ACCEPT/REJECT per test correction. Final message to root: verdicts, report path + SHA-256,
counts, top findings.
