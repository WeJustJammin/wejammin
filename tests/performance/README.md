# Performance tests

These tests own deterministic payload, bundle-budget, and Phase 1 API smoke
contracts. They do not run representative-data load locally. The API smoke
runner lives at [`infra/performance/api-p95-smoke.mjs`](../../infra/performance/api-p95-smoke.mjs)
and is exercised against the immutable Worker production bundle or an explicit
HTTPS staging origin by the validation workflow.

## Contents

- `api-p95-smoke.test.ts` locks the deterministic latency-runner contract.
- `bundle-budget.test.ts` verifies emitted browser-asset closure accounting.
- `cms-editorial-bundle-budget.test.ts` verifies the CMS editorial route table
  of `scripts/verify-bundle-budget.mjs` (every page and hydrated island of
  `apps/web/src/pages/app/cms-content-modeling` is declared, the document-shell
  scripts are charged to the route, a heavy static import fails the route and a
  dynamic one is a lazy chunk); `bundle-fixture.test-support.ts` builds its
  throw-away `dist` fixtures.

The bundle gate also measures the content schema registry route (the
`ContentSchemaRegistryWorkbenchIsland` entry: at most 90 KB gzip initial and
35 KB gzip workbench closure, with every lazy chunk at most 80 KB). Detail,
review, and editor views load on demand, so the detail route total is reported
in the JSON but not budgeted.

The gate also measures every CMS editorial route (the table `CMS_EDITORIAL_ROUTES`
in the script): each island's static closure is at most 35 KB gzip and each
route's initial JavaScript, including the scripts its document shell adds, at
most 90 KB gzip, with the contract schemas in a lazy chunk. A page or island
missing from the table fails `cms-editorial-bundle-budget.test.ts`.

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
