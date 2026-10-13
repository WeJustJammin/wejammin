# Lane evidence-gaps exclusive latency runs

Three API latency runs of the `evidence-gaps` lane, each taken with the quiet lock held exclusively.

## Contents

- `reset-run<n>.log`: the database reset that preceded run `n`.
- `vitest-run<n>.log`: the vitest output of run `n`.
- `samples-run<n>.jsonl`: the raw latency samples of run `n`; `runs.txt`: the run index with the host load recorded for each.

## Ownership

The `evidence-gaps` lane owns this directory.

## Extension

A further run adds `reset-run<n>`, `vitest-run<n>` and `samples-run<n>` files and one line to `runs.txt`; it never edits an earlier run.

## Conventions

Each run starts from a fresh reset and records the host load, so a sample set can be judged against the load it was taken under.

## Related links

- `../README.md`
- `../../lane-evidence-gaps-report.md`
