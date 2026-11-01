# Slice 11 evidence logs: bench2

## Contents

Raw output of the bench2 lane (P2-S09-AC-217 in the canonical SQL suite): TAP outputs of the diagnosis and measurement
runs, the job scripts that took the quiet lock exclusively and produced them, the probes they ran, the mutation harness for
the validator early accept and the regression driver.

- `b2lib.sh`, `diag-job.sh`, `w1-job.sh`, `verify-job.sh`: the lock discipline (quiet lock EXCLUSIVE, then the alt-stack lock,
  resets under the reset lock, the 1-minute load below 1.5 before each measurement) and the jobs built on it. A run of the
  bench is "in-suite" when it follows `supabase db reset` and the test files that sort before the bench file, in
  pg_prove's order (`b2_prefix`), exactly as `pnpm db:test` does.
- `probes/`: the SQL probes (state snapshot, statement profile, function profile, chain profile, plans, catalog).
- `*.summary`, `*.summary.<probe>`: the job summaries and the probe output lines (`# ` diagnostics).
- `*-bench-*.tap`, `*-prefix-*.tap`: the bench runs and the prefix runs of each job.
- `mutants-fast-accept.py`, `mutant-fast-accept-*.tap`: the mutation proof of the early accept.
- `regress.sh`, `regress-*-chunk*.tap`: the Slice 09 to 12 regression on the alt stack.
- `red-*.tap`, `green-*.tap`: the failing and passing runs of the new suites.

## Ownership

The lane that owns `../lane-bench2-report.md` wrote these files and owns them. Raw reset logs (`*.log`) are git-ignored.

## Extension

Add a run as the next timestamped file and state the commit, the host load and whether the quiet lock was held exclusively
in the lane report. Never overwrite a baseline run with a later one.

## Conventions

Quote file paths exactly. Never record a passing result that was not observed, and keep credentials, tokens and personal data
out of every file here.

## Related links

- `../lane-bench2-report.md`
- `../lane-bench-logs/README.md` and `../lane-bench-report.md` (the first bench lane)
- `../STATE.md`
