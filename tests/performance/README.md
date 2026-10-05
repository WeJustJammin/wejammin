# Performance tests

These tests own deterministic payload, bundle-budget, and Phase 1 API smoke
contracts. They do not run representative-data load locally. The API smoke
runner lives at [`infra/performance/api-p95-smoke.mjs`](../../infra/performance/api-p95-smoke.mjs)
and is exercised against the immutable Worker production bundle or an explicit
HTTPS staging origin by the validation workflow.

## Contents

- `api-p95-smoke.test.ts` locks the deterministic latency-runner contract.
- `bundle-budget.test.ts` verifies emitted browser-asset closure accounting.

The bundle gate also measures the content schema registry route (the
`ContentSchemaRegistryWorkbenchIsland` entry: at most 90 KB gzip initial and
35 KB gzip workbench closure, with every lazy chunk at most 80 KB). Detail,
review, and editor views load on demand, so the detail route total is reported
in the JSON but not budgeted.

## Ownership

Performance regression tests belong to the surface that owns the measured
artifact. Cross-surface budget orchestration remains in this directory.

## Extension

Add a focused regression before changing a threshold, asset classification, or
measurement protocol. New external probes must fail closed on missing evidence.

## Conventions

Use deterministic fixtures for pull-request gates and record exact sample,
error, percentile, and artifact identity fields.

## Related links

- [`infra/performance/README.md`](../../infra/performance/README.md)
- [`scripts/verify-bundle-budget.mjs`](../../scripts/verify-bundle-budget.mjs)
