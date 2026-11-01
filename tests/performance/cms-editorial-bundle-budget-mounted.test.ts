import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  BUNDLE_BUDGETS,
  CMS_EDITORIAL_ROUTES,
  CMS_ON_DEMAND_CHUNKS,
  cmsEditorialBundleBudgetFailures,
  measureCmsEditorialRoute,
} from '../../scripts/verify-bundle-budget.mjs';
import {
  createBundleFixture,
  incompressiblePayload,
  removeBundleFixtures,
} from './bundle-fixture.test-support';

/*
 * Chrome (phase-02-slice-11-bundle-budget-real-route.spec.ts, P2-S11-AC-106) charges a route for every
 * script it fetches until the page is idle. A command form an island mounts at hydration is a lazy
 * chunk, but a reader who may use it fetches it at once, so the route is charged for it: the initial
 * route is the static closure of the island, the shell and the runtimes PLUS every dynamic edge that
 * is not on demand (FE03 "Performance budgets and loading strategy", app/admin <= 90 KB). A chunk is
 * on demand only when it is named in CMS_ON_DEMAND_CHUNKS; any other lazy chunk is charged.
 */

afterEach(removeBundleFixtures);

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Every non-test source file of the web app. */
const sourceFiles = (directory = resolve('apps/web/src')): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/u.test(name) && !/\.test(?:-support)?\./u.test(name)
      ? [path]
      : [];
  });

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

const ROUTE = 'CMS entry workflow';
const ISLAND = 'CmsEditorialWorkflowIsland.entry.js';

describe('a lazy chunk the island mounts at hydration', () => {
  it('is charged to the initial route with its static closure', () => {
    const root = createBundleFixture({
      ...documentScripts,
      [ISLAND]:
        'const load=()=>import("./CmsFixtureForm.form.js");export{load};',
      'CmsFixtureForm.form.js': `import "./form-helper.js";${incompressiblePayload(3, 4_000)}`,
      'form-helper.js': incompressiblePayload(5, 3_000),
    });
    const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
      distDirectory: root,
    });
    expect(report.initialAssets).toEqual(
      expect.arrayContaining([
        'client/_astro/CmsFixtureForm.form.js',
        'client/_astro/form-helper.js',
      ]),
    );
    expect(report.lazyAssets).not.toContain(
      'client/_astro/CmsFixtureForm.form.js',
    );
    expect(report.initialRouteGzipBytes).toBeGreaterThan(4_500);
  });

  it('keeps the island budget on the static closure alone', () => {
    const root = createBundleFixture({
      ...documentScripts,
      [ISLAND]:
        'const load=()=>import("./CmsFixtureForm.form.js");export{load};',
      'CmsFixtureForm.form.js': incompressiblePayload(3, 4_000),
    });
    const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
      distDirectory: root,
    });
    expect(report.workbenchAssets).toEqual([
      'client/_astro/CmsEditorialWorkflowIsland.entry.js',
    ]);
  });

  it('fails a route whose mounted forms push the cold load over the initial-route threshold, naming the route', () => {
    const root = createBundleFixture({
      ...documentScripts,
      'client.runtime.js': incompressiblePayload(7, 100_000),
      [ISLAND]:
        'const a=()=>import("./CmsFirstForm.form.js");const b=()=>import("./CmsSecondForm.form.js");export{a,b};',
      'CmsFirstForm.form.js': incompressiblePayload(11, 25_000),
      'CmsSecondForm.form.js': incompressiblePayload(13, 25_000),
    });
    const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
      distDirectory: root,
    });
    expect(report.initialRouteGzipBytes).toBeGreaterThan(
      BUNDLE_BUDGETS.initialRouteGzipBytes,
    );
    expect(cmsEditorialBundleBudgetFailures([report])).toEqual([
      `${ROUTE} initial route exceeds ${BUNDLE_BUDGETS.initialRouteGzipBytes} gzip bytes: ${report.initialRouteGzipBytes}`,
    ]);
  });

  it('charges a nested chunk the mounted form itself imports at mount, not one it imports on demand', () => {
    const root = createBundleFixture({
      ...documentScripts,
      [ISLAND]:
        'const load=()=>import("./CmsFixtureForm.form.js");export{load};',
      'CmsFixtureForm.form.js':
        'const a=()=>import("./CmsNestedPanel.panel.js");const b=()=>import("./validators.heavy.js");export{a,b};',
      'CmsNestedPanel.panel.js': incompressiblePayload(17, 2_000),
      'validators.heavy.js': incompressiblePayload(19, 30_000),
    });
    const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
      distDirectory: root,
    });
    expect(report.initialAssets).toContain(
      'client/_astro/CmsNestedPanel.panel.js',
    );
    expect(report.initialAssets).not.toContain(
      'client/_astro/validators.heavy.js',
    );
    expect(report.lazyAssets).toEqual(['client/_astro/validators.heavy.js']);
  });
});

