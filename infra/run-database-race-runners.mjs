import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
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
  'supabase/tests/phase_02_slice_10_races/010-activation-serialization.mjs',
  'supabase/tests/phase_02_slice_10_races/011-authority-revocation.mjs',
  'supabase/tests/phase_02_slice_10_races/012-relation-target-race.mjs',
  'supabase/tests/phase_02_slice_10_races/013-revision-concurrency-cap.mjs',
  'supabase/tests/phase_02_slice_10_races/014-revocation-vs-activation.mjs',
];

/**
 * One JSON line per (criterion marker, assertion) for the evidence collector
 * (`scripts/evidence/collect-receipts.mjs --races`), written to this path under the
 * gitignored `test-results/` directory (override with DB_RACES_JSONL) and echoed on
 * stdout. Record: { marker, title, status, file }.
 */
export const RACE_RECEIPTS_PATH = 'test-results/db-races.jsonl';

/**
 * The lock and serialization criteria this gate must evidence: CMS-03A-01 unique
 * type-key locking (052), CMS-03A-04 candidate and active row locks then one
 * compare-and-swap (097), CMS-03A-08 block-version lock with stale and duplicate
 * transitions refused (157). The gate fails when any has no passed receipt.
 */
export const REQUIRED_RACE_MARKERS = [
  'P2-S09-AC-052',
  'P2-S09-AC-097',
  'P2-S09-AC-157',
];

const MARKER = /\[(P2-S09-AC-\d+)\]/gu;
const markersOf = (text) => [
  ...new Set([...text.matchAll(MARKER)].map((match) => match[1])),
];

/**
 * The receipts of one runner: every `ok - ...` line carrying criterion markers,
 * once per marker, with the runner's verdict as status; when the runner failed,
 * the markers of the assertion that threw (`ASSERTION FAILED: ...` on stderr) are
 * reported failed too, so a failing criterion is never silently absent.
 */
export const raceReceiptLines = ({ runner, status, stdout, stderr = '' }) => {
  const verdict = runnerVerdict({ status, stdout });
  const state = verdict.passed ? 'passed' : 'failed';
  const receipts = [];
  for (const line of stdout.split('\n')) {
    const ok = /^ok - (.*)$/u.exec(line);
    if (ok === null) continue;
    for (const marker of markersOf(ok[1]))
      receipts.push({ marker, title: ok[1], status: state, file: runner });
  }
  for (const line of stderr.split('\n')) {
    const failed = /ASSERTION FAILED: (.*)$/u.exec(line);
    if (failed === null) continue;
    for (const marker of markersOf(failed[1]))
      receipts.push({
        marker,
        title: failed[1],
        status: 'failed',
        file: runner,
      });
  }
  return receipts;
};

export const missingRequiredMarkers = (receipts) =>
  REQUIRED_RACE_MARKERS.filter(
    (marker) =>
      !receipts.some(
        (receipt) => receipt.marker === marker && receipt.status === 'passed',
      ),
  );

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
  const receipts = [];
  const receiptsPath = resolve(
    repositoryRoot,
    process.env.DB_RACES_JSONL ?? RACE_RECEIPTS_PATH,
  );
  mkdirSync(dirname(receiptsPath), { recursive: true });
  writeFileSync(receiptsPath, '');
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
    const lines = raceReceiptLines({
      runner,
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    });
    receipts.push(...lines);
    for (const line of lines) {
      const text = JSON.stringify(line);
      appendFileSync(receiptsPath, `${text}\n`);
      console.log(text);
    }
  }
  resetDatabase();
  console.log(`Race receipts: ${receiptsPath} (${receipts.length} lines).`);
  if (failures.length > 0) {
    console.error(`Race runners failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  const missing = missingRequiredMarkers(receipts);
  if (missing.length > 0) {
    console.error(
      `No passed race receipt for: ${missing.join(', ')} (the lock and serialization criteria this gate must evidence).`,
    );
    process.exit(1);
  }
  console.log(`All ${RACE_RUNNERS.length} race runners passed.`);
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  main();
