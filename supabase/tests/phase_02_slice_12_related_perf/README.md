# Slice 12 related-content performance fragments (lane related)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_related_perf.sql`, the non-gating wall-clock suite for BE03c 1633
(tracker P2-S12-AC-279, related part). They are includes, not discovered tests. The suite opens one transaction,
includes the Slice 10/11 preludes and the shared world of `../phase_02_slice_12_related_content/` (`000-helpers`,
`001-world`), then these fragments, and rolls back.

| Fragment           | Content                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `001-bench.sqlinc` | 124 published entries, ten 64-target CMS-03C-05 writes and twenty CMS-03C-21 projections, p95 of each against 300 ms |

Run it on a quiet host (precedent: `../phase_02_slice_12_locale_perf.sql`); the functional suites
(`../phase_02_slice_12_related_content.sql`, `../phase_02_slice_12_related_public_targets.sql`) carry no timing.

To add a measurement: record `(kind, run, ms, ok)` rows in `r12p_ms` from the `do` block and assert the p95.

## Related paths

- `../phase_02_slice_12_related_content/` (world and helpers shared with the other related suites)
- `../phase_02_slice_12_locale_perf/` (the precedent)
