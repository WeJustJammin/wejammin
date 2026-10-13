# Lane e2e logs (2026-10-11)

Evidence for `../lane-e2e-report.md`: the real-route browser runs and the unit checks of the `e2e` lane, including the full `pnpm test:e2e` run on a quiet host.

## Contents

- `<letter><n>-*.log`: the numbered rounds of the lane (`a1-*` probes and targeted runs, `c*`/`d*` rounds with their `-vmstat.log` host samples, `win<n>-*` window runs, `full-e2e-*` snapshot runs, `green-` and `red-isolation-*`, `intermittent-isolation-*` and `static-checks-*` runs).
- `*-units-maxinput-*.log`, `max-input-*.log`: the max-input unit checks. `sweep-deadline-unit-red.log`, `dst-gap-unit-green.log`: the unit checks of two other defects.
- `e2e-snapshot.sh`, `e2e-window.sh`: the snapshot and quiet-window runners; `*-tree-state.txt`: the sha256 of every owned file for a run.
- `probe/`: the throw-away probe spec, its config and its unit twin.

## Ownership

The `e2e` lane owns this directory. Nothing here is acceptance evidence by itself: the criteria are proven by the specs the report cites.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-e2e-report.md`
- `../../2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh`
- `../impl-lane-brief.md`
