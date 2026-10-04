import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyBuiltRouteScripts } from '../apps/web/built-route-scripts.mjs';

/*
 * Fixtures mirror the shape Astro emits: a manifest chunk (route data, the
 * script-key to emitted-file map and the inlined scripts), one chunk per page
 * that calls `renderScript` for processed scripts, and `dist/client/_astro`.
 */
const roots: string[] = [];

type Page = {
  readonly route: string;
  readonly component: string;
  readonly body: string;
};

type Fixture = {
  readonly pages: readonly Page[];
  readonly emitted?: Readonly<Record<string, string>>;
  readonly inlined?: Readonly<Record<string, string>>;
  readonly client?: Readonly<Record<string, string>>;
  readonly extraChunks?: Readonly<Record<string, string>>;
};

const write = (path: string, content: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const build = (fixture: Fixture): string => {
  const root = mkdtempSync(join(tmpdir(), 'wejammin-built-routes-'));
  roots.push(root);
  const routes = fixture.pages
    .map(
      (page) =>
        `{"file":"","scripts":[],"routeData":{"route":"${page.route}","isIndex":false,"type":"page","pattern":"^x$","component":"${page.component}","prerender":false}}`,
    )
    .join(',');
  write(
    join(root, 'server/chunks/entrypoints_A.mjs'),
    `const manifest = {"routes":[${routes}],"inlinedScripts":${JSON.stringify(
      Object.entries(fixture.inlined ?? {}),
    )},"entryModules":${JSON.stringify(fixture.emitted ?? {})}};`,
  );
  fixture.pages.forEach((page, index) =>
    write(
      join(root, `server/chunks/page${index}_A.mjs`),
      `//#region ${page.component}\ncreateComponent(() => renderTemplate\`${page.body}\`, "/abs/${page.component}", undefined);\n//#endregion\n`,
    ),
  );
  for (const [name, source] of Object.entries(fixture.extraChunks ?? {}))
    write(join(root, 'server/chunks', name), source);
  for (const [name, source] of Object.entries(fixture.client ?? {}))
    write(join(root, 'client/_astro', name), source);
  return root;
};

const KEY = '/abs/src/pages/x.astro?astro&type=script&index=0&lang.ts';
const PROCESSED = `<html lang="en">\${renderScript($$result, "${KEY}")}</html>`;
const SYNC_ASSET = 'auth-scope-sync.Abc123.js';
const MISSING_CLIENT = 'missing-client-chunk.js';
const GOOD: Fixture = {
  pages: [{ route: '/x', component: 'src/pages/x.astro', body: PROCESSED }],
  emitted: { [KEY]: '_astro/x.astro_astro_type_script_index_0_lang.H1.js' },
  client: {
    'x.astro_astro_type_script_index_0_lang.H1.js': `import"./${SYNC_ASSET}";`,
    [SYNC_ASSET]: 'export {};',
  },
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe('verifyBuiltRouteScripts', () => {
  it('passes a document route whose processed script reaches the auth-scope-sync asset', () => {
    const report = verifyBuiltRouteScripts(build(GOOD));
    expect(report.failures).toEqual([]);
    expect(report.documentRoutes).toEqual(['/x']);
    expect(report.scriptKeys).toBe(1);
  });

  it('passes when a small script is inlined into the manifest instead of emitted', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        emitted: {},
        inlined: { [KEY]: `import"./${SYNC_ASSET}";` },
        client: { [SYNC_ASSET]: 'export {};' },
      }),
    );
    expect(report.failures).toEqual([]);
  });

  it.each([
    [
      'escaped quotes in a template string',
      '<script src=\\"../lib/auth-scope-sync.ts\\"></script>',
    ],
    [
      'plain quotes in a template string',
      '<script src="../../lib/route-heading-focus.ts"></script>',
    ],
  ])(
    'fails a runtime HTML string that ships a raw .ts script (%s)',
    (_label, tag) => {
      const body = `<html lang="en">${tag}</html>`;
      const report = verifyBuiltRouteScripts(
        build({
          pages: [{ route: '/x', component: 'src/pages/x.astro', body }],
        }),
      );
      expect(report.failures).toEqual(
        expect.arrayContaining([
          expect.stringContaining('serves a raw TypeScript <script src> tag'),
          expect.stringContaining(
            'route /x (src/pages/x.astro) serves a document but loads no emitted auth-scope-sync asset',
          ),
        ]),
      );
    },
  );

  it('fails a document route that loads processed scripts but never the auth-scope-sync asset', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        client: {
          'x.astro_astro_type_script_index_0_lang.H1.js': 'export {};',
        },
      }),
    );
    expect(report.failures).toEqual([
      'route /x (src/pages/x.astro) serves a document but loads no emitted auth-scope-sync asset',
    ]);
  });

  it('fails when an inlined script imports an auth-scope asset the build never emitted', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        emitted: {},
        inlined: { [KEY]: `import"./${SYNC_ASSET}";` },
        client: {},
      }),
    );
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(SYNC_ASSET),
        'route /x (src/pages/x.astro) serves a document but loads no emitted auth-scope-sync asset',
      ]),
    );
  });

  it('fails when an emitted script imports an auth-scope asset the build never emitted', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        client: {
          'x.astro_astro_type_script_index_0_lang.H1.js': `import"./${SYNC_ASSET}";`,
        },
      }),
    );
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(SYNC_ASSET),
        'route /x (src/pages/x.astro) serves a document but loads no emitted auth-scope-sync asset',
      ]),
    );
  });

  it('fails and reports once when a script imports a client file the build never emitted', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        client: {
          'x.astro_astro_type_script_index_0_lang.H1.js': `import"./${SYNC_ASSET}";import"./${MISSING_CLIENT}";import"./${MISSING_CLIENT}";`,
          [SYNC_ASSET]: 'export {};',
        },
      }),
    );
    const missing = report.failures.filter((failure) =>
      failure.includes(MISSING_CLIENT),
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('missing from dist');
  });

  it('fails a script whose emitted file is absent from dist/client', () => {
    const report = verifyBuiltRouteScripts(build({ ...GOOD, client: {} }));
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('which is missing from dist'),
      ]),
    );
  });

  it('fails a renderScript key that has no emitted or inlined file', () => {
    const report = verifyBuiltRouteScripts(build({ ...GOOD, emitted: {} }));
    expect(report.failures).toEqual(
      expect.arrayContaining([`script ${KEY} has no emitted file`]),
    );
  });

  it('does not treat a route that serves no document as needing the guard', () => {
    const report = verifyBuiltRouteScripts(
      build({
        pages: [
          { route: '/x', component: 'src/pages/x.astro', body: 'plain text' },
        ],
      }),
    );
    expect(report).toEqual({ failures: [], documentRoutes: [], scriptKeys: 0 });
  });

  it('ignores raw page sources embedded for a test (?raw regions)', () => {
    const report = verifyBuiltRouteScripts(
      build({
        ...GOOD,
        extraChunks: {
          'guard-test_A.mjs':
            '//#region src/pages/x.astro?raw\nvar x = "<script src=\\"../lib/auth-scope-sync.ts\\"></script>";\n//#endregion\n',
        },
      }),
    );
    expect(report.failures).toEqual([]);
  });

  it('reports a build with no server modules instead of passing it', () => {
    const root = mkdtempSync(join(tmpdir(), 'wejammin-built-routes-'));
    roots.push(root);
    expect(verifyBuiltRouteScripts(root).failures).toHaveLength(1);
  });
});
