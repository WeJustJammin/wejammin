#!/usr/bin/env node

/**
 * Slice 09 DEC-111 concurrency evidence for the shared MFA verification lock
 * (BE01a: ten failures in 15 minutes across AUTH-API-18 and AUTH-API-21 lock the
 * account's verification for 15 minutes).  Fourteen failures are charged by
 * fourteen independent committed PostgreSQL sessions at once, seven through the
 * enrollment failure RPC and seven through the step-up failure RPC.  The charge
 * runs under the account binding row lock, so exactly nine are recorded
 * without a lock, the tenth locks, the remaining four report locked without
 * being counted, and the lock is persisted once for 15 minutes.
 *
 * Run only against the disposable local Supabase database right after
 * `pnpm db:reset` and run `pnpm db:reset` again afterwards (it commits a user,
 * a factor and a challenge).  It is not a Supabase-discovered test.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const container = process.env.AC217_DB_CONTAINER ?? 'supabase_db_wejammin';
const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const assert = (condition, message) => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok - ${message}`);
};
const psqlArgs = (appName, args) => [
  'exec',
  '-i',
  '-e',
  `PGAPPNAME=${appName}`,
  container,
  'psql',
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'postgres',
  '-d',
  'postgres',
  ...args,
];
const runScript = (script) => {
  const result = spawnSync(
    'docker',
    psqlArgs('dec111lock-setup', ['-At', '-f', '-']),
    {
      input: script,
      encoding: 'utf8',
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `setup failed: ${(result.stderr || result.error?.message || '').split('\n').slice(-12).join(' | ')}`,
    );
  }
  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .at(-1);
};
const runValue = (statement) => {
  const result = spawnSync(
    'docker',
    psqlArgs('dec111lock-probe', ['-At', '-c', statement]),
    {
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`probe failed: ${result.stderr}`);
  return result.stdout.trim().split('\n').filter(Boolean).at(-1) ?? '';
};
const runAsync = (appName, script) => {
  const child = spawn('docker', psqlArgs(appName, ['-At', '-c', script]));
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve) =>
    child.on('close', (code) => resolve({ code, stdout, stderr })),
  );
};
const fragment = (relative) => readFileSync(join(testsDir, relative), 'utf8');

console.log(
  '# building a user with a verified factor and a live step-up challenge through the named RPCs',
);
const ids = JSON.parse(
  runScript(
    [
      '\\set ON_ERROR_STOP on',
      'begin;',
      fragment('phase_02_slice_09_dec111/00-support.sqlinc'),
      `select pg_temp.m_user(1);
   select pg_temp.m_enroll(1, 'Phone');
   select pg_temp.m('c:b', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1),
     'p_session_id', pg_temp.m_sid(1), 'p_method', 'totp', 'p_factor_id', null));
   select pg_temp.m('c:f', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1),
     'p_session_id', pg_temp.m_sid(1), 'p_factor_id', pg_temp.m_fid(1),
     'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
   select jsonb_build_object('user', pg_temp.m_uid(1), 'session', pg_temp.m_sid(1),
     'challenge', pg_temp.m_resp('c:f')->>'challengeId')::text;`,
      'commit;',
    ].join('\n'),
  ),
);

const enrollmentFailure = () =>
  `select platform_api.auth_mfa_verification_failure_record(${sql(ids.user)}::uuid, 'incorrect', extensions.gen_random_uuid(), extensions.gen_random_uuid());`;
const stepUpFailure = () =>
  `select platform_api.auth_step_up_challenge_failure_record(${sql(ids.user)}::uuid, ${sql(ids.session)}::uuid, ${sql(ids.challenge)}::uuid, 'incorrect', extensions.gen_random_uuid(), extensions.gen_random_uuid());`;

const calls = [];
for (let n = 0; n < 7; n += 1) {
  calls.push(runAsync(`dec111lock-e${n}`, enrollmentFailure()));
  calls.push(runAsync(`dec111lock-s${n}`, stepUpFailure()));
}
const results = await Promise.all(calls);
assert(
  results.every((result) => result.code === 0),
  'all fourteen concurrent failure charges committed',
);
const enrollmentResults = results.filter((_, index) => index % 2 === 0);
assert(
  enrollmentResults.every(
    (result) =>
      /"locked":\s*(true|false)/.test(result.stdout) &&
      /"recorded":\s*true/.test(result.stdout),
  ),
  'every enrollment failure RPC reported recorded and its lock state',
);
const totalCounted = Number(
  runValue(
    `select version - 1 from identity.mfa_verification_lockouts where auth_user_id = ${sql(ids.user)}::uuid;`,
  ),
);
assert(
  totalCounted === 10,
  `[P2-S09-AC-778] [P2-S09-AC-865] exactly ten of the fourteen failures across AUTH-API-18 and AUTH-API-21 were counted in one account budget (got ${totalCounted})`,
);
assert(
  runValue(
    `select cardinality(failure_times) from identity.mfa_verification_lockouts where auth_user_id = ${sql(ids.user)}::uuid;`,
  ) === '0',
  'the lock cleared the in-window list exactly once',
);
const remaining = Number(
  runValue(
    `select ceil(extract(epoch from locked_until - clock_timestamp())) from identity.mfa_verification_lockouts where auth_user_id = ${sql(ids.user)}::uuid;`,
  ),
);
assert(
  remaining > 880 && remaining <= 900,
  `[P2-S09-AC-778] [P2-S09-AC-865] the 15-minute lock is persisted once (${remaining}s remaining)`,
);
const challengeAttempts = Number(
  runValue(
    `select failed_attempt_count from identity.step_up_challenges where id = ${sql(ids.challenge)}::uuid;`,
  ),
);
assert(
  challengeAttempts === 7,
  `each step-up failure was recorded on its challenge, locked or not (${challengeAttempts})`,
);
console.log(
  '# all concurrency assertions passed; run `pnpm db:reset` before the pgTAP suite',
);
