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

import type { EvidenceCitation } from './phase-02-evidence-ledger';

type Step = {
  id: string;
  tool: string;
  label: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  needsDatabase: boolean;
  resetBefore: boolean;
  outputKind: string;
  output: string;
  runner?: string;
};
type Plan = {
  steps: Step[];
  problems: string[];
  outputs: {
    vitest: string[];
    playwright: string[];
    pgtap: string[];
    races: string[];
  };
  finalReset: boolean;
};
type Outcome = { id: string; outcome: string; status: number | null };
type SpawnResult = { status: number | null; stdout: string; stderr: string };
type PlanLib = {
  planEvidenceRuns: (input: {
    citations: readonly EvidenceCitation[];
    root: string;
    outDir?: string;
    playwrightConfigs?: readonly string[];
    only?: readonly string[] | null;
  }) => Plan;
  entrypointsFor: (root: string, file: string) => string[];
  DEFAULT_PLAYWRIGHT_CONFIGS: readonly string[];
};
type ExecuteLib = {
  executeSteps: (input: {
    steps: readonly Step[];
    root: string;
    finalReset: boolean;
    spawn: (
      command: string,
      args: string[],
      options: { cwd: string; env: Record<string, string | undefined> },
    ) => SpawnResult;
  }) => Outcome[];
  raceVerdict: (input: { status: number | null; stdout: string }) => {
    passed: boolean;
    assertions: number;
  };
};
const planLib =
  (await import('../../scripts/evidence/run-plan-lib.mjs')) as PlanLib;
const executeLib =
  (await import('../../scripts/evidence/run-execute-lib.mjs')) as ExecuteLib;

