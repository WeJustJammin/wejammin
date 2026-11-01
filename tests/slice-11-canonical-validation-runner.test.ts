import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/**
 * Regression guard for the two Slice 11 canonical gate runners (gate-validate.sh, gate-db-verify.sh).
 * It copies the runner into a temp fixture and patches ONLY the copy (W= and the /tmp locks become
 * fixture-local); db:reset, validate and db:verify route to exit-code shims, a sha256sum shim can be
 * forced to fail, and no real DB/container/network/gate command runs. The fixture record carries a
 * prior canonical-validate line the test asserts survives byte-for-byte, the property the old runner
 * broke by stamping the line before the run.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LANES = 'docs/handoffs/2026-10-10-claude-s11/lanes';
const RECORD_REL =
  '.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md';
const QUIET_LOCK = '/tmp/wejammin-quiet.lock';
const CI_LOCK = '/tmp/wejammin-supabase-ci.lock';

const SEEDED_RECORD = [
  '# fixture Slice 11 record',
  '',
  '- canonical validate: `pnpm validate` exit 0 on 2026-10-01 (00:00 UTC) on the integration checkout — prior proven line that must survive untouched',
  '',
].join('\n');

/** db:reset: exits with the n-th code of GATE_FIXTURE_RESET_CODES and counts its calls. */
const DB_RESET_SHIM = [
  '#!/usr/bin/env bash',
  'set -u',
  'state="${GATE_FIXTURE_STATE:?}"',
  'n=$(( $(cat "$state/reset.count" 2>/dev/null || echo 0) + 1 ))',
  'printf %s "$n" > "$state/reset.count"',
  'code=$(printf %s "${GATE_FIXTURE_RESET_CODES:-0,0}" | cut -d, -f"$n")',
  'echo "fixture db:reset #$n exit=${code:-0}"',
  'exit "${code:-0}"',
  '',
].join('\n');

/** validate: marks that it ran, counts its calls and exits with GATE_FIXTURE_VALIDATE_CODE. */
const VALIDATE_SHIM = [
  '#!/usr/bin/env bash',
  'set -u',
  'state="${GATE_FIXTURE_STATE:?}"',
  'printf ran > "$state/validate.ran"',
  'n=$(( $(cat "$state/validate.count" 2>/dev/null || echo 0) + 1 ))',
  'printf %s "$n" > "$state/validate.count"',
  'echo "fixture validate #$n exit=${GATE_FIXTURE_VALIDATE_CODE:-0}"',
  'exit "${GATE_FIXTURE_VALIDATE_CODE:-0}"',
  '',
].join('\n');

/** db:verify: marks that it ran, counts its calls and exits with GATE_FIXTURE_DBVERIFY_CODE. */
const DB_VERIFY_SHIM = [
  '#!/usr/bin/env bash',
  'set -u',
  'state="${GATE_FIXTURE_STATE:?}"',
  'printf ran > "$state/dbverify.ran"',
  'n=$(( $(cat "$state/dbverify.count" 2>/dev/null || echo 0) + 1 ))',
  'printf %s "$n" > "$state/dbverify.count"',
  'echo "fixture db:verify #$n exit=${GATE_FIXTURE_DBVERIFY_CODE:-0}"',
  'exit "${GATE_FIXTURE_DBVERIFY_CODE:-0}"',
  '',
].join('\n');

/** sha256sum: delegates to the real tool, or fails when GATE_FIXTURE_SHA_FAIL=1. */
const SHA_SHIM = [
  '#!/usr/bin/env bash',
  'if [ "${GATE_FIXTURE_SHA_FAIL:-0}" = "1" ]; then echo "sha256sum: fixture failure" >&2; exit 1; fi',
  'exec /usr/bin/sha256sum "$@"',
  '',
].join('\n');

/** gh: the db:verify header asks GitHub for active runs; keep it offline and instant. */
const GH_SHIM = ['#!/usr/bin/env bash', 'exit 0', ''].join('\n');

type Fixture = Readonly<{
  root: string;
  state: string;
  shims: string;
  runnerCopy: string;
  recordPath: string;
}>;

