import { afterEach, describe, expect, it } from 'vitest';

import {
  BUNDLE_BUDGETS,
  CMS_EDITORIAL_ROUTES,
  cmsEditorialBundleBudgetFailures,
  measureCmsEditorialRoute,
} from '../../scripts/verify-bundle-budget.mjs';
import {
  createBundleFixture,
  incompressiblePayload,
  removeBundleFixtures,
} from './bundle-fixture.test-support';

/*
 * A page can hydrate more than one island (the pattern, taxonomy and template pages carry a
 * designer and a governed panel). FE03 "Performance budgets and loading strategy" holds every
 * island to 35 KB and the page to 90 KB of initial JavaScript, so the page is charged for ALL of
 * its islands and each island is checked on its own.
 */

afterEach(removeBundleFixtures);

const routeNamed = (name: string) => {
  const route = CMS_EDITORIAL_ROUTES.find((entry) => entry.name === name);
  if (!route) throw new Error(`no CMS editorial route named ${name}`);
  return route;
};

const documentScripts = {
  'CmsEditorialDocument.astro_astro_type_script_index_0_lang.a.js':
    'import "./route-heading-focus.js";',
  'CmsEditorialDocument.astro_astro_type_script_index_1_lang.b.js':
    'import "./auth-scope-sync.js";',
  'CmsEditorialDocument.astro_astro_type_script_index_2_lang.c.js':
    'export const actions = true;',
  'route-heading-focus.js': 'export const heading = true;',
  'auth-scope-sync.js': 'export const scope = true;',
  'client.runtime.js': 'export const client = true;',
};

describe('CMS editorial routes with more than one island', () => {
  it('declares the pattern page with its designer and its governed panel', () => {
    const route = routeNamed('CMS pattern edit');
    expect(route.island).toBe('CmsPatternVersionDesigner');
    expect(route.extraIslands).toEqual(['CmsGovernedPatternPanel']);
  });

  it('declares the pattern, taxonomy, related-content and definition-review pages', () => {
    expect(
      CMS_EDITORIAL_ROUTES.map((route) => route.page).filter((page) =>
        /^(patterns|taxonomies|definition-reviews)\/|related-content/u.test(
          page,
        ),
      ),
    ).toHaveLength(7);
  });

  it('declares the template edit page with its designer and its governed panel', () => {
    const route = routeNamed('CMS template edit');
    expect(route.island).toBe('CmsTemplateEditDesigner');
    expect(route.extraIslands).toEqual(['CmsGovernedTemplatePanel']);
  });

  it('charges the route for every island and lists each island on its own', () => {
    const root = createBundleFixture({
      'CmsPatternVersionDesigner.entry.js': 'import "./shared.js";',
      'CmsGovernedPatternPanel.entry.js': 'import "./panel.only.js";',
      'shared.js': incompressiblePayload(3, 3_000),
      'panel.only.js': incompressiblePayload(5, 4_000),
      ...documentScripts,
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS pattern edit'), {
      distDirectory: root,
    });

    expect(report.initialAssets).toEqual(
      expect.arrayContaining([
        'client/_astro/CmsPatternVersionDesigner.entry.js',
        'client/_astro/CmsGovernedPatternPanel.entry.js',
        'client/_astro/panel.only.js',
        'client/_astro/shared.js',
      ]),
    );
    expect(report.islands.map((island) => island.name)).toEqual([
      'CmsPatternVersionDesigner',
      'CmsGovernedPatternPanel',
    ]);
    const [designer, panel] = report.islands;
    expect(panel?.gzipBytes).toBeGreaterThan(designer?.gzipBytes ?? 0);
    expect(report.workbenchGzipBytes).toBe(designer?.gzipBytes);
    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      (designer?.gzipBytes ?? 0) + (panel?.gzipBytes ?? 0) - 3_000,
    );
  });

  it('fails the extra island that exceeds the island budget, naming it, though the primary one is light', () => {
    const root = createBundleFixture({
      'CmsPatternVersionDesigner.entry.js': 'export const light = true;',
      'CmsGovernedPatternPanel.entry.js': 'import "./panel.heavy.js";',
      'panel.heavy.js': incompressiblePayload(9, 60_000),
      ...documentScripts,
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS pattern edit'), {
      distDirectory: root,
    });
    const panel = report.islands.find(
      (island) => island.name === 'CmsGovernedPatternPanel',
    );

    expect(panel?.gzipBytes).toBeGreaterThan(BUNDLE_BUDGETS.workbenchGzipBytes);
    expect(report.workbenchGzipBytes).toBeLessThan(
      BUNDLE_BUDGETS.workbenchGzipBytes,
    );
    expect(cmsEditorialBundleBudgetFailures([report])).toEqual([
      `CmsGovernedPatternPanel exceeds ${BUNDLE_BUDGETS.workbenchGzipBytes} gzip bytes: ${panel?.gzipBytes}`,
    ]);
  });

  it('fails the page when two light islands together exceed the initial route budget', () => {
    const root = createBundleFixture({
      'CmsPatternVersionDesigner.entry.js': 'import "./a.js";',
      'CmsGovernedPatternPanel.entry.js': 'import "./b.js";',
      'a.js': incompressiblePayload(11, 50_000),
      'b.js': incompressiblePayload(13, 50_000),
      ...documentScripts,
      'client.runtime.js': incompressiblePayload(7, 45_000),
    });

    const report = measureCmsEditorialRoute(routeNamed('CMS pattern edit'), {
      distDirectory: root,
    });

    for (const island of report.islands)
      expect(island.gzipBytes).toBeLessThanOrEqual(
        BUNDLE_BUDGETS.workbenchGzipBytes,
      );
    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      BUNDLE_BUDGETS.initialRouteGzipBytes,
    );
    expect(cmsEditorialBundleBudgetFailures([report])).toEqual([
      `CMS pattern edit initial route exceeds ${BUNDLE_BUDGETS.initialRouteGzipBytes} gzip bytes: ${report.initialRouteGzipBytes}`,
    ]);
  });

  it('fails closed when a declared extra island is missing from the build', () => {
    const root = createBundleFixture({
      'CmsPatternVersionDesigner.entry.js': 'export const light = true;',
      ...documentScripts,
    });
    expect(() =>
      measureCmsEditorialRoute(routeNamed('CMS pattern edit'), {
        distDirectory: root,
      }),
    ).toThrow('CmsGovernedPatternPanel browser entry is missing');
  });

  it('keeps the single-island report shape: one island entry, the primary one', () => {
    const root = createBundleFixture({
      'CmsEditorialWorkflowIsland.entry.js': 'export const light = true;',
      ...documentScripts,
    });
    const report = measureCmsEditorialRoute(routeNamed('CMS entry workflow'), {
      distDirectory: root,
    });
    expect(report.islands.map((island) => island.name)).toEqual([
      'CmsEditorialWorkflowIsland',
    ]);
  });
});
