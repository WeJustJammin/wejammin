# Slice 11 lane runners

The shell runners the 2026-10-10 Slice 11 lanes use to reach the databases and the canonical gates without colliding.

## Contents

- `lane-db-alt.sh`: runs pgTAP files on the second (alt) Supabase stack under its own lock, resetting it to the worktree's migrations first.
- `gate-db-verify.sh`: the canonical `db:verify` gate runner.
- `gate-validate-diag.sh`: the canonical `validate` gate runner with per-step diagnostics.

## Ownership

The orchestrator owns these scripts; lanes call them and do not edit them.

## Extension

A new runner states its lock, what it resets and what it logs in a header comment, takes `/tmp/wejammin-quiet.lock` shared for any heavy step, and never touches the primary checkout.

## Conventions

Every runner takes the worktree as its first argument and writes its logs under that worktree, never under the primary checkout.

## Related links

- `../impl-lane-brief.md`
- `../../2026-10-08-phase2-codex-handoff/lanes/lane-api.sh`
- `../../2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh`