type RunResult = Readonly<{
  status: number;
  stdout: string;
  log: string;
  logPath: string;
  shaPath: string;
}>;

type RunOptions = Readonly<{
  resetCodes?: string;
  validateCode?: number;
  dbVerifyCode?: number;
  shaFail?: boolean;
}>;

const created: string[] = [];

const shimScript = (path: string): string => "bash '" + path + "'";

const makeFixture = (runnerFile: string): Fixture => {
  const root = mkdtempSync(join(tmpdir(), 's11-gate-'));
  created.push(root);
  const co = join(root, 'co');
  const state = join(root, 'state');
  const shims = join(root, 'shims');
  mkdirSync(join(co, dirname(RECORD_REL)), { recursive: true });
  mkdirSync(join(co, '.lane-logs'), { recursive: true });
  mkdirSync(state, { recursive: true });
  mkdirSync(shims, { recursive: true });
  mkdirSync(join(root, 'locks'), { recursive: true });
  const exec = { mode: 0o755 } as const;
  writeFileSync(join(shims, 'db-reset.sh'), DB_RESET_SHIM, exec);
  writeFileSync(join(shims, 'validate.sh'), VALIDATE_SHIM, exec);
  writeFileSync(join(shims, 'db-verify.sh'), DB_VERIFY_SHIM, exec);
  writeFileSync(join(shims, 'sha256sum'), SHA_SHIM, exec);
  writeFileSync(join(shims, 'gh'), GH_SHIM, exec);
  writeFileSync(
    join(co, 'package.json'),
    JSON.stringify({
      name: 's11-gate-fixture',
      private: true,
      scripts: {
        'db:reset': shimScript(join(shims, 'db-reset.sh')),
        validate: shimScript(join(shims, 'validate.sh')),
        'db:verify': shimScript(join(shims, 'db-verify.sh')),
      },
    }),
  );
  const recordPath = join(co, RECORD_REL);
  writeFileSync(recordPath, SEEDED_RECORD);
  const patched = readFileSync(join(REPO, LANES, runnerFile), 'utf8')
    .replace(/^W=.*$/mu, () => "W='" + co + "'")
    .replaceAll(QUIET_LOCK, join(root, 'locks', 'quiet.lock'))
    .replaceAll(CI_LOCK, join(root, 'locks', 'ci.lock'));
  const runnerCopy = join(root, runnerFile);
  writeFileSync(runnerCopy, patched);
  return { root, state, shims, runnerCopy, recordPath };
};

const runRunner = (fx: Fixture, opts: RunOptions = {}): RunResult => {
  const proc = spawnSync('bash', [fx.runnerCopy], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      PATH: fx.shims + ':' + (process.env.PATH ?? ''),
      GATE_FIXTURE_STATE: fx.state,
      GATE_FIXTURE_RESET_CODES: opts.resetCodes ?? '0,0',
      GATE_FIXTURE_VALIDATE_CODE: String(opts.validateCode ?? 0),
      GATE_FIXTURE_DBVERIFY_CODE: String(opts.dbVerifyCode ?? 0),
      GATE_FIXTURE_SHA_FAIL: opts.shaFail === true ? '1' : '0',
    },
  });
  const stdout = proc.stdout ?? '';
  const logPath = /LOG=(\S+)/u.exec(stdout)?.[1] ?? '';
  const log =
    logPath !== '' && existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  return {
    status: proc.status ?? -1,
    stdout,
    log,
    logPath,
    shaPath: logPath.replace(/\.log$/u, '') + '.sha256',
  };
};

