import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  BUNDLE_BUDGETS,
  CMS_EDITORIAL_ROUTES,
  cmsEditorialBundleBudgetFailures,
  measureCmsEditorialRoute,
  measureCmsEditorialRoutes,
} from '../../scripts/verify-bundle-budget.mjs';
import {
  createBundleFixture,
  incompressiblePayload,
  removeBundleFixtures,
} from './bundle-fixture.test-support';

/*
 * The CMS editorial routes (Slices 09-12) hydrate React islands behind the
 * shared document shell. `pnpm bundle:check` must charge each of them against
 * the declared thresholds, or a route can ship 50 KB over its budget with a
 * green gate (FE03 "Performance budgets and loading strategy").
 */

const WEB_SRC = resolve(import.meta.dirname, '../../apps/web/src');
const PAGES = join(WEB_SRC, 'pages/app/cms-content-modeling');
const REGISTRY_ISLAND = 'ContentSchemaRegistryWorkbenchIsland';

afterEach(removeBundleFixtures);

const routeNamed = (name: string) => {
  const route = CMS_EDITORIAL_ROUTES.find((entry) => entry.name === name);
  if (!route) throw new Error(`no CMS editorial route named ${name}`);
  return route;
};

const astroFiles = (directory: string): string[] =>
  readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory()
        ? astroFiles(path)
        : name.endsWith('.astro')
          ? [path]
          : [];
    })
    .sort();

const resolveAstroImport = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.') || !specifier.endsWith('.astro')) return null;
  const target = resolve(dirname(from), specifier);
  return existsSync(target) ? target : null;
};

/** Islands a page hydrates, directly or through an `.astro` component it imports. */
const hydratedIslands = (file: string, seen = new Set<string>()): string[] => {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  const direct = [
    ...source.matchAll(/<([A-Z]\w*)\b[^<>]*?\sclient:\w+/gsu),
  ].map((match) => match[1] as string);
  const nested = [
    ...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gmsu),
  ].flatMap((match) => {
    const target = resolveAstroImport(file, match[1] as string);
    return target === null ? [] : hydratedIslands(target, seen);
  });
  return [...new Set([...direct, ...nested])].sort();
};

const usesCmsDocument = (file: string): boolean =>
  /^import\s[^;]*?CmsEditorialDocument\.astro'/msu.test(
    readFileSync(file, 'utf8'),
  ) ||
  [
    ...readFileSync(file, 'utf8').matchAll(
      /^import\s[^;]*?from\s+'([^']+)'/gmsu,
    ),
  ]
    .map((match) => resolveAstroImport(file, match[1] as string))
    .some(
      (target) =>
        target !== null &&
        !target.endsWith('CmsEditorialDocument.astro') &&
        usesCmsDocument(target),
    );

