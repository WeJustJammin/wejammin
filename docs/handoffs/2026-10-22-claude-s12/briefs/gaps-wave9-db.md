# Lanes `claude_s12_{db9a,db9b}` — wave 9: the reachable database gaps left after wave 8

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (never kill processes by pattern; tar-backup an
untracked file before editing it). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split; `/bin/ls`, never bare `ls`. Run
every command in the FOREGROUND — no `run_in_background`, no monitors (a lane sat idle 36 h waiting on one); the ALT runner
queues on the CI lock, so a foreground run may take a while: that is fine. pgTAP ONLY through the staged ALT runner named in the
lane rules. Never run Playwright, races, canonical db commands, `pnpm build` or Vitest suites. **Do not spawn sub-agents.**
Report `docs/handoffs/2026-10-22-claude-s12/lane-<lane>-report.md` (checkpoint early, keep `## Status` current); proposals
`docs/handoffs/2026-10-22-claude-s12/recite9/<lane>-proposals.json` (the `recite2/*-proposals.json` schema), written per row.
Debug-by-test: a behaviour contradicting BE03b/BE03c → RED test, named, then a NEW WIP dir (`supabase/migrations-wip/<lane>/`,
timestamps db9a `20261031100000`–`104999`, db9b `20261031105000`–`109999`) and stop for root. New SQL test files only, except
where an item below names an existing uncommitted file. Each file restores the database world it changes (race7/race8 style).

Inputs: the CURRENT ledger `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts` (each criterion's `limitation` names the
missing test), BE03b/BE03c/IA03, root decisions DEC-235..245 (`.memory/raw/events/2026-10-29.jsonl`, `2026-10-30.jsonl`),
`review-refute8-report.md` and `recite8/refutation.json` (the AC-294 and AC-277 `missedGaps`), `review-v18-report.md` MINOR-2.
Never edit ledgers, receipts, trackers, specs, promoted migrations, web code or another lane's files.

## db9a — concurrency (dblink two-session pgTAP on the race7/race8 harness, wait evidence from `pg_blocking_pids`/`pg_locks`)

1. **AC-294 "unassigned"**: a create whose own capability is `cms.author` but whose relation target is visible only through a
   `cms.editor` assignment waits at position 2 while the REAL authority revocation (CMS-03A-17 / grant or tenure end; migration
   `20261005011300` revokes the person's entry assignments in the same transaction) commits; after release the create answers
   the uniform `VALIDATION_FAILED` at the relation field with nothing written (refute8 missedGaps "REACHABILITY CORRECTION").
2. **AC-294 "no invisible/foreign definition lock lever"** (DEC-245(6): a DEFINITION — content type or template — not a relation
   target): try to drive it — a caller of organization B names organization A's content type (or a template A owns) while a
   session of A holds that definition's rows; assert B's call answers the uniform concealed outcome WITHOUT waiting (no
   `pg_blocking_pids` entry, completes under a short `lock_timeout`) and takes no lock on A's rows. If BE03b/BE03c give B no
   request shape that names A's definition, record BOUNDARY with lines instead.
3. **AC-277 U1**: in db8's uncommitted `supabase/tests/phase_02_slice_12_race8_related.sql` add the non-empty guard refute8 asked
   for (`u1_projection_after <> ''`) to the U1 projection assertion (tar-backup first).
4. **AC-277 "related target unpublish" on the production path** (DEC-245(7): a stand-in must take exactly the production locks):
   new file driving CMS-03B-07 schedule + CMS-03B-20 execute (`platform_api.cms_execute_publication_schedule`, migration
   `20261005017740`, entry row FOR SHARE) against a related-content curation (CMS-03C-05), both orders; assert the deterministic
   outcome of each (who waits, if anyone, and the committed end state), with wait evidence where a wait exists and proof of
   no-wait where none does.

## db9b — single-session gaps

1. **V18 MINOR-2 / DEC-243**: a template designer of a SECOND organization receives the same selectors from
   `platform_private.cms_template_context` as the first (blocks are platform registry records).
2. **AC-108 c3 / AC-190 c2**: an ACTIVE pattern version of another owner is never listed by `cms_list_pattern_selector` (and an
   active foreign vocabulary by the taxonomy selector): produce the foreign row through the REAL create + activation path as an
   organization-B designer, not a hand insert, and keep a positive control (the caller's own active row IS listed).
3. **AC-146 c5**: a terminal block at schedule fire (any closed reasonCode) leaves the PRIOR active version of the lineage intact
   (still active, `activated_at` unchanged, no supersession, no event) — the fixture must activate a prior version first.
4. **AC-211 c1 "again before publish"**: per the limitation — the publication-side provider and the CMS-03C-02 placement refuse a
   hand-built legacy stored forest that is over depth 8 / over 512 nodes / cyclic with `pattern_depth_exceeded` /
   `pattern_nodes_exceeded` / `pattern_cycle` (model: the PC-N04 legacy-row case).
5. **AC-044 "deletion"** (IA03 line 533): find every command that deletes or tombstones a pattern lineage, a composition source
   or an entry. For each that exists, assert immutable evidence kept, derived access removed, idempotent dependent invalidation
   queued. If none exists, BOUNDARY with the exact spec and migration lines that show it.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, per-item table (criterion, clause, outcome, identity),
TAP + SHA-256 per file, files with SHA-256, BOUNDARY items with lines, defects.