describe('the page-actions script', () => {
  const ACTIONS =
    'CmsEditorialPageActions.astro_astro_type_script_index_0_lang.d.js';
  const fixture = (): string =>
    createBundleFixture({
      ...documentScripts,
      [ACTIONS]: incompressiblePayload(41, 6_000),
      'CmsEditorialEntryEditorIsland.entry.js': 'export const island = true;',
      'CmsEditorialEntryCreateIsland.entry.js': 'export const island = true;',
      'CmsEditorialConflictResolveIsland.entry.js':
        'export const island = true;',
      'CmsEditorialReviewDetailIsland.entry.js': 'export const island = true;',
    });

  /*
   * The script serves the create type selector and the restore forms only, so the document shell
   * adds it where a route renders them (cms-page-actions-routes.test.ts keeps the pages honest) and
   * the gate charges it on exactly those routes.
   */
  it.each([
    ['CMS entry create', true],
    ['CMS revision history', true],
    ['CMS entry editor', false],
    ['CMS conflict resolve', false],
    ['CMS review detail', false],
  ])('charges it to %s: %s', (name, charged) => {
    const report = measureCmsEditorialRoute(routeNamed(name), {
      distDirectory: fixture(),
    });
    const assets = report.initialAssets as string[];
    expect(assets.includes(`client/_astro/${ACTIONS}`)).toBe(charged);
  });

  it('fails closed when a route that renders the forms finds no page-actions script in the build', () => {
    const root = createBundleFixture({
      ...documentScripts,
      'CmsEditorialEntryCreateIsland.entry.js': 'export const island = true;',
    });
    expect(() =>
      measureCmsEditorialRoute(routeNamed('CMS entry create'), {
        distDirectory: root,
      }),
    ).toThrow(/page actions/u);
  });
});

