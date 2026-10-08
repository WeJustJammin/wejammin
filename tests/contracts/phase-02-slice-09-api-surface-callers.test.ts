import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// P2-S09-AC-180: the SQL API exposes only the cms_ RPCs a caller really uses.
// The database guard (supabase/tests/phase_02_slice_09_r8_api_surface.sql) pins
// the exact enumerated set on the live catalog; this suite pins the other side,
// against the source: every executable name is called by Worker, web or workflow
// code, and the two spec-named functions that no API role may execute are called
// by none, so an RPC cannot become executable (or stay executable) without a caller.
const ROOT = resolve(import.meta.dirname, '../..');
const GUARD = readFileSync(
  resolve(ROOT, 'supabase/tests/phase_02_slice_09_r8_api_surface.sql'),
  'utf8',
);

const setOf = (name: string): string[] => {
  const block = new RegExp(`insert into ${name} values([\\s\\S]*?);`, 'u').exec(
    GUARD,
  );
  if (block === null) throw new Error(`guard set ${name} not found`);
  return [...(block[1] ?? '').matchAll(/\('([a-z0-9_]+)'/gu)].map(
    (match) => match[1] ?? '',
  );
};

const callerSources = (): string => {
  const parts: string[] = [];
  const visit = (directory: string): void => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['dist', 'node_modules', 'coverage', '.git'].includes(entry.name))
          visit(path);
        continue;
      }
      if (
        entry.isFile() &&
        /\.(?:ts|tsx|mjs|astro)$/u.test(entry.name) &&
        !/(?:\.test\.|\.spec\.|\.test-support\.|test-support|-fixtures?\.)/u.test(
          entry.name,
        )
      )
        parts.push(readFileSync(path, 'utf8'));
    }
  };
  for (const directory of ['apps/worker/src', 'apps/web/src', 'infra'])
    visit(resolve(ROOT, directory));
  return parts.join('\n');
};

describe('cms_ SQL API surface against its callers [P2-S09-AC-180]', () => {
  const allowed = [
    ...setOf('r8a_original'),
    ...setOf('r8a_amendment'),
    ...setOf('r8a_supporting'),
  ];
  const internal = setOf('r8a_internal');
  const sources = callerSources();

  it('enumerates 8 original, 10 amendment and 38 supporting RPCs and two internal functions', () => {
    expect(setOf('r8a_original')).toHaveLength(8);
    expect(setOf('r8a_amendment')).toHaveLength(10);
    expect(setOf('r8a_supporting')).toHaveLength(38);
    expect(new Set(allowed).size).toBe(56);
    expect(internal.sort()).toEqual([
      'cms_resolve_template_compatibility',
      'cms_validate_locale_config',
    ]);
  });

  it('every executable RPC is named by Worker, web or workflow source', () => {
    const uncalled = allowed.filter(
      (name) => !new RegExp(`\\b${name}\\b`, 'u').test(sources),
    );
    expect(uncalled).toEqual([]);
  });

  it('no Worker, web or workflow source calls a function that no API role may execute', () => {
    const called = internal.filter((name) =>
      new RegExp(`\\b${name}\\b`, 'u').test(sources),
    );
    expect(called).toEqual([]);
  });
});