const root = mkdtempSync(join(tmpdir(), 'evidence-run-plan-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text = 'x\n'): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
put('supabase/tests/entry.sql', '\\ir entry/001.sqlinc\nselect 1;\n');
put('supabase/tests/entry/001.sqlinc');
put('supabase/tests/lonely/001.sqlinc');
put('supabase/tests/other.sql', '\\ir entry/001.sqlinc\n');

const vitest = (file: string): EvidenceCitation => ({
  tool: 'vitest',
  file,
  title: 't',
});
const cites = (...c: EvidenceCitation[]): EvidenceCitation[] => c;
const plan = (citations: EvidenceCitation[], extra = {}): Plan =>
  planLib.planEvidenceRuns({ citations, root, ...extra });
const ids = (p: Plan): string[] => p.steps.map((s) => s.id);

describe('slice evidence run plan', () => {
  it('plans nothing for a ledger that cites nothing', () => {
    expect(plan([])).toEqual({
      steps: [],
      problems: [],
      outputs: { vitest: [], playwright: [], pgtap: [], races: [] },
      finalReset: false,
    });
  });

  it('groups vitest files by the config that runs them, once each and sorted, DB-backed kinds last', () => {
    const p = plan(
      cites(
        vitest('tests/postgrest/b.apispec.ts'),
        vitest('apps/x/b.test.ts'),
        vitest('apps/x/a.test.tsx'),
        vitest('apps/x/b.test.ts'),
        vitest('tests/db-integration/c.dbspec.ts'),
      ),
    );
    expect(ids(p)).toEqual([
      'vitest',
      'vitest-postgrest',
      'vitest-db-integration',
    ]);
    const [unit, api, dbi] = p.steps as [Step, Step, Step];
    expect(unit.command).toBe('pnpm');
    expect(unit.args).toEqual([
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.config.ts',
      'apps/x/a.test.tsx',
      'apps/x/b.test.ts',
      '--reporter=json',
      '--outputFile=test-results/evidence/vitest.json',
      '--retry=0',
    ]);
    expect([unit.needsDatabase, api.needsDatabase, dbi.needsDatabase]).toEqual([
      false,
      true,
      true,
    ]);
    expect(api.args).toContain('vitest.postgrest.config.ts');
    expect(dbi.args).toContain('vitest.db-integration.config.ts');
    expect(p.outputs.vitest).toEqual([
      'test-results/evidence/vitest.json',
      'test-results/evidence/vitest-postgrest.json',
      'test-results/evidence/vitest-db-integration.json',
    ]);
  });

  it('puts non-database steps first, resets the database before each database step, and once more at the end', () => {
    const p = plan(
      cites(
        vitest('tests/postgrest/b.apispec.ts'),
        vitest('apps/x/a.test.ts'),
        { tool: 'pgtap', file: 'supabase/tests/entry.sql', title: 't' },
        { tool: 'race', file: 'supabase/tests/race/010.mjs', title: 't' },
      ),
    );
    expect(ids(p)).toEqual([
      'vitest',
      'pgtap',
      'vitest-postgrest',
      'race:supabase/tests/race/010.mjs',
    ]);
    expect(p.steps.map((s) => s.resetBefore)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(p.finalReset).toBe(true);
    expect(plan(cites(vitest('apps/x/a.test.ts'))).finalReset).toBe(false);
  });

  it('runs a cited pgTAP file through its entrypoint: itself for a .sql, every including .sql for a .sqlinc', () => {
    expect(planLib.entrypointsFor(root, 'supabase/tests/entry.sql')).toEqual([
      'supabase/tests/entry.sql',
    ]);
    expect(
      planLib.entrypointsFor(root, 'supabase/tests/entry/001.sqlinc'),
    ).toEqual(['supabase/tests/entry.sql', 'supabase/tests/other.sql']);
    expect(
      planLib.entrypointsFor(root, 'supabase/tests/lonely/001.sqlinc'),
    ).toEqual([]);
    const p = plan(
      cites(
        { tool: 'pgtap', file: 'supabase/tests/entry/001.sqlinc', title: 'a' },
        { tool: 'pgtap', file: 'supabase/tests/entry.sql', title: 'b' },
      ),
    );
    const step = p.steps[0] as Step;
    expect(step.command).toBe(process.execPath);
    expect(step.args).toEqual([
      'infra/run-pgtap-verbose.mjs',
      '--out',
      'test-results/evidence/pgtap.tap',
      'supabase/tests/entry.sql',
      'supabase/tests/other.sql',
    ]);
    expect(p.outputs.pgtap).toEqual(['test-results/evidence/pgtap.tap']);
  });

  it('refuses to plan a cited .sqlinc that no .sql includes, a missing file and a file no tool can run', () => {
    const p = plan(
      cites(
        { tool: 'pgtap', file: 'supabase/tests/lonely/001.sqlinc', title: 'a' },
        { tool: 'pgtap', file: 'supabase/tests/nope.sql', title: 'b' },
        vitest('apps/x/readme.md'),
        { tool: 'race', file: 'scripts/x.mjs', title: 'c' },
        { tool: 'jest', file: 'a', title: 'd' } as unknown as EvidenceCitation,
      ),
    );
    expect(p.problems).toEqual([
      'pgtap supabase/tests/lonely/001.sqlinc: no supabase/tests/**/*.sql includes this file, so no entrypoint can run it',
      'pgtap supabase/tests/nope.sql: file does not exist',
      'vitest apps/x/readme.md: no vitest config runs this kind of file',
      'race scripts/x.mjs: a race runner must be a .mjs under supabase/tests/',
      'jest a: unknown tool',
    ]);
  });

  it('runs each Playwright spec through every configured config, marking the real-route config as database-backed', () => {
    const p = plan(
      cites(
        {
          tool: 'playwright',
          file: 'tests/e2e/b.spec.ts',
          title: 't',
          project: 'chrome',
        },
        {
          tool: 'playwright',
          file: 'tests/e2e/a.spec.ts',
          title: 't',
          project: 'chrome',
        },
      ),
    );
    expect(planLib.DEFAULT_PLAYWRIGHT_CONFIGS).toEqual([
      'playwright.config.ts',
      'playwright.s09-real.config.ts',
    ]);
    expect(ids(p)).toEqual([
      'playwright:playwright.config.ts',
      'playwright:playwright.s09-real.config.ts',
    ]);
    const [functional, real] = p.steps as [Step, Step];
    expect(functional.command).toBe('pnpm');
    expect(functional.args).toEqual([
      'exec',
      'playwright',
      'test',
      '--config=playwright.config.ts',
      '--reporter=json',
      '--retries=0',
      '--forbid-only',
      // Playwright empties its output directory before a run; a dedicated
      // directory keeps the reports of earlier steps (vitest, pgTAP, races).
      '--output=test-results/evidence/playwright-artifacts-playwright.config',
      // A config that selects none of the cited specs is not a failure.
      '--pass-with-no-tests',
      'tests/e2e/a.spec.ts',
      'tests/e2e/b.spec.ts',
    ]);
    expect(real.args).toContain(
      '--output=test-results/evidence/playwright-artifacts-playwright.s09-real.config',
    );
    expect(functional.env).toEqual({
      PLAYWRIGHT_JSON_OUTPUT_NAME:
        'test-results/evidence/playwright-playwright.config.json',
    });
    expect([functional.needsDatabase, real.needsDatabase]).toEqual([
      false,
      true,
    ]);
    const custom = plan(
      cites({
        tool: 'playwright',
        file: 'tests/e2e/a.spec.ts',
        title: 't',
        project: 'chrome',
      }),
      { playwrightConfigs: ['playwright.custom.config.ts'] },
    );
    expect(ids(custom)).toEqual(['playwright:playwright.custom.config.ts']);
  });

  it('plans one database step per cited race runner and writes the output directory it is told to', () => {
    const p = plan(
      cites(
        { tool: 'race', file: 'supabase/tests/race/011.mjs', title: 'b' },
        { tool: 'race', file: 'supabase/tests/race/010.mjs', title: 'a' },
        { tool: 'race', file: 'supabase/tests/race/010.mjs', title: 'a2' },
      ),
      { outDir: 'out/dir' },
    );
    expect(
      p.steps.map((s) => [s.id, s.command, s.args, s.output, s.outputKind]),
    ).toEqual([
      [
        'race:supabase/tests/race/010.mjs',
        process.execPath,
        ['supabase/tests/race/010.mjs'],
        'out/dir/races.out',
        'races',
      ],
      [
        'race:supabase/tests/race/011.mjs',
        process.execPath,
        ['supabase/tests/race/011.mjs'],
        'out/dir/races.out',
        'races',
      ],
    ]);
    expect(p.outputs.races).toEqual(['out/dir/races.out']);
  });

  it('keeps only the tools named by --only', () => {
    const all = cites(vitest('apps/x/a.test.ts'), {
      tool: 'race',
      file: 'supabase/tests/race/010.mjs',
      title: 'a',
    });
    expect(ids(plan(all, { only: ['race'] }))).toEqual([
      'race:supabase/tests/race/010.mjs',
    ]);
    expect(ids(plan(all, { only: ['vitest'] }))).toEqual(['vitest']);
    expect(plan(all, { only: ['pgtap'] }).steps).toEqual([]);
  });
});

describe('slice evidence execution', () => {
  const step = (over: Partial<Step>): Step => ({
    id: 'vitest',
    tool: 'vitest',
    label: 'l',
    command: 'pnpm',
    args: ['x'],
    env: {},
    needsDatabase: false,
    resetBefore: false,
    outputKind: 'vitest',
    output: 'out/vitest.json',
    ...over,
  });
  const fake = (script: (command: string, args: string[]) => SpawnResult) => {
    const calls: string[] = [];
    const spawn = (command: string, args: string[]): SpawnResult => {
      calls.push(
        `${command === process.execPath ? 'node' : command} ${args.join(' ')}`,
      );
      return script(command, args);
    };
    return { spawn, calls };
  };
  const ok: SpawnResult = { status: 0, stdout: '', stderr: '' };

  it('runs steps in order, keeps going after a failing test run, and resets the database around database steps', () => {
    const { spawn, calls } = fake((command, args) =>
      args[0] === 'exec' && command === 'pnpm' && args[1] === 'vitest'
        ? { ...ok, status: 1 }
        : ok,
    );
    const outcomes = executeLib.executeSteps({
      root,
      finalReset: true,
      spawn,
      steps: [
        step({ id: 'vitest', args: ['exec', 'vitest', 'run'] }),
        step({
          id: 'pgtap',
          tool: 'pgtap',
          command: process.execPath,
          args: ['infra/run-pgtap-verbose.mjs'],
          needsDatabase: true,
          resetBefore: true,
          outputKind: 'pgtap',
          output: 'out/pgtap.tap',
        }),
      ],
    });
    expect(calls).toEqual([
      'pnpm exec vitest run',
      'pnpm db:reset',
      'node infra/run-pgtap-verbose.mjs',
      'pnpm db:reset',
    ]);
    expect(outcomes.map((o) => [o.id, o.outcome, o.status])).toEqual([
      ['vitest', 'failed', 1],
      ['pgtap', 'passed', 0],
    ]);
  });

  it('classifies a Playwright run that found no tests of the cited specs as not matched, never as a failure', () => {
    const { spawn } = fake(() => ({
      status: 1,
      stdout: '',
      stderr: 'Error: No tests found',
    }));
    const [outcome] = executeLib.executeSteps({
      root,
      finalReset: false,
      spawn,
      steps: [
        step({
          id: 'playwright:a',
          tool: 'playwright',
          outputKind: 'playwright',
          output: 'out/missing.json',
        }),
      ],
    });
    expect(outcome?.outcome).toBe('no-tests');
  });

  it('writes a race runner stdout and its PASS or FAIL verdict line into the shared races output', () => {
    mkdirSync(join(root, 'out'), { recursive: true });
    rmSync(join(root, 'out/races.out'), { force: true });
    const runs: Record<string, SpawnResult> = {
      'supabase/tests/race/010.mjs': {
        status: 0,
        stdout: 'ok - serialized\nok - blocked\n',
        stderr: '',
      },
      'supabase/tests/race/011.mjs': {
        status: 1,
        stdout: 'ok - first\n',
        stderr: 'ASSERTION FAILED: x',
      },
    };
    const { spawn } = fake((command, args) => runs[args[0] ?? ''] ?? ok);
    const race = (runner: string): Step =>
      step({
        id: `race:${runner}`,
        tool: 'race',
        command: process.execPath,
        args: [runner],
        runner,
        needsDatabase: true,
        resetBefore: true,
        outputKind: 'races',
        output: 'out/races.out',
      });
    const outcomes = executeLib.executeSteps({
      root,
      finalReset: true,
      spawn,
      steps: [
        race('supabase/tests/race/010.mjs'),
        race('supabase/tests/race/011.mjs'),
      ],
    });
    expect(outcomes.map((o) => o.outcome)).toEqual(['passed', 'failed']);
    expect(readFileSync(join(root, 'out/races.out'), 'utf8')).toBe(
      [
        'ok - serialized',
        'ok - blocked',
        'PASS supabase/tests/race/010.mjs exit=0 ok=2',
        'ok - first',
        'FAIL supabase/tests/race/011.mjs exit=1 ok=1',
        '',
      ].join('\n'),
    );
  });

  it('judges a race runner by exit code 0 and at least one ok line', () => {
    expect(executeLib.raceVerdict({ status: 0, stdout: 'ok - a\n' })).toEqual({
      passed: true,
      assertions: 1,
    });
    expect(executeLib.raceVerdict({ status: 0, stdout: 'quiet\n' })).toEqual({
      passed: false,
      assertions: 0,
    });
    expect(executeLib.raceVerdict({ status: 1, stdout: 'ok - a\n' })).toEqual({
      passed: false,
      assertions: 1,
    });
    expect(
      executeLib.raceVerdict({ status: null, stdout: 'ok - a\n' }).passed,
    ).toBe(false);
  });

  it('aborts the remaining database steps when a reset fails, and still reports every step', () => {
    const { spawn, calls } = fake((command, args) =>
      args[0] === 'db:reset' ? { status: 1, stdout: '', stderr: 'boom' } : ok,
    );
    const db = (id: string): Step =>
      step({
        id,
        tool: 'pgtap',
        needsDatabase: true,
        resetBefore: true,
        outputKind: 'pgtap',
        output: 'out/pgtap.tap',
      });
    const outcomes = executeLib.executeSteps({
      root,
      finalReset: true,
      spawn,
      steps: [step({ id: 'vitest' }), db('pgtap'), db('race')],
    });
    expect(outcomes.map((o) => [o.id, o.outcome])).toEqual([
      ['vitest', 'passed'],
      ['pgtap', 'aborted'],
      ['race', 'aborted'],
    ]);
    expect(calls.filter((c) => c === 'pnpm db:reset')).toHaveLength(1);
  });

  it('writes a log per step next to its output', () => {
    const { spawn } = fake(() => ({
      status: 0,
      stdout: 'hello',
      stderr: 'warn',
    }));
    executeLib.executeSteps({
      root,
      finalReset: false,
      spawn,
      steps: [step({ id: 'vitest', output: 'logs/vitest.json' })],
    });
    expect(readFileSync(join(root, 'logs/vitest.log'), 'utf8')).toContain(
      'hello',
    );
    expect(readFileSync(join(root, 'logs/vitest.log'), 'utf8')).toContain(
      'warn',
    );
  });
});
