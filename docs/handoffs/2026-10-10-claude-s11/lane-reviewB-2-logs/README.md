# Lane reviewB-2 logs

Raw RED and GREEN output of lane `reviewB-2` (review findings B-02, B-06, B-08 of
`review-b-code.md`); the narrative is `../lane-reviewB-2-report.md`.

## Contents

- `baseline-worker.out`: the sweep tests before any change (the two AC-082 job-deadline cases already failed).
- `red-worker.out`: the B-02 transport and sweep tests against the unfixed code.
- `red-b08-release.out`: the B-08 session-release tests against the unfixed consumer.
- `green-worker-b02.out`, `green-b08.out`, `green-b08-neighbours.out`: neighbouring suites after the fixes.
- `coverage.out`, `tsc-build.out`: changed-file coverage and the project type-check.
- `*-api*.out`, `*-api*.log`: real-stack runs of the two new apispecs (when present).

## Extension

A new run adds its output here under a name that says RED or GREEN and what it covers. Logs are evidence for the
report, never inputs to a test.
