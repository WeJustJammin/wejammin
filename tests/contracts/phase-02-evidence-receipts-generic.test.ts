import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

type Result = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  status: string;
};
type Receipt = Result & { criterion: string; fileSha256: string | null };
type Lib = {
  markersIn: (text: string, slice?: string | number) => string[];
  allMarkersIn: (text: string) => string[];
  normaliseSlice: (slice: string | number) => string;
  receiptsPathFor: (slice: string | number) => string;
  buildReceipts: (
    results: Result[],
    root: string,
    slice?: string | number,
  ) => Receipt[];
  serialiseReceipts: (receipts: Receipt[]) => string;
  parsePgtapTap: (
    text: string,
    root: string,
    options?: { slice?: string | number },
  ) => { results: Result[]; unverified: string[] };
};
type Collector = {
  DEFAULT_OUT: string;
  collect: (input: {
    root: string;
    vitest: string[];
    pgtap: string[];
    playwright: string[];
    races: string[];
    testDir: string;
    slice?: string | number;
  }) => { receipts: Receipt[]; errors: string[] };
  parseCollectorArgs: (
    argv: string[],
    cwd: string,
  ) => { slice: string; out: string };
};
const lib = (await import('../../scripts/evidence/receipts-lib.mjs')) as Lib;
const collector =
  (await import('../../scripts/evidence/collect-receipts.mjs')) as Collector;

// Markers are assembled at run time so this fixture file is not itself a
// marker-bearing test for any citation guard.
const mk = (slice: string, n: string): string => `[P2-S${slice}-AC-${n}]`;
const id = (slice: string, n: string): string => `P2-S${slice}-AC-${n}`;

