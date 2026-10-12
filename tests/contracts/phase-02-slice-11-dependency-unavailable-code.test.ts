import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
 * BE00 lines 172 and 590 define one global code for a dependency failure:
 * `DEPENDENCY_UNAVAILABLE` (502 invalid answer, 503 unavailable). No spec or
 * decision defines `BAD_GATEWAY`, so no CMS editorial source (contract, Worker
 * route or production adapter, web proxy or editor) may name it. Behavioural
 * proof lives beside each owner (routes-dependency-code.test.ts,
 * route-errors-dependency.test.ts and the per-route 502 tests); this guard
 * catches a new site that bypasses them.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const RETIRED_CODE = 'BAD_GATEWAY';
const SOURCE_FILE = /\.(?:ts|tsx|mts|mjs)$/u;
const TEST_FILE = /\.test\.(?:ts|tsx|mts)$/u;

/** Directories scanned recursively, and flat file prefixes scanned in a directory. */
const TREES = [
  'packages/contracts/src/cms-editorial',
  'apps/worker/src/cms-editorial',
  'apps/web/src/components/cms-editorial',
  'apps/web/src/components/cms-editorial-workflow',
] as const;

const FLAT = [
  { directory: 'apps/worker/src', prefix: 'cms-editorial-production' },
  { directory: 'apps/web/src/server', prefix: 'cms-editorial-platform' },
  { directory: 'apps/web/src/server', prefix: 'cms-workflow-platform' },
] as const;

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
      ? [path]
      : [];
  });

const flat = (directory: string, prefix: string): string[] =>
  readdirSync(join(ROOT, directory), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(prefix) &&
        SOURCE_FILE.test(entry.name) &&
        !TEST_FILE.test(entry.name),
    )
    .map((entry) => join(ROOT, directory, entry.name));

const scanned = (): string[] => [
  ...TREES.flatMap((tree) => walk(join(ROOT, tree))),
  ...FLAT.flatMap(({ directory, prefix }) => flat(directory, prefix)),
];

describe('[BE00:172][BE00:590] CMS editorial sources never name BAD_GATEWAY', () => {
  it('scans the contract, Worker and web editorial sources', () => {
    const files = scanned().map((file) => relative(ROOT, file));
    expect(files.length).toBeGreaterThan(150);
    expect(files).toContain(
      'packages/contracts/src/cms-editorial/routes-errors.ts',
    );
    expect(files).toContain('apps/worker/src/cms-editorial/route-errors.ts');
    expect(files).toContain(
      'apps/worker/src/cms-editorial-production-errors.ts',
    );
    expect(files).toContain(
      'apps/web/src/server/cms-editorial-platform-shared.ts',
    );
  });

  it('finds no source file that names the retired code', () => {
    const offenders = scanned()
      .filter((file) => readFileSync(file, 'utf8').includes(RETIRED_CODE))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
