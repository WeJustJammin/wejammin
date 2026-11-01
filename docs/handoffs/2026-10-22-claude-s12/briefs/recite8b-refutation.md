# Review `claude_s12_refute8b` — refute the fix-round proposal rows of lanes web8a and web8b (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` and `briefs/recite8-refutation.md` (read both, and `review-refute8-report.md` for the DROP classes
and the AC-271 part matrix). READ-ONLY except your two outputs; never run supabase, docker, db, races or Playwright. You MAY run
focused Vitest with `--reporter=json` into your scratch directory to resolve titles (foreground only, no background monitors).
Do not spawn sub-agents.

Input: `recite8/web8a-proposals.json` (SHA `95da1919…`, 51 add, 11 staleExisting) and `recite8/web8b-proposals.json` (SHA
`c19c6240…`, 122 add, 2 staleExisting), written after refute8 by the lanes' fix rounds; `recite8/refutation.json` (refute8's
verdicts); `lane-web8a-report.md` (fix + bundle rounds) and `lane-web8b-report.md` (fix round 2); every test file they list. Root
rulings DEC-244 and DEC-245 (`.memory/raw/events/2026-10-30.jsonl`).

Work:
1. **New rows** (about 15 web8a + 55 web8b whose file+title is not in refute8's verdicts): KEEP / DROP (with class) / FIX each,
   with the AC-271 part it proves (loading, success, error, degraded, disabled, closing words).
2. **Moved rows**: every refute8 KEEP and every LIVE ledger vitest citation in `tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`
   whose test file either lane touched since refute8 — does its exact title still exist (resolve against a fresh JSON run, Vitest
   truncates long `$label` names with "…")? List each dead identity with its replacement title, or "no replacement".
3. **Dead ledger citations**: refute8 finding 2 named nine (AC-008/042/081/282/284/285); re-resolve them after the fix rounds and
   give the final replacement map.
4. **AC-271 part matrix after DEC-245**: per part, can it be cited now (every island's cell proven or ruled N/A/BOUNDARY by
   DEC-241/242/244/245)? DEC-245(1) and (4) turned two former gaps into product fixes — check the rows that prove them. Name the
   exact rows per part. c10/c11 stay uncited (DEC-245(5)) — confirm no proposal cites them.
5. The rewritten rows that replaced PINNED/BLIND rows (refute8 section 6): does each now assert the FE03 cell, and would it fail
   with the fix reverted (read the product hunk; you may revert-check in a scratch COPY of the file, never in the tree)?

Output: `docs/handoffs/2026-10-22-claude-s12/recite8/refutation-8b.json` (same schema as `refutation.json`, one AC-271 entry plus
entries for every other criterion whose citation you re-map; add a top-level-entry field `retitleMap` for dead identities) and
`docs/handoffs/2026-10-22-claude-s12/review-refute8b-report.md` (counts, DROP classes, the part matrix, the dead-citation map,
findings, verdict). Write the JSON as you go. Final message to root: verdict, both paths + SHA-256, counts.
