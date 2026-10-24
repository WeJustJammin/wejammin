import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { importEdges, importersOfModule } from './import-graph.test-support';

/*
 * DEC-194: the merge convergence recovery is exactly one database RPC run by the Worker `scheduled` sweep; it is not a
 * browser route, proxy or client type. Like CMS-03B-20 and CMS-03C-19 the principal is bound at the Worker MODULE
 * BOUNDARY, from the static import graph and every spelling of the name:
 *
 *   - the sweep is imported by the Worker entrypoint alone, in any form;
 *   - no non-test source of any workspace mentions the RPC name or its constant outside a closed allow-list;
 *   - the HTTP route layer never imports the sweep.
 */

const workerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(workerRoot, '../../..');
const SWEEP = 'cms-taxonomy-merge-reconcile-sweep';

const listing = (path: string): string[] | null => {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
};

const workspaceSourceFiles = (root: string): string[] =>
  (listing(root) ?? []).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(root, name);
    if (listing(path) !== null) return workspaceSourceFiles(path);
    return /\.(ts|tsx|astro|mjs)$/u.test(name) &&
      !/\.(test|spec|apispec|test-support)\.(ts|tsx|mjs)$/u.test(name)
      ? [path]
      : [];
  });

const RPC_SPELLINGS = [
  'cms_reconcile_taxonomy_merge_converge',
  'CMS_TAXONOMY_MERGE_RECONCILE_RPC',
];

const workspaceTrees = (): string[] => {
  const packages = join(repositoryRoot, 'packages');
  return [
    join(repositoryRoot, 'apps/worker/src'),
    join(repositoryRoot, 'apps/web/src'),
    ...(listing(packages) ?? []).map((name) => join(packages, name, 'src')),
  ];
};

describe(
  'DEC-194 merge convergence recovery module boundary (import graph)',
  { timeout: 120_000 },
  () => {
    it('lets no module but the Worker entrypoint import the sweep, in any form', () => {
      expect(importersOfModule(workerRoot, SWEEP)).toEqual({
        value: ['index.ts'],
        typeOnly: [],
      });
    });

    it('mentions the RPC name and its constant in no other non-test source of any workspace', () => {
      const mentions = workspaceTrees()
        .flatMap((root) =>
          workspaceSourceFiles(root)
            .filter((file) => {
              const text = readFileSync(file, 'utf8');
              return RPC_SPELLINGS.some((spelling) => text.includes(spelling));
            })
            .map((file) => file.slice(repositoryRoot.length + 1)),
        )
        // The generated database types list every platform_api function once `pnpm db:types` has run
        // (root-owned); they are not a conduit, so their presence or absence is not part of the boundary.
        .filter((file) => file !== 'packages/data-access/src/database.types.ts')
        .sort();
      expect(mentions).toEqual([
        'apps/worker/src/async-runtime-rpc-types.ts',
        'apps/worker/src/cms-taxonomy-merge-reconcile-sweep.ts',
      ]);
    });

    it('never reaches the sweep from the HTTP route layer', () => {
      const routeLayer = importEdges(workerRoot).filter((edge) =>
        edge.from.startsWith('cms-composition/'),
      );
      // A guard against a resolver that silently finds nothing.
      expect(routeLayer.length).toBeGreaterThan(100);
      expect(routeLayer.filter((edge) => edge.to === SWEEP)).toEqual([]);
    });
  },
);
