# Lane queue-perf logs (2026-10-12)

Evidence for `../lane-queue-perf-report.md`. All runs are on the ALT stack (`lanes/lane-db-alt.sh`, fresh `supabase db reset`
first) at HEAD `4c679486` plus this lane's uncommitted files.

| File                                    | What it is                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `diag3.full`                            | plain EXPLAIN and EXPLAIN ANALYZE of the OLD page query under stale statistics (65 s, 27 M buffer hits)          |
| `diag4.full`                            | variant A (65 s -> 123 ms) and the OLD query with the nine relationship policies dropped (62.6 s)                |
| `diag5.full`                            | the shipped query shape under stale statistics (4.2 ms, 693 buffer hits) and the installed reader's pg_proc pins |
| `old-query-metric-validation.txt`       | the planner-independent work metric on the OLD query: 63,132 ms, 26,704,773 review tuples read                   |
| `red1.tap`                              | RED: the guard against the unfixed reader (7 of 20 fail, queue page cancelled at 60 s)                           |
| `mutant1.tap` / `mutant1.out`           | mutation proof: the pre-171000 reader reinstalled in the guard's transaction (same 7 failures, 26,237,343 read)  |
| `green2.tap`                            | GREEN: the guard against the fixed reader (20 of 20, queue p95 9.3 ms, 201 review tuples per call)               |
| `bench-run{1,2,3}.{out,tap}`            | the reads bench, three runs, quiet lock held exclusively, load average recorded                                  |
| `final-targeted.out`                    | guard + bench + RLS + queue + safe-read-effects suites on the final tree (5 files, 163 tests)                    |
| `full-suite.out`, `full-suite-tail.txt` | the whole pgTAP suite: 369 files, 14,026 tests, all pass                                                         |
| `alt-bench-exclusive.sh`, `alt-lint.sh` | the exclusive-lock bench variant (from lane reviewA-2) and the `db lint` runner used here                        |

The full 3.5 MB TAP is `.lane-logs/queue-perf/full2.tap` (ignored by git).
