# Lane last-gaps logs

## Contents

Evidence for `../lane-last-gaps-report.md` (P2-S11-AC-071, P2-S11-AC-106, the BE03b outcome amendment): the mutation scripts `ac071-mutations.sh`, `ac071-mutations-2.sh` and `bundle-mutations.sh`, and the logs they and the runs write (`ac071-*.log`, `bundle-*.log`, `guard-*.log`, `be03b-spec-readers.log`). The logs are git-ignored (`*.log`) and exist only in the worktree that ran them.

## Ownership

The `last-gaps` lane owns this directory. Nothing here is acceptance evidence by itself: the criteria are proven by the cited tests and the ledger.

## Extension

A mutation script edits exactly one file per mutation, runs the runner, restores the file from a byte copy and proves the restore; add a mutation by appending one `mutate` call. Keep the unrestored-file check: a mutation that is left in a migration or a web source corrupts every later run.

## Conventions

Each log is named for the run it holds (`ac071-mutation-<name>.log`, `bundle-mutation-<name>.log`). A first pass whose mutation was not detected is kept and renamed `...-NOT-DETECTED.log`, never overwritten. Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-last-gaps-report.md`
- `../lanes/lane-db-alt.sh`
- `../../2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh`
