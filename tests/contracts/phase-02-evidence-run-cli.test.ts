import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

type Options = {
  slice: string;
  only: string[] | null;
  outDir: string;
  dryRun: boolean;
  collect: boolean;
  lockWait: number;
  playwrightConfigs: readonly string[];
};
const runnerLib =
  (await import('../../scripts/evidence/run-slice-evidence.mjs')) as {
    parseRunnerArgs: (argv: string[], cwd: string) => Options;
  };

const root = mkdtempSync(join(tmpdir(), 'evidence-run-cli-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string, mode?: number): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
  if (mode !== undefined) chmodSync(join(root, file), mode);
};
const script = resolve(
  import.meta.dirname,
  '../../scripts/evidence/run-slice-evidence.mjs',
);
const fakeLog = join(root, 'fake.log');
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [script, '--root', root, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_LOG: fakeLog,
      ...env,
    },
  });

const ledger = (citations: string): string =>
  [
    "import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';",
    'export const S10_EVIDENCE_LEDGER: readonly EvidenceLedgerEntry[] = [',
    `  { criterion: 'P2-S10-AC-001', text: 'x', clauses: [{ text: 'x', citations: [${citations}] }], status: 'unverified', limitation: 'not yet' },`,
    '];',
    '',
  ].join('\n');
const LEDGER = 'tests/contracts/phase-02-slice-10-evidence-ledger.ts';
const RECEIPTS = 'tests/contracts/phase-02-slice-10-receipts.generated.jsonl';
const receiptsOf = (): Record<string, unknown>[] =>
  readFileSync(join(root, RECEIPTS), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

put('apps/x/a.test.ts', 'export {};\n');
put('supabase/tests/entry.sql', "select ok(true, 'entry assertion');\n");
put('supabase/tests/race/010.mjs', "console.log('ok - serialized');\n");
put('supabase/tests/race/011.mjs', 'process.exit(1);\n');
// Fixture stand-ins for the repository's pgTAP runner and for the two external tools.
put(
  'infra/run-pgtap-verbose.mjs',
  [
    "import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';",
    "import { dirname } from 'node:path';",
    'const out = process.argv[process.argv.indexOf("--out") + 1];',
    'mkdirSync(dirname(out), { recursive: true });',
    'writeFileSync(out, `${process.cwd()}/supabase/tests/entry.sql .. \\n1..1\\nok 1 - entry assertion\\n`);',
    'appendFileSync(process.env.FAKE_LOG, `pgtap ${process.argv.slice(2).join(" ")}\\n`);',
    '',
  ].join('\n'),
);
put(
  'bin/pnpm',
  [
    '#!/bin/sh',
    'if [ "$1" = "db:reset" ]; then echo reset >> "$FAKE_LOG"; exit 0; fi',
    'if [ "$1" = "exec" ] && [ "$2" = "vitest" ]; then',
    '  for a in "$@"; do case "$a" in --outputFile=*) out="${a#--outputFile=}";; esac; done',
    '  mkdir -p "$(dirname "$out")"',
    '  printf \'%s\' "$FAKE_VITEST_JSON" > "$out"',
    '  echo "vitest $*" >> "$FAKE_LOG"',
    '  exit "${FAKE_VITEST_STATUS:-0}"',
    'fi',
    'exit 1',
    '',
  ].join('\n'),
  0o755,
);
put(
  'bin/flock',
  [
    '#!/bin/sh',
    'echo "flock $1 $2 $3 $4 $5" >> "$FAKE_LOG"',
    '[ -n "$FAKE_FLOCK_STATUS" ] && exit "$FAKE_FLOCK_STATUS"',
    'shift 5',
    'exec "$@"',
    '',
  ].join('\n'),
  0o755,
);
const vitestReport = (status: string): string =>
  JSON.stringify({
    testResults: [
      {
        name: join(root, 'apps/x/a.test.ts'),
        assertionResults: [{ fullName: 'suite cited', status }],
      },
    ],
  });
const citeAll = [
  "{ tool: 'vitest', file: 'apps/x/a.test.ts', title: 'suite cited' }",
  "{ tool: 'pgtap', file: 'supabase/tests/entry.sql', title: 'entry assertion' }",
  "{ tool: 'race', file: 'supabase/tests/race/010.mjs', title: 'serialized' }",
].join(', ');

describe('run-slice-evidence: arguments', () => {
  it('reads the slice, the tool filter, the lock wait and the Playwright configs', () => {
    const options = runnerLib.parseRunnerArgs(
      [
        '--slice',
        '10',
        '--only',
        'vitest,race',
        '--lock-wait',
        '5',
        '--dry-run',
        '--no-collect',
        '--playwright-config',
        'a.config.ts',
      ],
      '/r',
    );
    expect(options).toMatchObject({
      slice: '10',
      only: ['vitest', 'race'],
      lockWait: 5,
      dryRun: true,
      collect: false,
      playwrightConfigs: ['a.config.ts'],
      outDir: 'test-results/evidence',
    });
  });

  it('rejects a missing slice, an unknown tool and a bad lock wait', () => {
    expect(() => runnerLib.parseRunnerArgs([], '/r')).toThrow(/slice/u);
    expect(() =>
      runnerLib.parseRunnerArgs(['--slice', '10', '--only', 'jest'], '/r'),
    ).toThrow(/unknown tool/u);
    expect(() =>
      runnerLib.parseRunnerArgs(['--slice', '10', '--lock-wait', '-1'], '/r'),
    ).toThrow(/lock-wait/u);
  });
});

describe('run-slice-evidence: planning and refusals', () => {
  it('prints the plan and runs nothing with --dry-run', () => {
    put(LEDGER, ledger(citeAll));
    rmSync(fakeLog, { force: true });
    const result = run(['--slice', '10', '--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as {
      steps: { id: string }[];
      finalReset: boolean;
    };
    expect(plan.steps.map((s) => s.id)).toEqual([
      'vitest',
      'pgtap',
      'race:supabase/tests/race/010.mjs',
    ]);
    expect(plan.finalReset).toBe(true);
    expect(existsSync(fakeLog)).toBe(false);
  });

  it('exits 2 for a missing slice, an unknown slice ledger, a broken ledger and an unplannable citation', () => {
    expect(run([]).status).toBe(2);
    expect(run(['--slice', '11']).stderr).toContain('no evidence ledger');
    put(
      'tests/contracts/phase-02-slice-12-evidence-ledger.ts',
      'export const other = [];\n',
    );
    expect(run(['--slice', '12']).stderr).toContain('S12_EVIDENCE_LEDGER');
    put(
      LEDGER,
      ledger("{ tool: 'pgtap', file: 'supabase/tests/nope.sql', title: 't' }"),
    );
    const unplannable = run(['--slice', '10']);
    expect(unplannable.status).toBe(2);
    expect(unplannable.stderr).toContain(
      'cannot plan: pgtap supabase/tests/nope.sql: file does not exist',
    );
  });

  it('writes empty receipts and exits 0 when the ledger cites nothing', () => {
    put(LEDGER, ledger(''));
    const result = run(['--slice', '10']);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(root, RECEIPTS), 'utf8')).toBe('');
  });
});

