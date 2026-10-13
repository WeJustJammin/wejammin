# Slice 11 evidence logs: lease

## Contents

Raw run output of the lease lane (CMS lease-control forwarding): the baseline, RED and GREEN target runs and their JSON reports, the neighbour-suite runs and the format, lint and type-check runs.

## Ownership

The lane that owns `../lane-lease-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the exact failing assertion and passing counts.

## Extension

Add a log only when the report cites it. Name it `<red|green|mutation|regress>-<what>.log` so the report can refer to it by name, and never overwrite a RED log with a later run.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-lease-report.md` (the report these logs back)
- `../STATE.md`
