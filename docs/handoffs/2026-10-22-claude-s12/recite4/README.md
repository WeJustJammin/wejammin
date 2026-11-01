# Slice 12 gap-wave-5 proposals and refutations 4 and 5, 2026-10-29

## Contents

- `unit5-proposals.json`, `api5-proposals.json`, `web6-proposals.json`, `pw5-proposals.json`: lane proposals.
- `refutation.json`: refutation 4 (unit5, api5); refutation 5 is in `../recite5/refutation.json` (web6, pw5).
- `web6-probes/`: lane web6's probe outputs for the AC-271 state-table cells its tests do not cite.
- `apply4.mjs` (+ `apply4-report.json`): applies refutations 4 and 5 (AC-271 eight-part split, DEC-241 rulings, FIX
  resolutions, stale titles re-pointed); `dec240-s10-retitle.mjs` and `retitles2.mjs`: later title re-points.

## Ownership

Lanes wrote the proposals and probes, reviews `claude_s12_refute4`/`refute5` the refutations; the root orchestrator alone runs
the scripts on the ledgers.

## Extension

Run after `../recite3/apply3.mjs` in the order recorded in `../STATE.md`; a new wave gets its own directory.

## Conventions

The refutations' own citation records are the input (tool, file, title, current clause index); `--dry` first; static title
checks are warnings only — the evidence run and the guard are the identity check.

## Related links

- `../recite3/README.md`, `../briefs/recite4-refutation.md`, `../briefs/recite5-refutation.md`
