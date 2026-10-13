# Slice 11 lane runners and shared lane notes

## Contents

The scripts every Slice 10 and 11 lane runs the database and real-API suites through (`lane-db.sh`, `lane-api.sh`, `lane-db-ev.sh`, `lane-e2e.sh`, `refresh-receipts*.sh`) and the shared rules and notes they follow (`COMMON.md`, `NOTES.md`, `INTEGRATION-TODO.md`).

## Ownership

The orchestrator of the 2026-10-08 handoff owns the scripts. Each script takes `/tmp/wejammin-supabase-ci.lock` on the main local Supabase stack, resets the database to the checkout it is given, then runs its suite, so concurrent lanes serialize instead of corrupting one another.

## Extension

Add a runner only for a suite that needs a reset and a lock of its own; reuse `lane-db.sh` and `lane-api.sh` otherwise. A runner takes the checkout path first, holds the CI lock before it touches the database, and writes its log under `<checkout>/.lane-logs`.

## Conventions

Never run `supabase db reset`, `pnpm db:verify` or `psql` against the shared stack outside these runners. Take `/tmp/wejammin-quiet.lock` shared (`flock -s`) around any heavy command while a canonical gate may be running.

## Related links

- `COMMON.md` (rules every lane follows)
- `../../2026-10-10-claude-s11/lanes/lane-db-alt.sh` (the second-stack runner)
- `infra/verify-database.sh` (the canonical gate)
