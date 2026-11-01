# Review `claude_s12_refute4` — refute the wave-5 proposals of lanes gaps-unit5 and gaps-api5 (separate population)

You did not write these tests or proposals; your job is to break them. The rules, checks and output schema are exactly those of
`briefs/recite3-refutation.md` (read it: proof first, no-effect/control/source/adjacent/blind classes, seam conditions,
identities, gaps, status). READ-ONLY except your two outputs; never run supabase, docker, db, races, Vitest suites or Playwright.

## Input

`docs/handoffs/2026-10-22-claude-s12/recite4/{unit5,api5}-proposals.json`, the reports `lane-gaps-unit5-report.md` and
`lane-gaps-api5-report.md`, every test file they list, api5's ALT TAP `.lane-logs/alt-staged-none-003647-1626501.tap`.

Specifics:
- unit5 Worker tests that feed SQL refusals (AC-126, AC-128): DEC-226 — a fed token counts only if the database raises exactly
  that token on that operation; check the SQL lines the lane cites.
- api5 AC-238: the draft raw-copy-with-one-patched-member technique followed by the real governed chain — judge it like a seam
  (does it substitute only the state under test, is every other condition shown false, does the asserted behaviour equal the
  clause's?). AC-010/AC-016 cite apispecs that root runs; judge proof from the source.
- unit5's web product fixes are reviewed separately (V16); judge only the tests' proof here.
- Root rulings: AC-169 BOUNDARY accepted unless you find a real server/queue/job caller; AC-211 stays one uncited clause;
  AC-001 reading is root's (owner may override) and is proven by lane web6, not here.

## Output

`docs/handoffs/2026-10-22-claude-s12/recite4/refutation.json` (array, one entry per proposed criterion, written as you go) and
`docs/handoffs/2026-10-22-claude-s12/review-refute4-report.md` (counts, DROP classes, status changes, findings, verdict ACCEPT /
ACCEPT-WITH-DROPS / REJECT). Final message to root: verdict, both paths + SHA-256, counts.
