# Slice 12 wave-7 proposals and refutation 7, 2026-10-29

## Contents

- `race7-proposals.json`, `web7-proposals.json`, `pw7-proposals.json`: lane proposals (dblink concurrency pgTAP; the FE03
  state-table cells of AC-271 and AC-042 c5; page-level operation and journey specs).
- `race7-final-run.tap`: lane race7's final ALT run, the evidence its proposals cite.
- `refutation.json`: refutation 7 over all three lanes.
- `apply7.mjs` (+ `apply7-report.json`): applies the race7 and pw7 rows (AC-277 splits, refiles, AC-273/276 limitations);
  AC-271 and web7's AC-042 rows are deferred to a later apply. `dec243-ac159.mjs`: the AC-159 text change for DEC-243 and the
  re-point of the corrected `gaps_db1_template.sql` titles.

## Ownership

Lanes wrote the proposals and the TAP; review `claude_s12_refute7` the refutation; the root orchestrator alone runs the scripts
on the ledgers and trackers.

## Extension

Run after `../recite4/retitles3-s10-truncated.mjs` in the order recorded in `../STATE.md`; a new wave gets its own directory.

## Conventions

`--dry` first; any problem refuses the write; citations match by exact identity; statuses are computed, never set by hand.

## Related links

- `../recite4/README.md`, `../briefs/gaps-wave7.md`, `../briefs/recite7-refutation.md`
