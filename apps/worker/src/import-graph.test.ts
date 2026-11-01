import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  importEdges,
  importersOfModule,
  moduleStem,
} from './import-graph.test-support';

/*
 * The principal-boundary tests (cms-editorial-principals.test.ts) trust this
 * graph to name every module that can reach a protected port. This suite proves
 * the graph itself on a throwaway tree: each way a module can import another is
 * an edge, and a module that is only mentioned in prose is not.
 */

let root = '';

const write = (name: string, source: string): void => {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'import-graph-'));
  write('port/rpc.ts', 'export const rpc = 1;\nexport type Rpc = number;\n');
  write('port/index.ts', 'export const barrel = 1;\n');
  write('allowed.ts', "import { rpc } from './port/rpc';\nrpc;\n");
  write('reexport.ts', "export * from './port/rpc';\n");
  write('named-reexport.ts', "export { rpc as again } from './port/rpc.js';\n");
  write('dynamic.ts', "export const load = () => import('./port/rpc');\n");
  write('required.ts', "const loaded = require('./port/rpc');\nloaded;\n");
  write('deep/nested.ts', "import { rpc } from '../port/rpc';\nrpc;\n");
  write('side-effect.ts', "import './port/rpc';\n");
  write('equals.ts', "import loaded = require('./port/rpc');\nloaded;\n");
  write(
    'types-only.ts',
    "import type { Rpc } from './port/rpc';\nlet x: Rpc;\nx;\n",
  );
  write(
    'inline-types-only.ts',
    "import { type Rpc } from './port/rpc';\nlet x: Rpc;\nx;\n",
  );
  write(
    'export-type.ts',
    "export type { Rpc } from './port/rpc';\nexport type Local = import('./port/rpc').Rpc;\n",
  );
  write(
    'mixed.ts',
    "import { rpc, type Rpc } from './port/rpc';\nlet x: Rpc = rpc;\nx;\n",
  );
  write('barrel-user.ts', "import { barrel } from './port';\nbarrel;\n");
  write(
    'barrel-index-user.ts',
    "import { barrel } from './port/index';\nbarrel;\n",
  );
  write(
    'prose.ts',
    "// import { rpc } from './port/rpc';\nexport const text = \"from './port/rpc'\";\n",
  );
  write('package.ts', "import { z } from 'zod';\nz;\n");
  write('port/rpc.test.ts', "import { rpc } from './rpc';\nrpc;\n");
  write('port/rpc.test-support.ts', "import { rpc } from './rpc';\nrpc;\n");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the Worker import graph helper', () => {
  it('names every module that imports a port, however the import is written', () => {
    expect(importersOfModule(root, 'port/rpc')).toEqual({
      value: [
        'allowed.ts',
        'deep/nested.ts',
        'dynamic.ts',
        'equals.ts',
        'mixed.ts',
        'named-reexport.ts',
        'reexport.ts',
        'required.ts',
        'side-effect.ts',
      ],
      typeOnly: ['export-type.ts', 'inline-types-only.ts', 'types-only.ts'],
    });
  });

  it('treats an extension, a trailing /index and a directory as the same module', () => {
    expect(importersOfModule(root, 'port/rpc.ts')).toEqual(
      importersOfModule(root, 'port/rpc'),
    );
    expect(importersOfModule(root, 'port').value).toEqual([
      'barrel-index-user.ts',
      'barrel-user.ts',
    ]);
    expect(importersOfModule(root, 'port/index.ts').value).toEqual(
      importersOfModule(root, 'port').value,
    );
    expect(moduleStem('a\\b\\c.mjs?raw')).toBe('a/b/c');
  });

  it('ignores prose, packages, tests and test support', () => {
    const everyone = importEdges(root).map((edge) => edge.from);
    expect(everyone).not.toContain('prose.ts');
    expect(everyone).not.toContain('package.ts');
    expect(everyone).not.toContain('port/rpc.test.ts');
    expect(everyone).not.toContain('port/rpc.test-support.ts');
    expect(importersOfModule(root, 'zod')).toEqual({ value: [], typeOnly: [] });
  });

  it('reports a module nobody imports as having no importers', () => {
    expect(importersOfModule(root, 'allowed')).toEqual({
      value: [],
      typeOnly: [],
    });
  });

  it('names a module written later as a new importer, so an allowlist comparison fails', () => {
    const before = importersOfModule(root, 'port/rpc').value;
    write('intruder.ts', "import { rpc } from './port/rpc';\nrpc;\n");
    expect(importersOfModule(root, 'port/rpc').value).toEqual(
      [...before, 'intruder.ts'].sort(),
    );
  });
});
