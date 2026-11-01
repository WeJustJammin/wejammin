#!/usr/bin/env node
/** TEST ONLY. Standalone; NEVER import for syntax checking.
 * Runs in the canonical db:verify gate (WEJAMMIN_CANONICAL_RACE=1, infra/database-races/canonical-mode.mjs) or, by hand, in root's ALT mode
 * with its explicit release.
 * Needs a freshly reset database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertTarget,
  cleanup,
  commit,
  complete,
  frame,
  isReady,
  jsonb,
  nonce,
  query,
  ready,
  root,
  sql,
  start,
  until,
} from './phase_02_slice_12_dec193_pattern_currentness/091-publication-race-session-kit.mjs';
import {
  succeeded,
  activationEffects,
  publicationEffects,
} from './phase_02_slice_12_dec193_pattern_currentness/093-publication-race-effects.mjs';

assertTarget();
const selected = process.env.S12_DEC199_PUBLICATION_RACE_CASE ?? 'both';
assert.ok(
  ['both', 'change-first', 'publish-first'].includes(selected),
  'closed scenario selector',
);
const fragment = (name) =>
  readFileSync(join(root, 'supabase/tests', name), 'utf8');
const directory = 'phase_02_slice_12_dec193_pattern_currentness/';
const jwt = fragment('support/jwt-claims.sqlinc');
const helpers = fragment('phase_02_slice_09_dec108/00-helpers.sqlinc');
const fixture = fragment(directory + '090-publication-race-fixture.sqlinc');
const oracles = fragment(directory + '092-publication-race-oracles.sqlinc');
const begin = 'begin isolation level read committed;';
const runtime = [
  jwt,
  begin,
  helpers,
  'insert into s09d_actor select * from public.s12pr_actor;',
  'insert into s09d_ids select * from public.s12pr_base;',
  fixture,
  oracles,
].join('\n');
const tx = (body) => `${runtime}\n${body}`;
const read = async (expression) =>
  JSON.parse(await query(tx(`select ${expression}; commit;`)));
const snapshot = () => read('pg_temp.s12pr_snapshot()');
const facts = (tag) => read(`pg_temp.s12pr_facts(${sql(tag)})`);
const request = (tag) => read(`pg_temp.s12pr_request(${sql(tag)})`);

let bootstrap;
let ownership;
let failure;
let cleanupErrors = [];
try {
  assert.equal(
    await query(`select current_setting('transaction_isolation')='read committed'
    and to_regclass('public.s12pr_world') is null and to_regclass('public.s12pr_actor') is null
    and to_regclass('public.s12pr_base') is null and not exists(select 1 from platform_private.cms_pattern_versions)
    and not exists(select 1 from auth.users where id='a9d10000-0000-4000-8000-000000000001')
    and to_regprocedure('platform_private.cms_pattern_active_digest(uuid,jsonb)') is not null;`),
    't',
    'fresh released staged ALT',
  );
  bootstrap = start(
    'bootstrap',
    [
      jwt,
      'create extension if not exists pgtap with schema extensions;',
      begin,
      'select no_plan();',
      helpers,
      'create table public.s12pr_actor as table s09d_actor;',
      'create table public.s12pr_base as table s09d_ids;',
      'create table public.s12pr_world(nonce uuid not null, ids jsonb not null);',
      `insert into public.s12pr_world values(${sql(nonce)}::uuid,'{}');`,
      'revoke all on public.s12pr_actor,public.s12pr_base,public.s12pr_world from public,anon,authenticated,service_role;',
      fixture,
      oracles,
      `select 'ownership:'::text || jsonb_build_object('nonce',${sql(nonce)},'actor','public.s12pr_actor'::regclass::oid::bigint,
      'base','public.s12pr_base'::regclass::oid::bigint,'world','public.s12pr_world'::regclass::oid::bigint);
      create temp table s12pr_saved as select pg_temp.s12pr_context() context;`,
      fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
      fragment('phase_02_slice_09_dec108/02-chain.sqlinc'),
      fragment('phase_02_slice_09_p240/01-block.sqlinc'),
      `do $setup$ declare result text; before_context jsonb:=(select context from s12pr_saved); begin
      foreach result in array array['cms.author','cms.editor','cms.template_designer'] loop
        perform pg_temp.s12pr_assert(pg_temp.s09d_grant_via_rpc('owner',result,7) in ('OK','EXISTS'),'real owner grant');
      end loop;
      perform pg_temp.s12pr_assert(pg_temp.s09d_grant_via_rpc('rev1','cms.reviewer',7) in ('OK','EXISTS'),'real reviewer grant');
      perform pg_temp.s12pr_assert(pg_temp.s09d_grant_via_rpc('designer2','cms.publisher',7) in ('OK','EXISTS'),'real distinct publisher grant');
      perform pg_temp.s09d_create_type('pr-type','s12prtype'); perform pg_temp.s09d_to_active('pr-type');
      perform pg_temp.s12pr_assert(not exists(select 1 from s09d_probe where label like 'pr-type:%' and state<>'00000'),'real complete type chain');
      update s09d_actor set party_id=pg_temp.s09d_id('ownerOrg') where key='rev1';
      perform pg_temp.s09d_bind_context('rev1');
      perform pg_temp.s12pr_ok('register',pg_temp.p_block_request('s12pr.block',1,jsonb_build_object(
        'allowedChildren',jsonb_build_array('s12pr.block'),'slotRules',jsonb_build_object('maxDepth',16,'maxNodes',512))),null);
      update public.s12pr_world set ids=jsonb_build_object('change-first',pg_temp.s12pr_case('change-first'),
        'publish-first',pg_temp.s12pr_case('publish-first'),'actors',jsonb_build_object(
          'publisher',pg_temp.s09d_actor_id('designer2','auth'),'activator',pg_temp.s09d_actor_id('owner','auth'),
          'owner',pg_temp.s09d_id('ownerOrg')));
      insert into public.s12pr_actor select * from s09d_actor; insert into public.s12pr_base select * from s09d_ids;
      perform pg_temp.s12pr_restore(before_context);
      perform pg_temp.s12pr_assert(pg_temp.s12pr_context()=before_context,'complete bootstrap context restored');
    end $setup$; commit;`,
    ].join('\n'),
    false,
    true,
  );
  await complete(bootstrap, 125000);
  ownership = frame(bootstrap, 'ownership');
  assert.equal(ownership.nonce, nonce);
  const oids = [ownership.actor, ownership.base, ownership.world];
  assert.ok(
    oids.every((oid) => Number.isSafeInteger(oid) && oid > 0) &&
      new Set(oids).size === 3,
  );
  const world = JSON.parse(await query('select ids from public.s12pr_world;'));
  assert.notEqual(
    world.actors.publisher,
    world.actors.activator,
    'distinct publisher/activator authority',
  );
  for (const tag of ['change-first', 'publish-first'].filter(
    (tag) => selected === 'both' || selected === tag,
  )) {
    const item = world[tag];
    const initial = await snapshot();
    const initialFacts = await facts(tag);
    assert.deepEqual(
      initialFacts.patterns.map((row) => [row.id, row.state]).sort(),
      [
        [item.child, 'active'],
        [item.parent, 'active'],
        [item.next, 'approved'],
      ].sort(),
    );
    assert.deepEqual(initialFacts.review.dependency_manifest, item.manifest);
    assert.deepEqual(initialFacts.rebuilt, item.manifest);
    assert.deepEqual(
      [initialFacts.review.state, initialFacts.review.version],
      ['approved', 2],
    );
    assert.equal(initialFacts.schedules[0].state, 'pending');
    assert.equal(initialFacts.schedules[0].attempt_count, 0);
    assert.equal(initialFacts.schedules[0].lease_id, null);
    const publishRequest = await request(tag);
    for (const [operation, req, actor] of [
      [
        'publish',
        { ...publishRequest, idempotencyKey: `s12pr-control-${tag}` },
        'designer2',
      ],
      ['activate', item.activation, 'owner'],
    ]) {
      const control = start(
        'positive-control',
        tx(`savepoint positive;
        select 'rpc:'::text || pg_temp.s12pr_call(${sql(operation)},${jsonb(req)},${sql(actor)});
        rollback to positive; commit;`),
      );
      await complete(control);
      succeeded(frame(control, 'rpc'));
      assert.equal(
        frame(control, 'rpc').response.kind,
        undefined,
        'actual positive resource, not committed refusal',
      );
      assert.deepEqual(
        await snapshot(),
        initial,
        'every positive-control effect rolled back',
      );
    }
    const firstOperation = tag === 'change-first' ? 'activate' : 'publish';
    const firstRequest =
      tag === 'change-first' ? item.activation : publishRequest;
    const firstActor = tag === 'change-first' ? 'owner' : 'designer2';
    const first = start(
      'first-held',
      tx(`select 'tuple:'::text || pg_temp.s12pr_tuple(${sql(item.child)}::uuid);
      select 'rpc:'::text || pg_temp.s12pr_call(${sql(firstOperation)},${jsonb(firstRequest)},${sql(firstActor)});
      select 'held:'::text || pg_temp.s12pr_held();`),
      true,
    );
    await ready(first);
    succeeded(frame(first, 'rpc'));
    assert.equal(frame(first, 'rpc').response.kind, undefined);
    const tuple = frame(first, 'tuple');
    const held = frame(first, 'held');
    assert.equal(tuple.id, item.child);
    assert.equal(held.pid, first.pid);
    assert.match(held.xid, /^[1-9][0-9]*$/u);
    assert.deepEqual(
      await snapshot(),
      initial,
      'first RPC result is still UNCOMMITTED',
    );
    const secondOperation = tag === 'change-first' ? 'publish' : 'activate';
    const second = start(
      'second-waiter',
      tx(`select 'rpc:'::text || pg_temp.s12pr_call(${sql(secondOperation)},
      ${jsonb(tag === 'change-first' ? publishRequest : item.activation)},${sql(tag === 'change-first' ? 'designer2' : 'owner')});
      select 'held:'::text || pg_temp.s12pr_held();`),
      true,
    );
    await until(
      'exact old nested-V1 tuple/XID wait',
      async () => {
        assert.ok(
          !isReady(second),
          `actual ${secondOperation} returned before first transaction committed: ${JSON.stringify(frame(second, 'rpc'))}; result remains uncommitted`,
        );
        if (!second.pid) return false;
        return (
          (await query(
            tx(`select pg_temp.s12pr_wait(${second.pid},${first.pid},${sql(second.app)},${sql(first.app)},
        ${sql(held.xid)},${tuple.page},${tuple.offset},${sql(tag === 'change-first' ? 'RowShareLock' : 'AccessExclusiveLock')},
        ${tag === 'change-first'}); commit;`),
          )) === 't'
        );
      },
      [first, second],
    );
    assert.notEqual(first.pid, second.pid);
    console.log(
      `ok - ${tag}: exact nested-V1 tuple/XID witness; first PID ${first.pid}, waiter PID ${second.pid}`,
    );
    await commit(first);
    const afterFirst = await snapshot();
    const afterFirstFacts = await facts(tag);
    assert.deepEqual(
      afterFirstFacts.rebuilt,
      item.manifest,
      'nested state change does not alter manifest bytes',
    );
    if (tag === 'change-first')
      activationEffects(
        initial,
        afterFirst,
        item,
        frame(first, 'rpc').response,
        world.actors,
      );
    else
      publicationEffects(
        initial,
        afterFirst,
        initialFacts,
        afterFirstFacts,
        item,
        frame(first, 'rpc').response,
        world.actors,
        false,
      );
    await ready(second);
    succeeded(frame(second, 'rpc'));
    assert.deepEqual(
      await snapshot(),
      afterFirst,
      'second result is uncommitted until explicit release',
    );
    await commit(second);
    const final = await snapshot();
    const finalFacts = await facts(tag);
    if (tag === 'change-first')
      publicationEffects(
        afterFirst,
        final,
        afterFirstFacts,
        finalFacts,
        item,
        frame(second, 'rpc').response,
        world.actors,
        true,
      );
    else
      activationEffects(
        afterFirst,
        final,
        item,
        frame(second, 'rpc').response,
        world.actors,
      );
    assert.deepEqual(finalFacts.rebuilt, item.manifest);
    const replay = start(
      'same-key-replay',
      tx(`select 'rpc:'::text || pg_temp.s12pr_call('publish',
      ${jsonb(await request(tag))},'designer2'); commit;`),
    );
    await complete(replay);
    succeeded(frame(replay, 'rpc'));
    assert.deepEqual(
      frame(replay, 'rpc').response,
      frame(tag === 'change-first' ? second : first, 'rpc').response,
    );
    assert.equal(
      JSON.parse(frame(replay, 'rpc').headers)[0]['x-cms-idempotent-replay'],
      'true',
    );
    assert.deepEqual(
      await snapshot(),
      final,
      'exact replay preserves EVERY durable row',
    );
    console.log(
      `ok - ${tag}: explicit commit order, full effects and unchanged same-key replay`,
    );
  }
} catch (error) {
  failure = error;
} finally {
  ownership ??= bootstrap && frame(bootstrap, 'ownership');
  try {
    cleanupErrors = await cleanup(ownership);
  } catch (error) {
    cleanupErrors.push(error);
  }
}
if (failure || cleanupErrors.length)
  throw new AggregateError(
    [failure, ...cleanupErrors].filter(Boolean),
    'DEC199 publication race/owned cleanup failed',
  );
console.log(
  '# DEC199 publication race witnesses passed; reset the database before reusing the fixture',
);
