#!/usr/bin/env node

/**
 * Slice 09 two-session race evidence for the commands whose spec text promises
 * serialization by a row or key lock (BE03a "State machine and concurrency",
 * "Transaction and external seams").  Each scenario holds the FIRST command
 * uncommitted (pg_sleep inside its transaction), proves the SECOND command is
 * blocked on a PostgreSQL lock behind it, then proves that after the first one
 * commits the second one is refused with the typed 409 (CONFLICT for a state or
 * key conflict, VERSION_MISMATCH for a stale If-Match) and that
 * exactly one effect exists:
 *
 *   [P2-S09-AC-052] CMS-03A-01  two creates of one type key: the key lock serializes them,
 *                               the loser is refused with the typed 409 CONFLICT, one type
 *   [P2-S09-AC-153] [P2-S09-AC-157] CMS-03A-08  two signed lifecycle advances of one block: the
 *                               loser is refused with the typed 409 CONFLICT, one event
 *   [P2-S09-AC-301] CMS-03A-09  two successor commands for one source: one draft
 *   [P2-S09-AC-424] [P2-S09-AC-1130] CMS-03A-12  two reviewers decide one review version: one
 *                               approval, the approved review holds exactly the
 *                               policy count of decisions
 *   [P2-S09-AC-529] CMS-03A-15  two grants of one (owner, subject, capability):
 *                               the key lock serializes them, one aggregate
 *   [P2-S09-AC-558] [P2-S09-AC-1137] CMS-03A-16  two renewals of one aggregate at one version
 *   [P2-S09-AC-586] [P2-S09-AC-1137] CMS-03A-17  two revocations of one aggregate at one version
 *
 * Run only against the disposable local Supabase database right after
 * `pnpm db:reset`; run `pnpm db:reset` again afterwards so the pgTAP suite finds
 * an uninitialized owner.  Every row is produced through the named commands (the
 * pgTAP helper fragments run in one committed psql transaction); the runner never
 * inserts a review, decision, dry-run, plan or grant row.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const container = process.env.AC217_DB_CONTAINER ?? 'supabase_db_wejammin';
const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOLD_SECONDS = 5;
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

const runScript = (script, appName = 's09conc-setup') => {
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
    psqlArgs('s09conc-probe', ['-At', '-c', statement]),
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

const fragment = (relative) => readFileSync(join(testsDir, relative), 'utf8');

// ----------------------------------------------------------------- setup ----
console.log('# building the race fixtures through the named commands');
const request = (actor, body, withBinding = false) =>
  `${body} || jsonb_build_object('context', pg_temp.s09d_context('${actor}', ${withBinding}))`;
const setupScript = [
  '\\set ON_ERROR_STOP on',
  'begin;',
  fragment('phase_02_slice_09_dec108/00-helpers.sqlinc'),
  fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
  fragment('phase_02_slice_09_dec108/02-chain.sqlinc'),
  fragment('phase_02_slice_09_dec108/03-support.sqlinc'),
  fragment('phase_02_slice_09_dec119/00-support.sqlinc'),
  fragment('phase_02_slice_09_p240/00-a01.sqlinc'),
  fragment('phase_02_slice_09_p240/01-block.sqlinc'),
  `select pg_temp.p_register('race157', pg_temp.p_block_request('race157', 1));`,
  // AC301: an active source that two commands will both try to clone.
  `select pg_temp.s09d_create_type('a', 'race301');`,
  `select pg_temp.s09d_to_active('a');`,
  // AC424: an ordinary review (one decision) with two assigned reviewers.
  `select pg_temp.s09d_create_type('b', 'race424');`,
  `select pg_temp.s09d_to_review('b');`,
  `select pg_temp.s09d_assign('b', 'rev1');`,
  `select pg_temp.s09d_assign('b', 'rev2');`,
  // AC529 / AC558 / AC586: members and two existing aggregates.
  `select pg_temp.s09g_member('rev1');`,
  `select pg_temp.s09g_member('rev2');`,
  `select pg_temp.s09g_member('rev3');`,
  `select pg_temp.s09g_grant('g558', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(10));`,
  `select pg_temp.s09g_grant('g586', 'owner', 'rev2', 'cms.navigation_editor', pg_temp.s09g_day(10));`,
  `do $check$ begin
     if pg_temp.s09d_outcome('a:activate') <> 'OK' or pg_temp.s09d_outcome('b:submit') <> 'OK'
        or pg_temp.s09d_outcome('b:assign:rev1') <> 'OK' or pg_temp.s09d_outcome('b:assign:rev2') <> 'OK'
        or pg_temp.s09d_outcome('g558') <> 'OK' or pg_temp.s09d_outcome('g586') <> 'OK' then
       raise exception 'setup chain did not complete: % % % % % %', pg_temp.s09d_outcome('a:activate'), pg_temp.s09d_outcome('b:submit'), pg_temp.s09d_outcome('b:assign:rev1'), pg_temp.s09d_outcome('b:assign:rev2'), pg_temp.s09d_outcome('g558'), pg_temp.s09d_outcome('g586');
     end if;
   end $check$;`,
  `select jsonb_build_object(
     'actors', (select jsonb_object_agg(key, jsonb_build_object('auth', auth_user_id, 'person', person_id, 'party', party_id, 'binding', binding_id))
                  from s09d_actor where key in ('owner', 'rev1', 'rev2')),
     'typeA', pg_temp.s09d_id('a:type'), 'versionA', pg_temp.s09d_id('a:version'), 'typeB', pg_temp.s09d_id('b:type'),
     'reviewB', pg_temp.s09d_id('b:review'), 'rev3Person', pg_temp.s09d_actor_id('rev3', 'person'),
     'grant558', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g558')), 'grant586', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g586')),
     'blockRace', (pg_temp.s09d_resp('race157')->>'id'),
     'adv1', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('race157')->>'id')::uuid, 'supported', 'deprecated'),
     'adv2', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('race157')->>'id')::uuid, 'supported', 'deprecated'),
     'create1', ${request('owner', `pg_temp.p_base('race052', '{"idempotencyKey":"s09conc-create-0001"}'::jsonb)`)},
     'create2', ${request('owner', `pg_temp.p_base('race052', '{"idempotencyKey":"s09conc-create-0002"}'::jsonb)`)},
     'succ1', ${request('owner', `jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', null, 'fallbackChains', null, 'idempotencyKey', 's09conc-succ-0001')`)},
     'succ2', ${request('owner', `jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', null, 'fallbackChains', null, 'idempotencyKey', 's09conc-succ-0002')`)},
     'dec1', ${request('rev1', `jsonb_build_object('reviewId', pg_temp.s09d_id('b:review'), 'expectedVersion', pg_temp.s09d_review_version('b'), 'decision', 'approve', 'idempotencyKey', 's09conc-dec-0001')`, true)},
     'dec2', ${request('rev2', `jsonb_build_object('reviewId', pg_temp.s09d_id('b:review'), 'expectedVersion', pg_temp.s09d_review_version('b'), 'decision', 'approve', 'idempotencyKey', 's09conc-dec-0002')`, true)},
     'grant1', ${request('owner', `jsonb_build_object('subjectPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'capability', 'cms.template_designer', 'validThrough', pg_temp.s09g_day(5), 'idempotencyKey', 's09conc-grant-0001')`, true)},
     'grant2', ${request('owner', `jsonb_build_object('subjectPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'capability', 'cms.template_designer', 'validThrough', pg_temp.s09g_day(5), 'idempotencyKey', 's09conc-grant-0002')`, true)},
     'renew1', ${request('owner', `jsonb_build_object('grantId', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g558')), 'expectedVersion', '1', 'validThrough', pg_temp.s09g_day(20), 'idempotencyKey', 's09conc-renew-0001')`, true)},
     'renew2', ${request('owner', `jsonb_build_object('grantId', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g558')), 'expectedVersion', '1', 'validThrough', pg_temp.s09g_day(20), 'idempotencyKey', 's09conc-renew-0002')`, true)},
     'revoke1', ${request('owner', `jsonb_build_object('grantId', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g586')), 'expectedVersion', '1', 'idempotencyKey', 's09conc-revoke-0001')`, true)},
     'revoke2', ${request('owner', `jsonb_build_object('grantId', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g586')), 'expectedVersion', '1', 'idempotencyKey', 's09conc-revoke-0002')`, true)}
   )::text;`,
  'commit;',
].join('\n');
const ids = JSON.parse(runScript(setupScript));

const gucs = (actor) => {
  if (actor === null) return `select set_config('request.jwt.claim.role','service_role',false);`;
  const a = ids.actors[actor];
  return `select set_config('request.jwt.claim.role','service_role',false),
  set_config('request.jwt.claim.sub',${sql(a.auth)},false),
  set_config('app.auth_user_id',${sql(a.auth)},false),
  set_config('app.actor_auth_user_id',${sql(a.auth)},false),
  set_config('app.actor_person_id',${sql(a.person)},false),
  set_config('app.acting_party_id',${sql(a.party)},false),
  set_config('app.acting_context_id',${sql(a.binding)},false);`;
};
const call = (fn, req) =>
  `select platform_api.${fn}(${sql(JSON.stringify(req))}::jsonb);`;

// One race: S1 commits after a hold, S2 starts during the hold and must block.
// `refusal` is the typed 409 the loser must get: a stale If-Match (the winner
// bumped the version the loser still carries) is VERSION_MISMATCH, a state or
// key conflict at an unchanged version is CONFLICT.
const race = async (name, fn, first, second, refusal = 'CONFLICT') => {
  console.log(`# ${name}: the first command is in flight (${HOLD_SECONDS}s hold)`);
  const hold = runAsync(
    `s09conc-${name}-1`,
    `begin; ${gucs(first.actor)} ${call(fn, first.request)} select pg_sleep(${HOLD_SECONDS}); commit;`,
  );
  await waitFor(
    `${name}: the first command to hold its locks`,
    () => waitEvent(`s09conc-${name}-1`) === 'Timeout:PgSleep',
  );
  const blocked = runAsync(
    `s09conc-${name}-2`,
    `${gucs(second.actor)} ${call(fn, second.request)}`,
  );
  await waitFor(
    `${name}: the second command to block on a lock`,
    () => waitEvent(`s09conc-${name}-2`).startsWith('Lock:'),
  );
  assert(
    waitEvent(`s09conc-${name}-1`) === 'Timeout:PgSleep',
    `${name}: the second command is blocked behind the still-uncommitted first one (it did not overtake it)`,
  );
  const r1 = await hold.done;
  const r2 = await blocked.done;
  assert(r1.code === 0, `${name}: the first command committed`);
  assert(
    r2.code !== 0 && new RegExp(`ERROR:\\s+${refusal}\\b`).test(r2.stderr),
    `${name}: the blocked second command was refused with the typed 409 ${refusal} after the first committed (${r2.stderr.trim().split('\n').slice(0, 2).join(' ')})`,
  );
  return { r1, r2 };
};

// --------------------------------------------------------------- AC052 ----
await race(
  'create',
  'cms_create_type_draft',
  { actor: 'owner', request: ids.create1 },
  { actor: 'owner', request: ids.create2 },
);
assert(
  runValue(
    `select (select count(*) from platform_private.cms_content_types where type_key = 'race052') || ':' || (select count(*) from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'race052') || ':' || (select count(*) from platform_private.cms_schema_artifacts a join platform_private.cms_content_type_versions v on v.id = a.content_type_version_id join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'race052');`,
  ) === '1:1:1',
  '[P2-S09-AC-052] two concurrent creates of one type key: the unique key lock serialized them, the loser got the typed 409 and exactly one type, version and artifact exist',
);

// ------------------------------------------------------- AC153 / AC157 ----
await race(
  'advance',
  'cms_advance_block_lifecycle',
  { actor: null, request: ids.adv1 },
  { actor: null, request: ids.adv2 },
);
assert(
  runValue(
    `select (select count(*) from platform_private.cms_block_definition_lifecycle_events where block_definition_version_id = ${sql(ids.blockRace)}::uuid) || ':' || (select count(*) from platform_private.cms_release_nonce_receipts where operation_id = 'CMS-03A-08' and outcome = 'consumed');`,
  ) === '1:1',
  '[P2-S09-AC-153] [P2-S09-AC-157] two concurrent lifecycle advances of one block: the loser got the typed 409 and exactly one event and one consumed receipt exist',
);

// --------------------------------------------------------------- AC301 ----
await race(
  'succ',
  'cms_create_schema_successor',
  { actor: 'owner', request: ids.succ1 },
  { actor: 'owner', request: ids.succ2 },
);
assert(
  Number(
    runValue(
      `select count(*) from platform_private.cms_content_type_versions where content_type_id = ${sql(ids.typeA)}::uuid and state = 'draft';`,
    ),
  ) === 1 &&
    Number(
      runValue(
        `select count(*) from platform_private.cms_content_type_versions where content_type_id = ${sql(ids.typeA)}::uuid;`,
      ),
    ) === 2,
  '[P2-S09-AC-301] concurrent same-source successor requests produced exactly one draft beside the source',
);

// --------------------------------------------------------------- AC424 ----
await race(
  'decide',
  'cms_decide_schema_review',
  { actor: 'rev1', request: ids.dec1 },
  { actor: 'rev2', request: ids.dec2 },
  'VERSION_MISMATCH',
);
assert(
  runValue(
    `select (select state from platform_private.cms_schema_reviews where id = ${sql(ids.reviewB)}::uuid) || ':' || (select count(*) from platform_private.cms_schema_review_decisions where review_id = ${sql(ids.reviewB)}::uuid) || ':' || (select required_decision_count from platform_private.cms_schema_reviews where id = ${sql(ids.reviewB)}::uuid);`,
  ) === 'approved:1:1',
  '[P2-S09-AC-424] [P2-S09-AC-1130] concurrent decisions on one review version: the loser got a typed 409 and the approved review holds exactly the policy count (1) of decisions',
);

// --------------------------------------------------------------- AC529 ----
await race(
  'grant',
  'cms_grant_capability',
  { actor: 'owner', request: ids.grant1 },
  { actor: 'owner', request: ids.grant2 },
);
assert(
  runValue(
    `select (select count(*) from platform_private.cms_capability_grants where subject_person_ref = ${sql(ids.rev3Person)}::uuid and capability_code = 'cms.template_designer') || ':' || (select count(*) from platform_private.cms_capability_grant_events e join platform_private.cms_capability_grants g on g.id = e.grant_id where g.subject_person_ref = ${sql(ids.rev3Person)}::uuid and g.capability_code = 'cms.template_designer');`,
  ) === '1:1',
  '[P2-S09-AC-529] the (owner, subject, capability) key lock serialized two concurrent grants: one aggregate and one event',
);

// --------------------------------------------------------------- AC558 ----
await race(
  'renew',
  'cms_renew_capability_grant',
  { actor: 'owner', request: ids.renew1 },
  { actor: 'owner', request: ids.renew2 },
  'VERSION_MISMATCH',
);
assert(
  runValue(
    `select (select version from platform_private.cms_capability_grants where id = ${sql(ids.grant558)}::uuid) || ':' || (select count(*) from platform_private.cms_capability_grant_events where grant_id = ${sql(ids.grant558)}::uuid and action = 'renewed');`,
  ) === '2:1',
  '[P2-S09-AC-558] [P2-S09-AC-1137] two concurrent renewals at one expected version: the loser got a typed 409, the aggregate is at version 2 with one renewed event',
);

// --------------------------------------------------------------- AC586 ----
await race(
  'revoke',
  'cms_revoke_capability_grant',
  { actor: 'owner', request: ids.revoke1 },
  { actor: 'owner', request: ids.revoke2 },
  'VERSION_MISMATCH',
);
assert(
  runValue(
    `select (select version || '/' || state from platform_private.cms_capability_grants where id = ${sql(ids.grant586)}::uuid) || ':' || (select count(*) from platform_private.cms_capability_grant_events where grant_id = ${sql(ids.grant586)}::uuid and action = 'revoked');`,
  ) === '2/revoked:1',
  '[P2-S09-AC-586] [P2-S09-AC-1137] two concurrent revocations at one expected version: the loser got a typed 409, the aggregate is revoked at version 2 with one revoked event',
);
console.log('# all race assertions passed; run `pnpm db:reset` before the pgTAP suite');
