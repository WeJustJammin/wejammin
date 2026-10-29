# Slice 12 re-citation round 2 (gap-wave tests), 2026-10-29

## Contents

- `a-proposals.json`, `b-proposals.json`: lanes `claude_s12_recite2_{a,b}` proposed citations of the gap-wave tests.
- `a-refutation.json`, `b-refutation.json`: the refutations `claude_s12_refute2_{a,b}`.
- `apply2.mjs` (+ `apply2-report.json`): applies KEEP/FIX/missed tests, accepted splits and root re-cuts to the ledger.
- `dec235-ac056.mjs`, `dec236-ac056.mjs`: AC-056 text changes for root DEC-235/236; `retitles.mjs`: re-points titles the
  wave-3 corrections renamed; `limitations.mjs`: limitation texts refute2-b asked for.

## Ownership

Lanes wrote the proposals, separate reviewer populations the refutations; the root orchestrator alone runs the scripts on
the ledgers `tests/contracts/phase-02-slice-1[0-2]-evidence-ledger-*.ts`.

## Extension

Ledger scripts run in the order recorded in `../STATE.md` "LATEST"; each re-applies only its own change, so a rerun of an
earlier script reverts the later ones. Add a new script for a new change rather than editing an applied one.

## Conventions

Every script has `--dry`, refuses on any problem and writes nothing then; citations match by exact identity; statuses are
computed from citations, never set by hand.

## Related links

- `../recite/README.md` (round 1), `../recite3/README.md`, `../recite4/README.md`
- `scripts/evidence/README.md`
