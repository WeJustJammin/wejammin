# Slice 11 read-latency benchmark fragments (review A, A-M9)

`000-world.sqlinc` is the world of `../phase_02_slice_11_reads_bench128.sql`: a 128-field content type created by
the real `cms_create_type_draft`, an entry builder with 128 field values, review clones for the reviewer queue and the
timing loop (`b11_bench`, `b11_p95`). It is an include, not a discovered test.

## Adding a measurement

Build the bounded fixture in the entrypoint, take the request from a `b11_*_rq` builder (evidence and context are built
OUTSIDE the timed region), call `pg_temp.b11_bench(op, function, request, n)` with `n >= 20` as the actor whose session
is set, and assert `b11_p95(op)` against the declared BE03b target with a literal title.

## Conventions

- Measure on a quiet host only (the canonical gate holds `/tmp/wejammin-quiet.lock` exclusively).
- Targets are the BE03b tier figures (Tier 1 p95 < 750 ms, Tier 2 p95 < 1,200 ms); the worst sample is bounded by the
  exact 8,000 ms read deadline.
- Keep each file below 400 lines.

## Related paths

- `../phase_02_slice_09_evidence_bench128.sql` (the Slice 09 benchmark this follows)
- `../phase_02_slice_11_rpc_reads/` (the read worlds this builds on)
