import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  BUNDLE_BUDGETS,
  bundleBudgetFailures,
  measureBundleBudget,
} from '../../scripts/verify-bundle-budget.mjs';
import {
  createBundleFixture,
  incompressiblePayload,
  removeBundleFixtures,
} from './bundle-fixture.test-support';

/*
 * Regression for the content schema registry route
 * (`ContentSchemaRegistryWorkbenchIsland`). All three registry pages
 * (index.astro, [contentTypeId]/versions/[versionId].astro and
 * schema-reviews/[reviewId].astro) render the island and add two shared shell
 * scripts beside it: `route-heading-focus` and `auth-scope-sync`.
 *
 * `measureBundleBudget` discovers the registry route's extra scripts through
 * `findRouteAssets`, whose REGISTRY_ENTRY_STEM branch charged only
 * `route-heading-focus`. `auth-scope-sync` and its static dependencies were
 * never added to the initial route total, so `pnpm bundle:check` could pass
 * while the real registry route shipped past `initialRouteGzipBytes`.
 *
 * These tests drive the real `measureBundleBudget` / `bundleBudgetFailures`
 * over a synthetic built asset graph. They do not run the production build.
 */

const REGISTRY_ISLAND = 'ContentSchemaRegistryWorkbenchIsland';
const REGISTRY_ROUTE_LABEL = 'Content schema registry';
const ENTRY_ASSET = `${REGISTRY_ISLAND}.entry.js`;
const AUTH_SCOPE_SYNC_ASSET = 'auth-scope-sync.fixture.js';
const AUTH_SCOPE_STORE_ASSET = 'auth-scope-store.js';
const ROUTE_HEADING_ASSET = 'route-heading-focus.fixture.js';
const LAZY_FORMS_ASSET = 'registry-lazy-forms.js';

afterEach(removeBundleFixtures);

/**
 * A build graph shaped like the registry route's client output: the island entry
 * with its static closure, the Astro/React runtimes, the two shell scripts the
 * page loads beside the island, and a genuinely dynamic import that must stay
 * lazy. `authScopeSyncBytes` is incompressible so the companion's gzip size is
 * real; the auth companion is static-only, so nothing can promote it to initial.
 */
const registryBuildAssets = (
  authScopeSyncBytes: number,
): Record<string, string> => ({
  [ENTRY_ASSET]: [
    'import "./client.runtime.js";',
    'import "./registry-workbench-core.js";',
    `import("./${LAZY_FORMS_ASSET}");`,
  ].join('\n'),
  'registry-workbench-core.js': 'export const workbench = true;',
  [LAZY_FORMS_ASSET]: incompressiblePayload(29, 4_000),
  'client.runtime.js': 'import "./react.runtime.js";',
  'react.runtime.js': 'export const react = true;',
  [ROUTE_HEADING_ASSET]: 'export const heading = true;',
  [AUTH_SCOPE_SYNC_ASSET]: [
    `import "./${AUTH_SCOPE_STORE_ASSET}";`,
    `export const scope = "${incompressiblePayload(7, authScopeSyncBytes)}";`,
  ].join('\n'),
  [AUTH_SCOPE_STORE_ASSET]: incompressiblePayload(13, 64),
});

/** The island's own static closure — charged to the island, not the route shell. */
const ISLAND_CLOSURE = [
  `client/_astro/${ENTRY_ASSET}`,
  'client/_astro/client.runtime.js',
  'client/_astro/react.runtime.js',
  'client/_astro/registry-workbench-core.js',
];

/** The route's initial JavaScript: the island closure plus both shell scripts. */
const ROUTE_INITIAL = [
  `client/_astro/${ENTRY_ASSET}`,
  `client/_astro/${AUTH_SCOPE_STORE_ASSET}`,
  `client/_astro/${AUTH_SCOPE_SYNC_ASSET}`,
  'client/_astro/client.runtime.js',
  'client/_astro/react.runtime.js',
  'client/_astro/registry-workbench-core.js',
  `client/_astro/${ROUTE_HEADING_ASSET}`,
];

const measureRegistryRoute = (root: string) =>
  measureBundleBudget({
    distDirectory: root,
    entryName: `${REGISTRY_ISLAND}.tsx`,
  });

/** Independent oracle: `measureAsset` gzips the raw bytes of each asset. */
const sumGzip = (root: string, assets: readonly string[]): number =>
  assets.reduce(
    (total, asset) => total + gzipSync(readFileSync(join(root, asset))).length,
    0,
  );

describe('content schema registry route bundle-budget measurement', () => {
  it('charges the route for route-heading-focus and auth-scope-sync exactly once', () => {
    const root = createBundleFixture(
      registryBuildAssets(BUNDLE_BUDGETS.initialRouteGzipBytes + 64 * 1024),
    );

    const report = measureRegistryRoute(root);

    expect(report.routeLabel).toBe(REGISTRY_ROUTE_LABEL);
    expect(report.workbenchLabel).toBe(REGISTRY_ISLAND);
    expect(report.initialAssets).toEqual([...ROUTE_INITIAL].sort());
    expect(report.initialRouteGzipBytes).toBe(sumGzip(root, ROUTE_INITIAL));
  });

  it('charges the shell scripts to the route without inflating the island budget', () => {
    const root = createBundleFixture(registryBuildAssets(0));

    const report = measureRegistryRoute(root);

    expect(report.workbenchAssets).toEqual([...ISLAND_CLOSURE].sort());
    expect(report.workbenchGzipBytes).toBe(sumGzip(root, ISLAND_CLOSURE));
    expect(report.workbenchAssets).not.toContain(
      `client/_astro/${AUTH_SCOPE_SYNC_ASSET}`,
    );
  });

  it('leaves a genuinely dynamic registry import lazy instead of forcing it into the route', () => {
    const root = createBundleFixture(registryBuildAssets(0));

    const report = measureRegistryRoute(root);

    expect(report.lazyAssets).toEqual([`client/_astro/${LAZY_FORMS_ASSET}`]);
    expect(report.initialAssets).not.toContain(
      `client/_astro/${LAZY_FORMS_ASSET}`,
    );
    expect(bundleBudgetFailures(report)).toEqual([]);
  });

  it('fails the registry route when the uncharged auth companion pushes it past the cap', () => {
    const root = createBundleFixture(
      registryBuildAssets(BUNDLE_BUDGETS.initialRouteGzipBytes + 64 * 1024),
    );

    const report = measureRegistryRoute(root);
    const failures = bundleBudgetFailures(report);

    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      BUNDLE_BUDGETS.initialRouteGzipBytes,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^Content schema registry initial route exceeds 92160 gzip bytes: \d+$/u,
    );
  });
});
