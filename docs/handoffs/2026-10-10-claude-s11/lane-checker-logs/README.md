# Slice 11 evidence logs: checker

## Contents

Raw run output of the checker lane (`cms.a11y.structural`, AC-098): RED and GREEN SQL and vitest runs, the mutation runs that prove the checker rules bite, and the lint, format and type-check runs.

## Ownership

The lane that owns `../lane-checker-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the exact failing assertion and passing counts.

## Extension

Add a log only when the report cites it. Name it `<red|green|mutation|regress>-<what>.log` so the report can refer to it by name, and never overwrite a RED log with a later run.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-checker-report.md` (the report these logs back)
- `../STATE.md`
