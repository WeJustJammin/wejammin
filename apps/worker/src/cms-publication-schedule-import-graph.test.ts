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
 * P2-S11-AC-081, review finding A-M13: DEC-156 grants CMS-03B-20 (claim and execute) to the Worker service
 * credential and binds the registered principal at the Worker MODULE BOUNDARY: only the scheduled sweep may reach
 * the two RPCs. cms-editorial-principals.test.ts pins one quoting of the RPC names and the direct importers of the
 * port; it would not notice a module that imports the shared RPC-name constants (the generic AsyncRpcClient takes
 * any operation name) or one that spells the name in another quoting. This file pins, from the static import graph
 * of the Worker sources (import-graph.test-support.ts: value and type imports, re-exports, require, dynamic
 * import()) and from every spelling of the names, who can reach the RPCs:
 *
 *   - the port (cms-publication-schedule-rpc.ts) is imported by the sweep alone, and the sweep by the Worker
 *     entrypoint alone (a closed chain: each hop is pinned, so no third module can join it);
 *   - the RPC-name constants are VALUE-imported by the port alone, the shared RPC type module reads them as a TYPE;
 *   - no non-test source of any workspace mentions the RPC names or the constants outside a closed allow-list.
 *
 * The recheck and takedown seams are pinned by cms-editorial-principals.test.ts.
 */

const workerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(workerRoot, '../../..');

const PORT = 'cms-publication-schedule-rpc';
const NAMES = 'cms-publication-schedule-rpc-names';
const SWEEP = 'cms-publication-schedule-sweep';

const listing = (path: string): string[] | null => {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
};

/** Non-test sources of a workspace tree (the Worker tree is read with the shared graph helper). */
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
  'cms_claim_due_publication_schedules',
  'cms_execute_publication_schedule',
  'CMS_CLAIM_DUE_SCHEDULES_RPC',
  'CMS_EXECUTE_SCHEDULE_RPC',
  'CmsPublicationScheduleRpcName',
];

const workspaceTrees = (): string[] => {
  const packages = join(repositoryRoot, 'packages');
  return [
    join(repositoryRoot, 'apps/worker/src'),
    join(repositoryRoot, 'apps/web/src'),
    ...(listing(packages) ?? []).map((name) => join(packages, name, 'src')),
  ];
};

// Every importEdges call parses the whole Worker tree with the TypeScript parser (about 3 s, more on a loaded host).
describe(
  'CMS-03B-20 module boundary (import graph)',
  { timeout: 120_000 },
  () => {
    it('derives a real graph of the Worker sources', () => {
      // A guard against a resolver that silently finds nothing.
      expect(importEdges(workerRoot).length).toBeGreaterThan(200);
      expect(importEdges(workerRoot).some((edge) => edge.typeOnly)).toBe(true);
      expect(shippedSourceFiles(workerRoot).length).toBeGreaterThan(100);
    });

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
        .sort();
      expect(mentions).toEqual([
        'apps/worker/src/async-runtime-rpc-types.ts',
        'apps/worker/src/cms-publication-schedule-rpc-names.ts',
        'apps/worker/src/cms-publication-schedule-rpc.ts',
        'packages/contracts/src/cms-editorial/internal-rpc.ts',
        'packages/data-access/src/database.types.ts',
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
            literal(text, 'cms_claim_due_publication_schedules') ||
            literal(text, 'cms_execute_publication_schedule')
          );
        })
        .map((file) => file.slice(workerRoot.length + 1));
      expect(spellers).toEqual([`${NAMES}.ts`]);
    });
  },
);
