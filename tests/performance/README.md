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
- `cms-editorial-bundle-budget-mounted.test.ts` verifies that a route is charged for every lazy
  chunk its islands fetch without the person doing anything (a form mounted at hydration, a read
  made by a mount effect, the result a command left for the editor page), that only the chunks
  named in `CMS_ON_DEMAND_CHUNKS` are exempt, and that each exemption is shown, not asserted: it
  names the person's own event that loads it (`trigger`), the source files that hold its dynamic
  `import()` (`importedBy`, and the test fails on any other call site), and a proof test with the
  stem in its title that mounts the real surface, sees nothing requested by the mount, a scroll or
  time, and sees the trigger request it. A chunk that loads without a trigger on some routes only
  is charged on those (`chargedOn`). Nothing is exempt because of visibility or the size of the
  viewport.
- `bundle-provenance.test.ts` verifies what `pnpm bundle:check` refuses to measure: any Node but
  the one `.node-version` pins (zlib changes the gzip bytes by 660 to 800 on every CMS route), a
  `dist` built for a named environment, a development build, and a dist with no server build. The
  evidence JSON records `measuredWith.node`. Run it on a fresh production build
  (`pnpm --filter web build`) under the pinned Node.
- `cms-page-actions-routes.test.ts` verifies that a CMS page loads the page-actions script exactly
  when its markup holds a form the script serves.
- `cms-editorial-bundle-budget-islands.test.ts` verifies a page that hydrates more
  than one island (`extraIslands`: the pattern, taxonomy and template pages carry
  a designer and a governed panel): the route is charged for every island and
  each island is held to the island budget on its own.

The bundle gate also measures the content schema registry route (the
`ContentSchemaRegistryWorkbenchIsland` entry: at most 90 KB gzip initial and
35 KB gzip workbench closure, with every lazy chunk at most 80 KB). Detail,
review, and editor views load on demand, so the detail route total is reported
in the JSON but not budgeted.

The gate also measures every CMS editorial route (the table `CMS_EDITORIAL_ROUTES`
in the script): each island's static closure is at most 35 KB gzip and each
route's initial JavaScript, including the scripts its document shell adds, at
most 90 KB gzip, with the contract schemas in a lazy chunk. A page or island
missing from the table fails `cms-editorial-bundle-budget.test.ts`. A page with
`extraIslands` is charged for all of them. The source-level guard that a command
form stays out of an island's static closure is
`apps/web/src/cms-lazy-forms-closure.test.ts`.

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
