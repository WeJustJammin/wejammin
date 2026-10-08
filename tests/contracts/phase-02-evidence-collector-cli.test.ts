import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'evidence-collector-cli-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
const collector = resolve(
  import.meta.dirname,
  '../../scripts/evidence/collect-receipts.mjs',
);
const cli = (...args: string[]) =>
  spawnSync(process.execPath, [collector, '--root', root, ...args], {
    encoding: 'utf8',
  });

// Markers are assembled at run time so this fixture file is not itself a marker-bearing test.
const marker = (slice: string, n: string): string => `[P2-S${slice}-AC-${n}]`;

put('apps/x/a.test.ts', 'export {};\n');
put(
  'v.json',
  JSON.stringify({
    testResults: [
      {
        name: join(root, 'apps/x/a.test.ts'),
        assertionResults: [
          { fullName: 'suite cited by identity', status: 'passed' },
          {
            fullName: `suite ${marker('10', '007')} marked only`,
            status: 'passed',
          },
        ],
      },
    ],
  }),
);
const ledger = (clauses: string): string =>
  [
    "import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';",
    'export const S10_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [',
    `  { criterion: 'P2-S10-AC-001', text: 'x', clauses: [${clauses}], status: 'unverified', limitation: 'not yet' },`,
    '];',
    '',
  ].join('\n');
const outFile = 'tests/contracts/phase-02-slice-10-receipts.generated.jsonl';
const rows = (): Record<string, unknown>[] =>
  readFileSync(join(root, outFile), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe('collector command line: identity mode for slices with a ledger', () => {
  it('uses identity mode when the slice has a ledger: receipts for cited tests only, none from a marker', () => {
    put(
      'tests/contracts/phase-02-slice-10-evidence-ledger.ts',
      ledger(
        "{ text: 'x', citations: [{ tool: 'vitest', file: 'apps/x/a.test.ts', title: 'suite cited by identity' }] }",
      ),
    );
    const run = cli('--vitest', join(root, 'v.json'), '--slice', '10');
    expect(run.status, run.stderr).toBe(0);
    expect(rows().map((row) => [row.title, row.criterion])).toEqual([
      ['suite cited by identity', undefined],
    ]);
  });

  it('writes an empty receipts file and exits 0 when the ledger cites nothing, so no stale receipt survives', () => {
    put('tests/contracts/phase-02-slice-10-evidence-ledger.ts', ledger(''));
    const run = cli('--vitest', join(root, 'v.json'), '--slice', '10');
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('ledger cites no test');
    expect(readFileSync(join(root, outFile), 'utf8')).toBe('');
  });

  it('exits 1 when the ledger cites tests but none of them is in the inputs', () => {
    put(
      'tests/contracts/phase-02-slice-10-evidence-ledger.ts',
      ledger(
        "{ text: 'x', citations: [{ tool: 'vitest', file: 'apps/x/a.test.ts', title: 'a title that never ran' }] }",
      ),
    );
    const run = cli('--vitest', join(root, 'v.json'), '--slice', '10');
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('none of the');
  });

  it('keeps marker mode with --markers even when a ledger exists', () => {
    const run = cli(
      '--vitest',
      join(root, 'v.json'),
      '--slice',
      '10',
      '--markers',
    );
    expect(run.status, run.stderr).toBe(0);
    expect(rows().map((row) => row.criterion)).toEqual(['P2-S10-AC-007']);
  });

  it('never switches Slice 09 to identity mode', () => {
    put(
      'tests/contracts/phase-02-slice-09-evidence-ledger.ts',
      ledger('').replaceAll('S10', 'S09').replaceAll('P2-S10', 'P2-S09'),
    );
    put(
      'v9.json',
      JSON.stringify({
        testResults: [
          {
            name: join(root, 'apps/x/a.test.ts'),
            assertionResults: [
              { fullName: `s9 ${marker('09', '005')}`, status: 'passed' },
            ],
          },
        ],
      }),
    );
    const run = cli('--vitest', join(root, 'v9.json'));
    expect(run.status, run.stderr).toBe(0);
    const s09 = readFileSync(
      join(root, 'tests/contracts/phase-02-slice-09-receipts.generated.jsonl'),
      'utf8',
    );
    expect(JSON.parse(s09.trim()).criterion).toBe('P2-S09-AC-005');
  });

  it('exits 2 and names the ledger when its file does not export the ledger array', () => {
    put(
      'tests/contracts/phase-02-slice-10-evidence-ledger.ts',
      'export const other = [];\n',
    );
    const run = cli('--vitest', join(root, 'v.json'), '--slice', '10');
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('S10_EVIDENCE_LEDGER');
  });
});
