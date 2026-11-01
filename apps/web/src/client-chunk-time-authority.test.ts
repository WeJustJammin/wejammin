import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  TIME_AUTHORITY_LAZY_CONTRACT_MODULES,
  clientChunkFor,
  isTimeAuthorityLazyModule,
} from '../client-chunk-boundaries.mjs';

/*
 * The pinned tz snapshot (about 218 KB, 26 KB gzip) is imported only when the
 * schedule form opens. `clientChunkFor` puts every contracts module in the eager
 * `contracts` chunk, so without this carve-out the lazy import would still ship
 * the snapshot to every protected page. The carve-out is exactly the modules
 * that only the `@wejammin/contracts/time-authority` subpath reaches; the
 * resolver, the pin and the calendar rules stay in the eager chunk because the
 * main barrel exports them.
 */
const CONTRACTS_SRC = resolve(
  import.meta.dirname,
  '../../../packages/contracts/src',
);
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const closure = (entry: string): Set<string> => {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined || !(match[2] as string).startsWith('.'))
        continue;
      const target = resolve(dirname(file), match[2] as string);
      if (existsSync(target) && statSync(target).isFile()) pending.push(target);
    }
  }
  return seen;
};

const relative = (file: string): string =>
  file.slice(file.indexOf('/packages/contracts/'));

describe('time authority lazy chunk', () => {
  it('is exactly the closure only the time-authority subpath reaches', () => {
    const eager = closure(resolve(CONTRACTS_SRC, 'index.ts'));
    const lazy = [
      ...closure(
        resolve(CONTRACTS_SRC, 'cms-editorial/time-authority/index.ts'),
      ),
    ]
      .filter((file) => !eager.has(file))
      .map(relative)
      .sort();
    expect(lazy.length).toBeGreaterThan(2);
    expect([...TIME_AUTHORITY_LAZY_CONTRACT_MODULES].sort()).toEqual(lazy);
  });

  it('names a chunk of its own for those modules and keeps the rest of contracts eager', () => {
    for (const module of TIME_AUTHORITY_LAZY_CONTRACT_MODULES) {
      expect(isTimeAuthorityLazyModule(`/repo${module}`)).toBe(true);
      expect(clientChunkFor(`/repo${module}`)).toBe('contracts-time-authority');
    }
    expect(
      clientChunkFor(
        '/repo/packages/contracts/src/cms-editorial/time-authority/schedule-time.ts',
      ),
    ).toBe('contracts');
    expect(
      isTimeAuthorityLazyModule(
        '/repo/packages/contracts/src/cms-editorial/time-authority/schedule-time.ts',
      ),
    ).toBe(false);
    expect(clientChunkFor('/repo/node_modules/zod/index.js')).toBe('zod');
    expect(clientChunkFor('/repo/apps/web/src/other.ts')).toBeUndefined();
  });

  it('keeps the snapshot data out of the zod-free eager groups', () => {
    const snapshot =
      '/packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot-data.ts';
    expect(TIME_AUTHORITY_LAZY_CONTRACT_MODULES).toContain(snapshot);
  });
});
