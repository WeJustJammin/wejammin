# Lane reviewB-1 logs (2026-10-11)

Raw RED and GREEN output of lane `reviewB-1` (review findings B-01, B-03 and B-05 of `review-b-code.md`); the narrative is `../lane-reviewB-1-report.md`.

## Contents

- `red-pgtap.out`, `red-api.out`, `red-worker.log`: the RED runs against the unfixed code.
- `green-pgtap-focused.out`, `green-pgtap-focused.tap`, `green-pgtap-slice11-all.out`, `green-pgtap-slice11-all.tap`: the pgTAP runs after the fix (the focused files and every Slice 11 file).
- `green-api-recheck.out`, `green-api-recheck-2.out`: the real-stack apispec re-checks.
- `green-worker-async-runtime.log`, `green-worker-relay-neighbours.log`, `green-worker-broad-partial.txt`: the worker suites that neighbour the change.
- `mutation-neutralized-checker.log`: the mutation check recorded in the report (the checker neutralized, then restored byte-identical).

## Ownership

The `reviewB-1` lane owns this directory. Nothing here is acceptance evidence by itself.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-reviewB-1-report.md`
- `../review-b-code.md`
- `../impl-lane-brief.md`
