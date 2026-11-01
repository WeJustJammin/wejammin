# Slice 11 evidence logs: integration

## Contents

Raw run output of the integration lane (production-composition test, the checker node bound, race runner 031 and the Slice 09 benchmark): lint and type-check runs, RED and GREEN runs, mutation runs, race-runner runs, the Worker maximum-node timing and the `bench/` Slice 09 create-path measurements.

## Ownership

The lane that owns `../lane-integration-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the exact failing assertion and passing counts.

## Extension

Add a log only when the report cites it. Name it `<red|green|mutation|regress>-<what>.log` so the report can refer to it by name, and never overwrite a RED log with a later run.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-integration-report.md` (the report these logs back)
- `../STATE.md`
