# Slice 12 root evidence scripts and records, 2026-10-22 resume

## Contents

- `promotion-manifest-20261023.json`: every WIP file promoted into `supabase/migrations/` on 2026-10-23, with its
  WIP directory and SHA-256.
- `squash-catalog-snapshot.sql`: the DEC-215 squash proof, one TAP line and SHA-256 per catalog object in
  `platform_private`, `platform_api` and `public` at the end of the staged stack.
- `run-final-evidence.sh`: the final ledger runs for Slices 12, 11 and 10 (`run-slice-evidence.mjs`), then the
  first Slice 09 attempt. Its Slice 09 inputs were written under `test-results/`, which every Playwright run empties
  when it starts, so its Slice 09 collect step failed.
- `run-s09-evidence.sh <out-dir> [vitest-all.json]`: the Slice 09 marker inputs written outside `test-results/`, then
  `collect-receipts.mjs`.
- `run-s09-pass2.sh <pass-1 dir>`: the Slice 09 receipts second pass. The receipts guard cites its own file
  (AC-1144), so pass 1 records it failed; following the Slice 11 closure precedent it takes the committed passing row
  for the guard's own failed rows only while the guard file is unchanged, reruns the full Vitest suite and recollects
  from real runs.
- `run-s12-s11-evidence.sh <log-dir>`: the Slice 12 and Slice 11 ledger runs, each followed at once by its guard.
- `gate-validate.sh`: the canonical `pnpm validate` under the quiet and CI locks, with a `db:reset` before and after.

## Ownership

The root orchestrator (`claude_root`) writes and runs these. Lanes never run them: they take the shared CI lock
`/tmp/wejammin-supabase-ci.lock` and reset the local database.

## Extension

Add a script only for a root-run gate, take the CI lock for every database step, write logs under
`.lane-logs/canonical/`, and write any input another step reads outside `test-results/`. Record each run's result in
`../STATE.md`.

## Conventions

Bash, not zsh (zsh does not word-split). Pinned toolchain on `PATH`. Receipts pin each file's SHA-256, so run the
evidence scripts only after every code change is final. No credentials, tokens or personal data.

## Related links

- `docs/handoffs/2026-10-22-claude-s12/STATE.md`
- `scripts/evidence/README.md`
- `supabase/migrations/README.md`
