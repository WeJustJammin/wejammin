# Review `claude_s12_refute8` — refute the wave-8 proposals of lanes web8a, web8b and db8 (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` (read it). READ-ONLY except your two outputs; never run supabase, docker, db, races, Vitest suites
or Playwright. Do not spawn sub-agents.

Input: `docs/handoffs/2026-10-22-claude-s12/recite8/{web8a,web8b,db8}-proposals.json`, the reports `lane-web8a-report.md`,
`lane-web8b-report.md`, `lane-db8-report.md`, every test file they list; db8's TAP `recite8/db8-race8-final-run.tap`. Also the
earlier `recite7/refutation.json` partRulings for AC-271 and `recite7/web7-proposals.json` (V17 N8 noted two stale rows there).

Specifics:
- AC-271 is split in the ledger into 8 parts (part 0 idle and part 3 empty are cited). A part may be cited only if EVERY island's
  cell of that state is proven or ruled N/A/BOUNDARY by a root decision (DEC-241/242/244). Say per part (loading, success, error,
  degraded, disabled, the closing words) whether it can now be cited and with which rows, merging web7's KEEP rows from
  `recite7/refutation.json` with web8a/web8b rows.
- db8 (dblink pgTAP): check A5's concealed-versus-absent identity, D2's single assertion (position 2 only), and the unpublish
  modelled through `cms_append_publication_lineage` (no platform unpublish command). AC-294: the "archived/unassigned between
  check and use" sub-case has no command in BE03b/BE03c — propose a verbatim split leaving it uncited (round-2 rule), never
  verified-with-caveat.
- AC-085 (positions 1-4) and AC-277 c2 parts per refute7's split.

Output: `docs/handoffs/2026-10-22-claude-s12/recite8/refutation.json` (one entry per proposed criterion, written as you go) and
`docs/handoffs/2026-10-22-claude-s12/review-refute8-report.md` (counts, DROP classes, status changes, the AC-271 per-part ruling,
findings, verdict). Final message to root: verdict, both paths + SHA-256, counts.
