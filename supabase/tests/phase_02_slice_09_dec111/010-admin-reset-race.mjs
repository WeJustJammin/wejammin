#!/usr/bin/env node

/**
 * Slice 09 DEC-111 two-session race evidence (BE01a "Administrative factor
 * reset", BE05b CFG-05B-06).  The administrative reset must authorize the
 * destructive identity reset from membership and operator authority that are
 * locked and rechecked AFTER the target serialization lock is held, never from
 * an earlier unlocked read.  Across two real committed PostgreSQL sessions:
 *
 *   S1  the target's membership revocation is in flight (uncommitted) when the
 *       reset starts: the reset BLOCKS on the tenure row (it does not read the
 *       stale `confirmed` row and race past), and once the revocation commits it
 *       refuses with TARGET_NOT_FOUND; no reset row exists and the target's
 *       verified factor is untouched.
 *   S2  the operator's reset-capability revocation is in flight when the reset
 *       starts: the reset BLOCKS on the grant row and refuses with FORBIDDEN.
 *
 *   S3  (AC933) the settlement of a reset reports a `failed` provider outcome while
 *       a second copy of the same report (a Worker retry) is already in flight:
 *       the second settle BLOCKS on the reset row, then finds the first one's
 *       settlement receipt and emits nothing, so the reconciler is woken exactly
 *       once for the factor version (one reservation event plus one wake-up), and
 *       a later sequential replay emits nothing either.  Runs first, before S1 and
 *       S2 end the memberships and the grant the other scenarios consume.
 *
 * Run only against the disposable local Supabase database right after
 * `pnpm db:reset`, and run `pnpm db:reset` again afterwards (it commits
 * identities, a grant and a factor that the pgTAP suites expect absent).  It is
 * not a Supabase-discovered test.  The factor is enrolled through the real
 * enrollment RPCs and the reset is only ever driven through
 * platform_api.admin_mfa_factor_reset.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const container = process.env.AC217_DB_CONTAINER ?? 'supabase_db_wejammin';
const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLEEP_SECONDS = 6;
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
  if (result.error || result.status !== 0) {
    throw new Error(`probe failed: ${result.stderr || result.error?.message}`);
  }
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
  return {
    done: new Promise((resolve) =>
      child.on('close', (code) => resolve({ code, stdout, stderr })),
    ),
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (description, probe, timeoutMs = 25_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probe()) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${description}`);
};
const waitEvent = (appName) =>
  runValue(
    `select coalesce(wait_event_type || ':' || wait_event, 'none') from pg_stat_activity where application_name = ${sql(appName)} and state = 'active' and pid <> pg_backend_pid() limit 1;`,
  );
const fragment = (relative) => readFileSync(join(testsDir, relative), 'utf8');

// ----------------------------------------------------------------- setup ----
console.log(
  '# building operator, grant, members and a verified factor through the named commands',
);
const setupScript = [
  '\\set ON_ERROR_STOP on',
  fragment('support/jwt-claims.sqlinc'),
  'begin;',
  fragment('phase_02_slice_09_dec111/00-support.sqlinc'),
  fragment('phase_02_slice_09_dec108/00-helpers.sqlinc'),
  fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
  `insert into m_alias values
     (11, pg_temp.s09d_actor_id('owner', 'auth')::uuid), (12, pg_temp.s09d_actor_id('designer2', 'auth')::uuid),
     (13, pg_temp.s09d_actor_id('rev1', 'auth')::uuid), (14, pg_temp.s09d_actor_id('rev2', 'auth')::uuid),
     (15, pg_temp.s09d_actor_id('rev3', 'auth')::uuid), (16, pg_temp.s09d_actor_id('other', 'auth')::uuid);
   select pg_temp.m_session(n) from generate_series(11, 16) n;
   create or replace function pg_temp.m_member(p_actor text) returns void language plpgsql as $body$
   begin
     -- FIXTURE FORGERY: no command confirms an ungoverned membership (rpc_accept_or_end_membership accepts governed tenures only).
     insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
       starts_on, accepted_at, actor_id, version)
     select pg_temp.s09d_id('ownerOrg'), member.person_id, 'confirmed', 'invitation', 'ungoverned', current_date - 1,
            clock_timestamp(), owner.person_id, 1
     from s09d_actor member, s09d_actor owner where member.key = p_actor and owner.key = 'owner';
   end;
   $body$;
   select pg_temp.m_member('rev1');
   select pg_temp.m_member('rev2');
   select pg_temp.m_member('rev3');
   -- FIXTURE FORGERY: no command in this repository grants an admin capability (CFG-11 record).
   insert into platform_private.admin_capability_grants(id, subject_person_id, capability_key, resource_type, resource_id,
     scope, actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant, state, version_no)
   select extensions.gen_random_uuid(), pg_temp.s09d_actor_id('designer2', 'person')::uuid, 'admin.identity.mfa_reset',
     'organization', pg_temp.s09d_id('ownerOrg'), jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')),
     array['reset'], clock_timestamp() - interval '2 hours', clock_timestamp() + interval '1 day',
     pg_temp.s09d_actor_id('owner', 'person')::uuid, 'dec111 race', false, 'active', 1;
   select pg_temp.m_enroll(13, 'V1');
   select pg_temp.m_enroll(14, 'W1');
   select pg_temp.m_enroll(15, 'X1');`,
  `select jsonb_build_object(
     'guc', (select jsonb_build_object('auth', auth_user_id, 'person', person_id, 'party', party_id, 'binding', binding_id)
             from s09d_actor where key = 'designer2'),
     'org', pg_temp.s09d_id('ownerOrg'),
     'target1', pg_temp.s09d_actor_id('rev1', 'person'), 'target2', pg_temp.s09d_actor_id('rev2', 'person'),
     'targetAuth1', pg_temp.s09d_actor_id('rev1', 'auth'), 'targetAuth2', pg_temp.s09d_actor_id('rev2', 'auth'),
     'target3', pg_temp.s09d_actor_id('rev3', 'person'), 'targetAuth3', pg_temp.s09d_actor_id('rev3', 'auth'),
     'factor3', pg_temp.m_fid(15),
     'provider3', (select provider_factor_id from identity.mfa_factor_registry where id = pg_temp.m_fid(15)),
     'operator', pg_temp.s09d_actor_id('designer2', 'person'),
     'context', pg_temp.s09d_context('designer2', true))::text;`,
  'commit;',
].join('\n');
const ids = JSON.parse(runScript(setupScript));

const gucs = `select set_config('request.jwt.claims',${sql(JSON.stringify({ role: 'service_role', sub: ids.guc.auth }))},false),
  set_config('app.auth_user_id',${sql(ids.guc.auth)},false),
  set_config('app.actor_auth_user_id',${sql(ids.guc.auth)},false),
  set_config('app.actor_person_id',${sql(ids.guc.person)},false),
  set_config('app.acting_party_id',${sql(ids.guc.party)},false),
  set_config('app.acting_context_id',${sql(ids.guc.binding)},false);`;
const resetCall = (target, key) =>
  `select platform_api.admin_mfa_factor_reset(${sql(
    JSON.stringify({
      targetPersonId: target,
      reason: 'race: lost every factor',
      idempotencyKey: key,
      context: ids.context,
    }),
  )}::jsonb);`;
// FIXTURE FORGERY: ends the forged membership of this race fixture in place, so the end lands at an exact point between
// two committed sessions; it claims no producer path (rpc_accept_or_end_membership is the real end command).
const endMembership = (target) =>
  `update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), version = version + 1 where organization_id = ${sql(ids.org)}::uuid and person_id = ${sql(target)}::uuid;`;
const liveFactors = (authUser) =>
  Number(
    runValue(
      `select count(*) from identity.mfa_factor_registry where auth_user_id = ${sql(authUser)}::uuid and state = 'verified';`,
    ),
  );
const resetRows = (target) =>
  Number(
    runValue(
      `select count(*) from platform_private.admin_mfa_factor_resets where target_person_id = ${sql(target)}::uuid;`,
    ),
  );
const grantState = () =>
  runValue(
    `select state from platform_private.admin_capability_grants where subject_person_id = ${sql(ids.operator)}::uuid and capability_key = 'admin.identity.mfa_reset';`,
  );

assert(
  liveFactors(ids.targetAuth1) === 1 && liveFactors(ids.targetAuth2) === 1,
  'fixture: both targets hold one verified factor',
);
assert(
  grantState() === 'active',
  'fixture: the operator holds an active admin.identity.mfa_reset grant',
);

// ----------------------- S3: a duplicate failed settlement report (AC933) ----
const settleCall = (resetId, outcomes) =>
  `select platform_api.admin_mfa_factor_reset_settle(${sql(
    JSON.stringify({ resetId, outcomes, context: ids.context }),
  )}::jsonb);`;
const failedOutcome = [{ providerFactorId: ids.provider3, outcome: 'failed' }];
const factorEvents = (factor) =>
  Number(
    runValue(
      `select count(*) from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = ${sql(factor)}::uuid;`,
    ),
  );
const receipts = (resetId) =>
  Number(
    runValue(
      `select count(*) from platform_private.admin_mfa_factor_reset_settlements where reset_id = ${sql(resetId)}::uuid and outcome = 'failed';`,
    ),
  );
const eventsAfterEnrollment = factorEvents(ids.factor3);
const reserved = JSON.parse(
  runValue(`${gucs} ${resetCall(ids.target3, 'race-reset-key-3')}`),
);
const eventsAfterReservation = factorEvents(ids.factor3);
assert(
  reserved.state === 'reconciling' &&
    typeof reserved.resetId === 'string' &&
    eventsAfterReservation === eventsAfterEnrollment + 1,
  'S3 fixture: the reservation moved the factor to reconciling and wrote its one change event',
);
console.log(
  `# S3: two copies of one failed settlement report race (${SLEEP_SECONDS}s hold on the first)`,
);
const firstReport = runAsync(
  'dec111race-settle-a',
  `${gucs} begin; ${settleCall(reserved.resetId, failedOutcome)} select pg_sleep(${SLEEP_SECONDS}); commit;`,
);
await waitFor(
  'the first settlement to hold the reset row (pg_sleep)',
  () => waitEvent('dec111race-settle-a') === 'Timeout:PgSleep',
);
const secondReport = runAsync(
  'dec111race-settle-b',
  `${gucs} ${settleCall(reserved.resetId, failedOutcome)}`,
);
await waitFor('the duplicate settlement to block on the reset row', () =>
  waitEvent('dec111race-settle-b').startsWith('Lock:'),
);
assert(
  factorEvents(ids.factor3) === eventsAfterReservation &&
    receipts(reserved.resetId) === 0,
  'S3: nothing of the uncommitted first report is visible to the waiting duplicate',
);
const firstResult = await firstReport.done;
const secondResult = await secondReport.done;
assert(
  firstResult.code === 0 && secondResult.code === 0,
  `S3: both reports of the same outcome were accepted (${firstResult.stderr.trim()}${secondResult.stderr.trim()})`,
);
assert(
  factorEvents(ids.factor3) === eventsAfterReservation + 1 &&
    receipts(reserved.resetId) === 1,
  '[P2-S09-AC-933] S3: the concurrent duplicate emitted no second reconciler event: one reservation event plus exactly one wake-up for the factor version, one settlement receipt',
);
const replay = await runAsync(
  'dec111race-settle-c',
  `${gucs} ${settleCall(reserved.resetId, failedOutcome)}`,
).done;
assert(
  replay.code === 0 &&
    factorEvents(ids.factor3) === eventsAfterReservation + 1 &&
    receipts(reserved.resetId) === 1,
  '[P2-S09-AC-933] S3: a later sequential replay of the report emits nothing either',
);

// ------------------------------------ S1: membership revocation first ----
console.log(
  `# S1: the target's membership revocation is in flight when the reset starts (${SLEEP_SECONDS}s hold)`,
);
const revokeHold = runAsync(
  'dec111race-revoke1',
  `begin; ${endMembership(ids.target1)} select pg_sleep(${SLEEP_SECONDS}); commit;`,
);
await waitFor(
  'the in-flight revocation to hold the tenure row (pg_sleep)',
  () => waitEvent('dec111race-revoke1') === 'Timeout:PgSleep',
);
const resetBlocked = runAsync(
  'dec111race-reset1',
  `${gucs} ${resetCall(ids.target1, 'race-reset-key-1')}`,
);
await waitFor('the reset to block on the tenure row', () =>
  waitEvent('dec111race-reset1').startsWith('Lock:'),
);
assert(
  waitEvent('dec111race-revoke1') === 'Timeout:PgSleep',
  '[P2-S09-AC-893] [P2-S09-AC-931] S1: the reset is blocked behind the still-uncommitted revocation (it locks the target binding and membership and did not read a stale confirmed row)',
);
assert(
  resetRows(ids.target1) === 0 && liveFactors(ids.targetAuth1) === 1,
  'S1: nothing was reset while the reset waits',
);
const revokeResult = await revokeHold.done;
const resetResult = await resetBlocked.done;
assert(revokeResult.code === 0, 'S1: the in-flight revocation committed');
assert(
  resetResult.code !== 0 && /TARGET_NOT_FOUND/.test(resetResult.stderr),
  `S1: the reset rechecked after the revocation committed and refused with TARGET_NOT_FOUND (${resetResult.stderr.trim().split('\n').slice(-2).join(' ')})`,
);
assert(
  resetRows(ids.target1) === 0,
  'S1: no reset row exists for the revoked member',
);
assert(
  liveFactors(ids.targetAuth1) === 1,
  "S1: the revoked member's verified factor is untouched",
);

// ------------------------------------ S2: operator grant revocation first ----
console.log(
  `# S2: the operator's reset-capability revocation is in flight when the reset starts (${SLEEP_SECONDS}s hold)`,
);
const grantHold = runAsync(
  'dec111race-grant2',
  // FIXTURE FORGERY: revokes the forged admin capability grant of this race fixture (no command grants or revokes one in this repository, CFG-11 record).
  `begin; update platform_private.admin_capability_grants set state = 'revoked', revoked_at = clock_timestamp(), revoked_by = grantor_person_id, version_no = version_no + 1 where subject_person_id = ${sql(ids.operator)}::uuid and capability_key = 'admin.identity.mfa_reset'; select pg_sleep(${SLEEP_SECONDS}); commit;`,
);
await waitFor(
  'the in-flight grant revocation to hold its row (pg_sleep)',
  () => waitEvent('dec111race-grant2') === 'Timeout:PgSleep',
);
const resetGrantBlocked = runAsync(
  'dec111race-reset2',
  `${gucs} ${resetCall(ids.target2, 'race-reset-key-2')}`,
);
await waitFor('the reset to block on the grant row', () =>
  waitEvent('dec111race-reset2').startsWith('Lock:'),
);
const grantResult = await grantHold.done;
const resetGrantResult = await resetGrantBlocked.done;
assert(grantResult.code === 0, 'S2: the in-flight grant revocation committed');
assert(
  resetGrantResult.code !== 0 && /FORBIDDEN/.test(resetGrantResult.stderr),
  `[P2-S09-AC-931] S2: the reset rechecked the operator grant it locked after the revocation committed and refused with FORBIDDEN (${resetGrantResult.stderr.trim().split('\n').slice(-2).join(' ')})`,
);
assert(
  resetRows(ids.target2) === 0 && liveFactors(ids.targetAuth2) === 1,
  'S2: nothing was reset for the second member',
);
console.log(
  '# all race assertions passed; run `pnpm db:reset` before the pgTAP suite',
);
