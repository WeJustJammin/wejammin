# Lane evidence-gaps logs (2026-10-12)

Evidence for `../lane-evidence-gaps-report.md`: the mutation proofs of AC-079 and AC-089, the API latency and coupling checks, the timeouts check and the evidence-guard run.

## Contents

- `ac079-*.log`: the AC-079 outcome vocabulary, green and three mutations. `ac089-contract-*.log`, `ac089-worker-*.log`: the AC-089 input bound at the contract and the worker, green and mutated.
- `latency-dev*.out`, `latency-dev4.jsonl`, `latency-mutation-tight-targets.*`: the API latency runs and the tight-target mutation; `latency-exclusive/`: the three exclusive-lock runs with their samples.
- `coupling-*.log`, `api-coupling-check.sh`, `api-latency-exclusive.sh`: the coupling checks and the runners.
- `timeouts-*.out`: the timeouts check and its 1 ms mutation. `evidence-guards.log`, `evidence-guards.problem-classes.txt`: the guard run and its problem classes.

## Ownership

The `evidence-gaps` lane owns this directory. Nothing here is acceptance evidence by itself.

## Extension

A new run adds its output here under a name that says what it shows (RED, GREEN, a mutation, a repeat) and, in the first line of the
file or in the report, the command that produced it. Never record a result that was not observed, and never overwrite the log of an earlier run.

## Conventions

`*.log` files are git-ignored and exist only in the worktree that ran them; scripts, notes and the other captured outputs are kept as they
were produced. A log whose command is not in its first line names the command in the report. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-evidence-gaps-report.md`
- `../impl-lane-brief.md`
