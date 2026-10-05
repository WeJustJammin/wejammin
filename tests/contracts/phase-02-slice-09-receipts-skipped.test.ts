import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
type Entry = { criterion: string; testFiles: readonly string[] };
type Lib = {
  parseVitestJson: (json: unknown, root: string) => Result[];
  parsePlaywrightJson: (json: unknown, testDir?: string) => Result[];
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
    }) => { receipts: Receipt[]; notes: string[]; errors: string[] };
  };

// Markers are assembled at run time so this fixture is not itself marker-bearing.
const mk = (n: string): string => `[P2-S09-AC-${n}]`;
const id = (n: string): string => `P2-S09-AC-${n}`;
const sha = 'a'.repeat(64);
const shaOf = (): string => sha;

const root = mkdtempSync(join(tmpdir(), 's09-receipts-skipped-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
put('apps/x/a.test.ts', 'export {};\n');
put('tests/e2e/a.spec.ts', 'export {};\n');

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
const entryFor = (file: string): Entry[] => [
  { criterion: id('001'), testFiles: [file] },
];

const vitestReport = (
  tests: ReadonlyArray<readonly [string, string]>,
): unknown => ({
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
const writeReport = (name: string, json: unknown): string => {
  const path = join(root, name);
  writeFileSync(path, JSON.stringify(json));
  return path;
};
const collect = (vitest: string[]) =>
  collector.collect({
    root,
    vitest,
    pgtap: [],
    playwright: [],
    races: [],
    testDir: 'tests/e2e',
  });

describe('Slice 09 receipts fail closed on skipped tests for every tool', () => {
  it('rejects a skipped vitest receipt even when a sibling test in the same file passed', () => {
    const problems = lib.evaluateReceipts({
      entries: entryFor('apps/x/a.test.ts'),
      receipts: [receipt({}), receipt({ status: 'skipped', title: 'other' })],
      shaOf,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('skipped');
    expect(problems[0]).toContain('apps/x/a.test.ts');
  });

  it('rejects a skipped Playwright receipt even when a sibling test passed', () => {
    const e2e = (over: Partial<Receipt>): Receipt =>
      receipt({ tool: 'playwright', file: 'tests/e2e/a.spec.ts', ...over });
    const problems = lib.evaluateReceipts({
      entries: entryFor('tests/e2e/a.spec.ts'),
      receipts: [e2e({}), e2e({ status: 'skipped', title: 'fixme case' })],
      shaOf,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('skipped');
  });

  it('rejects a skipped race receipt beside a passing one', () => {
    const race = (over: Partial<Receipt>): Receipt =>
      receipt({
        tool: 'race',
        granularity: 'assertion',
        file: 'supabase/tests/race/010.mjs',
        ...over,
      });
    const problems = lib.evaluateReceipts({
      entries: entryFor('supabase/tests/race/010.mjs'),
      receipts: [race({}), race({ status: 'skipped', title: 'x' })],
      shaOf,
    });
    expect(problems[0]).toContain('skipped');
  });

  it('maps vitest pending, todo, disabled and skipped to skipped, and Playwright skipped to skipped', () => {
    const results = lib.parseVitestJson(
      vitestReport([
        [`a ${mk('001')}`, 'pending'],
        [`b ${mk('001')}`, 'todo'],
        [`c ${mk('001')}`, 'disabled'],
        [`d ${mk('001')}`, 'skipped'],
      ]),
      root,
    );
    expect(results.map((r) => r.status)).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
  });
});

const EVIDENCE_MAP = 'tests/contracts/phase-02-slice-09-evidence-map.test.ts';
const GATE_REPORT = 'vitest-evidence-s09.json';
const LIVE = `${mk('269')} executable S09 evidence map ${mk('269')} executes every declared nonbrowser command`;
const liveEntry: Entry[] = [
  { criterion: id('269'), testFiles: [EVIDENCE_MAP] },
];
const evidenceReport = (
  tests: ReadonlyArray<readonly [string, string]>,
): unknown => ({
  testResults: [
    {
      name: join(root, EVIDENCE_MAP),
      assertionResults: tests.map(([fullName, status]) => ({
        fullName,
        status,
      })),
    },
  ],
});

describe('Slice 09 receipts merge a test executed in its own gate across reports', () => {
  const skippedRun = (): string =>
    writeReport(
      'root.json',
      evidenceReport([
        [LIVE, 'skipped'],
        [`gate ${mk('001')} sibling`, 'passed'],
      ]),
    );
  const gateRun = (status: string): string =>
    writeReport(
      GATE_REPORT,
      evidenceReport([
        [LIVE, status],
        [`gate ${mk('001')} sibling`, 'skipped'],
      ]),
    );

  it('keeps the skipped receipt when no report ever executed the test', () => {
    const { receipts } = collect([skippedRun()]);
    const skipped = receipts.filter((r) => r.status === 'skipped');
    expect(skipped.map((r) => r.title)).toEqual([LIVE]);
    const problems = lib.evaluateReceipts({
      entries: liveEntry,
      receipts: receipts.map((r) => ({ ...r, fileSha256: sha })),
      shaOf,
    });
    expect(problems[0]).toContain('skipped');
  });

  it('drops the skipped receipt when the designated gate report executed and passed that same test', () => {
    const { receipts } = collect([skippedRun(), gateRun('passed')]);
    expect(receipts.map((r) => [r.title, r.status])).toEqual([
      [`gate ${mk('001')} sibling`, 'passed'],
      [LIVE, 'passed'],
    ]);
    const problems = lib.evaluateReceipts({
      entries: liveEntry,
      receipts: receipts.map((r) => ({ ...r, fileSha256: sha })),
      shaOf,
    });
    expect(problems).toEqual([]);
  });

  it('still reports a failure when the dedicated gate ran the test and it failed', () => {
    const { receipts } = collect([skippedRun(), gateRun('failed')]);
    expect(receipts.find((r) => r.title === LIVE)?.status).toBe('failed');
  });

  it('does not let a passing duplicate title hide a skipped test inside one report', () => {
    const same = writeReport(
      'dup.json',
      vitestReport([
        [`dup ${mk('001')}`, 'passed'],
        [`dup ${mk('001')}`, 'skipped'],
      ]),
    );
    const { receipts } = collect([same]);
    expect(receipts.map((r) => r.status).sort()).toEqual(['passed', 'skipped']);
  });
});

describe('Slice 09 AC-269 live execution has its own receipted gate', () => {
  const scripts = (
    JSON.parse(
      readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> }
  ).scripts;

  it('writes a JSON report from the dedicated evidence gate so evidence:collect can receipt the live run', () => {
    const gate = scripts['test:evidence:s09'] ?? '';
    expect(gate).toContain('phase-02-slice-09-evidence-map.test.ts');
    expect(gate).toContain('--reporter=json');
    expect(gate).toMatch(/--outputFile\.json=test-results\/\S+\.json/u);
    expect(scripts['validate']).toContain('pnpm test:evidence:s09');
  });
});
