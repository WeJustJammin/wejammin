import { describe, expect, it } from 'vitest';

/**
 * An Astro page that default-imports a React island from a module with no
 * default export is a build error (astro check, ts2613) and cannot hydrate in
 * production. Fixture-rendered component tests never import the page, so this
 * guard reads each page's import list against the module it names.
 */

const pages = import.meta.glob<string>('./**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const islands = import.meta.glob<string>('../components/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const DEFAULT_IMPORT =
  /^import\s+([A-Za-z_$][\w$]*)\s+from\s+'(\.[^']+\.tsx)';/gmu;

/** Resolve a relative specifier against a `./a/b.astro` glob key. */
const resolveKey = (pageKey: string, specifier: string): string => {
  const segments = pageKey.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.') continue;
    if (part === '..') {
      if (segments.length === 1 && segments[0] === '.')
        segments.splice(0, 1, '..');
      else if (segments[segments.length - 1] === '..') segments.push('..');
      else segments.pop();
    } else segments.push(part);
  }
  return segments.join('/');
};

describe('Astro page island imports', () => {
  it('finds the page tree', () => {
    expect(Object.keys(pages).length).toBeGreaterThan(10);
  });

  it('default-imports an island only from a module that has a default export', () => {
    const offenders: string[] = [];
    for (const [pageKey, source] of Object.entries(pages)) {
      for (const match of source.matchAll(DEFAULT_IMPORT)) {
        const key = resolveKey(pageKey, match[2] ?? '');
        const target = islands[key];
        if (target === undefined) {
          offenders.push(`${pageKey} -> ${key} (unresolved)`);
        } else if (!/^export default\b/mu.test(target)) {
          offenders.push(`${pageKey} -> ${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
