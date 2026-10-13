# Slice 09 bench128 probes: bench2 lane

## Contents

Profiling probes of the bench2 lane for P2-S09-AC-217 (create128 and activate p95): instrumented copies, timing and EXPLAIN (ANALYZE, BUFFERS) scripts run inside rolled-back transactions on a local stack, and their raw output.

## Ownership

The lane that owns `../../lane-bench2-report.md` wrote these files. They are evidence of how the cost was located, not production code or tests; nothing here runs in a gate.

## Extension

Add a probe only when the report cites it. Never edit a probe after its output is cited; write a new one.

## Conventions

Probes never commit, never alter grants or production objects outside a rolled-back transaction, and contain no credentials or personal data.

## Related links

- `../../lane-bench2-report.md`
- `../../../../../supabase/tests/phase_02_slice_09_evidence_bench128.sql`
