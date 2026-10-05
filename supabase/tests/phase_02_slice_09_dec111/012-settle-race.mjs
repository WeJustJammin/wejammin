#!/usr/bin/env node

/**
 * Slice 09 DEC-111 / AC-913 concurrency evidence on committed, independent
 * PostgreSQL sessions.
 *
 * Lockout during in-flight verification (AC-778, AC-865): an enrollment and a
 * step-up verification are prepared while the account is unlocked; a separate
 * session then holds the account binding lock while it charges ten failures and
 * persists the 15-minute lock, and the two settles start while that transaction
 * is still open.  Both settles queue on the binding lock, then re-check the
 * persisted lock after acquiring it and are refused with
 * MFA_VERIFICATION_LOCKED, committing nothing.
 *
 * Reconciler lockout (AC-778, AC-865, AC-904): a third user's reconciling
 * factor is reconciled `verified` while a separate session holds the account
 * binding lock charging the tenth failure; the reconciler queues on the lock,
 * re-checks the persisted lock after acquiring it, is refused with
 * MFA_VERIFICATION_LOCKED and commits nothing, so the factor stays reconciling.
 *
 * Reconciler version CAS (AC-913): two reconcilers that observed the same
 * factor version settle it at once (exactly one
 * applies, the other answers { stale: true } and writes nothing); a delayed
 * poll that observed an older version settles after the factor was settled and
 * re-entered reconciling and is a stale no-op.
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
    psqlArgs('dec111race-setup', ['-At', '-f', '-']),
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
    psqlArgs('dec111race-probe', ['-At', '-c', statement]),
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

const uuidSql = (value) => `${sql(value)}::uuid`;
const columns = (relation, column, id) =>
  runValue(
    `select ${column}::text from ${relation} where id = ${uuidSql(id)};`,
  );

console.log(
  '# building two users through the named RPCs: one with a prepared enrollment and step-up, one with a reconciling factor',
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
   select pg_temp.m_pending(1, 'Draft');
   select pg_temp.m_user(2);
   select pg_temp.m_enroll(2, 'Phone');
   select pg_temp.m('r:m', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(2),
     'p_factor_id', pg_temp.m_fid(2)));
   select pg_temp.m_user(3);
   select pg_temp.m_pending(3, 'Phone');
   select pg_temp.m('r3:m', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(3),
     'p_factor_id', pg_temp.m_fid(3)));
   select jsonb_build_object('user', pg_temp.m_uid(1), 'session', pg_temp.m_sid(1),
     'challenge', pg_temp.m_resp('c:f')->>'challengeId',
     'pending', (select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(1) and state = 'pending'),
     'version', pg_temp.m_ver(1),
     'user2', pg_temp.m_uid(2), 'factor2', pg_temp.m_fid(2),
     'factor2Version', pg_temp.m_fv(pg_temp.m_fid(2)),
     'user3', pg_temp.m_uid(3), 'factor3', pg_temp.m_fid(3),
     'factor3Version', pg_temp.m_fv(pg_temp.m_fid(3)))::text;`,
      'commit;',
    ].join('\n'),
  ),
);

// ---------------------------------------------------- lockout in flight ----
const trace = () =>
  'extensions.gen_random_uuid(), extensions.gen_random_uuid()';
const prepareEnrollment = runValue(
  `select platform_api.auth_mfa_enrollment_verify_prepare(${uuidSql(ids.user)}, ${uuidSql(ids.pending)}, ${sql(ids.version)}, ${trace()});`,
);
const prepareStepUp = runValue(
  `select platform_api.auth_step_up_challenge_verify_prepare(${uuidSql(ids.user)}, ${uuidSql(ids.session)}, ${uuidSql(ids.challenge)}, ${trace()});`,
);
assert(
  prepareEnrollment.includes('providerFactorId') &&
    prepareStepUp.includes('providerFactorId'),
  'both verify-prepare RPCs admitted the verification while the account was unlocked',
);
const before = {
  factor: columns('identity.mfa_factor_registry', 'state', ids.pending),
  challenge: columns('identity.step_up_challenges', 'state', ids.challenge),
  mfa: runValue(
    `select mfa_version from identity.auth_user_bindings where auth_user_id = ${uuidSql(ids.user)};`,
  ),
};
const failures = Array.from(
  { length: 10 },
  () =>
    `select platform_api.auth_mfa_verification_failure_record(${uuidSql(ids.user)}, 'incorrect', ${trace()});`,
).join(' ');
const locker = runAsync(
  'dec111race-locker',
  `begin; ${failures} select pg_sleep(3); commit;`,
);
await new Promise((resolve) => setTimeout(resolve, 1200));
const settleEnrollment = runAsync(
  'dec111race-settle-e',
  `select platform_api.auth_mfa_enrollment_verify_settle(${uuidSql(ids.user)}, ${uuidSql(ids.pending)}, ${sql(ids.version)}, ${uuidSql(ids.session)}, ${uuidSql(ids.session)}, clock_timestamp(), ${trace()});`,
);
const settleStepUp = runAsync(
  'dec111race-settle-s',
  `select platform_api.auth_step_up_challenge_verify_settle(${uuidSql(ids.user)}, ${uuidSql(ids.session)}, ${uuidSql(ids.challenge)}, ${uuidSql(ids.session)}, clock_timestamp(), ${trace()});`,
);
const [lockResult, enrollmentResult, stepUpResult] = await Promise.all([
  locker,
  settleEnrollment,
  settleStepUp,
]);
assert(lockResult.code === 0, 'the lock-setting transaction committed');
assert(
  runValue(
    `select (locked_until > clock_timestamp())::text from identity.mfa_verification_lockouts where auth_user_id = ${uuidSql(ids.user)};`,
  ) === 'true',
  'the 15-minute lock is persisted',
);
assert(
  enrollmentResult.code !== 0 &&
    /MFA_VERIFICATION_LOCKED:\d+/.test(enrollmentResult.stderr),
  `[P2-S09-AC-778] the enrollment settle queued behind the lock-setting transaction was refused (${enrollmentResult.stderr.trim().split('\n')[0]})`,
);
assert(
  stepUpResult.code !== 0 &&
    /MFA_VERIFICATION_LOCKED:\d+/.test(stepUpResult.stderr),
  `[P2-S09-AC-865] the step-up settle queued behind the lock-setting transaction was refused (${stepUpResult.stderr.trim().split('\n')[0]})`,
);
assert(
  columns('identity.mfa_factor_registry', 'state', ids.pending) ===
    before.factor &&
    columns('identity.step_up_challenges', 'state', ids.challenge) ===
      before.challenge &&
    runValue(
      `select mfa_version from identity.auth_user_bindings where auth_user_id = ${uuidSql(ids.user)};`,
    ) === before.mfa,
  'neither refused settle changed the factor, the challenge or the account MFA version',
);

// ------------------------------------------- reconciler lockout in flight ----
const reconcileOf = (user, factor, outcome, version) =>
  `select platform_api.auth_mfa_factor_reconcile(${uuidSql(user)}, ${uuidSql(factor)}, ${sql(outcome)}, ${version}, ${trace()});`;
const factor3Before = {
  state: columns('identity.mfa_factor_registry', 'state', ids.factor3),
  version: columns('identity.mfa_factor_registry', 'version', ids.factor3),
  mfa: runValue(
    `select mfa_version from identity.auth_user_bindings where auth_user_id = ${uuidSql(ids.user3)};`,
  ),
};
assert(
  factor3Before.state === 'reconciling',
  'the third user\'s factor is reconciling before the lock is set',
);
const failures3 = Array.from(
  { length: 10 },
  () =>
    `select platform_api.auth_mfa_verification_failure_record(${uuidSql(ids.user3)}, 'incorrect', ${trace()});`,
).join(' ');
const locker3 = runAsync(
  'dec111race-locker3',
  `begin; ${failures3} select pg_sleep(3); commit;`,
);
await new Promise((resolve) => setTimeout(resolve, 1200));
const reconcileVerified = runAsync(
  'dec111race-rc-lock-v',
  reconcileOf(ids.user3, ids.factor3, 'verified', ids.factor3Version),
);
const reconcilePending = runAsync(
  'dec111race-rc-lock-p',
  reconcileOf(ids.user3, ids.factor3, 'pending', ids.factor3Version),
);
const [lock3Result, verifiedResult, pendingResult] = await Promise.all([
  locker3,
  reconcileVerified,
  reconcilePending,
]);
assert(lock3Result.code === 0, 'the third user\'s lock-setting transaction committed');
assert(
  runValue(
    `select (locked_until > clock_timestamp())::text from identity.mfa_verification_lockouts where auth_user_id = ${uuidSql(ids.user3)};`,
  ) === 'true',
  'the third user\'s 15-minute lock is persisted',
);
assert(
  verifiedResult.code !== 0 &&
    /MFA_VERIFICATION_LOCKED:\d+/.test(verifiedResult.stderr),
  `[P2-S09-AC-778] [P2-S09-AC-904] a verified reconcile queued behind the lock-setting transaction was refused (${verifiedResult.stderr.trim().split('\n')[0]})`,
);
assert(
  pendingResult.code !== 0 &&
    /MFA_VERIFICATION_LOCKED:\d+/.test(pendingResult.stderr),
  `[P2-S09-AC-778] [P2-S09-AC-904] a pending reconcile queued behind the lock-setting transaction was refused (${pendingResult.stderr.trim().split('\n')[0]})`,
);
assert(
  columns('identity.mfa_factor_registry', 'state', ids.factor3) ===
    factor3Before.state &&
    columns('identity.mfa_factor_registry', 'version', ids.factor3) ===
      factor3Before.version &&
    runValue(
      `select mfa_version from identity.auth_user_bindings where auth_user_id = ${uuidSql(ids.user3)};`,
    ) === factor3Before.mfa,
  'neither refused reconcile changed the factor state, the factor version or the account MFA version',
);

// ------------------------------------------------- reconciler version CAS ----
const reconcile = (outcome, version) =>
  `select platform_api.auth_mfa_factor_reconcile(${uuidSql(ids.user2)}, ${uuidSql(ids.factor2)}, ${sql(outcome)}, ${version}, ${trace()});`;
const counts = () => ({
  events: runValue(
    `select count(*) from identity.security_events where action = 'mfa.factor.reconciled' and actor_auth_user_id = ${uuidSql(ids.user2)};`,
  ),
  outbox: runValue(
    `select count(*) from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = ${uuidSql(ids.factor2)};`,
  ),
});
const baseline = counts();
const [first, second] = await Promise.all([
  runAsync('dec111race-rc-a', reconcile('verified', ids.factor2Version)),
  runAsync('dec111race-rc-b', reconcile('verified', ids.factor2Version)),
]);
assert(
  first.code === 0 && second.code === 0,
  'both concurrent reconcilers committed without error',
);
const answers = [first.stdout.trim(), second.stdout.trim()];
assert(
  answers.filter((answer) => /"stale":\s*true/.test(answer)).length === 1 &&
    answers.filter((answer) => /"state"/.test(answer)).length === 1,
  `[P2-S09-AC-913] exactly one of two reconcilers that observed the same version applied and the other was stale (${answers.join(' | ')})`,
);
const after = counts();
assert(
  Number(after.events) === Number(baseline.events) + 1 &&
    Number(after.outbox) === Number(baseline.outbox) + 1,
  '[P2-S09-AC-913] exactly one security event and one outbox row were written',
);
assert(
  Number(columns('identity.mfa_factor_registry', 'version', ids.factor2)) ===
    Number(ids.factor2Version) + 1,
  'the factor version advanced exactly once',
);
// The delayed poll: the factor was settled (above) and re-enters reconciling at
// a newer version; the old delivery arrives afterwards.
assert(
  columns('identity.mfa_factor_registry', 'state', ids.factor2) === 'verified',
  'the winning reconciler settled the factor to verified',
);
runValue(
  `select platform_api.auth_mfa_factor_mark_reconciling(${uuidSql(ids.user2)}, ${uuidSql(ids.factor2)}, ${trace()});`,
);
const newerVersion = columns(
  'identity.mfa_factor_registry',
  'version',
  ids.factor2,
);
const delayed = runValue(reconcile('removed', ids.factor2Version));
assert(
  /"stale":\s*true/.test(delayed) &&
    columns('identity.mfa_factor_registry', 'state', ids.factor2) ===
      'reconciling' &&
    columns('identity.mfa_factor_registry', 'version', ids.factor2) ===
      newerVersion,
  '[P2-S09-AC-913] a delayed poll that observed the older version cannot settle the newer reconciliation',
);
console.log(
  '# all concurrency assertions passed; run `pnpm db:reset` before the pgTAP suite',
);
