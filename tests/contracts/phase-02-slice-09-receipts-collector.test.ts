import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

type Result = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  status: string;
};
type Receipt = Result & { criterion: string; fileSha256: string | null };
type Entry = {
  criterion: string;
  testFiles: readonly string[];
  supplementary?: readonly string[];
};
type Lib = {
  markersIn: (text: string) => string[];
  parseVitestJson: (json: unknown, root: string) => Result[];
  parsePlaywrightJson: (json: unknown, testDir?: string) => Result[];
  parsePgtapTap: (
    text: string,
    root: string,
  ) => { results: Result[]; verbose: boolean };
  parseRaceOutput: (text: string) => Result[];
  buildReceipts: (results: Result[], root: string) => Receipt[];
  markStale: (
    results: Result[],
    root: string,
    reportMtimeMs: number,
  ) => Result[];
  serialiseReceipts: (receipts: Receipt[]) => string;
  parseReceipts: (text: string) => Receipt[];
  evaluateReceipts: (input: {
    entries: Entry[];
    receipts: Receipt[];
    shaOf: (file: string) => string | null;
  }) => string[];
};
const lib = (await import('../../scripts/evidence/receipts-lib.mjs')) as Lib;
const collector =
  (await import('../../scripts/evidence/collect-receipts.mjs')) as {
    collect: (input: {
      root: string;
      vitest: string[];
      pgtap: string[];
      playwright: string[];
      races: string[];
      testDir: string;
    }) => { receipts: Receipt[]; notes: string[] };
  };

// Markers are assembled at run time so this fixture file is not itself a
// marker-bearing test for the citation guards.
const mk = (n: string): string => `[P2-S09-AC-${n}]`;
const id = (n: string): string => `P2-S09-AC-${n}`;

