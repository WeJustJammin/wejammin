# Slice 09 create-path benchmark runs

## Contents

TAP outputs and summaries of the `bench128` measurement of the Slice 09 create path (AC-217: create128 p95 against 300 ms) at origin/main and at the branch HEAD, in numbered repeat runs (`bench-head-*.tap`, `bench-head2-*.tap`, `bench-head3-*.tap`, `bench-ab2.out`).

## Ownership

The integration lane owns these measurements. They record that the p95 exceeded the budget on this host for both origin/main and HEAD; they are not a specification and no number here may be copied into a spec.

## Extension

Add a run as the next numbered file of its series and state the commit, the host load and whether the quiet lock was held exclusively in the lane report.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data out of every file here.

## Related links

- `../../lane-integration-report.md`
- `../../STATE.md`
