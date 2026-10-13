# Lane a11y-status logs (2026-10-11)

Evidence for `../lane-a11y-status-report.md`: the persistent polite status line of the Slice 11 workflow island (the confirmation that survives the form's removal), with the RED and GREEN runs, the real-route browser runs, the mutation checks and the DOM snapshots.

## Contents

- `00-baseline.log` to `14-decision-write-once.log`: the numbered runs in the order they were made (baseline, RED, the first status run, the directory runs before and after the test updates, the route and type checks, eslint, the browser RED and GREEN runs and their repeats, the final directory and route run, the decision write-once check).
- `M-M1-*.log` to `M-M5-*.log`: one mutation of the status handling per file, each run against the specs it must break.
- `a11y-snapshot.sh`, `snapshot-red-tree-state.txt`, `snapshot-green-tree-state.txt`: the snapshot runner and the tree state of the RED and GREEN snapshots the browser runs used.

## Ownership

The `a11y-status` lane owns this directory. Nothing here is acceptance evidence by itself: the criteria are proven by the tests the report cites and by the ledger.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-a11y-status-report.md`
- `../../2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh`
- `../impl-lane-brief.md`
