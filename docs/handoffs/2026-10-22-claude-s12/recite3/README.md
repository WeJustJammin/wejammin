# Slice 12 gap-wave-4 proposals and refutation 3, 2026-10-29

## Contents

- `db3-proposals.json`, `db4-proposals.json`: lanes `claude_s12_gaps_{db3,db4}` proposed citations of their new tests.
- `refutation.json`: refutation 3 over both; `refutation-v2.json`: its verification round over db4's fixed tests (supersedes
  the db4 entries of `refutation.json`).
- `apply3.mjs` (+ `apply3-report.json`): applies both to the ledger by clause text (AC-155 split, AC-072 c4 and AC-086 c4
  root rulings).

## Ownership

Lanes wrote the proposals, review `claude_s12_refute3` the refutations; the root orchestrator alone runs `apply3.mjs`.

## Extension

Run after `../recite2/dec236-ac056.mjs` (order in `../STATE.md`); a new wave gets its own directory and apply script.

## Conventions

Clauses are matched by text, never by the lanes' indexes; `--dry` first; any problem refuses the write.

## Related links

- `../recite2/README.md`, `../recite4/README.md`, `../briefs/recite3-refutation.md`
