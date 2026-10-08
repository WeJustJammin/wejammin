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

type Citation = {
  tool: string;
  file: string;
  title: string;
  project?: string;
};
type Result = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  status: string;
  invocation?: string;
  project?: string;
  entrypoint?: string;
  ownerCount?: number;
};
type Receipt = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  project?: string;
  entrypoint?: string;
  status: string;
  occurrences?: number;
  fileSha256: string | null;
  closureSha256?: string | null;
};
type Receipts = {
  parseVitestJson: (
    json: unknown,
    root: string,
    invocation?: string,
  ) => Result[];
  parsePlaywrightJson: (
    json: unknown,
    testDir?: string,
    config?: string,
  ) => Result[];
  parsePgtapTap: (
    text: string,
    root: string,
    options?: { identity?: boolean },
  ) => { results: Result[]; unverified: string[] };
  parseRaceOutput: (text: string, options?: { identity?: boolean }) => Result[];
  markStale: (
    results: Result[],
    root: string,
    reportMtimeMs: number,
  ) => Result[];
  mergeReports: (
    reports: Result[][],
    replacements?: readonly unknown[],
  ) => Result[];
};
type Identity = {
  identityKey: (
    tool: string,
    file: string,
    title: string,
    project?: string,
  ) => string;
  closureSha256: (root: string, entrypoint: string) => string | null;
  buildIdentityReceipts: (
    results: Result[],
    root: string,
    citations: readonly Citation[],
  ) => Receipt[];
};
type Collector = {
  collect: (input: {
    root: string;
    vitest: string[];
    pgtap: string[];
    playwright: string[];
    races: string[];
    testDir: string;
    slice?: string;
    identity?: { citations: readonly Citation[] };
  }) => { receipts: Receipt[]; errors: string[] };
};
const lib =
  (await import('../../scripts/evidence/receipts-lib.mjs')) as Receipts;
const identity =
  (await import('../../scripts/evidence/identity-receipts-lib.mjs')) as Identity;
const collector =
  (await import('../../scripts/evidence/collect-receipts.mjs')) as Collector;

