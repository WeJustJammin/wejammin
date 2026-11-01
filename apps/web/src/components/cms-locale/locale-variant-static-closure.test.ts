import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { staticPackages } from '../cms-pattern-designer/static-closure.test-support';

/**
 * FE03 "Performance budgets and loading strategy" (AC261): the locale-variant island hydrates on its
 * route, so zod, the contract barrel and the lazy validators are never in its STATIC import closure.
 * The request builder, the transport and the source refetch are written out zod-free;
 * their tests are the drift guards.
 */
const SRC_ROOT = resolve(import.meta.dirname, '../..');
const ENTRIES: readonly string[] = [
  'components/cms-locale/CmsLocaleVariantForm.tsx',
].map((entry) => resolve(SRC_ROOT, entry));

const FORBIDDEN = [
  'zod <-',
  '@wejammin/contracts <-',
  '@wejammin/contracts/cms-editorial/validators <-',
  '@wejammin/contracts/content-schema-registry/validators <-',
  '@wejammin/contracts/time-authority <-',
];

describe('locale-variant island: static import closure', () => {
  it('names real entries', () => {
    for (const entry of ENTRIES) expect(existsSync(entry), entry).toBe(true);
  });

  it.each(ENTRIES.map((entry) => [relative(SRC_ROOT, entry), entry] as const))(
    '%s never reaches zod, the contract barrel or a lazy entry statically',
    (_name, entry) => {
      expect(
        staticPackages(entry, SRC_ROOT).filter((imported) =>
          FORBIDDEN.some((prefix) => imported.startsWith(prefix)),
        ),
      ).toEqual([]);
    },
  );

  it('reaches the contracts only through the zod-free browser entry', () => {
    for (const entry of ENTRIES)
      for (const imported of staticPackages(entry, SRC_ROOT).filter((name) =>
        name.startsWith('@wejammin/contracts'),
      ))
        expect(imported, relative(SRC_ROOT, entry)).toMatch(
          /^@wejammin\/contracts\/client <-/u,
        );
  });

  it('does not import the server-only loader or reads into the island', () => {
    for (const entry of ENTRIES)
      for (const imported of staticPackages(entry, SRC_ROOT))
        expect(imported).not.toMatch(/cloudflare:workers|server\//u);
  });
});
