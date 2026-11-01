# phase_02_slice_12_gaps_perf_governed

Fragments of `../phase_02_slice_12_gaps_perf_governed.sql`: the governed-review RPC-share bench (CMS-03C-06 .. -11): 110 real submissions, assignments, 50 approvals, 24 activations / schedules / retirements, a protected review with 36 assignment rows, and the timed detail and queue reads.

- Run only through the staged ALT runner (lane `none`: promoted migrations only); never wrap it in `timeout`. Run on a quiet host.
- Timing kit: `../phase_02_slice_12_gaps_perf_common/000-timing.sqlinc` (`g12p_call` times only the RPC statement under the real
  `service_role`; every sample must succeed; the statistic is `percentile_cont(0.95)`).
- Add an operation: build its world with the real producers (never a hand-inserted active row), time it with `g12p_call`, require
  the sample count, and assert the p95 against the clause target with the criterion marker `[P2-S12-AC-NNN]` in the title.
- The end-to-end (API) p95 of the same operations is `tests/postgrest/phase-02-slice-12-latency-*.apispec.ts`, run by root.
- Related: `../phase_02_slice_09_dec108/`, `../phase_02_slice_12_governed_assignment/`, `../phase_02_slice_12_taxonomy_terms/`.