describe('on-demand chunks', () => {
  const examples: Readonly<Record<string, string>> = {
    contracts: 'contracts.AbCd1234.js',
    'contracts-time-authority': 'contracts-time-authority.AbCd1234.js',
    validators: 'validators.AbCd1234.js',
    'time-authority': 'time-authority.AbCd1234.js',
    'cms-workflow-command-transport':
      'cms-workflow-command-transport.AbCd1234.js',
    'cms-workflow-refusal': 'cms-workflow-refusal.AbCd1234.js',
    'cms-workflow-canonical-read': 'cms-workflow-canonical-read.AbCd1234.js',
    'cms-editorial-page-actions-restore':
      'cms-editorial-page-actions-restore.AbCd1234.js',
  };

  it.each(Object.entries(examples))(
    'does not charge %s to the cold load',
    (_name, file) => {
      const root = createBundleFixture({
        ...documentScripts,
        [ISLAND]: `const load=()=>import("./${file}");export{load};`,
        [file]: incompressiblePayload(23, 20_000),
      });
      const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
        distDirectory: root,
      });
      expect(report.initialAssets).not.toContain(`client/_astro/${file}`);
      expect(report.lazyAssets).toContain(`client/_astro/${file}`);
    },
  );

  it('exempts a chunk by its own name only, never by a name that merely contains an on-demand one', () => {
    const file = 'contracts-client.AbCd1234.js';
    const root = createBundleFixture({
      ...documentScripts,
      [ISLAND]: `const load=()=>import("./${file}");export{load};`,
      [file]: incompressiblePayload(29, 20_000),
    });
    const report = measureCmsEditorialRoute(routeNamed(ROUTE), {
      distDirectory: root,
    });
    expect(report.initialAssets).toContain(`client/_astro/${file}`);
  });

  it('lists exactly the modules the real islands load after hydration, each with its reason', () => {
    expect(CMS_ON_DEMAND_CHUNKS.map((entry) => entry.stem).sort()).toEqual(
      [
        'CmsEditorialReviewAssignmentForm',
        'CmsGovernedActivationForm',
        'CmsGovernedAssignmentForm',
        'CmsGovernedDecisionForm',
        'CmsGovernedSubmitForm',
        'CmsTaxonomyTermAction',
        'cms-editorial-conflict-detail-transport',
        'cms-editorial-conflict-resolve',
        'cms-editorial-entry-create-submit',
        'cms-editorial-entry-draft-detail-transport',
        'cms-editorial-entry-editor-save',
        'cms-editorial-page-actions-restore',
        'cms-editorial-restore-draft',
        'cms-editorial-runtime',
        'cms-registry-read',
        'cms-workflow-canonical-read',
        'cms-workflow-command-transport',
        'cms-workflow-refusal',
        'contracts',
        'contracts-time-authority',
        'governed-review-canonical-read',
        'governed-review-command-transport',
        'governed-review-refusal',
        'time-authority',
        'locale-source-refresh',
        'locale-variant-submit',
        'pattern-latest-fetch',
        'taxonomy-designer-submit',
        'taxonomy-outcome-reconcile',
        'taxonomy-terms-fetch',
        'taxonomy-versions-read',
        'term-action-submit',
        'validators',
      ].sort(),
    );
    for (const entry of CMS_ON_DEMAND_CHUNKS)
      expect(entry.reason.length, entry.stem).toBeGreaterThan(20);
  });

  /*
   * Landing-dependent chunks are not on demand: the result of a committed command is read by a
   * mount effect of the editor page, so the page that follows create entry, resolve conflict and
   * restore fetches the handoff and the panel without the person doing anything (V11 M4).
   */
  it.each([['cms-editorial-result-handoff', 'CMS entry editor']])(
    'charges %s to the route it lands on',
    (stem, routeName) => {
      const file = `${stem}.AbCd1234.js`;
      const root = createBundleFixture({
        ...documentScripts,
        'CmsEditorialEntryEditorIsland.entry.js': `const load=()=>import("./${file}");export{load};`,
        [file]: incompressiblePayload(31, 20_000),
      });
      const report = measureCmsEditorialRoute(routeNamed(routeName), {
        distDirectory: root,
      });
      expect(report.initialAssets).toContain(`client/_astro/${file}`);
    },
  );

  /*
   * A chunk that loads with the page on some routes only (the revision history looks for its
   * restore form at load) is charged on those routes and exempt elsewhere.
   */
  it('charges cms-editorial-restore-draft to the revision history and not to the other routes that load the page actions', () => {
    const file = 'cms-editorial-restore-draft.AbCd1234.js';
    // The page-actions script reaches the chunk; the create page loads that script too.
    const root = createBundleFixture({
      ...documentScripts,
      'CmsEditorialPageActions.astro_astro_type_script_index_0_lang.d.js': `const load=()=>import("./${file}");export{load};`,
      'CmsEditorialEntryCreateIsland.entry.js': 'export const island = true;',
      [file]: incompressiblePayload(37, 20_000),
    });
    const history = measureCmsEditorialRoute(
      routeNamed('CMS revision history'),
      { distDirectory: root },
    );
    expect(history.initialAssets).toContain(`client/_astro/${file}`);
    const create = measureCmsEditorialRoute(routeNamed('CMS entry create'), {
      distDirectory: root,
    });
    expect(create.initialAssets).not.toContain(`client/_astro/${file}`);
    expect(create.lazyAssets).toContain(`client/_astro/${file}`);
  });

  /*
   * The call sites are the triggers. A dynamic import of an exempt chunk that the list does not
   * declare is a trigger nobody proved (a mount effect would have the chunk loading with the
   * page), so the source must hold exactly the declared sites.
   */
  it.each(CMS_ON_DEMAND_CHUNKS.map((entry) => [entry.stem, entry] as const))(
    '%s is imported dynamically from exactly the declared sites',
    (stem, entry) => {
      const pattern = new RegExp(
        `import\\(\\s*['"]${
          'specifier' in entry
            ? escapeRegExp(entry.specifier as string)
            : `[^'"]*/${escapeRegExp(stem)}`
        }['"]\\s*\\)`,
        'u',
      );
      const sites = sourceFiles()
        .filter((file) => pattern.test(readFileSync(file, 'utf8')))
        .map((file) => relative(process.cwd(), file))
        .sort();
      expect(sites).toEqual([...entry.importedBy].sort());
    },
  );

  /*
   * A browser keeps a failed dynamic import in its module map, so a plain `import('./x')` can never
   * be retried (real Chrome, `apps/web/src/lib/retryable-import.ts`). Every call site of an exempt
   * chunk therefore goes through `retryable(...)` (or a view loader that applies it).
   */
  it.each(CMS_ON_DEMAND_CHUNKS.map((entry) => [entry.stem, entry] as const))(
    '%s is imported through a retry that works in a browser',
    (stem, entry) => {
      const specifier =
        'specifier' in entry
          ? escapeRegExp(entry.specifier as string)
          : `[^'"]*/${escapeRegExp(stem)}`;
      const wrapped = new RegExp(
        `(?:retryable|loadView|loadViewOnIntent)\\(\\s*(?:'[^']*',\\s*)?\\(\\)\\s*=>\\s*import\\(\\s*['"]${specifier}['"]\\s*\\)`,
        'u',
      );
      for (const file of entry.importedBy)
        expect(readFileSync(resolve(file), 'utf8'), file).toMatch(wrapped);
    },
  );

  /*
   * An exemption has to be shown, not asserted: each entry names the event that loads it and the
   * test that proves the module is not requested before that event.
   */
  it.each(CMS_ON_DEMAND_CHUNKS.map((entry) => [entry.stem, entry] as const))(
    '%s names its trigger and a proof test that exists',
    (stem, entry) => {
      expect(entry.trigger.length, stem).toBeGreaterThan(3);
      const source = readFileSync(resolve(entry.proof.file), 'utf8');
      expect(source, `${entry.proof.file} names ${stem}`).toMatch(
        new RegExp(`it\\(\\s*'${stem}: `, 'u'),
      );
    },
  );
});
