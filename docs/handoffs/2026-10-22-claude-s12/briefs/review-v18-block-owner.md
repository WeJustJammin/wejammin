# Review V18 — the DEC-243 block-owner WIP migration and its test corrections, before promotion

You did not write this work; your job is to find what is wrong with it. Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
first. Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. READ-ONLY except
your report `docs/handoffs/2026-10-22-claude-s12/review-v18-report.md`. You may run the ALT staged pgTAP runner (background,
wait); never Playwright, races or canonical db commands. Do not spawn sub-agents.

Input: `docs/handoffs/2026-10-22-claude-s12/lane-block-owner-report.md` (incl. `## Fix round`),
`supabase/migrations-wip/block-owner/20261029150000_cms_template_context_platform_blocks.sql`, the RED-then-green suite
`supabase/tests/phase_02_slice_12_block_owner_red.sql`, the five test corrections in `supabase/tests/phase_02_slice_12_gaps_db1_template.sql`,
the ALT TAP the report names. Decision: DEC-243 in `.memory/raw/events/2026-10-29.jsonl`; BE03c 206 + changelog; the Slice 09
precedent `supabase/migrations/20261002209000*` and P2-S09-AC-145.

Check: the patch removes ONLY the owner predicate (state, supported lifecycle, ordering, 128 cap, definer settings, grants,
owner, `app.cms_rpc` handling byte-identical otherwise); the inverse check really restores the installed source; populated-DB
safety; the context read still never returns owner ids, renderer refs or manifests (BE03c 206); no other block reader is
affected; each test correction follows from DEC-243 and none weakens an unrelated assertion (cap, C-order, lifecycle); the RED
file's relabelled controls are honest; the sweep missed no Worker/web/contract test asserting the owner-scoped list. Run the
suites once with the WIP applied.

Output: findings BLOCKER / MAJOR / MINOR / NIT with file:line; verdict PROMOTE / PROMOTE-WITH-CONDITIONS / DO-NOT-PROMOTE.
Final message to root: verdict, report path + SHA-256, counts, top findings.
