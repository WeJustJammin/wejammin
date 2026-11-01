# Slice 11 evidence logs: bench

## Contents

Raw run output of the bench lane (the Slice 09 create-path optimization, AC-217): second-stack reset logs (`alt-reset-*.log`), pgTAP TAP outputs of the `bench128` runs (`alt-tap-*.tap`) and the wrapper script `altrun.sh` that ran them on the second stack.

## Ownership

The lane that owns `../lane-bench-report.md` wrote these files and owns them. Raw logs (`*.log`) are git-ignored; the report names the ones that matter and quotes the measured p95 values.

## Extension

Add a run as the next timestamped file and state the commit, the host load and whether the quiet lock was held exclusively in the lane report. Never overwrite a baseline run with a later one.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../lane-integration-logs/bench/README.md` (the earlier baseline runs)
- `../lane-integration-report.md`
- `../STATE.md`