describe('CMS editorial bundle-budget route declaration', () => {
  it('declares every page of the CMS content-modeling route tree exactly once', () => {
    const pages = astroFiles(PAGES).map((file) => relative(PAGES, file));
    const declared = CMS_EDITORIAL_ROUTES.map((route) => route.page).sort();
    expect(declared).toEqual(pages);
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('names, for each page, exactly the island it hydrates (the registry routes stay with the registry measurement)', () => {
    for (const route of CMS_EDITORIAL_ROUTES) {
      const hydrated = hydratedIslands(join(PAGES, route.page));
      expect(hydrated, `islands hydrated by ${route.page}`).toEqual(
        route.island === null ? [] : [route.island],
      );
    }
  });

  it('charges the document-shell scripts to exactly the pages that render the shell', () => {
    for (const route of CMS_EDITORIAL_ROUTES) {
      if (route.measuredBy !== undefined) continue;
      expect(route.routeScripts, route.page).toBe(
        usesCmsDocument(join(PAGES, route.page))
          ? 'cms-editorial-document'
          : 'page-shell',
      );
    }
  });

  it('leaves the registry routes to the existing registry measurement and measures the rest', () => {
    const registry = CMS_EDITORIAL_ROUTES.filter(
      (route) => route.island === REGISTRY_ISLAND,
    );
    expect(registry.length).toBeGreaterThan(0);
    for (const route of registry)
      expect(route.measuredBy).toBe('content-schema-registry');
    const measured = CMS_EDITORIAL_ROUTES.filter(
      (route) => route.measuredBy === undefined,
    );
    expect(measured.map((route) => route.name)).toEqual(
      expect.arrayContaining([
        'CMS capability grants',
        'CMS entry editor',
        'CMS entry create',
        'CMS conflict resolve',
        'CMS review detail',
        'CMS entry workflow',
      ]),
    );
  });

  it('keeps the declared thresholds unchanged', () => {
    expect(BUNDLE_BUDGETS).toEqual({
      workbenchGzipBytes: 35 * 1024,
      initialRouteGzipBytes: 90 * 1024,
      lazyChunkGzipBytes: 80 * 1024,
    });
  });
});

const documentScripts = (zodImport: string) => ({
  'CmsEditorialDocument.astro_astro_type_script_index_0_lang.a.js':
    'import "./route-heading-focus.js";',
  'CmsEditorialDocument.astro_astro_type_script_index_1_lang.b.js':
    'import "./auth-scope-sync.js";',
  'CmsEditorialDocument.astro_astro_type_script_index_2_lang.c.js': zodImport,
  'route-heading-focus.js': 'export const heading = true;',
  'auth-scope-sync.js': 'export const scope = true;',
});

describe('CMS editorial bundle-budget measurement', () => {
  it('charges the document-shell scripts and their imports to the route but not to the island', () => {
    const root = createBundleFixture({
      'CmsEditorialWorkflowIsland.entry.js': 'import "./react.runtime.js";',
      'react.runtime.js': 'export const react = true;',
      'client.runtime.js': 'import "./react.runtime.js";',
      ...documentScripts('import "./page-actions-core.js";'),
      'page-actions-core.js': incompressiblePayload(11, 6_000),
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
      distDirectory: root,
    });

    expect(report.routeLabel).toBe('CMS entry workflow');
    expect(report.workbenchAssets).toEqual([
      'client/_astro/CmsEditorialWorkflowIsland.entry.js',
      'client/_astro/react.runtime.js',
    ]);
    expect(report.initialAssets).toEqual([
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_0_lang.a.js',
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_1_lang.b.js',
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_2_lang.c.js',
      'client/_astro/CmsEditorialWorkflowIsland.entry.js',
      'client/_astro/auth-scope-sync.js',
      'client/_astro/client.runtime.js',
      'client/_astro/page-actions-core.js',
      'client/_astro/react.runtime.js',
      'client/_astro/route-heading-focus.js',
    ]);
    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      report.workbenchGzipBytes,
    );
  });

  it('fails a route whose island statically pulls a heavy module, naming the route, the island and both thresholds', () => {
    const root = createBundleFixture({
      'CmsEditorialWorkflowIsland.entry.js': 'import "./contracts.heavy.js";',
      'contracts.heavy.js': incompressiblePayload(31, 60_000),
      'client.runtime.js': incompressiblePayload(7, 100_000),
      ...documentScripts('export const actions = true;'),
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
      distDirectory: root,
    });
    const failures = cmsEditorialBundleBudgetFailures([report]);

    expect(report.workbenchGzipBytes).toBeGreaterThan(
      BUNDLE_BUDGETS.workbenchGzipBytes,
    );
    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      BUNDLE_BUDGETS.initialRouteGzipBytes,
    );
    expect(failures).toEqual([
      `CmsEditorialWorkflowIsland exceeds ${BUNDLE_BUDGETS.workbenchGzipBytes} gzip bytes: ${report.workbenchGzipBytes}`,
      `CMS entry workflow initial route exceeds ${BUNDLE_BUDGETS.initialRouteGzipBytes} gzip bytes: ${report.initialRouteGzipBytes}`,
    ]);
  });

  it('passes the same payload when the island reaches it only through a dynamic import, and measures it as a lazy chunk', () => {
    const root = createBundleFixture({
      'CmsEditorialWorkflowIsland.entry.js':
        'const load=()=>import("./contracts.heavy.js");export{load};',
      'contracts.heavy.js': incompressiblePayload(31, 60_000),
      'client.runtime.js': incompressiblePayload(7, 100_000),
      ...documentScripts('export const actions = true;'),
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
      distDirectory: root,
    });

    expect(cmsEditorialBundleBudgetFailures([report])).toEqual([]);
    expect(report.lazyAssets).toEqual(['client/_astro/contracts.heavy.js']);
  });

  it('fails a lazy chunk over the lazy-chunk threshold', () => {
    const root = createBundleFixture({
      'CmsEditorialWorkflowIsland.entry.js':
        'const load=()=>import("./contracts.heavy.js");export{load};',
      'contracts.heavy.js': incompressiblePayload(
        41,
        Math.ceil(BUNDLE_BUDGETS.lazyChunkGzipBytes * 1.7),
      ),
      'client.runtime.js': 'client',
      ...documentScripts('export const actions = true;'),
    });

    const failures = cmsEditorialBundleBudgetFailures([
      measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
        distDirectory: root,
      }),
    ]);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^Lazy chunk client\/_astro\/contracts\.heavy\.js exceeds 81920 gzip bytes: \d+$/u,
    );
  });

  it('measures a route that hydrates no island from the document-shell scripts alone', () => {
    const root = createBundleFixture({
      'client.runtime.js': incompressiblePayload(7, 100_000),
      ...documentScripts('import "./page-actions-core.js";'),
      'page-actions-core.js': incompressiblePayload(11, 8_000),
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS entry list'), {
      distDirectory: root,
    });

    expect(report.workbenchAssets).toEqual([]);
    expect(report.workbenchGzipBytes).toBe(0);
    expect(report.initialAssets).toEqual([
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_0_lang.a.js',
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_1_lang.b.js',
      'client/_astro/CmsEditorialDocument.astro_astro_type_script_index_2_lang.c.js',
      'client/_astro/auth-scope-sync.js',
      'client/_astro/page-actions-core.js',
      'client/_astro/route-heading-focus.js',
    ]);
    expect(cmsEditorialBundleBudgetFailures([report])).toEqual([]);
  });

  it('charges the shared route-heading and auth-scope scripts to a page that owns its script tags', () => {
    const root = createBundleFixture({
      'CmsCapabilityGrantConsoleIsland.entry.js': 'export const island = true;',
      'client.runtime.js': 'client',
      'capability-grants.astro_astro_type_script_index_0_lang.a.js':
        'import "./route-heading-focus.js";',
      'capability-grants.astro_astro_type_script_index_1_lang.b.js':
        'import "./auth-scope-sync.js";',
      'route-heading-focus.js': 'export const heading = true;',
      'auth-scope-sync.js': 'export const scope = true;',
    });

    const report = measureCmsEditorialRoute(
      routeNamed('CMS capability grants'),
      { distDirectory: root },
    );

    expect(report.initialAssets).toEqual([
      'client/_astro/CmsCapabilityGrantConsoleIsland.entry.js',
      'client/_astro/auth-scope-sync.js',
      'client/_astro/capability-grants.astro_astro_type_script_index_0_lang.a.js',
      'client/_astro/capability-grants.astro_astro_type_script_index_1_lang.b.js',
      'client/_astro/client.runtime.js',
      'client/_astro/route-heading-focus.js',
    ]);
  });

  it('reports every failing route together instead of stopping at the first', () => {
    const lightIslands = Object.fromEntries(
      CMS_EDITORIAL_ROUTES.filter(
        (route) => route.measuredBy === undefined && route.island !== null,
      ).map((route) => [
        `${route.island}.entry.js`,
        'export const light = true;',
      ]),
    );
    const pageScripts = Object.fromEntries(
      CMS_EDITORIAL_ROUTES.flatMap((route) =>
        route.measuredBy === undefined && route.routeScripts === 'page-shell'
          ? [
              [
                `${route.pageScript}.astro_astro_type_script_index_0_lang.a.js`,
                'import "./route-heading-focus.js";',
              ],
            ]
          : [],
      ),
    );
    const root = createBundleFixture({
      ...lightIslands,
      'CmsEditorialWorkflowIsland.entry.js': 'import "./contracts.heavy.js";',
      'CmsEditorialReviewDetailIsland.entry.js':
        'import "./contracts.heavy.js";',
      'contracts.heavy.js': incompressiblePayload(31, 60_000),
      'client.runtime.js': incompressiblePayload(7, 100_000),
      ...documentScripts('export const actions = true;'),
      ...pageScripts,
    } as Record<string, string>);

    const reports = measureCmsEditorialRoutes({ distDirectory: root });
    const failing = cmsEditorialBundleBudgetFailures(reports);
    const routeBytes = (name: string): number | undefined =>
      reports.find((report) => report.routeLabel === name)
        ?.initialRouteGzipBytes;

    expect(reports.map((report) => report.routeLabel).sort()).toEqual(
      CMS_EDITORIAL_ROUTES.filter((route) => route.measuredBy === undefined)
        .map((route) => route.name)
        .sort(),
    );
    expect(failing.filter((line) => line.includes('initial route'))).toEqual([
      `CMS entry workflow initial route exceeds ${BUNDLE_BUDGETS.initialRouteGzipBytes} gzip bytes: ${routeBytes('CMS entry workflow')}`,
      `CMS review detail initial route exceeds ${BUNDLE_BUDGETS.initialRouteGzipBytes} gzip bytes: ${routeBytes('CMS review detail')}`,
    ]);
  });

  it('fails closed when a declared island is missing from the build', () => {
    const root = createBundleFixture({
      'client.runtime.js': 'client',
      ...documentScripts('export const actions = true;'),
    });

    expect(() =>
      measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
        distDirectory: root,
      }),
    ).toThrow('CmsEditorialWorkflowIsland browser entry is missing');
  });
});
