import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `pnpm db:reset`: `supabase db reset --local`, repeated when the CLI itself failed.
 *
 * The CLI recreates the database, then runs a one-off container that initialises the schema
 * and starts the services again. On the shared local stack, whose Auth, Storage, Realtime and
 * Analytics services reconnect to the new database while that happens, the container
 * intermittently exits 1 (`LegacyDbSetupError`, "error running container: exit 1") and a
 * service intermittently stays unhealthy (`LegacyHealthCheckTimeoutError`): 5 of the 263
 * reset logs in the lane log directory. The race gate resets 22 times per run, so it failed
 * on infrastructure alone roughly one run in three, and that failure left a recreated, EMPTY
 * database behind (the stale generated types the next gate step reported).
 *
 * When the CLI fails like that no migration has run, so resetting again repeats nothing the
 * project did. A migration or seed error is deterministic and is never retried.
 *
 * The CLI prints its error as JSON on STDOUT, so a caller that discards stdout sees only
 * "Initialising schema..." and no cause. Both streams are echoed here, and every failed
 * attempt is reported on stderr with the CLI's error line.
 */
export const RESET_ATTEMPTS = 3;

const TRANSIENT_RESET_FAILURES = [
  /"code":"LegacyDbSetupError"/u,
  /"code":"LegacyHealthCheckTimeoutError"/u,
];

export const isTransientResetFailure = (output) =>
  TRANSIENT_RESET_FAILURES.some((pattern) => pattern.test(output));

/** The CLI's own error (a JSON line on stdout) when it printed one, else its last line. */
const failureLine = (output) => {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return (
    lines.findLast((line) => line.startsWith('{"_tag":"Error"')) ??
    lines.at(-1) ??
    ''
  );
};

/**
 * Runs `run()` (one `supabase db reset --local`) until it succeeds, fails with something
 * that is not transient, or `attempts` have been used. `status` is the last exit status, 1
 * when the CLI was killed by a signal (never 0).
 */
export const resetLocalDatabase = ({
  run,
  attempts = RESET_ATTEMPTS,
  report = () => {},
}) => {
  for (let attempt = 1; ; attempt += 1) {
    const result = run();
    if (result.status === 0) return { ok: true, attempts: attempt, status: 0 };
    const status = result.status ?? 1;
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const retry = attempt < attempts && isTransientResetFailure(output);
    report(
      `supabase db reset attempt ${attempt} of ${attempts} failed (exit ${String(result.status)}): ${failureLine(output)}${
        retry ? '; resetting again' : ''
      }`,
    );
    if (!retry) return { ok: false, attempts: attempt, status };
  }
};

const supabaseBinary = () => {
  const local = resolve(repositoryRoot, 'node_modules/.bin/supabase');
  return existsSync(local) ? local : 'supabase';
};

const runSupabaseReset = () => {
  const result = spawnSync(supabaseBinary(), ['db', 'reset', '--local'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = `${result.stderr ?? ''}${
    result.error === undefined ? '' : `${result.error.message}\n`
  }`;
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return { status: result.status, stdout, stderr };
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const outcome = resetLocalDatabase({
    run: runSupabaseReset,
    report: (message) => console.error(message),
  });
  process.exit(outcome.status);
}
