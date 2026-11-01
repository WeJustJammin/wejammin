import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  importEdges,
  importersOfModule,
  shippedSourceFiles,
} from './import-graph.test-support';

/*
 * CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep; neither is a browser route,
 * proxy or client type (BE03c row 188, P2-S12-AC-142). Like CMS-03B-20 (cms-publication-schedule-import-graph.test.ts)
 * the registered principal is bound at the Worker MODULE BOUNDARY, from the static import graph and every
 * spelling of the names:
 *
 *   - the port (cms-governed-activation-rpc.ts) is imported by the sweep alone, and the sweep by the Worker
 *     entrypoint alone (a closed chain: each hop is pinned, so no third module can join it);
 *   - the RPC-name constants are VALUE-imported by the port alone, the shared RPC type module reads them as a TYPE;
 *   - no non-test source of any workspace mentions the RPC names or the constants outside a closed allow-list.
 */

const workerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(workerRoot, '../../..');

const PORT = 'cms-governed-activation-rpc';
const NAMES = 'cms-governed-activation-rpc-names';
const SWEEP = 'cms-governed-activation-sweep';

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
  'cms_claim_due_governed_activations',
  'cms_execute_governed_activation',
  'CMS_CLAIM_DUE_GOVERNED_ACTIVATIONS_RPC',
  'CMS_EXECUTE_GOVERNED_ACTIVATION_RPC',
  'CmsGovernedActivationRpcName',
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
  'CMS-03C-19 module boundary (import graph)',
  { timeout: 120_000 },
  () => {
    it('lets only the scheduled sweep import the claim/execute port, in any form', () => {
      expect(importersOfModule(workerRoot, PORT)).toEqual({
        value: [`${SWEEP}.ts`],
        typeOnly: [],
      });
    });

    it('lets no module but the Worker entrypoint import the sweep, in any form', () => {
      expect(importersOfModule(workerRoot, SWEEP)).toEqual({
        value: ['index.ts'],
        typeOnly: [],
      });
    });

    it('value-imports the RPC-name constants in the port alone; the shared RPC type module reaches them only as a type', () => {
      expect(importersOfModule(workerRoot, NAMES)).toEqual({
        value: [`${PORT}.ts`],
        typeOnly: ['async-runtime-rpc-types.ts'],
      });
    });

    it('keeps the names module free of imports, so it can never become a conduit to another module', () => {
      expect(
        importEdges(workerRoot).filter((edge) => edge.from === `${NAMES}.ts`),
      ).toEqual([]);
    });

    it('mentions the RPC names and their constants in no other non-test source of any workspace', () => {
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
        'apps/worker/src/cms-governed-activation-rpc-names.ts',
        'apps/worker/src/cms-governed-activation-rpc.ts',
        'packages/contracts/src/cms-composition/governed-activation-job.ts',
      ]);
    });

    it('spells the RPC names exactly once as string literals, in the names module, whatever the quoting', () => {
      const quotes = ["'", '"', '`'];
      const literal = (text: string, name: string): boolean =>
        quotes.some((quote) => text.includes(`${quote}${name}${quote}`));
      const spellers = shippedSourceFiles(workerRoot)
        .filter((file) => {
          const text = readFileSync(file, 'utf8');
          return (
            literal(text, 'cms_claim_due_governed_activations') ||
            literal(text, 'cms_execute_governed_activation')
          );
        })
        .map((file) => file.slice(workerRoot.length + 1));
      expect(spellers).toEqual([`${NAMES}.ts`]);
    });

    it('never reaches the RPCs from the HTTP route layer (the governed routes import no sweep, port or name module)', () => {
      const edges = importEdges(workerRoot);
      const routeLayer = edges.filter((edge) =>
        edge.from.startsWith('cms-composition/'),
      );
      // A guard against a resolver that silently finds nothing.
      expect(routeLayer.length).toBeGreaterThan(100);
      expect(
        routeLayer.filter((edge) => [PORT, NAMES, SWEEP].includes(edge.to)),
      ).toEqual([]);
    });
  },
);