const root = mkdtempSync(join(tmpdir(), 'evidence-generic-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): string => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
  return createHash('sha256').update(text).digest('hex');
};
const vitestSha = put('apps/x/a.test.ts', 'export {};\n');

describe('phase 2 generic criterion markers', () => {
  it('reads the slice a caller names, S09 by default, and nothing from another slice', () => {
    const text = `${mk('09', '001')} ${mk('10', '002')} ${mk('11', '1147')}`;
    expect(lib.markersIn(text)).toEqual([id('09', '001')]);
    expect(lib.markersIn(text, '09')).toEqual([id('09', '001')]);
    expect(lib.markersIn(text, '10')).toEqual([id('10', '002')]);
    expect(lib.markersIn(text, 11)).toEqual([id('11', '1147')]);
    expect(lib.markersIn(text, '12')).toEqual([]);
  });

  it('reads grouped markers of the requested slice only, once, sorted', () => {
    expect(
      lib.markersIn(
        `[P2-S10-AC-${'219'}, AC-242, 243] [P2-S09-AC-${'005'}, AC-006]`,
        '10',
      ),
    ).toEqual([id('10', '219'), id('10', '242'), id('10', '243')]);
    expect(
      lib.markersIn(
        `[P2-S10-AC-${'219'}, AC-242, 243] [P2-S09-AC-${'005'}, AC-006]`,
      ),
    ).toEqual([id('09', '005'), id('09', '006')]);
  });

  it('rejects a malformed marker: three-digit slice, five-digit number, wrong prefix', () => {
    expect(
      lib.markersIn('P2-S110-AC-001 P2-S10-AC-12345 P3-S10-AC-001', '10'),
    ).toEqual([]);
    expect(lib.markersIn('P2-S10-AC-12345', '10')).toEqual([]);
  });

  it('lists every marker of every slice with allMarkersIn', () => {
    expect(
      lib.allMarkersIn(
        `${mk('10', '002')} ${mk('09', '001')} ${mk('10', '002')}`,
      ),
    ).toEqual([id('09', '001'), id('10', '002')]);
  });

  it('normalises a slice to two digits within 01..17 and rejects anything else', () => {
    expect(lib.normaliseSlice(9)).toBe('09');
    expect(lib.normaliseSlice('9')).toBe('09');
    expect(lib.normaliseSlice('10')).toBe('10');
    expect(lib.normaliseSlice(17)).toBe('17');
    for (const bad of ['0', '00', '18', '100', 'x', '', '1.5', '-1', '1e1']) {
      expect(() => lib.normaliseSlice(bad), bad).toThrow(/slice/u);
    }
  });

  it('maps a slice to its generated receipts file and keeps the S09 path unchanged', () => {
    expect(lib.receiptsPathFor('09')).toBe(
      'tests/contracts/phase-02-slice-09-receipts.generated.jsonl',
    );
    expect(lib.receiptsPathFor('10')).toBe(
      'tests/contracts/phase-02-slice-10-receipts.generated.jsonl',
    );
    expect(collector.DEFAULT_OUT).toBe(lib.receiptsPathFor('09'));
  });
});

describe('phase 2 generic receipt building', () => {
  const results: Result[] = [
    {
      tool: 'vitest',
      granularity: 'test',
      file: 'apps/x/a.test.ts',
      title: `both ${mk('09', '002')} ${mk('09', '001')} and other ${mk('10', '003')}`,
      status: 'passed',
    },
    {
      tool: 'vitest',
      granularity: 'test',
      file: 'apps/x/a.test.ts',
      title: `only s10 ${mk('10', '004')}`,
      status: 'failed',
    },
  ];

  it('builds S09 receipts exactly as before when no slice is named (golden output)', () => {
    const receipts = lib.buildReceipts(results, root);
    expect(lib.serialiseReceipts(receipts)).toBe(
      [
        {
          criterion: id('09', '001'),
          tool: 'vitest',
          granularity: 'test',
          file: 'apps/x/a.test.ts',
          title: results[0]?.title,
          status: 'passed',
          fileSha256: vitestSha,
        },
        {
          criterion: id('09', '002'),
          tool: 'vitest',
          granularity: 'test',
          file: 'apps/x/a.test.ts',
          title: results[0]?.title,
          status: 'passed',
          fileSha256: vitestSha,
        },
      ]
        .map((row) => JSON.stringify(row))
        .join('\n') + '\n',
    );
    expect(lib.buildReceipts(results, root, '09')).toEqual(receipts);
  });

  it('builds receipts for the named slice only', () => {
    const receipts = lib.buildReceipts(results, root, '10');
    expect(receipts.map((r) => [r.criterion, r.status])).toEqual([
      [id('10', '003'), 'passed'],
      [id('10', '004'), 'failed'],
    ]);
  });

  it('attributes an unattributable pgTAP SKIP to the markers of the requested slice', () => {
    put(
      'supabase/tests/gen.sql',
      `select ok(true, 'kept ${mk('10', '021')}');\nselect ok(true, 'other ${mk('09', '022')}');\n`,
    );
    const tap = [
      `${join(root, 'supabase/tests/gen.sql')} .. `,
      '1..2',
      `ok 1 - kept ${mk('10', '021')}`,
      'ok 2 # SKIP no database role',
    ].join('\n');
    const titlesOf = (slice: string): string[] =>
      lib
        .parsePgtapTap(tap, root, { slice })
        .results.filter((r) => r.granularity === 'file')
        .map((r) => r.title);
    expect(titlesOf('10')).toEqual([`kept ${mk('10', '021')}`]);
    expect(titlesOf('09')).toEqual([`other ${mk('09', '022')}`]);
  });
});

describe('phase 2 generic collector', () => {
  const report = (title: string): string =>
    JSON.stringify({
      testResults: [
        {
          name: join(root, 'apps/x/a.test.ts'),
          assertionResults: [{ fullName: title, status: 'passed' }],
        },
      ],
    });

  it('collects the markers of the slice it is told to, and S09 by default', () => {
    writeFileSync(
      join(root, 'v.json'),
      report(`v ${mk('09', '001')} ${mk('10', '002')}`),
    );
    const base = {
      root,
      vitest: [join(root, 'v.json')],
      pgtap: [],
      playwright: [],
      races: [],
      testDir: 'tests/e2e',
    };
    expect(collector.collect(base).receipts.map((r) => r.criterion)).toEqual([
      id('09', '001'),
    ]);
    expect(
      collector
        .collect({ ...base, slice: '10' })
        .receipts.map((r) => r.criterion),
    ).toEqual([id('10', '002')]);
  });

  it('resolves the output path from --slice, defaulting to the S09 file, and honours --out', () => {
    expect(collector.parseCollectorArgs([], '/r')).toEqual({
      slice: '09',
      out: resolve(
        '/r',
        'tests/contracts/phase-02-slice-09-receipts.generated.jsonl',
      ),
    });
    expect(collector.parseCollectorArgs(['--slice', '10'], '/r')).toEqual({
      slice: '10',
      out: resolve(
        '/r',
        'tests/contracts/phase-02-slice-10-receipts.generated.jsonl',
      ),
    });
    expect(
      collector.parseCollectorArgs(
        ['--slice', '10', '--out', 'x/y.jsonl'],
        '/r',
      ).out,
    ).toBe(resolve('/r', 'x/y.jsonl'));
    expect(() => collector.parseCollectorArgs(['--slice', '99'], '/r')).toThrow(
      /slice/u,
    );
  });

  const cli = (args: string[]) =>
    spawnSync(
      process.execPath,
      [
        resolve(
          import.meta.dirname,
          '../../scripts/evidence/collect-receipts.mjs',
        ),
        '--root',
        root,
        ...args,
      ],
      { encoding: 'utf8' },
    );

  it('writes tests/contracts/phase-02-slice-NN-receipts.generated.jsonl for --slice NN and the S09 file otherwise', () => {
    mkdirSync(join(root, 'tests/contracts'), { recursive: true });
    writeFileSync(
      join(root, 'v2.json'),
      report(`v ${mk('09', '001')} ${mk('10', '002')}`),
    );
    const s09 = cli(['--vitest', join(root, 'v2.json')]);
    expect(s09.status, s09.stderr).toBe(0);
    const s10 = cli(['--vitest', join(root, 'v2.json'), '--slice', '10']);
    expect(s10.status, s10.stderr).toBe(0);
    const criteria = (slice: string): string[] =>
      readFileSync(
        join(
          root,
          `tests/contracts/phase-02-slice-${slice}-receipts.generated.jsonl`,
        ),
        'utf8',
      )
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => (JSON.parse(line) as Receipt).criterion);
    expect(criteria('09')).toEqual([id('09', '001')]);
    expect(criteria('10')).toEqual([id('10', '002')]);
  });

  it('exits 1 with the slice-specific marker hint when the inputs carry no marker of the slice', () => {
    writeFileSync(join(root, 'v3.json'), report('no marker'));
    const result = cli(['--vitest', join(root, 'v3.json'), '--slice', '11']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[P2-S11-AC-NNN]');
    expect(
      existsSync(
        join(
          root,
          'tests/contracts/phase-02-slice-11-receipts.generated.jsonl',
        ),
      ),
    ).toBe(false);
    const s09 = cli(['--vitest', join(root, 'v3.json')]);
    expect(s09.stderr).toContain('[P2-S09-AC-NNN]');
  });
});
