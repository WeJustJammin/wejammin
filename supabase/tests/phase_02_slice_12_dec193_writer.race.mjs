#!/usr/bin/env node
/** DEC193 candidate-target race. Standalone: NEVER import for syntax checking.
 * Runs in the canonical db:verify gate (WEJAMMIN_CANONICAL_RACE=1, infra/database-races/canonical-mode.mjs) or, by hand, in root's ALT mode
 * with its explicit release.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answer,
  assertTarget,
  cleanup,
  commit,
  complete,
  definitionWait,
  jsonb,
  query,
  ready,
  sql,
  start,
  testsDir,
  waitDefinition,
} from './phase_02_slice_12_dec193_writer_boundaries/091-race-session-kit.mjs';

assertTarget(); // Before any client or database access; no default-container fallback.
const fragment = (path) => readFileSync(join(testsDir, path), 'utf8');
const jwt = fragment('support/jwt-claims.sqlinc');
const actorHelpers = fragment('phase_02_slice_09_dec108/00-helpers.sqlinc');
const patternOracles = fragment(
  'phase_02_slice_12_pattern_definition/010-oracles.sqlinc',
);
const placementOracles = fragment(
  'phase_02_slice_12_pattern_placement/010-oracles.sqlinc',
);
const raceHelpers = fragment(
  'phase_02_slice_12_dec193_writer_boundaries/090-race-fixture.sqlinc',
);
const begin = 'begin isolation level read committed;';
const runtime = [
  jwt,
  actorHelpers,
  'insert into s09d_actor select * from public.s12wr_actor;',
  'insert into s09d_ids select * from public.s12wr_base;',
  patternOracles,
  placementOracles,
  raceHelpers,
].join('\n');
const tx = (body) => `${begin}\n${runtime}\n${body}`;
const stage = async (body) => JSON.parse(await query(tx(`${body}\ncommit;`)));
const snapshot = () => stage('select pg_temp.s12wr_snapshot();');
const facts = () => stage('select pg_temp.s12wr_facts();');
const call = (request, operation = 'writer') =>
  `select pg_temp.s12wr_call(${sql(operation)}, ${jsonb(request)});`;
const assertRole = (result) => {
  assert.equal(result.callRole, 'service_role', 'actual public transport role');
  assert.equal(
    result.roleRestored,
    true,
    'harness restores postgres after the RPC',
  );
};
const refuse = (result) => {
  assertRole(result);
  assert.deepEqual(
    [result.state, result.message, result.response],
    ['P0001', 'pattern_version_not_active', null],
    'target changed after candidate collection: exact typed refusal, never unlocked acceptance',
  );
  assert.deepEqual(JSON.parse(result.detail), ['/targetPatternVersion']);
};
const patternStates = (value) =>
  value.patterns.map((row) => [row.version, row.state]);

let bootstrapOwned = false;
let primaryFailure;
let cleanupErrors = [];
try {
  assert.equal(
    await query("select current_setting('transaction_isolation');"),
    'read committed',
    'direct-session isolation control, not actual HTTP proof',
  );
  assert.equal(
    await query(`select to_regclass('public.s12wr_actor') is null
    and to_regclass('public.s12wr_base') is null and to_regclass('public.s12wr_world') is null
    and not exists (select 1 from platform_private.cms_pattern_versions)
    and not exists (select 1 from auth.users where id = 'a9d10000-0000-4000-8000-000000000001')
    and to_regprocedure('platform_private.cms_pattern_root_snapshot(platform_private.cms_composition_instances,platform_private.cms_pattern_versions,boolean)') is not null;`),
    't',
    'fresh root-staged ALT and DEC193 writer prerequisites',
  );
  const bootstrap = [
    jwt,
    begin,
    'create extension if not exists pgtap with schema extensions;',
    "select no_plan(); select set_config('s12pd.type_count', '1', true);",
    actorHelpers,
    fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
    fragment('phase_02_slice_09_dec108/02-chain.sqlinc'),
    fragment('phase_02_slice_09_p240/01-block.sqlinc'),
    fragment('phase_02_slice_12_pattern_definition/000-fixtures.sqlinc'),
    patternOracles,
    fragment('phase_02_slice_12_pattern_placement/000-fixtures.sqlinc'),
    placementOracles,
    fragment('phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc'),
    'create table public.s12wr_actor as table s09d_actor;',
    'create table public.s12wr_base as table s09d_ids;',
    'create table public.s12wr_world(ids jsonb not null);',
    'revoke all on public.s12wr_actor, public.s12wr_base, public.s12wr_world from public, anon, authenticated, service_role;',
    raceHelpers,
    "select pg_temp.s12wr_ordered_draft('wr-v1', null, true);",
    "select * from pg_temp.s12pl_activate('wr-v1');",
    "select * from pg_temp.s12pu_place('wr-entry', 'wr-v1');",
    "select pg_temp.s12wr_ordered_draft('wr-v2', '1', false);",
    "select * from pg_temp.s12pl_activate('wr-v2');",
    `select * from pg_temp.s12pl_pattern('wr-v3', 's12wr-race',
      jsonb_build_array(pg_temp.s12pd_block('hero', '[]', '{"title":"wr-v3"}')),
      null, false, '2');`,
    `select pg_temp.s12wr_assert(pg_temp.s12pd_state('wr-v3') = '00000', 'real V3 draft');
    insert into public.s12wr_world select jsonb_build_object(
      'base', pg_temp.s12pd_body('wr-v1')->'id', 'candidate', pg_temp.s12pd_body('wr-v2')->'id',
      'next', pg_temp.s12pd_body('wr-v3')->'id', 'lineage', pg_temp.s12pd_body('wr-v1')->'patternId',
      'entry', pg_temp.s12pl_entry_id('wr-entry'), 'revision', pg_temp.s12pl_rev('wr-entry'),
      'instance', pg_temp.s12pu_head('wr-entry', '/hero'),
      'activate', pg_temp.s12wr_approve('wr-v3'),
      'request', pg_temp.s12pu_update_request('wr-entry', 'accept',
        jsonb_build_array(pg_temp.s12pu_target('wr-entry', '/hero')),
        's12wr-race-accept-three', 3) || jsonb_build_object('correlationId', extensions.gen_random_uuid()));
    select pg_temp.s12wr_assert((select count(*) = 1 from public.s12wr_world), 'one owned world');
    commit;
    select jsonb_build_object('built', true,
      'actor', 'public.s12wr_actor'::regclass::oid::bigint,
      'base', 'public.s12wr_base'::regclass::oid::bigint,
      'world', 'public.s12wr_world'::regclass::oid::bigint);`,
  ].join('\n');
  const metadata = JSON.parse(await query(bootstrap, true));
  assert.equal(metadata.built, true, 'fixture transaction committed');
  const oids = [metadata.actor, metadata.base, metadata.world];
  assert.ok(
    oids.every((oid) => Number.isSafeInteger(oid) && oid > 0) &&
      new Set(oids).size === 3,
    'three observed owned metadata OIDs',
  );
  bootstrapOwned = metadata;
  const ids = JSON.parse(await query('select ids from public.s12wr_world;'));
  assert.ok(
    ids.base < ids.candidate,
    'real UUID sampling proves B first in the ordered lock set',
  );
  assert.equal(ids.request.targetPatternVersion, 3);
  assert.deepEqual(
    [ids.request.expectedVersion, ids.request.ifMatch],
    ['2', '2'],
  );
  const initialFacts = await facts();
  assert.deepEqual(patternStates(initialFacts), [
    [1, 'superseded'],
    [2, 'active'],
    [3, 'approved'],
  ]);
  assert.equal(initialFacts.entryVersion, '2');
  assert.deepEqual(
    initialFacts.instances.map((row) => [
      row.id,
      row.pin,
      row.version,
      row.mode,
    ]),
    [[ids.instance, 1, '1', 'linked']],
  );
  for (const row of initialFacts.patterns) {
    assert.equal(
      row.tree.length,
      1,
      'flat real pattern: no hidden nested pin before B',
    );
    assert.equal(row.tree[0].kind, 'block');
    assert.deepEqual(row.tree[0].children, []);
  }
  const initial = await snapshot();
  const control2Request = {
    ...ids.request,
    targetPatternVersion: 2,
    idempotencyKey: 's12wr-control-two',
  };
  const control2 = start(
    'valid-two-control',
    tx(
      `savepoint valid_control; ${call(control2Request)} rollback to valid_control; commit;`,
    ),
  );
  await complete(control2);
  const valid2 = answer(control2);
  assertRole(valid2);
  assert.equal(
    valid2.state,
    '00000',
    'same actual writer admits the valid current target',
  );
  assert.deepEqual(Object.keys(valid2.response), ['items']);
  assert.deepEqual(JSON.parse(valid2.headers), [{ etag: '"3"' }]);
  assert.equal(valid2.response.items[0].patternVersion, 2);
  assert.deepEqual(
    await snapshot(),
    initial,
    'positive control rolls back every effect',
  );
  const futureControl = start(
    'future-three-control',
    tx(
      `${call({ ...ids.request, idempotencyKey: 's12wr-control-future' })} commit;`,
    ),
  );
  await complete(futureControl);
  refuse(answer(futureControl));
  assert.deepEqual(
    await snapshot(),
    initial,
    'future target refuses before the race with no effects',
  );
  console.log(
    'ok - real signed/governed V1/V2/V3, placement, current-target success and future-target refusal controls',
  );

  const holder = start(
    'base-definition-holder',
    `${begin}
    do $hold$ begin
      perform 1 from platform_private.cms_pattern_versions where id = ${sql(ids.base)}::uuid for update;
      if not found then raise exception 'writer race B pin missing'; end if;
    end $hold$;
    select jsonb_build_object('id', id, 'xid', (select transactionid::text from pg_locks
      where pid = pg_backend_pid() and locktype = 'transactionid' and granted and mode = 'ExclusiveLock'),
      'page', split_part(btrim(ctid::text, '()'), ',', 1)::bigint,
      'offset', split_part(btrim(ctid::text, '()'), ',', 2)::integer)
    from platform_private.cms_pattern_versions where id = ${sql(ids.base)}::uuid;`,
    true,
  );
  await ready(holder);
  const tuple = answer(holder);
  assert.equal(tuple.id, ids.base);
  assert.match(tuple.xid, /^[1-9][0-9]*$/u);
  assert.ok(Number.isSafeInteger(tuple.page) && tuple.page >= 0);
  assert.ok(Number.isSafeInteger(tuple.offset) && tuple.offset > 0);
  const writer = start('actual-writer', tx(`${call(ids.request)} commit;`));
  await waitDefinition(writer, holder, tuple);
  assert.deepEqual(
    patternStates(await facts()),
    [
      [1, 'superseded'],
      [2, 'active'],
      [3, 'approved'],
    ],
    'V2 is the sole active candidate at the observed post-selection definition wait',
  );
  assert.deepEqual(
    await snapshot(),
    initial,
    'blocked writer has no committed effects',
  );

  const activation = start(
    'real-activate-three',
    tx(`${call(ids.activate, 'activate')} commit;`),
  );
  await complete(activation, 8000);
  const activated = answer(activation);
  assertRole(activated);
  assert.equal(
    activated.state,
    '00000',
    'real governed activation commits before releasing B',
  );
  assert.deepEqual(
    [
      activated.response.subjectId,
      activated.response.subjectState,
      String(activated.response.subjectVersion),
      activated.response.action,
    ],
    [ids.next, 'active', '3', 'activate'],
  );
  const pids = [holder.pid, writer.pid, activation.pid];
  assert.ok(
    pids.every((pid) => Number.isSafeInteger(pid) && pid > 0) &&
      new Set(pids).size === 3,
    'independent holder, writer and activator backends',
  );
  assert.deepEqual(patternStates(await facts()), [
    [1, 'superseded'],
    [2, 'superseded'],
    [3, 'active'],
  ]);
  const afterActivation = await snapshot();
  assert.equal(
    await definitionWait(writer, holder, tuple),
    true,
    'same writer still waits on the same B tuple AFTER V3 activation COMMIT',
  );
  console.log(
    `ok - real V3 activation committed while writer PID ${writer.pid} still waits on B; activation PID ${activation.pid}`,
  );
  await commit(holder);
  await complete(writer);
  const result = answer(writer);
  console.log(
    `# actual raced writer outcome: ${JSON.stringify({
      state: result.state,
      message: result.message,
      entryEtag: result.headers,
      pins: result.response?.items?.map((row) => row.patternVersion),
    })}`,
  );
  refuse(result);
  assert.deepEqual(
    await snapshot(),
    afterActivation,
    'typed refusal preserves ALL full-row stores including receipts/audit/outbox/reviews/authority',
  );
  assert.deepEqual((await facts()).instances, initialFacts.instances);

  // A fresh V3 request must succeed once its own target/closure can be locked.
  const control3 = start(
    'valid-three-control',
    tx(`savepoint fresh_three;
    ${call({ ...ids.request, idempotencyKey: 's12wr-control-three' })}
    rollback to fresh_three; commit;`),
  );
  await complete(control3);
  const valid3 = answer(control3);
  assertRole(valid3);
  assert.equal(
    valid3.state,
    '00000',
    'freshly planned V3 remains legitimate after activation',
  );
  assert.equal(valid3.response.items[0].patternVersion, 3);
  assert.deepEqual(Object.keys(valid3.response), ['items']);
  assert.deepEqual(JSON.parse(valid3.headers), [{ etag: '"3"' }]);
  assert.deepEqual(
    await snapshot(),
    afterActivation,
    'fresh V3 control rolls all effects back',
  );
  console.log(
    'ok - changed target refused atomically; fresh independently locked V3 still accepted',
  );
} catch (error) {
  primaryFailure = error;
} finally {
  try {
    cleanupErrors = await cleanup(bootstrapOwned);
  } catch (error) {
    cleanupErrors.push(error);
  }
}
if (primaryFailure || cleanupErrors.length) {
  throw new AggregateError(
    [primaryFailure, ...cleanupErrors].filter(Boolean),
    'DEC193 writer race/owned cleanup failed',
  );
}
console.log(
  '# DEC193 writer race passed; reset the database before reusing the fixture',
);
