# Lane `claude_s12_web_impl` — Slice 12 web implementation gaps and the pattern-tree node pointers

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (HEAD the latest root commit). Toolchain
`PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split. `/bin/ls`, never bare `ls`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-web-impl-report.md` (Bash heredoc if Write refuses). Real-route Playwright is
root's: write or extend specs, name them; root runs them. The bundle budget (`scripts/verify-bundle-budget.mjs`) is tight
(entry editor ~79 B headroom): measure with a production build before and after (`pnpm build && pnpm bundle:check` is
allowed for you) and keep every chunk inside its budget.

## Items (spec exists for each → implement; boundary rule)

1. **AC-105 nested pattern nodes from `CmsPatternSelector`** (FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`
   row `CmsPatternVersionDesigner`, ~line 885): `apps/web/src/components/**/CmsPatternNestedPicker.tsx` is a permanently
   disabled placeholder with a stale BOUNDARY comment; implement the picker over the designer-only nested-pattern read
   (DEC-196, BE03c `cmsPatternSelector`/nested picker read) and remove the stale comment.
2. **AC-105 / Q7 node pointers** (BE03c 1525 "at the offending node's pointer in the request `blockTree`,
   `/blockTree/{i}(/children/{j})*`, like the operation's other `blockTree` refusals"; FE03 885 "a cycle, depth or
   node-count refusal render inline with the node path"; error summary links to the node). Today
   `supabase/migrations/20261014020400_cms_create_pattern_version.sql:211,217,230` raise `pattern_cycle`,
   `pattern_depth_exceeded`, `pattern_nodes_exceeded` with `detail = '["/blockTree"]'`. Root decision (DEC-228, raw record
   written by root before you start): the offending node is — depth: the first request node in preorder at level 9;
   node count: the request node whose expansion first takes the expanded total past 512; cycle: the nested `pattern`
   node whose lineage closes the cycle. Fix forward in NEW WIP `supabase/migrations-wip/node-pointers/` (timestamps
   `20261024140000`–`149999`; anchored patch of the live body like the governed-v4 lane did) with pgTAP RED first (NEW
   `supabase/tests/phase_02_slice_12_gaps_node_pointers.sql`), then the Worker relay (pointer passes through, tests with
   the real token form) and the designer (inline at the node, summary link) with component tests.
3. **AC-110 restart after a cursor conflict**: `apps/web/src/components/cms-composition-instances/use-composition-insert.ts`
   `loadMore` (lines ~72-95) has no 409 branch; per FE03/BE00 a client restarts from the first page after a cursor
   conflict. Implement + test.
4. **AC-271 skeleton after 250 ms**: no Slice 12 island implements the FE03 "skeleton after 250 ms" loading rule; find the
   rule's exact wording and component list in FE03, implement it in the shared async-state helper the islands use (one
   place, not per island), with fake-timer tests at 249/250 ms.
5. The `web`-class rows of `docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json` that touch the same components.

## Runs

Vitest for touched packages; ALT staged runner for the pgTAP of item 2; `pnpm build && pnpm bundle:check`; tsc, eslint,
prettier. Name every Playwright spec you add or change for root to run.

## Claim

The files of items 1-5 (name each in the report before editing), NEW WIP `node-pointers/`, NEW
`phase_02_slice_12_gaps_node_pointers*`. Never edit ledgers, receipts, trackers, specs or promoted migrations. Live: other
gap lanes and the taxonomy-integrity lane.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, counts, bundle numbers before/after, files with
SHA-256, Playwright specs for root, BOUNDARY items, the AC clauses your tests prove, requests to root.
