# Review `claude_s12_refute5` — refute the proposals of lanes web6 and gaps-pw5 (separate population)

You did not write these tests or proposals; your job is to break them. Rules, checks and output schema: exactly those of
`briefs/recite3-refutation.md` (read it). READ-ONLY except your two outputs; never run supabase, docker, db, races, Vitest
suites or Playwright.

## Input

`docs/handoffs/2026-10-22-claude-s12/recite4/{web6,pw5}-proposals.json`, the reports `lane-web6-report.md` (incl. its probes
`recite4/web6-probes/`) and `lane-gaps-pw5-report.md`, every test file they list. pw5's specs ran under root:
`.lane-logs/canonical/pw5-run1-20261029T044420Z/pw.log` (before root's harness/redirect fixes) and
`.lane-logs/canonical/pw5-run2-20261029T051459Z/pw.log` (24/25; the AC-042 focus assertion was then corrected by root to the
named result heading — `tests/e2e/phase-02-slice-12-template-states-real-route.spec.ts`). Judge PROOF from source; root
attaches receipts from the next full real-route run.

Specifics:
- "consumed at /app/…" (DEC-226): a page-level test must open that route and assert the island's behaviour, not only that it
  hydrated; say which pw5 page tests prove only mounting.
- AC-271 (web6 row 3): the lane kept only passing halves and put failing assertions in probes — check that no cited test claims
  a state cell the probe shows failing; the clause stays partial.
- AC-272 browser half and AC-001 (root reading: a template preserves block accessibility contracts because it references exact
  immutable block versions and its strict definition carries no overriding member) — judge the proof against that reading.
- AC-273 journeys: partial by design (template/merge/locale/related journeys not driven) — no citation may claim the whole.

## Output

`docs/handoffs/2026-10-22-claude-s12/recite5/refutation.json` (one entry per proposed criterion, written as you go) and
`docs/handoffs/2026-10-22-claude-s12/review-refute5-report.md` (counts, DROP classes, status changes, findings, verdict).
Final message to root: verdict, both paths + SHA-256, counts.