const state = (fx: Fixture, name: string): string | null => {
  const path = join(fx.state, name);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

const digestOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const hashText = (result: RunResult): string =>
  existsSync(result.shaPath) ? readFileSync(result.shaPath, 'utf8') : '';

afterAll(() => {
  for (const root of created) rmSync(root, { recursive: true, force: true });
});

describe('gate-validate.sh (Slice 11 canonical validation runner)', () => {
  it('a passing run exits 0, resets twice, captures a log and its SHA-256, and leaves the prior proven record untouched', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, { resetCodes: '0,0', validateCode: 0 });
    expect(result.status).toBe(0);
    expect(result.log).toContain('[validate] exit=0');
    expect(result.log).toContain(
      '[validate] gate RC=0 (validate=0 postReset=0)',
    );
    expect(state(fx, 'reset.count')).toBe('2');
    expect(existsSync(result.shaPath)).toBe(true);
    expect(hashText(result)).toContain(digestOf(result.logPath));
    expect(readFileSync(fx.recordPath, 'utf8')).toBe(SEEDED_RECORD);
  });

  it('a failed db pre-reset stops before pnpm validate and exits non-zero', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, { resetCodes: '1,0', validateCode: 0 });
    expect(result.status).not.toBe(0);
    expect(state(fx, 'validate.ran')).toBeNull();
    expect(result.log).toContain('preReset=1');
  });

  it('a failing pnpm validate is propagated as the run exit code', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, { resetCodes: '0,0', validateCode: 7 });
    expect(result.status).toBe(7);
    expect(result.log).toContain('[validate] exit=7');
  });

  it('a failing db post-reset is propagated as the run exit code and named apart from the validate RC', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, { resetCodes: '0,1', validateCode: 0 });
    expect(result.status).toBe(1);
    expect(result.log).toContain('[validate] exit=0');
    expect(result.log).toContain('[validate] postReset exit=1');
    expect(result.log).toContain(
      '[validate] gate RC=1 (validate=0 postReset=1)',
    );
    expect(result.stdout).toContain('RC=1');
  });

  it('a failed evidence hash write fails the run even when validate and both resets pass', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, {
      resetCodes: '0,0',
      validateCode: 0,
      shaFail: true,
    });
    expect(result.status).not.toBe(0);
    expect(result.log).toContain('[validate] exit=0');
    expect(result.stdout).toContain('hash=FAILED');
    expect(hashText(result).trim()).toBe('');
  });

  it('the captured log records the same exit code the runner process returns', () => {
    const fx = makeFixture('gate-validate.sh');
    const result = runRunner(fx, { resetCodes: '0,0', validateCode: 9 });
    const logged = /\[validate\] exit=(-?\d+)/u.exec(result.log)?.[1];
    expect(logged).toBe(String(result.status));
  });
});

describe('gate-db-verify.sh (Slice 11 canonical db:verify runner)', () => {
  it('a passing run exits 0, verifies once, resets once and captures a log and its SHA-256', () => {
    const fx = makeFixture('gate-db-verify.sh');
    const result = runRunner(fx, { dbVerifyCode: 0 });
    expect(result.status).toBe(0);
    expect(state(fx, 'dbverify.ran')).toBe('ran');
    expect(state(fx, 'dbverify.count')).toBe('1');
    expect(state(fx, 'reset.count')).toBe('1');
    expect(result.log).toContain('[dbverify] exit=0');
    expect(hashText(result)).toContain(digestOf(result.logPath));
  });

  it('a failing pnpm db:verify is propagated as the run exit code', () => {
    const fx = makeFixture('gate-db-verify.sh');
    const result = runRunner(fx, { dbVerifyCode: 6 });
    expect(result.status).toBe(6);
    expect(result.log).toContain('[dbverify] exit=6');
  });

  it('a failing db post-reset is propagated as the run exit code and named apart from the db:verify RC', () => {
    const fx = makeFixture('gate-db-verify.sh');
    const result = runRunner(fx, { resetCodes: '1', dbVerifyCode: 0 });
    expect(result.status).toBe(1);
    expect(result.log).toContain('[dbverify] postReset exit=1');
    expect(result.log).toContain(
      '[dbverify] gate RC=1 (dbverify=0 postReset=1)',
    );
  });

  it('a failed evidence hash write fails the run even when db:verify and the post-reset pass', () => {
    const fx = makeFixture('gate-db-verify.sh');
    const result = runRunner(fx, { dbVerifyCode: 0, shaFail: true });
    expect(result.status).not.toBe(0);
    expect(result.log).toContain('[dbverify] exit=0');
    expect(result.stdout).toContain('hash=FAILED');
    expect(hashText(result).trim()).toBe('');
  });
});