const root = mkdtempSync(join(tmpdir(), 'evidence-identity-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const sha = (text: string): string =>
  createHash('sha256').update(text).digest('hex');
const put = (file: string, text: string): string => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
  return sha(text);
};

const vitestSha = put('apps/x/a.test.ts', 'export {};\n');
const e2eSha = put('tests/e2e/a.spec.ts', 'export {};\n');
const raceSha = put('supabase/tests/race/010.mjs', 'export {};\n');
const entrySource = [
  '\\ir entry/001.sqlinc',
  "select ok(true, 'entry assertion');",
  "select ok(true, 'dup description');",
  "select ok(true, 'dup description');",
  '',
].join('\n');
const incSource = [
  "select ok(true, 'it''s an included assertion');",
  "select ok(true, 'entry assertion extended text');",
  '',
].join('\n');
const entrySha = put('supabase/tests/entry.sql', entrySource);
const incSha = put('supabase/tests/entry/001.sqlinc', incSource);

const vitestReport = (...tests: [string, string][]): unknown => ({
  testResults: [
    {
      name: join(root, 'apps/x/a.test.ts'),
      assertionResults: tests.map(([fullName, status]) => ({
        fullName,
        status,
      })),
    },
  ],
});
const v = (title: string, status = 'passed', file = 'apps/x/a.test.ts') => ({
  tool: 'vitest',
  granularity: 'test',
  file,
  title,
  status,
});
const cite = (title: string, over: Partial<Citation> = {}): Citation => ({
  tool: 'vitest',
  file: 'apps/x/a.test.ts',
  title,
  ...over,
});

describe('identity receipts: selection and shape', () => {
  it('keys a receipt by tool, file, exact title and (Playwright) project, and by nothing a title may carry', () => {
    const keys = new Set([
      identity.identityKey('vitest', 'a', 't'),
      identity.identityKey('vitest', 'a', 't2'),
      identity.identityKey('vitest', 'b', 't'),
      identity.identityKey('pgtap', 'a', 't'),
      identity.identityKey('playwright', 'a', 't', 'chrome'),
      identity.identityKey('playwright', 'a', 't', 'firefox'),
    ]);
    expect(keys.size).toBe(6);
    expect(identity.identityKey('vitest', 'a', 't')).toBe(
      identity.identityKey('vitest', 'a', 't', ''),
    );
  });

  it('emits the cited test with no criterion, no marker dependence and the SHA-256 of its file', () => {
    const receipts = identity.buildIdentityReceipts(
      [v('suite cited test'), v('suite [P2-S10-AC-001] marked but uncited')],
      root,
      [cite('suite cited test')],
    );
    expect(receipts).toEqual([
      {
        tool: 'vitest',
        granularity: 'test',
        file: 'apps/x/a.test.ts',
        title: 'suite cited test',
        status: 'passed',
        fileSha256: vitestSha,
      },
    ]);
    expect(Object.keys(receipts[0] ?? {})).not.toContain('criterion');
  });

  it('also emits a non-passing sibling in a cited file so a hidden skip or failure cannot be missed', () => {
    const receipts = identity.buildIdentityReceipts(
      [
        v('cited'),
        v('sibling skipped', 'skipped'),
        v('sibling failed', 'failed'),
        v('sibling flaky', 'flaky'),
        v('sibling passed uncited'),
        v('other file skipped', 'skipped', 'apps/x/other.test.ts'),
      ],
      root,
      [cite('cited')],
    );
    expect(receipts.map((r) => [r.title, r.status])).toEqual([
      ['cited', 'passed'],
      ['sibling failed', 'failed'],
      ['sibling flaky', 'flaky'],
      ['sibling skipped', 'skipped'],
    ]);
  });

  it('emits nothing for a tool, file or title nobody cites, and sorts the output', () => {
    expect(
      identity.buildIdentityReceipts([v('a'), v('b', 'skipped')], root, []),
    ).toEqual([]);
    const out = identity.buildIdentityReceipts(
      [v('b'), v('a'), { ...v('a'), tool: 'race', granularity: 'assertion' }],
      root,
      [cite('a'), cite('b'), cite('a', { tool: 'race' })],
    );
    expect(out.map((r) => `${r.tool}/${r.title}`)).toEqual([
      'race/a',
      'vitest/a',
      'vitest/b',
    ]);
  });

  it('records occurrences when one report holds the same identity twice, and never collapses it into one clean row', () => {
    const receipts = identity.buildIdentityReceipts(
      [
        { ...v('twice'), invocation: 'r.json' },
        { ...v('twice'), invocation: 'r.json' },
        { ...v('once'), invocation: 'r.json' },
      ],
      root,
      [cite('twice'), cite('once')],
    );
    expect(receipts.find((r) => r.title === 'twice')?.occurrences).toBe(2);
    expect(
      receipts.find((r) => r.title === 'once')?.occurrences,
    ).toBeUndefined();
  });

  it('emits a duplicated identity even when only an uncited sibling is duplicated', () => {
    const receipts = identity.buildIdentityReceipts(
      [
        { ...v('dup'), invocation: 'r' },
        { ...v('dup'), invocation: 'r' },
        v('cited'),
      ],
      root,
      [cite('cited')],
    );
    expect(receipts.map((r) => [r.title, r.occurrences])).toEqual([
      ['cited', undefined],
      ['dup', 2],
    ]);
  });

  it('treats one test run by two invocations as one clean receipt per outcome, not as a duplicate', () => {
    const receipts = identity.buildIdentityReceipts(
      [
        { ...v('t'), invocation: 'a.json' },
        { ...v('t'), invocation: 'b.json' },
        { ...v('t', 'failed'), invocation: 'c.json' },
      ],
      root,
      [cite('t')],
    );
    expect(receipts.map((r) => [r.status, r.occurrences])).toEqual([
      ['failed', undefined],
      ['passed', undefined],
    ]);
  });
});

describe('identity receipts: vitest', () => {
  it('reads the full title path as the identity and maps pending and todo to skipped', () => {
    const results = lib.parseVitestJson(
      vitestReport(
        ['outer inner test', 'passed'],
        ['outer todo', 'todo'],
        ['outer pend', 'pending'],
      ),
      root,
      'r.json',
    );
    expect(results.map((r) => [r.title, r.status])).toEqual([
      ['outer inner test', 'passed'],
      ['outer todo', 'skipped'],
      ['outer pend', 'skipped'],
    ]);
  });
});

describe('identity receipts: Playwright project is part of the identity', () => {
  const spec = (title: string, project: string, status: string): unknown => ({
    title,
    file: 'a.spec.ts',
    tests: [{ status, projectName: project }],
  });
  const report = {
    suites: [
      {
        title: 'a.spec.ts',
        file: 'a.spec.ts',
        specs: [
          spec('renders', 'chrome', 'expected'),
          spec('renders', 'mobile', 'unexpected'),
        ],
      },
    ],
  };
  const pw = (title: string, project: string): Citation => ({
    tool: 'playwright',
    file: 'tests/e2e/a.spec.ts',
    title,
    project,
  });

  it('keeps the same title in two projects as two receipts with their own statuses', () => {
    const results = lib.parsePlaywrightJson(report, 'tests/e2e', 'p.json');
    expect(results.map((r) => [r.project, r.status])).toEqual([
      ['chrome', 'passed'],
      ['mobile', 'failed'],
    ]);
    const receipts = identity.buildIdentityReceipts(results, root, [
      pw('renders', 'chrome'),
    ]);
    expect(receipts.map((r) => [r.project, r.status, r.fileSha256])).toEqual([
      ['chrome', 'passed', e2eSha],
      ['mobile', 'failed', e2eSha],
    ]);
  });

  it('does not let a cited project satisfy a different project', () => {
    const results = lib.parsePlaywrightJson(report, 'tests/e2e', 'p.json');
    const receipts = identity.buildIdentityReceipts(results, root, [
      pw('renders', 'chrome'),
    ]);
    expect(receipts.some((r) => r.project === 'firefox')).toBe(false);
  });
});

describe('identity receipts: pgTAP', () => {
  const tapFor = (...lines: string[]): string =>
    [`${join(root, 'supabase/tests/entry.sql')} .. `, ...lines].join('\n');
  const complete = tapFor(
    '1..5',
    "ok 1 - it's an included assertion",
    'ok 2 - entry assertion',
    'ok 3 - dup description',
    'ok 4 - dup description',
    'ok 5 - entry assertion extended text',
  );

  it('attributes an assertion to the file whose source holds its description as a whole string literal', () => {
    const { results } = lib.parsePgtapTap(complete, root, { identity: true });
    const owner = (title: string): string[] =>
      results.filter((r) => r.title === title).map((r) => r.file);
    expect(owner('entry assertion')).toEqual(['supabase/tests/entry.sql']);
    expect(owner("it's an included assertion")).toEqual([
      'supabase/tests/entry/001.sqlinc',
    ]);
    expect(owner('entry assertion extended text')).toEqual([
      'supabase/tests/entry/001.sqlinc',
    ]);
    expect(
      results.every((r) => r.entrypoint === 'supabase/tests/entry.sql'),
    ).toBe(true);
  });

  it('writes the entrypoint and the closure hash, so an edit of any included file stales the receipt', () => {
    const { results } = lib.parsePgtapTap(complete, root, { identity: true });
    const cited: Citation = {
      tool: 'pgtap',
      file: 'supabase/tests/entry/001.sqlinc',
      title: "it's an included assertion",
    };
    const [receipt] = identity.buildIdentityReceipts(results, root, [cited]);
    expect(receipt).toMatchObject({
      tool: 'pgtap',
      granularity: 'assertion',
      entrypoint: 'supabase/tests/entry.sql',
      fileSha256: incSha,
      closureSha256: identity.closureSha256(root, 'supabase/tests/entry.sql'),
    });
    expect(identity.closureSha256(root, 'supabase/tests/entry.sql')).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(
      identity.closureSha256(root, 'supabase/tests/missing.sql'),
    ).toBeNull();
    expect(entrySha).not.toBe(incSha);
  });

  it('changes the closure hash when an included file changes though the entrypoint does not', () => {
    const before = identity.closureSha256(root, 'supabase/tests/entry.sql');
    put('supabase/tests/entry/001.sqlinc', `${incSource}-- edited\n`);
    const after = identity.closureSha256(root, 'supabase/tests/entry.sql');
    put('supabase/tests/entry/001.sqlinc', incSource);
    expect(after).not.toBe(before);
    expect(identity.closureSha256(root, 'supabase/tests/entry.sql')).toBe(
      before,
    );
  });

  it('reports a description used twice in one file as occurrences 2', () => {
    const { results } = lib.parsePgtapTap(complete, root, { identity: true });
    const cited: Citation = {
      tool: 'pgtap',
      file: 'supabase/tests/entry.sql',
      title: 'entry assertion',
    };
    const receipts = identity.buildIdentityReceipts(results, root, [cited]);
    expect(receipts.map((r) => [r.title, r.occurrences])).toEqual([
      ['dup description', 2],
      ['entry assertion', undefined],
    ]);
  });

  it('never counts undescribed assertions as duplicates of each other', () => {
    const tap = tapFor('1..2', 'ok 1', 'ok 2');
    const { results } = lib.parsePgtapTap(tap, root, { identity: true });
    const receipts = identity.buildIdentityReceipts(results, root, [
      {
        tool: 'pgtap',
        file: 'supabase/tests/entry.sql',
        title: 'entry assertion',
      },
    ]);
    expect(receipts).toEqual([]);
  });

  it('treats a SKIP or TODO with no description as a skipped file-level row for every file of the entrypoint', () => {
    const tap = tapFor(
      '1..2',
      'ok 1 - entry assertion',
      'ok 2 # SKIP no database role',
    );
    const { results } = lib.parsePgtapTap(tap, root, { identity: true });
    const fileRows = results.filter((r) => r.granularity === 'file');
    expect(fileRows.map((r) => [r.file, r.status]).sort()).toEqual([
      ['supabase/tests/entry.sql', 'skipped'],
      ['supabase/tests/entry/001.sqlinc', 'skipped'],
    ]);
    const receipts = identity.buildIdentityReceipts(results, root, [
      {
        tool: 'pgtap',
        file: 'supabase/tests/entry.sql',
        title: 'entry assertion',
      },
    ]);
    expect(receipts.filter((r) => r.granularity === 'file')).toHaveLength(1);
    expect(receipts.find((r) => r.granularity === 'file')?.status).toBe(
      'skipped',
    );
  });

  it('fails every assertion of an incomplete file and keeps a described SKIP as that assertion', () => {
    const short = lib.parsePgtapTap(
      tapFor('1..3', 'ok 1 - entry assertion', 'ok 2 - dup description'),
      root,
      { identity: true },
    );
    expect(short.results.map((r) => r.status)).toEqual(['failed', 'failed']);
    const skip = lib.parsePgtapTap(
      tapFor('1..1', 'ok 1 - entry assertion # SKIP not today'),
      root,
      { identity: true },
    );
    expect(skip.results.map((r) => [r.title, r.status])).toEqual([
      ['entry assertion', 'skipped'],
    ]);
  });

  it('flags a description present as a literal in two files of one entrypoint as ambiguous', () => {
    put(
      'supabase/tests/amb.sql',
      "\\ir amb/001.sqlinc\nselect ok(true, 'shared text');\n",
    );
    put('supabase/tests/amb/001.sqlinc', "select ok(true, 'shared text');\n");
    const tap = `${join(root, 'supabase/tests/amb.sql')} .. \n1..1\nok 1 - shared text\n`;
    const { results } = lib.parsePgtapTap(tap, root, { identity: true });
    expect(results.map((r) => r.file).sort()).toEqual([
      'supabase/tests/amb.sql',
      'supabase/tests/amb/001.sqlinc',
    ]);
    const receipts = identity.buildIdentityReceipts(results, root, [
      { tool: 'pgtap', file: 'supabase/tests/amb.sql', title: 'shared text' },
    ]);
    expect(receipts.every((r) => r.occurrences === 2)).toBe(true);
  });

  it('keeps the Slice 09 parse unchanged: no entrypoint key and the loose owner rule', () => {
    const { results } = lib.parsePgtapTap(complete, root);
    expect(results.every((r) => !('entrypoint' in r))).toBe(true);
  });
});

describe('identity receipts: race runners', () => {
  it('uses the assertion text as the title and never lets a "not ok" line pass under a PASS verdict', () => {
    const results = lib.parseRaceOutput(
      [
        'ok - first serialized',
        'not ok - second serialized',
        'PASS supabase/tests/race/010.mjs exit=0 ok=1',
      ].join('\n'),
      { identity: true },
    );
    expect(results.map((r) => [r.file, r.title, r.status])).toEqual([
      ['supabase/tests/race/010.mjs', 'first serialized', 'passed'],
      ['supabase/tests/race/010.mjs', 'second serialized', 'failed'],
    ]);
    const legacy = lib.parseRaceOutput(
      'not ok - second serialized\nPASS supabase/tests/race/010.mjs exit=0 ok=1',
    );
    expect(legacy.map((r) => r.status)).toEqual(['passed']);
  });

  it('reads JSON lines with the plain title in identity mode', () => {
    const line = JSON.stringify({
      marker: 'P2-S10-AC-001',
      title: 'loser got 409',
      status: 'passed',
      file: 'supabase/tests/race/010.mjs',
    });
    expect(
      lib.parseRaceOutput(line, { identity: true }).map((r) => r.title),
    ).toEqual(['loser got 409']);
    expect(lib.parseRaceOutput(line).map((r) => r.title)).toEqual([
      'P2-S10-AC-001 loser got 409',
    ]);
  });

  it('drops assertions that never reached a runner verdict, so a crashed runner leaves no receipt', () => {
    expect(lib.parseRaceOutput('ok - lonely', { identity: true })).toEqual([]);
  });
});

describe('identity receipts: staleness and merging', () => {
  it('marks an identity result stale when an included pgTAP file changed after the report', () => {
    const { results } = lib.parsePgtapTap(
      `${join(root, 'supabase/tests/entry.sql')} .. \n1..1\nok 1 - entry assertion\n`,
      root,
      { identity: true },
    );
    const reportAt = Date.now() - 60_000;
    const set = (file: string, ms: number): void =>
      utimesSync(join(root, file), ms / 1000, ms / 1000);
    set('supabase/tests/entry.sql', reportAt - 30_000);
    set('supabase/tests/entry/001.sqlinc', reportAt - 30_000);
    expect(lib.markStale(results, root, reportAt)[0]?.status).toBe('passed');
    set('supabase/tests/entry/001.sqlinc', reportAt + 30_000);
    expect(lib.markStale(results, root, reportAt)[0]?.status).toBe('stale');
  });

  it('never merges a skip away when the allowlist is empty, so a skip in one invocation survives a pass in another', () => {
    const skipped = { ...v('t', 'skipped'), invocation: 'a.json' };
    const passed = { ...v('t'), invocation: 'vitest-evidence-s09.json' };
    expect(
      lib.mergeReports([[skipped], [passed]], []).map((r) => r.status),
    ).toEqual(['skipped', 'passed']);
  });
});

describe('identity receipts: collector end to end', () => {
  it('collects every tool by identity from files and omits what no citation names', () => {
    writeFileSync(
      join(root, 'v.json'),
      JSON.stringify(
        vitestReport(['suite a', 'passed'], ['suite b', 'passed']),
      ),
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
                title: 'renders',
                file: 'a.spec.ts',
                tests: [{ status: 'expected', projectName: 'chrome' }],
              },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, 'db.tap'),
      `${join(root, 'supabase/tests/entry.sql')} .. \n1..2\nok 1 - entry assertion\nok 2 - dup description\n`,
    );
    writeFileSync(
      join(root, 'race.out'),
      'ok - serialized\nPASS supabase/tests/race/010.mjs exit=0 ok=1\n',
    );
    const { receipts, errors } = collector.collect({
      root,
      slice: '10',
      vitest: [join(root, 'v.json')],
      pgtap: [join(root, 'db.tap')],
      playwright: [join(root, 'p.json')],
      races: [join(root, 'race.out')],
      testDir: 'tests/e2e',
      identity: {
        citations: [
          cite('suite a'),
          {
            tool: 'playwright',
            file: 'tests/e2e/a.spec.ts',
            title: 'renders',
            project: 'chrome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/entry.sql',
            title: 'entry assertion',
          },
          {
            tool: 'race',
            file: 'supabase/tests/race/010.mjs',
            title: 'serialized',
          },
        ],
      },
    });
    expect(errors).toEqual([]);
    expect(receipts.map((r) => `${r.tool}|${r.file}|${r.title}`)).toEqual([
      'pgtap|supabase/tests/entry.sql|entry assertion',
      'playwright|tests/e2e/a.spec.ts|renders',
      'race|supabase/tests/race/010.mjs|serialized',
      'vitest|apps/x/a.test.ts|suite a',
    ]);
    expect(receipts.find((r) => r.tool === 'race')?.fileSha256).toBe(raceSha);
    expect(receipts.find((r) => r.tool === 'pgtap')?.fileSha256).toBe(entrySha);
  });

  it('refuses non-verbose pgTAP input in identity mode as well', () => {
    writeFileSync(
      join(root, 'coarse.log'),
      `${join(root, 'supabase/tests/entry.sql')} ... ok\n`,
    );
    const { receipts, errors } = collector.collect({
      root,
      slice: '10',
      vitest: [],
      pgtap: [join(root, 'coarse.log')],
      playwright: [],
      races: [],
      testDir: 'tests/e2e',
      identity: {
        citations: [
          { tool: 'pgtap', file: 'supabase/tests/entry.sql', title: 'x' },
        ],
      },
    });
    expect(receipts).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});
