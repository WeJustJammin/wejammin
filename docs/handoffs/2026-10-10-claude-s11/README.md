# Slice 11 Claude orchestration (2026-10-10)

## Contents

The live orchestration state (`STATE.md`), the implementation and ledger lane briefs (`impl-lane-brief.md`, `ledger-lane-brief.md`), one `lane-<name>-report.md` per lane, the ledger-gap lists (`ledger-gaps-*.md`), the second-stack runner `lanes/lane-db-alt.sh`, the `lane-*-logs/` evidence directories, and the closeout preparation report (`closeout-prep-report.md`: what the closure artifacts changed and what the orchestrator still owes).

## Ownership

The Claude orchestrator of Slice 11 owns this directory; each lane owns its own report and log directory. Nothing here is acceptance evidence by itself: criteria are proven by the cited tests and the ledger.

## Extension

A new lane adds `lane-<name>-report.md` and, only if it keeps logs, a `lane-<name>-logs/` directory with its own README. Update `STATE.md` when a lane integrates. Do not edit another lane's report.

## Conventions

Reports name every changed file, the RED log and failing assertion, the GREEN log and counts, and anything left open. Never copy a measurement into a spec. Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `STATE.md`
- `impl-lane-brief.md`
- `../2026-10-08-phase2-codex-handoff/lanes/` (the main-stack runners)
- `.memory/pipeline/progress/slices/phase-02-slice-11.md`