describe('run-slice-evidence: end to end through fake tools', () => {
  it('runs plain steps, then the database steps under flock with resets, then collects receipts for every cited test', () => {
    put(LEDGER, ledger(citeAll));
    rmSync(fakeLog, { force: true });
    const result = run(
      [
        '--slice',
        '10',
        '--lock-file',
        join(root, 'db.lock'),
        '--lock-wait',
        '7',
      ],
      {
        FAKE_VITEST_JSON: vitestReport('passed'),
      },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const log = readFileSync(fakeLog, 'utf8').trim().split('\n');
    expect(log).toEqual([
      'vitest exec vitest run --config vitest.config.ts apps/x/a.test.ts --reporter=json --outputFile=test-results/evidence/vitest.json --retry=0',
      `flock --wait 7 -E 99 ${join(root, 'db.lock')}`,
      'reset',
      'pgtap --out test-results/evidence/pgtap.tap supabase/tests/entry.sql',
      'reset',
      'reset',
    ]);
    const rows = receiptsOf();
    expect(rows.map((r) => [r.tool, r.title, r.status])).toEqual([
      ['pgtap', 'entry assertion', 'passed'],
      ['race', 'serialized', 'passed'],
      ['vitest', 'suite cited', 'passed'],
    ]);
    expect(
      rows.every(
        (r) => typeof r.fileSha256 === 'string' && !('criterion' in r),
      ),
    ).toBe(true);
    expect(result.stdout).toContain('PASSED   vitest');
    expect(result.stdout).toContain(
      'PASSED   race:supabase/tests/race/010.mjs',
    );
  });

  it('still writes receipts when a test run fails, records the failure, and exits 1', () => {
    put(
      LEDGER,
      ledger(
        "{ tool: 'vitest', file: 'apps/x/a.test.ts', title: 'suite cited' }",
      ),
    );
    const result = run(['--slice', '10'], {
      FAKE_VITEST_JSON: vitestReport('failed'),
      FAKE_VITEST_STATUS: '1',
    });
    expect(result.status).toBe(1);
    expect(receiptsOf().map((r) => r.status)).toEqual(['failed']);
    expect(result.stdout).toContain('FAILED   vitest');
  });

  it('exits 3 when the database lock cannot be taken, and still reports the plain steps', () => {
    put(LEDGER, ledger(citeAll));
    const result = run(['--slice', '10', '--lock-wait', '1'], {
      FAKE_VITEST_JSON: vitestReport('passed'),
      FAKE_FLOCK_STATUS: '99',
    });
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('could not take the database lock');
  });

  it('exits 1 when a database step fails, and still collects the receipts of the steps that ran', () => {
    put(
      LEDGER,
      ledger(
        [
          "{ tool: 'race', file: 'supabase/tests/race/010.mjs', title: 'serialized' }",
          "{ tool: 'race', file: 'supabase/tests/race/011.mjs', title: 'never printed' }",
        ].join(', '),
      ),
    );
    const result = run(['--slice', '10', '--lock-file', join(root, 'db.lock')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'FAILED   race:supabase/tests/race/011.mjs',
    );
    expect(receiptsOf().map((r) => [r.title, r.status])).toEqual([
      ['serialized', 'passed'],
    ]);
  });

  it('collects nothing and exits 1 when --no-collect is combined with a failing step', () => {
    put(
      LEDGER,
      ledger(
        "{ tool: 'vitest', file: 'apps/x/a.test.ts', title: 'suite cited' }",
      ),
    );
    const result = run(['--slice', '10', '--no-collect'], {
      FAKE_VITEST_JSON: vitestReport('failed'),
      FAKE_VITEST_STATUS: '1',
    });
    expect(result.status).toBe(1);
  });
});