const root = mkdtempSync(join(tmpdir(), 's09-receipts-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): string => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
  return createHash('sha256').update(text).digest('hex');
};

const sqlEntry = put(
  'supabase/tests/entry.sql',
  `\\ir entry/001.sqlinc\nselect ok(true, 'entry assertion ${mk('010')}');\n`,
);
const sqlInc = put(
  'supabase/tests/entry/001.sqlinc',
  `select ok(true, 'it''s an included assertion ${mk('011')}');\n`,
);
const vitestSha = put('apps/x/a.test.ts', 'export {};\n');
const e2eSha = put('tests/e2e/a.spec.ts', 'export {};\n');
const raceSha = put('supabase/tests/race/010.mjs', 'export {};\n');

describe('Slice 09 receipts collector', () => {
  it('reads every criterion a title names, including grouped markers, once and sorted', () => {
    expect(lib.markersIn(`${mk('005')} and ${mk('1147')} x`)).toEqual([
      id('005'),
      id('1147'),
    ]);
    expect(lib.markersIn(`[P2-S09-AC-${'219'}, AC-242, 243] grouped`)).toEqual([
      id('219'),
      id('242'),
      id('243'),
    ]);
    expect(lib.markersIn('no marker here')).toEqual([]);
  });

  it('turns a vitest JSON report into one result per test with a repository-relative file', () => {
    const results = lib.parseVitestJson(
      {
        testResults: [
          {
            name: join(root, 'apps/x/a.test.ts'),
            assertionResults: [
              { fullName: `suite ${mk('001')} ok`, status: 'passed' },
              { fullName: `suite ${mk('002')} bad`, status: 'failed' },
              { fullName: `suite ${mk('003')} todo`, status: 'pending' },
            ],
          },
        ],
      },
      root,
    );
    expect(results.map((r) => [r.file, r.status])).toEqual([
      ['apps/x/a.test.ts', 'passed'],
      ['apps/x/a.test.ts', 'failed'],
      ['apps/x/a.test.ts', 'skipped'],
    ]);
  });

  it('turns a Playwright report into results, mapping expected, unexpected, flaky and skipped', () => {
    const spec = (title: string, status: string): unknown => ({
      title,
      file: 'a.spec.ts',
      tests: [{ status }],
    });
    const results = lib.parsePlaywrightJson({
      suites: [
        {
          title: 'a.spec.ts',
          file: 'a.spec.ts',
          specs: [spec(`top ${mk('020')}`, 'expected')],
          suites: [
            {
              title: 'group',
              file: 'a.spec.ts',
              specs: [
                spec(`nested ${mk('021')}`, 'unexpected'),
                spec(`retry ${mk('022')}`, 'flaky'),
                spec(`skip ${mk('023')}`, 'skipped'),
              ],
            },
          ],
        },
      ],
    });
    expect(results.map((r) => [r.file, r.title, r.status])).toEqual([
      ['tests/e2e/a.spec.ts', `top ${mk('020')}`, 'passed'],
      ['tests/e2e/a.spec.ts', `group > nested ${mk('021')}`, 'failed'],
      ['tests/e2e/a.spec.ts', `group > retry ${mk('022')}`, 'flaky'],
      ['tests/e2e/a.spec.ts', `group > skip ${mk('023')}`, 'skipped'],
    ]);
  });

  it('reads verbose pgTAP assertions and attributes each to the included file that holds its text', () => {
    const tap = [
      'psql:/x/entry.sql:3: NOTICE:  extension "pgtap" already exists, skipping',
      'supabase/tests/entry.sql .. ',
      '1..2',
      `ok 1 - it's an included assertion ${mk('011')}`,
      `not ok 2 - entry assertion ${mk('010')}`,
      '# Failed test 2',
      'Result: FAIL',
    ].join('\n');
    const parsed = lib.parsePgtapTap(tap, root);
    expect(parsed.verbose).toBe(true);
    expect(
      parsed.results.map((r) => [r.granularity, r.file, r.status]),
    ).toEqual([
      ['assertion', 'supabase/tests/entry/001.sqlinc', 'passed'],
      ['assertion', 'supabase/tests/entry.sql', 'failed'],
    ]);
  });

  it('reads non-verbose pgTAP output as file-level receipts that take the file verdict, and flags it non-verbose', () => {
    const passed = lib.parsePgtapTap(
      `${join(root, 'supabase/tests/entry.sql')} ....... ok\n`,
      root,
    );
    expect(passed.verbose).toBe(false);
    expect(
      passed.results.map((r) => [r.granularity, r.file, r.status]).sort(),
    ).toEqual([
      ['file', 'supabase/tests/entry.sql', 'passed'],
      ['file', 'supabase/tests/entry/001.sqlinc', 'passed'],
    ]);
    const failed = lib.parsePgtapTap(
      `${join(root, 'supabase/tests/entry.sql')} ....... Dubious, test returned 3\n`,
      root,
    );
    expect(failed.results.every((r) => r.status === 'failed')).toBe(true);
  });

  it('reads race-runner JSON lines and plain db:races output with the runner verdict', () => {
    const json = lib.parseRaceOutput(
      JSON.stringify({
        marker: id('030'),
        title: 'loser got 409',
        status: 'passed',
        file: 'supabase/tests/race/010.mjs',
      }),
    );
    expect(json.map((r) => [r.file, r.title, r.status])).toEqual([
      ['supabase/tests/race/010.mjs', `${id('030')} loser got 409`, 'passed'],
    ]);
    const text = lib.parseRaceOutput(
      [
        `ok - ${mk('031')} serialized`,
        'PASS supabase/tests/race/010.mjs exit=0 ok=1',
        `ok - ${mk('032')} blocked`,
        'FAIL supabase/tests/race/011.mjs exit=1 ok=1',
      ].join('\n'),
    );
    expect(text.map((r) => [r.file, r.status])).toEqual([
      ['supabase/tests/race/010.mjs', 'passed'],
      ['supabase/tests/race/011.mjs', 'failed'],
    ]);
  });

  it('builds one sorted receipt per marker and test with the SHA-256 of the file on disk', () => {
    const receipts = lib.buildReceipts(
      [
        {
          tool: 'vitest',
          granularity: 'test',
          file: 'apps/x/a.test.ts',
          title: `both ${mk('002')} ${mk('001')}`,
          status: 'passed',
        },
        {
          tool: 'vitest',
          granularity: 'test',
          file: 'apps/x/missing.test.ts',
          title: `gone ${mk('003')}`,
          status: 'passed',
        },
        {
          tool: 'vitest',
          granularity: 'test',
          file: 'apps/x/a.test.ts',
          title: 'no marker',
          status: 'passed',
        },
      ],
      root,
    );
    expect(receipts.map((r) => r.criterion)).toEqual([
      id('001'),
      id('002'),
      id('003'),
    ]);
    expect(receipts[0]?.fileSha256).toBe(vitestSha);
    expect(receipts[2]?.fileSha256).toBeNull();
    expect(lib.parseReceipts(lib.serialiseReceipts(receipts))).toEqual(
      receipts,
    );
  });

  it('marks a result stale when its test file was edited after the report was written, never vouching for a run that did not see the file', () => {
    const file = 'apps/x/fresh.test.ts';
    put(file, 'export {};\n');
    const base = {
      tool: 'vitest',
      granularity: 'test',
      file,
      title: `t ${mk('005')}`,
      status: 'passed',
    };
    const reportAt = Date.now() - 60_000;
    utimesSync(
      join(root, file),
      (reportAt - 30_000) / 1000,
      (reportAt - 30_000) / 1000,
    );
    expect(lib.markStale([base], root, reportAt)[0]?.status).toBe('passed');
    utimesSync(
      join(root, file),
      (reportAt + 30_000) / 1000,
      (reportAt + 30_000) / 1000,
    );
    expect(lib.markStale([base], root, reportAt)[0]?.status).toBe('stale');
    expect(
      lib.markStale(
        [{ ...base, file: 'apps/x/gone.test.ts' }],
        root,
        reportAt,
      )[0]?.status,
    ).toBe('passed');
  });

  it('collects every tool end to end from files and reports non-verbose pgTAP', () => {
    writeFileSync(
      join(root, 'v.json'),
      JSON.stringify({
        testResults: [
          {
            name: join(root, 'apps/x/a.test.ts'),
            assertionResults: [
              { fullName: `v ${mk('001')}`, status: 'passed' },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, 'p.json'),
      JSON.stringify({
        suites: [
          {
            title: 'a.spec.ts',
            file: 'a.spec.ts',
            specs: [
              {
                title: `e ${mk('020')}`,
                file: 'a.spec.ts',
                tests: [{ status: 'expected' }],
              },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, 'db.log'),
      `${join(root, 'supabase/tests/entry.sql')} ... ok\n`,
    );
    writeFileSync(
      join(root, 'race.out'),
      `ok - ${mk('031')} s\nPASS supabase/tests/race/010.mjs exit=0 ok=1\n`,
    );
    const { receipts, notes } = collector.collect({
      root,
      vitest: [join(root, 'v.json')],
      pgtap: [join(root, 'db.log')],
      playwright: [join(root, 'p.json')],
      races: [join(root, 'race.out')],
      testDir: 'tests/e2e',
    });
    expect(new Set(receipts.map((r) => r.tool))).toEqual(
      new Set(['vitest', 'pgtap', 'playwright', 'race']),
    );
    expect(receipts.find((r) => r.tool === 'playwright')?.fileSha256).toBe(
      e2eSha,
    );
    expect(receipts.find((r) => r.tool === 'race')?.fileSha256).toBe(raceSha);
    expect(
      receipts.find((r) => r.file === 'supabase/tests/entry.sql')?.fileSha256,
    ).toBe(sqlEntry);
    expect(
      receipts.find((r) => r.file === 'supabase/tests/entry/001.sqlinc')
        ?.fileSha256,
    ).toBe(sqlInc);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('non-verbose');
  });
});

describe('Slice 09 receipts guard logic', () => {
  const sha = 'a'.repeat(64);
  const receipt = (over: Partial<Receipt>): Receipt => ({
    criterion: id('001'),
    tool: 'vitest',
    granularity: 'test',
    file: 'apps/x/a.test.ts',
    title: `t ${mk('001')}`,
    status: 'passed',
    fileSha256: sha,
    ...over,
  });
  const entries: Entry[] = [
    { criterion: id('001'), testFiles: ['apps/x/a.test.ts'] },
  ];
  const shaOf = (): string => sha;

  it('accepts a current passing receipt for each cited file', () => {
    expect(
      lib.evaluateReceipts({ entries, receipts: [receipt({})], shaOf }),
    ).toEqual([]);
  });

  it('fails a criterion with no receipt for a cited file', () => {
    const problems = lib.evaluateReceipts({
      entries,
      receipts: [receipt({ file: 'apps/x/other.test.ts' })],
      shaOf,
    });
    expect(problems).toEqual([`${id('001')} apps/x/a.test.ts: no receipt`]);
  });

  it('fails a stale receipt when the test file changed after the run', () => {
    const problems = lib.evaluateReceipts({
      entries,
      receipts: [receipt({})],
      shaOf: () => 'b'.repeat(64),
    });
    expect(problems[0]).toContain('stale');
  });

  it('fails a receipt the collector marked stale even when its hash matches the file now', () => {
    const problems = lib.evaluateReceipts({
      entries,
      receipts: [receipt({ status: 'stale' })],
      shaOf,
    });
    expect(problems[0]).toContain('stale');
  });

  it('fails a failed, flaky or only-skipped receipt', () => {
    for (const status of ['failed', 'flaky']) {
      const problems = lib.evaluateReceipts({
        entries,
        receipts: [receipt({}), receipt({ status })],
        shaOf,
      });
      expect(problems[0]).toContain(status);
    }
    const skipped = lib.evaluateReceipts({
      entries,
      receipts: [receipt({ status: 'skipped' })],
      shaOf,
    });
    expect(skipped[0]).toContain('no passing receipt');
  });

  it('requires a receipt for a supplementary race runner but not for a database spec', () => {
    const withRace: Entry[] = [
      {
        criterion: id('001'),
        testFiles: ['apps/x/a.test.ts'],
        supplementary: ['supabase/tests/race/010.mjs', 'tests/x.dbspec.ts'],
      },
    ];
    const missing = lib.evaluateReceipts({
      entries: withRace,
      receipts: [receipt({})],
      shaOf,
    });
    expect(missing).toEqual([
      `${id('001')} supabase/tests/race/010.mjs: no receipt`,
    ]);
    const present = lib.evaluateReceipts({
      entries: withRace,
      receipts: [
        receipt({}),
        receipt({ tool: 'race', file: 'supabase/tests/race/010.mjs' }),
      ],
      shaOf,
    });
    expect(present).toEqual([]);
  });
});
