# Lane reviewA-2 logs (2026-10-11)

## Contents

Evidence of the reviewA-2 lane: the in-call durable-effect observation of the refusal suites, the read-latency
benchmark, the whole-job sweep deadline and the retain-input specs. Everything here was produced by a command run
in this worktree; the report is `../lane-reviewA-2-report.md`.

| File                                       | What it shows                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `red-run1.out`, `red-run1.tap`             | First pgTAP run at the start of the lane: the six refusal suites fail only on their unfinished final assertion; the criteria suites pass                                                                                              |
| `mutants-and-green-run2.tap`               | The six refusal suites green and the six scratch mutants (a refusal that writes and returns) red on the effect verdict, naming the probes                                                                                             |
| `green-final-pgtap.out`, `.tap`            | Final run after a fresh `supabase db reset` of the alt stack: 12 files, 336 assertions, all passing                                                                                                                                   |
| `retention-run1.out`, `retention-run2.out` | Retain-input specs: the first run (one fixture defect, a 422 without the window members) and the green run after the fix (11 tests)                                                                                                   |
| `retention-mutants*.out`                   | Mutation proof: forms that forget what was typed on a refusal or an unknown outcome fail the specs (7 failures for decision, schedule, publish; 2 for preview)                                                                        |
| `sweep-run1.out`                           | The five `cms-publication-schedule-sweep*` test files (43 tests) green                                                                                                                                                                |
| `sweep-deadline-red-against-head.out`      | The whole-job deadline specs run against the sweep at `HEAD`: the two whole-job specs fail there                                                                                                                                      |
| `bench-functional-run*.out`                | Fixture debugging of the benchmark on the loaded host (no reset); `run4` is the first full pass                                                                                                                                       |
| `bench-mutant-slow.out`, `.tap`            | Benchmark with CMS-03B-16/17 slowed by 0.8 s: exactly the three Tier 1 assertions fail                                                                                                                                                |
| `bench-exclusive-run.out`, `.tap`          | The timed run under the exclusive quiet lock with load below 1.5 (24/24; p95 figures in the report). No command line in the first line: it is `alt-bench-exclusive.sh <worktree> supabase/tests/phase_02_slice_11_reads_bench128.sql` |
| `sweep-run2.out`, `retention-run4.out`     | Resume of 2026-10-11 at HEAD `0fd4bf31`: the five sweep files (43 tests) and the whole `cms-editorial-workflow` web directory (35 files, 369 tests) green                                                                             |
| `lint-run2.out`, `tsc-run3.out`            | prettier, eslint and `tsc --noEmit` for the five TS files and the web and worker projects at HEAD `0fd4bf31`                                                                                                                          |
| `world-suites.txt`, `world-suites-run.out` | The 42 pgTAP suites that include the shared `rpc_review/000-world.sqlinc`, and the run on the alt stack at HEAD `0fd4bf31`                                                                                                            |
| `stale-citations-scan.mjs`, `.out`         | Read-only scan of the four ledger fragments for citations whose title no longer exists in the changed file (34 found)                                                                                                                 |
| `tsc-web2.out`, `tsc-worker.out`           | Type checks of the web and worker projects                                                                                                                                                                                            |
| `alt-noreset.sh`, `alt-bench-exclusive.sh` | Variants of `../lanes/lane-db-alt.sh`: the first skips the reset (fast iteration only), the second takes the quiet lock exclusively and waits for load < 1.5                                                                          |

## Ownership

This lane owns this directory. The scratch mutants named in the logs (`zz_a2_*`) existed only for the run that
produced the log and were deleted straight after; none is in the tree.

## Extension

A new log goes beside these with its command in the first line of the file. Never record a result that was not
observed.

## Conventions

Logs name the run they hold; a mutant is named in the file that proves it. The `.out` and `.tap` captures are kept as produced.
Credentials, tokens and personal data never enter a log.

## Related links

- `../lane-reviewA-2-report.md`
- `../review-a-ledger-refutation.md` (A-M3, A-M9, A-M12, A-M15)
- `../impl-lane-brief.md`
