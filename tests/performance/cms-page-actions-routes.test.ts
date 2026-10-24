import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../apps/web/src/', import.meta.url));
const PAGES = join(SRC, 'pages/app/cms-content-modeling');

/*
 * The page-actions script (the create type selector, the restore review and the restore
 * confirmation, `lib/cms-editorial-page-actions.ts`) is about 2 KB gzip. A route that renders none
 * of those forms must not load it (P2-S11-AC-106): the document shell takes it as the
 * `pageActions` prop, and a route passes the prop exactly when its markup holds a form the script
 * serves. This test reads the page sources, follows their relative imports through components, and
 * fails when a route that renders such a form leaves the prop out (the form would navigate to a
 * JSON endpoint) or when a route that renders none passes it (a silent extra 2 KB).
 */
const SERVED = /data-cms-editorial-(?:create-type-selector|restore)\b/u;

const pagesUnder = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return pagesUnder(path);
    return path.endsWith('.astro') ? [path] : [];
  });

const IMPORT = /(?:from|import)\s+['"](\.[^'"]+)['"]/gu;

const resolveImport = (from: string, specifier: string): string | null => {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.astro`,
    join(base, 'index.ts'),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next shape
    }
  }
  return null;
};

/** Markup lives in pages and components; lib files only name the attributes in selectors. */
const rendersServedForm = (file: string, seen = new Set<string>()): boolean => {
  if (seen.has(file)) return false;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  if (SERVED.test(source)) return true;
  for (const match of source.matchAll(IMPORT)) {
    const next = resolveImport(file, match[1] ?? '');
    if (
      next !== null &&
      !next.includes('.test.') &&
      (next.includes('/components/') || next.includes('/pages/'))
    )
      if (rendersServedForm(next, seen)) return true;
  }
  return false;
};

const documentPages = pagesUnder(PAGES).filter((page) =>
  readFileSync(page, 'utf8').includes('<CmsEditorialDocument'),
);

describe('the page-actions script follows the forms it serves', () => {
  it('finds the pages of the CMS editorial document shell', () => {
    expect(documentPages.length).toBeGreaterThanOrEqual(15);
  });

  it.each(documentPages.map((page) => [page.slice(PAGES.length + 1), page]))(
    '%s passes pageActions exactly when it renders a form the script serves',
    (_name, page) => {
      const source = readFileSync(page, 'utf8');
      const passes = /<CmsEditorialDocument[^>]*\bpageActions\b/su.test(source);
      expect(passes).toBe(rendersServedForm(page));
    },
  );

  it('keeps the script out of the shell unless pageActions is set', () => {
    const shell = readFileSync(
      join(SRC, 'components/cms-editorial/CmsEditorialDocument.astro'),
      'utf8',
    );
    expect(shell).not.toContain('cms-editorial-page-actions.ts');
    expect(shell).toMatch(/pageActions\s*&&\s*<CmsEditorialPageActions/u);
    const actions = readFileSync(
      join(SRC, 'components/cms-editorial/CmsEditorialPageActions.astro'),
      'utf8',
    );
    expect(actions).toContain('src="../../lib/cms-editorial-page-actions.ts"');
  });
});
