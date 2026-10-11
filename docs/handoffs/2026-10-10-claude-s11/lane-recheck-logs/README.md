# Slice 11 evidence logs: recheck

## Contents

Raw run output of the dependency-recheck lane (AC-113): RED and GREEN pgTAP, contract and unit runs, the coverage run, and the SQL and Worker mutation runs.

## Ownership

The lane that owns `../lane-recheck-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the exact failing assertion and passing counts.

## Extension

Add a log only when the report cites it. Name it `<red|green|mutation|regress>-<what>.log` so the report can refer to it by name, and never overwrite a RED log with a later run.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-recheck-report.md` (the report these logs back)
- `../STATE.md`
