#!/usr/bin/env node

/**
 * Slice 09 DEC-108 two-session race evidence (BE03a "Source drift").  The
 * activation switch proves the scanned source unchanged and then flips the
 * source version to superseded; an entry that committed in between would be
 * unscanned.  This runner proves, across two real committed PostgreSQL
 * sessions, that the entry write (FOR SHARE on the source version row) and the
 * switch (FOR UPDATE on the same row, before its final unchanged check) cannot
 * interleave:
 *
 *   S1  an entry is in flight (uncommitted) when the switch starts: the switch
 *       BLOCKS on the source-version row, and once the entry commits the switch
 *       sees the new row and refuses with 409 CONFLICT / MIGRATION_SOURCE_DRIFT;
 *       the source stays active and nothing was switched over the unscanned row.
 *   S2  the switch is in flight (uncommitted) when the entry starts: the entry
 *       BLOCKS on the source-version row, and once the switch commits the entry
 *       is refused with CONFLICT by the version-lock guard; no entry row exists
 *       on the switched-away version.  Without the guard the waiting insert's
 *       foreign-key check (a key-share lock, unaffected by the non-key UPDATE of
 *       `state`) succeeds and the entry COMMITS on the superseded version,
 *       unscanned: that is the race the guard closes.
 *
 * Run only against the disposable local Supabase database right after
 * `pnpm db:reset` (the owner is initialized with the one-time operator command
 * and immutable rows are retained until the next reset); run `pnpm db:reset`
 * again afterwards so the pgTAP suite finds an uninitialized owner.  The
 * candidates are produced ONLY through the named commands (create -> dry-run ->
 * worker seal -> submit -> assign -> decide); the runner never inserts a review,
 * decision, dry-run report, approved version or plan row.  The pgTAP fragments
 * are reused through one committed psql transaction.
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

const runScript = (script, appName = 's09race-setup') => {
  const result = spawnSync('docker', psqlArgs(appName, ['-At', '-f', '-']), {
    input: script,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  });
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
    psqlArgs('s09race-probe', ['-At', '-c', statement]),
    { encoding: 'utf8', timeout: 30_000 },
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
  const done = new Promise((resolve) => {
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  return { done };
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

const fragment = (relative) =>
  readFileSync(join(testsDir, relative), 'utf8');

// ----------------------------------------------------------------- setup ----
console.log('# building two approved candidates through the named commands');
const setupScript = [
  '\\set ON_ERROR_STOP on',
  'begin;',
  fragment('phase_02_slice_09_dec108/00-helpers.sqlinc'),
  fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
  fragment('phase_02_slice_09_dec108/02-chain.sqlinc'),
  fragment('phase_02_slice_09_dec108/03-support.sqlinc'),
  fragment('phase_02_slice_09_dec108/04-worker.sqlinc'),
  fragment('phase_02_slice_09_dec119/00-support.sqlinc'),
  `select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));`,
  // Race 1 type: version 1 active, a zero-row additive successor approved.
  `select pg_temp.s09d_create_type('a', 'racefirst');`,
  `select pg_temp.s09d_to_active('a');`,
  `select pg_temp.s09d_successor('b', 'a');`,
  `select pg_temp.s09d_dry_run('b');`,
  `select pg_temp.s09d_seal('b');`,
  `select pg_temp.s09d_submit('b');`,
  `select pg_temp.s09d_assign('b', 'rev1');`,
  `select pg_temp.s09d_decide('b', 'rev1');`,
  // Race 2 type.
  `select pg_temp.s09d_create_type('c', 'racesecond');`,
  `select pg_temp.s09d_to_active('c');`,
  `select pg_temp.s09d_successor('d', 'c');`,
  `select pg_temp.s09d_dry_run('d');`,
  `select pg_temp.s09d_seal('d');`,
  `select pg_temp.s09d_submit('d');`,
  `select pg_temp.s09d_assign('d', 'rev1');`,
  `select pg_temp.s09d_decide('d', 'rev1');`,
  `do $check$ begin
     if pg_temp.s09d_outcome('a:activate') <> 'OK' or pg_temp.s09d_outcome('c:activate') <> 'OK'
        or pg_temp.s09d_outcome('b:decide:rev1') <> 'OK' or pg_temp.s09d_outcome('d:decide:rev1') <> 'OK' then
       raise exception 'setup chain did not complete: % % % %', pg_temp.s09d_outcome('a:activate'),
         pg_temp.s09d_outcome('c:activate'), pg_temp.s09d_outcome('b:decide:rev1'), pg_temp.s09d_outcome('d:decide:rev1');
     end if;
   end $check$;`,
  `select jsonb_build_object(
     'guc', (select jsonb_build_object('auth', auth_user_id, 'person', person_id, 'party', party_id, 'binding', binding_id)
             from s09d_actor where key = 'owner'),
     'a', pg_temp.s09d_id('a:version'), 'b', pg_temp.s09d_id('b:version'),
     'c', pg_temp.s09d_id('c:version'), 'd', pg_temp.s09d_id('d:version'),
     'entryA', pg_temp.s09w_entry_request('race-a', 'a', 'Race entry one')
       || jsonb_build_object('context', pg_temp.s09d_context('owner')),
     'entryC', pg_temp.s09w_entry_request('race-c', 'c', 'Race entry two')
       || jsonb_build_object('context', pg_temp.s09d_context('owner')),
     'activateB', pg_temp.s09d_activation_request('b'),
     'activateD', pg_temp.s09d_activation_request('d'))::text;`,
  'commit;',
].join('\n');
const ids = JSON.parse(runScript(setupScript));

const gucs = `select set_config('request.jwt.claim.role','service_role',false),
  set_config('request.jwt.claim.sub',${sql(ids.guc.auth)},false),
  set_config('app.auth_user_id',${sql(ids.guc.auth)},false),
  set_config('app.actor_auth_user_id',${sql(ids.guc.auth)},false),
  set_config('app.actor_person_id',${sql(ids.guc.person)},false),
  set_config('app.acting_party_id',${sql(ids.guc.party)},false),
  set_config('app.acting_context_id',${sql(ids.guc.binding)},false);`;
const call = (name, request) =>
  `select platform_api.${name}(${sql(JSON.stringify(request))}::jsonb);`;
const versionState = (id) =>
  runValue(
    `select state::text from platform_private.cms_content_type_versions where id = ${sql(id)}::uuid;`,
  );
const revisionCount = (versionId) =>
  Number(
    runValue(
      `select count(*) from platform_private.cms_entry_revisions where schema_version_id = ${sql(versionId)}::uuid;`,
    ),
  );

assert(
  versionState(ids.a) === 'active' && versionState(ids.b) === 'approved',
  'fixture 1: version 1 is active and its zero-row successor is approved',
);
assert(
  versionState(ids.c) === 'active' && versionState(ids.d) === 'approved',
  'fixture 2: version 1 is active and its zero-row successor is approved',
);

// -------------------------------------------------- S1: entry first ----
console.log(`# S1: an entry is in flight when the switch starts (${SLEEP_SECONDS}s hold)`);
const entryHold = runAsync(
  's09race-entry1',
  `begin; ${gucs} ${call('cms_create_entry', ids.entryA)} select pg_sleep(${SLEEP_SECONDS}); commit;`,
);
await waitFor(
  'the in-flight entry to hold its locks (pg_sleep)',
  () => waitEvent('s09race-entry1') === 'Timeout:PgSleep',
);
const switchBlocked = runAsync(
  's09race-switch1',
  `${gucs} ${call('cms_activate_schema', ids.activateB)}`,
);
await waitFor(
  'the switch to block on the source-version row',
  () => waitEvent('s09race-switch1').startsWith('Lock:'),
);
assert(
  waitEvent('s09race-entry1') === 'Timeout:PgSleep',
  'S1: the switch is blocked behind the still-uncommitted entry (it did not overtake it)',
);
assert(
  versionState(ids.a) === 'active',
  'S1: the source version is untouched while the switch waits',
);
const entryResult = await entryHold.done;
const switchResult = await switchBlocked.done;
assert(entryResult.code === 0, 'S1: the in-flight entry committed');
assert(
  switchResult.code !== 0 &&
    /CONFLICT/.test(switchResult.stderr) &&
    /MIGRATION_SOURCE_DRIFT/.test(switchResult.stderr),
  `S1: the switch re-checked after the entry committed and refused with CONFLICT / MIGRATION_SOURCE_DRIFT (${switchResult.stderr.trim().split('\n').slice(-3).join(' ')})`,
);
assert(
  versionState(ids.a) === 'active' && versionState(ids.b) === 'approved',
  'S1: nothing was switched over the unscanned entry (source active, candidate approved)',
);
assert(
  revisionCount(ids.a) === 1,
  'S1: the entry is committed on the still-active source version',
);

// ------------------------------------------------ S2: switch first ----
console.log(`# S2: the switch is in flight when an entry starts (${SLEEP_SECONDS}s hold)`);
const switchHold = runAsync(
  's09race-switch2',
  `begin; ${gucs} ${call('cms_activate_schema', ids.activateD)} select pg_sleep(${SLEEP_SECONDS}); commit;`,
);
await waitFor(
  'the in-flight switch to hold its locks (pg_sleep)',
  () => waitEvent('s09race-switch2') === 'Timeout:PgSleep',
);
const entryBlocked = runAsync(
  's09race-entry2',
  `${gucs} ${call('cms_create_entry', ids.entryC)}`,
);
await waitFor(
  'the entry to block on the source-version row',
  () => waitEvent('s09race-entry2').startsWith('Lock:'),
);
assert(
  waitEvent('s09race-switch2') === 'Timeout:PgSleep',
  'S2: the entry is blocked behind the still-uncommitted switch (it did not overtake it)',
);
const switchResult2 = await switchHold.done;
const entryResult2 = await entryBlocked.done;
assert(switchResult2.code === 0, 'S2: the in-flight switch committed');
assert(
  versionState(ids.c) === 'superseded' && versionState(ids.d) === 'active',
  'S2: the successor is active and the source superseded',
);
assert(
  entryResult2.code !== 0 &&
    /CONFLICT/.test(entryResult2.stderr) &&
    /cms_entry_version_lock_guard/.test(entryResult2.stderr),
  `S2: the waiting entry was refused with CONFLICT by the version-lock guard after the switch committed (${entryResult2.stderr.trim().split('\n').slice(0, 2).join(' ')})`,
);
assert(
  revisionCount(ids.c) === 0,
  'S2: no entry revision exists on the switched-away version',
);
console.log('# all race assertions passed; run `pnpm db:reset` before the pgTAP suite');
