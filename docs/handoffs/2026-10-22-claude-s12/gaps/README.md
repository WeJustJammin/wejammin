# Slice 12 gap inventories (root)

## Contents

- `inventory.mjs`: lists every uncited Slice 12 ledger clause with its criterion, status, a coarse class (pgtap, race,
  playwright, worker, web, hosted, impl, other) taken from the criterion limitation, and that limitation.
- `inventory.json`, `inventory-20261029.json`, `inventory-20261029b.json`: its output at three points (2026-10-24 after the
  first re-citation, 2026-10-29 before and after the second), the inputs of the gap-wave briefs.

## Ownership

The root orchestrator (`claude_root`) runs the script and writes the snapshots; gap lanes read them and never edit them.

## Extension

Regenerate with `node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/gaps/inventory.mjs > <new dated file>`
after a ledger change and name the snapshot in the brief that uses it; never overwrite a snapshot a brief cites.

## Conventions

Snapshots are generated JSON; the class is a routing hint only — each lane re-checks the clause against the ledger and specs.

## Related links

- `../STATE.md`, `../LANES.md`
- `../briefs/gap-tests.md`, `../briefs/gaps-wave4.md`, `../briefs/gaps-wave5.md`
