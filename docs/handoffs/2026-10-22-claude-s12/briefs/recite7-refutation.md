# Review `claude_s12_refute7` — refute the wave-7 proposals of lanes race7, web7 and pw7 (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` (read it: proof first; no-effect/control/source/adjacent/blind/pinned classes; seams; identity;
gaps; status). READ-ONLY except your two outputs; never run supabase, docker, db, races, Vitest suites or Playwright.

## Input

`docs/handoffs/2026-10-22-claude-s12/recite7/{race7,web7,pw7}-proposals.json`, the reports `lane-race7-report.md`,
`lane-web7-report.md`, `lane-gaps-pw7-report.md`, every test file they list. race7's ALT TAP: `recite7/race7-final-run.tap`.
pw7's specs are being run by root (`.lane-logs/canonical/e2e-*` newest): judge proof from source; root attaches receipts.

Specifics:
- race7 (dblink two-session pgTAP): a concurrency claim needs WAIT evidence (the second session observed blocked on the lock —
  `pg_locks` / `pg_stat_activity`), not a sleep; the exact outcome after the first session commits or aborts; and a restore to the
  pre-test state. Judge "lock order" claims against BE03c's Slice 12 lock order positions. Root reading for its ambiguity: a term
  write that waited on a vocabulary version superseded meanwhile answers `taxonomy_not_active` (the post-wait recheck), a stale
  operand arriving after it `CONFLICT`.
- web7 (AC-271 cells, AC-042 c5): each cited test must assert the FE03 cell (root DEC-241/242 readings,
  `.memory/raw/events/2026-10-29.jsonl`), never pin a defect; AC-271's parts stay uncited unless EVERY cell of the part is proven
  (the lane's open cells: 409 auto-refetch, unknown refetch-before-retry, other 422 field reasons, reviewer_not_eligible refetch).
- pw7: DEC-241 — a page-level test closes "consumed by … at /app/…" only if it performs the operation from the page; AC-273 has
  one clause, so no citation may close it while journeys remain undriven.

## Output

`docs/handoffs/2026-10-22-claude-s12/recite7/refutation.json` (one entry per proposed criterion, written as you go) and
`docs/handoffs/2026-10-22-claude-s12/review-refute7-report.md` (counts, DROP classes, status changes, findings, verdict).
Final message to root: verdict, both paths + SHA-256, counts.
