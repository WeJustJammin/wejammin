import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

const independentSessionRunnersOnDisk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory())
      return independentSessionRunnersOnDisk(path);
    return name.endsWith('.mjs') ? [relative(ROOT, path)] : [];
  });

const packageScripts = (
  JSON.parse(read('package.json')) as { scripts: Record<string, string> }
).scripts;

type RaceReceipt = {
  marker: string;
  title: string;
  status: 'passed' | 'failed';
  file: string;
};

const gate = (await import(
  resolve(ROOT, 'infra/run-database-race-runners.mjs')
)) as {
  RACE_RUNNERS: readonly string[];
  RACE_RECEIPTS_PATH: string;
  REQUIRED_RACE_MARKERS: readonly string[];
  countOkLines: (output: string) => number;
  runnerVerdict: (result: { status: number | null; stdout: string }) => {
    passed: boolean;
    assertions: number;
  };
  raceReceiptLines: (result: {
    runner: string;
    status: number | null;
    stdout: string;
    stderr?: string;
  }) => RaceReceipt[];
  missingRequiredMarkers: (receipts: readonly RaceReceipt[]) => string[];
};

describe('independent-session race runners are executed by the database gate', () => {
  it('[P2-S09-AC-424] [P2-S09-AC-586] lists every independent-session .mjs runner under supabase/tests', () => {
    const onDisk = independentSessionRunnersOnDisk(
      resolve(ROOT, 'supabase/tests'),
    ).sort();
    expect([...gate.RACE_RUNNERS].sort()).toEqual(onDisk);
  });

  it('[P2-S09-AC-424] the runner that proves concurrent decisions on one review version is in the gate', () => {
    expect(gate.RACE_RUNNERS).toContain(
      'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
    );
    expect(
      read(
        'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
      ),
    ).toContain('[P2-S09-AC-424]');
  });

  it('[P2-S09-AC-586] the runner that proves concurrent revocations of one grant is in the gate', () => {
    expect(
      read(
        'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
      ),
    ).toContain('[P2-S09-AC-586]');
  });

  it('[P2-S09-AC-424] [P2-S09-AC-586] db:verify, the chain CI runs through db:ci, runs the race runners after the pgTAP suite', () => {
    expect(packageScripts['db:races']).toBe(
      'node infra/run-database-race-runners.mjs',
    );
    const steps = (packageScripts['db:verify'] ?? '').split(' && ');
    // Other database gates (the PostgREST API test) may sit between the steps;
    // what must hold is the order of these five and that none is skipped.
    const required = [
      'pnpm db:reset',
      'pnpm db:lint',
      'pnpm db:test',
      'pnpm db:races',
      'pnpm db:types:check',
    ];
    expect(steps.filter((step) => required.includes(step))).toEqual(required);
    expect(steps.at(0)).toBe('pnpm db:reset');
    expect(steps.at(-1)).toBe('pnpm db:types:check');
    expect(packageScripts['db:ci']).toBe('bash infra/verify-database.sh');
    expect(read('infra/verify-database.sh')).toContain('pnpm db:verify');
    expect(read('.github/workflows/ci.yml')).toContain('pnpm db:ci');
  });

  it('[P2-S09-AC-424] [P2-S09-AC-586] a runner passes only on exit code 0 with at least one ok assertion line', () => {
    expect(gate.countOkLines('# note\nok - one\nok - two\nnot ok - x\n')).toBe(
      2,
    );
    expect(gate.runnerVerdict({ status: 0, stdout: 'ok - a\n' })).toEqual({
      passed: true,
      assertions: 1,
    });
    expect(gate.runnerVerdict({ status: 1, stdout: 'ok - a\n' }).passed).toBe(
      false,
    );
    expect(
      gate.runnerVerdict({ status: null, stdout: 'ok - a\n' }).passed,
    ).toBe(false);
    expect(
      gate.runnerVerdict({ status: 0, stdout: '# nothing\n' }).passed,
    ).toBe(false);
  });

  it('[P2-S09-AC-424] [P2-S09-AC-586] the gate script exists, is executable by node and refuses a missing runner list entry', () => {
    expect(
      existsSync(resolve(ROOT, 'infra/run-database-race-runners.mjs')),
    ).toBe(true);
    const syntax = spawnSync(
      process.execPath,
      ['--check', resolve(ROOT, 'infra/run-database-race-runners.mjs')],
      { encoding: 'utf8' },
    );
    expect(syntax.status).toBe(0);
    for (const runner of gate.RACE_RUNNERS)
      expect(existsSync(resolve(ROOT, runner)), runner).toBe(true);
  });
});

