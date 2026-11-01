import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { recheckBoundaryViolations } from './cms-editorial-principal-boundaries.test-support';
import { shippedSourceFiles } from './import-graph.test-support';

/*
 * DEC-156 / P2-S11-AC-113 / P2-S11-AC-118 (review B-03): an allow-list that never fails proves nothing.
 * This suite copies the shipped Worker sources to a scratch directory, checks that the copy honours the
 * recheck and takedown boundary, and then applies, one at a time, every way a module can reach a
 * protected port (static, type-only, re-exported, dynamic, required, `import x = require()`, through an
 * explicit extension, from a nested directory) and every way to bypass the import (a copied name table,
 * a spelled RPC literal). Each mutation must be reported and attributed to the intruding file, and
 * deleting it must restore a clean report. The real tree is asserted by cms-editorial-principals.test.ts.
 */

const workerRoot = dirname(fileURLToPath(import.meta.url));
const RECHECK = './cms-editorial/review-recheck';
const INTRUDER = 'zz-intruder.ts';
const NESTED = 'nested/zz-intruder.ts';

let copy = '';
let written: string[] = [];

const write = (name: string, source: string): void => {
  const path = join(copy, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  written.push(path);
};

beforeAll(() => {
  copy = mkdtempSync(join(tmpdir(), 'principal-mutation-'));
  for (const file of shippedSourceFiles(workerRoot)) {
    const target = join(copy, relative(workerRoot, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}, 180_000);

afterEach(() => {
  for (const path of written) rmSync(path, { force: true });
  written = [];
});

afterAll(() => {
  rmSync(copy, { recursive: true, force: true });
});

const mutations: readonly Readonly<{
  title: string;
  file: string;
  source: string;
  names: string;
}>[] = [
  {
    title: 'a value import of the recheck RPC wrappers',
    file: INTRUDER,
    source: `import { createReviewRecheckRpcPorts } from '${RECHECK}/rpc';\nexport const use = createReviewRecheckRpcPorts;\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'a value import of the recheck RPC names',
    file: INTRUDER,
    source: `import { CMS_REVIEW_RECHECK_RPC } from '${RECHECK}/rpc-names';\nexport const use = CMS_REVIEW_RECHECK_RPC;\n`,
    names: 'cms-editorial/review-recheck/rpc-names',
  },
  {
    title:
      'a type-only import of the recheck RPC names beyond the shared RPC type',
    file: INTRUDER,
    source: `import type { CmsReviewRecheckRpcName } from '${RECHECK}/rpc-names';\nexport type Use = CmsReviewRecheckRpcName;\n`,
    names: 'cms-editorial/review-recheck/rpc-names: type-only',
  },
  {
    title: 'a re-export of the recheck RPC wrappers',
    file: INTRUDER,
    source: `export * from '${RECHECK}/rpc';\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'a named re-export of the recheck RPC names',
    file: INTRUDER,
    source: `export { CMS_REVIEW_RECHECK_RPC as names } from '${RECHECK}/rpc-names';\n`,
    names: 'cms-editorial/review-recheck/rpc-names',
  },
  {
    title: 'a dynamic import of the recheck RPC wrappers',
    file: INTRUDER,
    source: `export const load = () => import('${RECHECK}/rpc');\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'a require of the recheck RPC names',
    file: INTRUDER,
    source: `export const names = require('${RECHECK}/rpc-names');\n`,
    names: 'cms-editorial/review-recheck/rpc-names',
  },
  {
    title: 'an import-equals require of the recheck RPC wrappers',
    file: INTRUDER,
    source: `import wrappers = require('${RECHECK}/rpc');\nexport { wrappers };\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'a side-effect import of the recheck RPC wrappers',
    file: INTRUDER,
    source: `import '${RECHECK}/rpc';\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'an import written with an explicit extension',
    file: INTRUDER,
    source: `import { createReviewRecheckRpcPorts } from '${RECHECK}/rpc.js';\nexport const use = createReviewRecheckRpcPorts;\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'an import from a nested directory',
    file: NESTED,
    source: `import { createReviewRecheckRpcPorts } from '../cms-editorial/review-recheck/rpc';\nexport const use = createReviewRecheckRpcPorts;\n`,
    names: 'cms-editorial/review-recheck/rpc',
  },
  {
    title: 'a second importer of the recheck production composition',
    file: INTRUDER,
    source: `import { createProductionReviewRecheckProcessor } from '${RECHECK}/production';\nexport const use = createProductionReviewRecheckProcessor;\n`,
    names: 'cms-editorial/review-recheck/production',
  },
  {
    title: 'a copy of the wrapper name table',
    file: INTRUDER,
    source: `export const CMS_REVIEW_RECHECK_RPC = { run: 'x' };\n`,
    names: 'CMS_REVIEW_RECHECK_RPC',
  },
  {
    title: 'a spelled recheck RPC literal with no import',
    file: INTRUDER,
    source: `export const operation = 'cms_dependency_recheck_run';\n`,
    names: "'cms_dependency_recheck_run'",
  },
  {
    title: 'a spelled takedown RPC literal with no import',
    file: INTRUDER,
    source: `export const operation = 'cms_takedown_preview_tokens';\n`,
    names: "'cms_takedown_preview_tokens'",
  },
  {
    title: 'a value import of the preview takedown port',
    file: INTRUDER,
    source: `import { PREVIEW_TAKEDOWN_RPC } from './cms-editorial-production-preview-takedown';\nexport const use = PREVIEW_TAKEDOWN_RPC;\n`,
    names: 'cms-editorial-production-preview-takedown',
  },
  {
    title: 'a type-only import of the preview takedown port',
    file: INTRUDER,
    source: `import type { PreviewTakedownResult } from './cms-editorial-production-preview-takedown';\nexport type Use = PreviewTakedownResult;\n`,
    names: 'cms-editorial-production-preview-takedown: type-only',
  },
  {
    title: 'a re-export of the preview takedown port',
    file: INTRUDER,
    source: `export * from './cms-editorial-production-preview-takedown';\n`,
    names: 'cms-editorial-production-preview-takedown',
  },
  {
    title: 'a dynamic import of the preview takedown port',
    file: NESTED,
    source: `export const load = () => import('../cms-editorial-production-preview-takedown');\n`,
    names: 'cms-editorial-production-preview-takedown',
  },
];

describe('the recheck and takedown import boundary fails for every way of reaching a port', () => {
  it('control: the copied Worker tree honours the boundary', () => {
    expect(recheckBoundaryViolations(copy)).toEqual([]);
  });

  it('control: import-shaped prose, a string and an unrelated package import are not edges, so they are not violations', () => {
    write(
      INTRUDER,
      [
        `// import { somethingElse } from '${RECHECK}/rpc';`,
        `export const prose = "import x from '${RECHECK}/rpc'";`,
        `import { REVIEW_RECHECK_SOURCES } from '@wejammin/contracts';`,
        `export const sources = REVIEW_RECHECK_SOURCES;`,
        '',
      ].join('\n'),
    );
    expect(recheckBoundaryViolations(copy)).toEqual([]);
  });

  it.each(mutations)(
    'reports $title and attributes it to the intruding file',
    ({ file, source, names }) => {
      write(file, source);
      const violations = recheckBoundaryViolations(copy);
      expect(violations.length).toBeGreaterThan(0);
      expect(
        violations.filter(
          (violation) => violation.includes(file) && violation.includes(names),
        ),
      ).not.toEqual([]);
    },
  );

  it('is clean again once the intruders are deleted', () => {
    write(INTRUDER, `export * from '${RECHECK}/rpc';\n`);
    expect(recheckBoundaryViolations(copy)).not.toEqual([]);
    rmSync(join(copy, INTRUDER));
    expect(recheckBoundaryViolations(copy)).toEqual([]);
  });
});
