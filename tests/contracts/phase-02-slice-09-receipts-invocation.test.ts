import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

type Result = {
  tool: string;
  granularity: string;
  file: string;
  title: string;
  status: string;
  invocation?: string;
};
type Receipt = Omit<Result, 'invocation'> & {
  criterion: string;
  fileSha256: string | null;
};
type Lib = {
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
  mergeReports: (reports: Result[][]) => Result[];
  SKIP_REPLACEMENTS: readonly {
    tool: string;
    gate: string;
    file: string;
  }[];
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

const root = mkdtempSync(join(tmpdir(), 's09-receipts-invocation-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
const EVIDENCE_MAP = 'tests/contracts/phase-02-slice-09-evidence-map.test.ts';
const GATE = 'vitest-evidence-s09.json';
const AC269 = `phase 02 slice 09 evidence map ${mk('269')} executes every declared nonbrowser command`;
put(EVIDENCE_MAP, 'export {};\n');
put('apps/x/a.test.ts', 'export {};\n');
put('tests/e2e/a.spec.ts', 'export {};\n');

const vitestReport = (
  file: string,
  tests: ReadonlyArray<readonly [string, string]>,
): unknown => ({
  testResults: [
    {
      name: join(root, file),
      assertionResults: tests.map(([fullName, status]) => ({
        fullName,
        status,
      })),
    },
  ],
});
const playwrightReport = (
  configFile: string,
  tests: ReadonlyArray<readonly [string, string, string]>,
): unknown => ({
  config: { configFile },
  suites: [
    {
      title: 'a.spec.ts',
      file: 'a.spec.ts',
      specs: tests.map(([title, projectName, status]) => ({
        title,
        file: 'a.spec.ts',
        tests: [{ projectName, status }],
      })),
    },
  ],
});
const write = (name: string, json: unknown): string => {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(json));
  return path;
};
const collect = (vitest: string[], playwright: string[] = []) =>
  collector.collect({
    root,
    vitest,
    pgtap: [],
    playwright,
    races: [],
    testDir: 'tests/e2e',
  });
const statuses = (receipts: Receipt[]): string[] =>
  receipts.map((r) => `${r.title}|${r.status}`).sort();

describe('receipt results carry a stable invocation identity', () => {
  it('names a vitest result by the report (gate) it came from', () => {
    const [result] = lib.parseVitestJson(
      vitestReport('apps/x/a.test.ts', [[`a ${mk('001')}`, 'passed']]),
      root,
      GATE,
    );
    expect(result?.invocation).toBe(GATE);
  });

  it('names a Playwright result by config file and project', () => {
    const results = lib.parsePlaywrightJson(
      playwrightReport('/any/where/playwright.config.ts', [
        [`one ${mk('001')}`, 'chrome', 'passed'],
        [`two ${mk('001')}`, 'webkit', 'skipped'],
      ]),
      'tests/e2e',
      'report.json',
    );
    expect(results.map((r) => r.invocation)).toEqual([
      'playwright.config.ts#chrome',
      'playwright.config.ts#webkit',
    ]);
  });

  it('falls back to the report name when a Playwright report carries no config file', () => {
    const results = lib.parsePlaywrightJson(
      {
        suites: [
          {
            title: 'a.spec.ts',
            file: 'a.spec.ts',
            specs: [
              {
                title: `one ${mk('001')}`,
                file: 'a.spec.ts',
                tests: [{ status: 'expected' }],
              },
            ],
          },
        ],
      },
      'tests/e2e',
      'report.json',
    );
    expect(results[0]?.invocation).toBe('report.json#');
  });
});

describe('a skip is never suppressed by a different invocation', () => {
  it('keeps a Playwright skip in one project when another project passed the same test', () => {
    const chrome = write(
      'pw-chrome.json',
      playwrightReport('playwright.config.ts', [
        [`case ${mk('001')}`, 'chrome', 'expected'],
      ]),
    );
    const webkit = write(
      'pw-webkit.json',
      playwrightReport('playwright.config.ts', [
        [`case ${mk('001')}`, 'webkit', 'skipped'],
      ]),
    );
    const { receipts } = collect([], [chrome, webkit]);
    expect(statuses(receipts)).toEqual([
      `case ${mk('001')}|passed`,
      `case ${mk('001')}|skipped`,
    ]);
  });

  it('keeps a Playwright skip in one config when another config executed the same test', () => {
    const functional = write(
      'pw-functional.json',
      playwrightReport('playwright.config.ts', [
        [`case ${mk('001')}`, 'chrome', 'skipped'],
      ]),
    );
    const real = write(
      'pw-real.json',
      playwrightReport('playwright.s09-real.config.ts', [
        [`case ${mk('001')}`, 'chrome', 'expected'],
      ]),
    );
    const { receipts } = collect([], [functional, real]);
    expect(statuses(receipts)).toEqual([
      `case ${mk('001')}|passed`,
      `case ${mk('001')}|skipped`,
    ]);
  });

  it('keeps a vitest skip when the executing report is not the designated gate', () => {
    const ordinary = write(
      'ordinary.json',
      vitestReport(EVIDENCE_MAP, [[AC269, 'skipped']]),
    );
    const other = write(
      'some-other-gate.json',
      vitestReport(EVIDENCE_MAP, [[AC269, 'passed']]),
    );
    const { receipts } = collect([ordinary, other]);
    expect(statuses(receipts)).toEqual([`${AC269}|passed`, `${AC269}|skipped`]);
  });

  it('keeps a skip on a test the allowlist does not name, even against the gate report', () => {
    const title = `phase 02 slice 09 evidence map ${mk('270')} some other test`;
    const ordinary = write(
      'ordinary-2.json',
      vitestReport(EVIDENCE_MAP, [[title, 'skipped']]),
    );
    const gate = write(GATE, vitestReport(EVIDENCE_MAP, [[title, 'passed']]));
    const { receipts } = collect([ordinary, gate]);
    expect(statuses(receipts)).toEqual([`${title}|passed`, `${title}|skipped`]);
  });

  it('keeps a skip on the allowlisted test when it sits in another file', () => {
    const ordinary = write(
      'ordinary-3.json',
      vitestReport('apps/x/a.test.ts', [[AC269, 'skipped']]),
    );
    const gate = write(
      GATE,
      vitestReport('apps/x/a.test.ts', [[AC269, 'passed']]),
    );
    const { receipts } = collect([ordinary, gate]);
    expect(statuses(receipts)).toEqual([`${AC269}|passed`, `${AC269}|skipped`]);
  });
});

describe('the allowlisted ordinary run and dedicated gate still merge', () => {
  it('lists exactly the AC269 live execution and its test:evidence:s09 gate', () => {
    expect(lib.SKIP_REPLACEMENTS).toEqual([
      expect.objectContaining({
        tool: 'vitest',
        gate: GATE,
        file: EVIDENCE_MAP,
      }),
    ]);
  });

  it('counts the live execution once, as the gate executed it', () => {
    const ordinary = write(
      'ordinary-4.json',
      vitestReport(EVIDENCE_MAP, [
        [AC269, 'skipped'],
        [`sibling ${mk('271')}`, 'passed'],
      ]),
    );
    const gate = write(
      GATE,
      vitestReport(EVIDENCE_MAP, [
        [AC269, 'passed'],
        [`sibling ${mk('271')}`, 'skipped'],
      ]),
    );
    const { receipts } = collect([ordinary, gate]);
    expect(statuses(receipts)).toEqual([
      `${AC269}|passed`,
      `sibling ${mk('271')}|passed`,
    ]);
  });

  it('does not let the gate report launder a skip that sits in the same report', () => {
    const gate = write(
      'dir/' + GATE,
      vitestReport(EVIDENCE_MAP, [
        [AC269, 'passed'],
        [AC269, 'skipped'],
      ]),
    );
    const { receipts } = collect([gate]);
    expect(statuses(receipts)).toEqual([`${AC269}|passed`, `${AC269}|skipped`]);
  });

  it('keeps a skipped test no report executed, gate or not', () => {
    const gate = write(GATE, vitestReport(EVIDENCE_MAP, [[AC269, 'skipped']]));
    expect(statuses(collect([gate]).receipts)).toEqual([`${AC269}|skipped`]);
  });
});
