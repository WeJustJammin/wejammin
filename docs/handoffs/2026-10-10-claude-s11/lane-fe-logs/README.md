# Slice 11 evidence logs: fe

## Contents

Raw run output of the front-end lane (focus order, schedule choices, workflow island): the baseline, first-run, RED and GREEN runs, the type-check run and one `M<n>-*.log` per mutation of the focus and pending-state behavior.

## Ownership

The lane that owns `../lane-fe-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the exact failing assertion and passing counts.

## Extension

Add a log only when the report cites it. Name it `<red|green|mutation|regress>-<what>.log` so the report can refer to it by name, and never overwrite a RED log with a later run.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-fe-report.md` (the report these logs back)
- `../STATE.md`
