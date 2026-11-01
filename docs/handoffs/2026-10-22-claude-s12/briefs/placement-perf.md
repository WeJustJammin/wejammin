# Lane `claude_s12_placement_perf` — CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound (defect D1)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner
only). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD the latest root
commit). Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never
bare `ls`. Report: `docs/handoffs/2026-10-22-claude-s12/lane-placement-perf-report.md` (Bash heredoc if Write refuses).

## Defect

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` line ~1813: "Representative 64-slot templates,
512-node pattern bounds … meet Tier 2 p95 <1,200ms and RPC <300ms." The perf lane's bench
`supabase/tests/phase_02_slice_12_gaps_perf_patterns.sql` (report `lane-gaps-perf-report.md`, D1) measured
`platform_api.cms_insert_pattern_instance` placing 512 rows at p50 627 ms / p95 661 ms (32 rows: 35 ms, roughly linear at
~1.2 ms per row). The 512-node pattern save is marginal (p95 294 ms vs 300 ms).

## Work

1. Reproduce first: run the bench alone through the staged runner; record p50/p95 per row count (32, 128, 256, 512).
2. Profile the placement path per row (the live function body: newest definition across `supabase/migrations/`; use
   `EXPLAIN (ANALYZE, BUFFERS)` inside a pgTAP-free scratch SQL run through the staged runner, or `clock_timestamp()`
   checkpoints in a scratch copy): row-at-a-time inserts, per-row trigger work, repeated lookups (block registry, digest,
   path validation, position computation), per-row locks.
3. Fix forward in NEW WIP `supabase/migrations-wip/placement-perf/` (timestamps `20261024150000`–`159999`; an anchored
   patch of the live body with a reverse check, like the governed-v4 lane's), preserving every behaviour: set-based
   inserts, hoisting invariant lookups, batching trigger work — never weakening a check, lock or audit. The full
   existing placement, block-rules (DEC-210), linked-update and composition suites must stay green; list them and run
   them in your final run.
4. Target: 512-row placement p95 < 300 ms with headroom (aim ≤ 200 ms) and the 512-node save p95 ≤ 250 ms on the same
   bench; record before/after for 32/128/256/512.

## Claim

NEW `supabase/migrations-wip/placement-perf/`; scratch profiling files in your lane scratch dir only. Never edit promoted
migrations, existing tests, ledgers, receipts or specs. Live: other gap lanes.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, before/after timings, the suites run with counts,
files with SHA-256, requests to root.
