import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'evidence-identities-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
};
const script = resolve(
  import.meta.dirname,
  '../../scripts/evidence/list-test-identities.mjs',
);
const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, '--root', root, ...args], {
    encoding: 'utf8',
  });

put('apps/x/a.test.ts', 'export {};\n');
put('tests/e2e/a.spec.ts', 'export {};\n');
put(
  'supabase/tests/entry.sql',
  "\\ir entry/001.sqlinc\nselect ok(true, 'entry assertion');\n",
);
put('supabase/tests/entry/001.sqlinc', "select ok(true, 'it''s included');\n");
put(
  'v.json',
  JSON.stringify({
    testResults: [
      {
        name: join(root, 'apps/x/a.test.ts'),
        assertionResults: [
          { fullName: 'suite passes', status: 'passed' },
          { fullName: 'suite is skipped', status: 'pending' },
        ],
      },
    ],
  }),
);
put(
  'p.json',
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
put(
  'db.tap',
  `${join(root, 'supabase/tests/entry.sql')} .. \n1..2\nok 1 - it's included\nnot ok 2 - entry assertion\n`,
);
put(
  'race.out',
  'ok - serialized\nPASS supabase/tests/race/010.mjs exit=0 ok=1\n',
);
const inputs = [
  '--vitest',
  join(root, 'v.json'),
  '--playwright',
  join(root, 'p.json'),
  '--pgtap',
  join(root, 'db.tap'),
  '--races',
  join(root, 'race.out'),
];

describe('list-test-identities', () => {
  it('lists every executed test as tool, status, file, project and exact title, sorted', () => {
    const result = run(...inputs);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trimEnd().split('\n')).toEqual([
      'pgtap\tfailed\tsupabase/tests/entry.sql\t\tentry assertion',
      "pgtap\tpassed\tsupabase/tests/entry/001.sqlinc\t\tit's included",
      'playwright\tpassed\ttests/e2e/a.spec.ts\tchrome\trenders',
      'race\tpassed\tsupabase/tests/race/010.mjs\t\tserialized',
      'vitest\tskipped\tapps/x/a.test.ts\t\tsuite is skipped',
      'vitest\tpassed\tapps/x/a.test.ts\t\tsuite passes',
    ]);
  });

  it('filters by file substring and by status', () => {
    expect(
      run(...inputs, '--file', 'entry/001')
        .stdout.trimEnd()
        .split('\n'),
    ).toEqual([
      "pgtap\tpassed\tsupabase/tests/entry/001.sqlinc\t\tit's included",
    ]);
    expect(run(...inputs, '--status', 'skipped').stdout.trimEnd()).toBe(
      'vitest\tskipped\tapps/x/a.test.ts\t\tsuite is skipped',
    );
  });

  it('prints ready-to-paste ledger citations with --citations, quoting titles safely', () => {
    const result = run(...inputs, '--citations', '--file', 'entry/001');
    expect(result.stdout.trimEnd()).toBe(
      "{ tool: 'pgtap', file: 'supabase/tests/entry/001.sqlinc', title: 'it\\'s included' },",
    );
    const pw = run(...inputs, '--citations', '--file', 'tests/e2e');
    expect(pw.stdout.trimEnd()).toBe(
      "{ tool: 'playwright', file: 'tests/e2e/a.spec.ts', title: 'renders', project: 'chrome' },",
    );
  });

  it('exits 1 with a message when no input is given and 2 on an unreadable input', () => {
    expect(run().status).toBe(1);
    const missing = run('--vitest', join(root, 'nope.json'));
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain('cannot read');
  });

  it('exits 3 for non-verbose pgTAP input, as the collector does', () => {
    put('coarse.log', `${join(root, 'supabase/tests/entry.sql')} ... ok\n`);
    expect(run('--pgtap', join(root, 'coarse.log')).status).toBe(3);
  });
});
