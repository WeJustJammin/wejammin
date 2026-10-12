# Lane dep502 logs (2026-10-11)

Evidence for `../lane-dep502-report.md`: the CMS editorial 502 wire contract (`DEPENDENCY_UNAVAILABLE`, not `BAD_GATEWAY`), with the RED run, the GREEN runs and the static checks.

## Contents

- `red-1.log`, `green-1.log` to `green-3.log`: the RED run of the new specs against the unfixed code and the GREEN runs after the fix.
- `contracts-check.log`, `eslint-1.log`, `eslint-2.log`, `tsc-1.log`, `tsc-2.log`: the contract check, lint and type-check runs.
- `run-set.sh`: the exact vitest set the lane ran; `my-files.txt`: every file the lane touched.

## Ownership

The `dep502` lane owns this directory. Nothing here is acceptance evidence by itself: the criteria are proven by the tests the report cites and by the ledger.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-dep502-report.md`
- `../impl-lane-brief.md`