describe('the race gate writes marker receipts the evidence collector reads (AC052, AC097, AC157)', () => {
  const runner = 'supabase/tests/race/010.mjs';

  it('[P2-S09-AC-052] [P2-S09-AC-097] [P2-S09-AC-157] writes JSON lines to one deterministic path under the gitignored test-results directory', () => {
    expect(gate.RACE_RECEIPTS_PATH).toBe('test-results/db-races.jsonl');
    expect(read('.gitignore')).toMatch(/^test-results\/$/mu);
    expect(gate.REQUIRED_RACE_MARKERS).toEqual([
      'P2-S09-AC-052',
      'P2-S09-AC-097',
      'P2-S09-AC-157',
    ]);
  });

  it('[P2-S09-AC-052] [P2-S09-AC-097] [P2-S09-AC-157] turns each marked ok line into one {marker, title, status, file} record per marker', () => {
    const receipts = gate.raceReceiptLines({
      runner,
      status: 0,
      stdout: [
        '# two sessions',
        'ok - [P2-S09-AC-153] [P2-S09-AC-157] the loser got the typed 409',
        'ok - an unmarked assertion',
        'not ok - [P2-S09-AC-052] ignored: only ok lines are receipts',
      ].join('\n'),
    });
    expect(receipts).toEqual([
      {
        marker: 'P2-S09-AC-153',
        title: '[P2-S09-AC-153] [P2-S09-AC-157] the loser got the typed 409',
        status: 'passed',
        file: runner,
      },
      {
        marker: 'P2-S09-AC-157',
        title: '[P2-S09-AC-153] [P2-S09-AC-157] the loser got the typed 409',
        status: 'passed',
        file: runner,
      },
    ]);
  });

  it('[P2-S09-AC-052] [P2-S09-AC-097] [P2-S09-AC-157] a failed runner marks its receipts failed and reports the assertion that threw', () => {
    const receipts = gate.raceReceiptLines({
      runner,
      status: 1,
      stdout: 'ok - [P2-S09-AC-052] first half\n',
      stderr:
        'Error: ASSERTION FAILED: [P2-S09-AC-097] the switch did not block\n',
    });
    expect(receipts.map((r) => [r.marker, r.status])).toEqual([
      ['P2-S09-AC-052', 'failed'],
      ['P2-S09-AC-097', 'failed'],
    ]);
  });

  it('[P2-S09-AC-052] [P2-S09-AC-097] [P2-S09-AC-157] the gate fails when a required lock or serialization criterion has no passed race receipt', () => {
    const passed = (marker: string): RaceReceipt => ({
      marker,
      title: marker,
      status: 'passed',
      file: runner,
    });
    expect(gate.missingRequiredMarkers([])).toEqual(gate.REQUIRED_RACE_MARKERS);
    expect(
      gate.missingRequiredMarkers([
        passed('P2-S09-AC-052'),
        passed('P2-S09-AC-097'),
        { ...passed('P2-S09-AC-157'), status: 'failed' },
      ]),
    ).toEqual(['P2-S09-AC-157']);
    expect(
      gate.missingRequiredMarkers(
        gate.REQUIRED_RACE_MARKERS.map((marker) => passed(marker)),
      ),
    ).toEqual([]);
  });

  it('[P2-S09-AC-052] [P2-S09-AC-097] [P2-S09-AC-157] each required criterion is asserted under its marker by a runner the gate executes', () => {
    for (const marker of gate.REQUIRED_RACE_MARKERS) {
      // A marker carries a receipt only when it opens an assertion message (a string
      // literal that starts with its marker, optionally after other markers).
      const carriers = gate.RACE_RUNNERS.filter((file) =>
        new RegExp(`['"\`](\\[P2-S09-AC-\\d+\\] )*\\[${marker}\\]`, 'u').test(
          read(file),
        ),
      );
      expect(carriers.length, marker).toBeGreaterThan(0);
    }
  });
});
