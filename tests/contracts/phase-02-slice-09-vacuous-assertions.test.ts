import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ROOT,
  read,
} from './phase-02-slice-09-amendment-evidence.test-support';

/**
 * Assertions that cannot fail. A guard that asserts nothing is worse than no
 * guard: it reads as proof. Two nets: a static scan for the shapes that are
 * always true, and a run of the guards with vitest's requireAssertions option,
 * which fails any test (an empty loop, a branch never taken) that executed no
 * assertion at all.
 */
type Finding = { line: number; reason: string };

const RULES: readonly { reason: string; pattern: RegExp }[] = [
  { reason: 'empty slice', pattern: /\.slice\(\s*0\s*,\s*0\s*\)/u },
  {
    reason: 'toContain of an empty string',
    pattern: /toContain\(\s*(?:''|""|``)\s*\)/u,
  },
  {
    reason: 'expect of a literal',
    pattern: /expect\(\s*(?:true|false|null|undefined|\d+)\s*[,)]/u,
  },
  {
    reason: 'expect of a value against itself',
    pattern: /expect\(\s*([\w.]+)\s*\)\.(?:toBe|toEqual)\(\s*\1\s*\)/u,
  },
  {
    reason: 'length or size is never below zero',
    pattern: /(?:length|size)\b[^\n]*\.toBeGreaterThanOrEqual\(\s*0\s*\)/u,
  },
  {
    reason: 'or-true inside an assertion',
    pattern: /expect\([^\n]*\|\|\s*true\b/u,
  },
  {
    reason: 'loop over an empty literal',
    pattern: /for\s*\([^)]*\bof\s*\[\s*\]\s*\)/u,
  },
  {
    reason: 'filter that keeps nothing',
    pattern: /filter\(\s*\(\)\s*=>\s*false/u,
  },
  {
    reason: 'toMatch of a pattern that matches everything',
    pattern: /toMatch\(\s*\/(?:\^|\.\*|\(\?:\))\/[a-z]*\s*\)/u,
  },
];

const vacuousAssertions = (source: string): Finding[] =>
  source.split(/\r?\n/u).flatMap((text, index) => {
    if (/^\s*(?:\/\/|\*)/u.test(text)) return [];
    return RULES.filter(({ pattern }) => pattern.test(text)).map(
      ({ reason }) => ({ line: index + 1, reason }),
    );
  });

const guardFiles = readdirSync(resolve(ROOT, 'tests/contracts'))
  .filter((name) => /^phase-02-slice-09-.*\.test(?:-support)?\.ts$/u.test(name))
  .map((name) => `tests/contracts/${name}`)
  .sort();

describe('Slice 09 guards contain no assertion that cannot fail', () => {
  it('[P2-S09-AC-274] finds no always-true assertion shape in any Slice 09 guard file', () => {
    expect(guardFiles.length).toBeGreaterThan(30);
    const found = guardFiles.flatMap((file) =>
      vacuousAssertions(read(file)).map(
        ({ line, reason }) => `${file}:${String(line)} ${reason}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('[P2-S09-AC-274] detects each always-true shape it is built to catch', () => {
    const shapes: readonly [string, string][] = [
      ['empty slice', 'x.toContain(a.slice(0, ' + '0));'],
      ['toContain of an empty string', 'expect(t).toContain(' + "'');"],
      ['expect of a literal', 'expect(' + 'true).toBe(true);'],
      ['expect of a value against itself', 'expect(a.b).toBe(' + 'a.b);'],
      [
        'length or size is never below zero',
        'expect(list.length).toBeGreaterThanOrEqual(' + '0);',
      ],
      [
        'or-true inside an assertion',
        'expect(a === b ||' + ' true).toBe(true);',
      ],
      ['loop over an empty literal', 'for (const x of ' + '[]) {}'],
      ['filter that keeps nothing', 'list.filter(() =>' + ' false);'],
      [
        'toMatch of a pattern that matches everything',
        'expect(t).toMatch(/' + '.*/);',
      ],
    ];
    for (const [reason, line] of shapes) {
      expect(
        vacuousAssertions(line).map((finding) => finding.reason),
        line,
      ).toContain(reason);
    }
    expect(vacuousAssertions('expect(list).toHaveLength(3);')).toEqual([]);
    expect(vacuousAssertions('// expect(' + 'true).toBe(true)')).toEqual([]);
  });

  it('[P2-S09-AC-274] runs the guards with requireAssertions and no test finishes without asserting', () => {
    const files = guardFiles.filter(
      (file) =>
        !file.endsWith('.test-support.ts') &&
        !file.includes('vacuous-assertions') &&
        !file.includes('-ac265-') &&
        !file.includes('-ac211-'),
    );
    expect(files.length).toBeGreaterThan(20);
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('NODE_V8_COVERAGE') || key.startsWith('VITEST')) {
        delete env[key];
      }
    }
    const run = spawnSync(
      process.execPath,
      [
        resolve(ROOT, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--reporter=json',
        '--expect.requireAssertions',
        '--coverage.enabled=false',
        '-t',
        '^(?!.*executes every declared nonbrowser)',
        ...files,
      ],
      { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 },
    );
    const report = JSON.parse(run.stdout.slice(run.stdout.indexOf('{'))) as {
      testResults: {
        name: string;
        assertionResults: {
          fullName: string;
          status: string;
          failureMessages: string[];
        }[];
      }[];
    };
    const vacuous = report.testResults.flatMap((suite) =>
      suite.assertionResults
        .filter(({ failureMessages }) =>
          failureMessages.some((message) =>
            /expected any number of assertion, but got none/u.test(message),
          ),
        )
        .map(({ fullName }) => `${suite.name}: ${fullName}`),
    );
    expect(vacuous).toEqual([]);
    expect(report.testResults.length).toBe(files.length);
  }, 180_000);
});
