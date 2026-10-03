import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The independent-session race runners. Each opens fresh committed PostgreSQL
 * sessions (one `psql` process per call), so each proves a lock or ordering
 * guarantee that a single-transaction pgTAP file cannot. They are not
 * Supabase-discovered tests: `pnpm db:test` never runs them, so this gate does,
 * as part of `pnpm db:verify` (and therefore `pnpm db:ci`).
 *
 * Every runner must run right after `pnpm db:reset` (it commits rows the pgTAP
 * suites expect absent, and some need an uninitialized owner), so the gate
 * resets before each runner and once more at the end, leaving a clean
 * database for the steps that follow.
 */
export const RACE_RUNNERS = [
  'supabase/tests/phase_02_slice_09_dec108/012-concurrent-commands.mjs',
  'supabase/tests/phase_02_slice_09_dec111/010-admin-reset-race.mjs',
  'supabase/tests/phase_02_slice_09_dec111/011-verification-lock-race.mjs',
  'supabase/tests/phase_02_slice_09_dec111/012-settle-race.mjs',
  'supabase/tests/phase_02_slice_09_scan/010-entry-lock-race.mjs',
  'supabase/tests/phase_02_slice_09_schema/009c-independent-sessions.mjs',
];

export const countOkLines = (output) =>
  output.split('\n').filter((line) => line.startsWith('ok - ')).length;

/** A runner passes on exit code 0 and at least one asserted `ok -` line. */
export const runnerVerdict = ({ status, stdout }) => {
  const assertions = countOkLines(stdout);
  return { passed: status === 0 && assertions > 0, assertions };
};

const resetDatabase = () => {
  const result = spawnSync('pnpm', ['db:reset'], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (result.status !== 0) {
    console.error('pnpm db:reset failed; the race runners cannot run.');
    process.exit(1);
  }
};

const main = () => {
  const failures = [];
  for (const runner of RACE_RUNNERS) {
    resetDatabase();
    const result = spawnSync(
      process.execPath,
      [resolve(repositoryRoot, runner)],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const verdict = runnerVerdict({
      status: result.status,
      stdout: result.stdout ?? '',
    });
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    console.log(
      `${verdict.passed ? 'PASS' : 'FAIL'} ${runner} exit=${String(result.status)} ok=${verdict.assertions}`,
    );
    if (!verdict.passed) failures.push(runner);
  }
  resetDatabase();
  if (failures.length > 0) {
    console.error(`Race runners failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(`All ${RACE_RUNNERS.length} race runners passed.`);
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  main();
