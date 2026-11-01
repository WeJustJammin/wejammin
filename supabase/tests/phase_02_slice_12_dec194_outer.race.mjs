#!/usr/bin/env node
/** DEC-194 real outer merge admission. Standalone: NEVER import for syntax checking.
 * Runs in the canonical db:verify gate (WEJAMMIN_CANONICAL_RACE=1, infra/database-races/canonical-mode.mjs) or, by hand, in root's ALT mode
 * with its explicit release.
 * Needs a freshly reset database. No future helper, trigger or SQL sleep.
 */
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answer,
  blocked,
  cleanupSessions,
  commit,
  configureFixture,
  container,
  jsonb,
  outcome,
  query,
  ready,
  sql,
  start,
  testsDir,
  until,
} from './phase_02_slice_12_dec194_sweep/091-race-session-kit.mjs';
import {
  assertCanonicalTarget,
  assertRaceCheckout,
  canonicalContainer,
  isCanonicalRace,
} from '../../infra/database-races/canonical-mode.mjs';

const root = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
);
// DEC-225: the primary checkout is refused in ALT mode only (one rule, in the helper).
assertRaceCheckout({ root });
if (isCanonicalRace()) {
  // Canonical db:verify mode (set by infra/run-database-race-runners.mjs): the container
  // of the Slice 10 and 11 runners, after the gate's db:reset. No ALT release.
  assertCanonicalTarget({
    altEnvNames: [
      'S12_DEC194_OUTER_RACE_ROOT_RELEASE',
      'S12_DEC194_OUTER_RACE_ALT_CONTAINER',
    ],
  });
  assert.equal(
    container,
    canonicalContainer(),
    'canonical target must match the owned psql kit',
  );
} else {
  assert.equal(
    process.env.S12_DEC194_OUTER_RACE_ROOT_RELEASE,
    '2026-10-16-native-outer-red',
    'explicit root outer ALT release required',
  );
  assert.ok(
    process.env.S10_RACE_DB_CONTAINER,
    'default/fallback seeded database is forbidden',
  );
  assert.equal(
    container,
    process.env.S12_DEC194_OUTER_RACE_ALT_CONTAINER,
    'explicit outer ALT must match the owned psql kit',
  );
  assert.match(
    container,
    /^supabase_db_[a-z0-9_-]+$/iu,
    'named local Supabase ALT container required',
  );
  assert.notEqual(
    container.toLowerCase(),
    'supabase_db_wejammin',
    'primary/default seeded database is forbidden',
  );
}

const fragment = (path) => readFileSync(join(testsDir, path), 'utf8');
const base = [
  'phase_02_slice_09_dec108/00-helpers.sqlinc',
  'phase_02_slice_09_dec108/02-chain.sqlinc',
  'phase_02_slice_09_dec119/00-support.sqlinc',
];
const later = [
  'phase_02_slice_12_governed_assignment/000-world.sqlinc',
  'phase_02_slice_12_governed_activation/000-world.sqlinc',
  'phase_02_slice_12_taxonomy_terms/000-world.sqlinc',
  'phase_02_slice_12_dec194_sweep/000-helpers.sqlinc',
  'phase_02_slice_12_dec194_sweep/090-race-fixture.sqlinc',
];
const begin =
  "begin isolation level read committed; select set_config('app.cms_rpc', 'true', true);";
const helpers = [
  fragment('support/jwt-claims.sqlinc'),
  ...base.map(fragment),
  'insert into s09d_actor select * from public.s12dcr_actor; insert into s09d_ids select * from public.s12dcr_base;',
  fragment('phase_02_slice_12_governed_submit/000-fixtures.sqlinc'),
  'insert into s12gov_ids select * from public.s12dcr_gov on conflict (key) do update set value = excluded.value;',
  ...later.map(fragment),
].join('\n');
const tx = (body) => `${begin}\n${helpers}\n${body}`;
configureFixture(tx);
const stage = async (body) => JSON.parse(await query(body, true));
const outer = (ids) => `select pg_temp.s09d_session('owner');
  select platform_private.cms_act_taxonomy_term(${jsonb(ids.request)});`;
const snapshot = (ids) =>
  stage(`select jsonb_build_object('stores', pg_temp.s12tt_snap()::jsonb,
  'authority', md5((select string_agg(to_jsonb(r)::text, '|' order by to_jsonb(r)::text collate "C") from platform_private.person_party r)
    || (select string_agg(to_jsonb(r)::text, '|' order by to_jsonb(r)::text collate "C") from identity_private.membership_tenure r)
    || (select string_agg(to_jsonb(r)::text, '|' order by to_jsonb(r)::text collate "C") from identity_private.organization_actor_grant r)),
  'retired', pg_temp.s12tt_term(${sql(ids.tax)}::uuid, 'outer-a'), 'survivor', pg_temp.s12tt_term(${sql(ids.tax)}::uuid, 'outer-b'),
  'assignments', (select jsonb_agg(to_jsonb(r) order by r.id) from platform_private.cms_term_assignments r),
  'audit', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from audit_private.audit_events r
    where r.correlation_id = ${sql(ids.correlation)}::uuid), '[]'::jsonb),
  'events', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from platform_private.outbox_events r
    where r.correlation_id = ${sql(ids.correlation)}::uuid), '[]'::jsonb),
  'receipts', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from platform_private.idempotency_records r
    where r.actor_id = ${sql(ids.actor)}::uuid and r.operation = 'CMS-03C-03'
      and r.key_hash = platform_private.cms_key_hash(${sql(ids.request.idempotencyKey)})), '[]'::jsonb));`);

let bootstrapOwned = false;
let primaryFailure;
try {
  assert.equal(
    await query("select current_setting('transaction_isolation');"),
    'read committed',
    'direct session isolation control',
  );
  assert.equal(
    await query(
      "select to_regclass('public.s12dcr_actor') is null and to_regclass('public.s12dcr_base') is null and to_regclass('public.s12dcr_gov') is null and to_regclass('public.s12dcr_cases') is null and not exists (select 1 from platform_private.cms_terms);",
    ),
    't',
    'fresh ALT fixture prerequisite',
  );
  const bootstrap = [
    fragment('support/jwt-claims.sqlinc'),
    begin,
    'create extension if not exists pgtap with schema extensions; select no_plan();',
    fragment(base[0]),
    fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
    ...base.slice(1).map(fragment),
    "select pg_temp.s09d_session('owner', 'authenticated');",
    fragment('phase_02_slice_12_governed_submit/000-fixtures.sqlinc'),
    fragment('phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc'),
    ...later.slice(0, 3).map(fragment),
    fragment('phase_02_slice_12_taxonomy_terms/010-setup.sqlinc'),
    fragment(later[3]),
    fragment(later[4]),
    'create table public.s12dcr_actor as table s09d_actor; create table public.s12dcr_base as table s09d_ids;',
    'create table public.s12dcr_gov as table s12gov_ids; create table public.s12dcr_cases(label text primary key, ids jsonb not null);',
    'revoke all on public.s12dcr_actor, public.s12dcr_base, public.s12dcr_gov, public.s12dcr_cases from public, anon, authenticated, service_role;',
    "select pg_temp.s12dcr_assert(pg_temp.s12tt_active(pg_temp.s12tt_lineage('vf')) = '1', 'real active vocabulary');",
    'commit;',
    "select 'fixture-built';",
  ].join('\n');
  bootstrapOwned = true;
  assert.equal(await query(bootstrap, false, true), 'fixture-built');
  const ids =
    await stage(`select pg_temp.s12tt_act('outer-a', 'owner', pg_temp.s12tt_lineage('vf'), 'create', 'outer-a');
    select pg_temp.s12tt_act('outer-b', 'owner', pg_temp.s12tt_lineage('vf'), 'create', 'outer-b');
    select pg_temp.s12dcr_assert(pg_temp.s12ga_out('outer-a') = 'ok' and pg_temp.s12ga_out('outer-b') = 'ok', 'real unmerged term creates');
    select pg_temp.s12dcr_assert(pg_temp.s12tt_seed_bulk('outer-tail', 3, pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'outer-a')) = 3, 'three real assignment fixtures');
    select jsonb_build_object('tax', pg_temp.s12tt_lineage('vf'), 'active', pg_temp.s12tt_active_id(pg_temp.s12tt_lineage('vf')),
      'term', pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'outer-a'), 'survivor', pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'outer-b'),
      'actor', pg_temp.s12ga_auth('owner'), 'party', pg_temp.s09d_id('ownerOrg'), 'request',
      pg_temp.s12tt_req('outer-merge', pg_temp.s12tt_lineage('vf'), 'merge', 'outer-a',
        jsonb_build_object('survivorId', pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'outer-b')))
        || jsonb_build_object('context', pg_temp.s12ga_ctx('owner')));`);
  ids.correlation = ids.request.context.correlationId;
  assert.deepEqual(
    [
      ids.request.action,
      ids.request.expectedVersion,
      ids.request.ifMatch,
      typeof ids.request.idempotencyKey,
    ],
    ['merge', '1', '1', 'string'],
  );
  assert.deepEqual(
    [ids.request.context.authUserId, ids.request.context.actingPartyId],
    [ids.actor, ids.party],
  );
  const before = await snapshot(ids);
  assert.deepEqual(
    [
      before.retired.lifecycle,
      before.survivor.lifecycle,
      before.assignments.length,
    ],
    ['active', 'active', 3],
  );
  assert.match(
    before.authority,
    /^[0-9a-f]{32}$/u,
    'authority digest is not a null-equality control',
  );
  assert.deepEqual(
    [before.audit.length, before.events.length, before.receipts.length],
    [0, 0, 0],
    'new correlation and command identity',
  );
  for (const row of before.assignments)
    assert.deepEqual(
      [row.term_id, row.owner_id, row.state, row.version],
      [ids.term, ids.party, 'active', 1],
    );
  console.log(
    `ok - real active vocabulary ${ids.tax}, unmerged terms ${ids.term}/${ids.survivor}, three active assignments`,
  );

  // Positive raw-request control uses the ACTUAL outer function, then rolls every effect back.
  const control = start(
    'outer-control',
    tx(`savepoint valid_outer; ${outer(ids)} rollback to valid_outer; commit;`),
  );
  const controlled = await outcome(control);
  assert.equal(controlled.code, 0, controlled.stderr);
  assert.deepEqual(
    [
      answer(control).id,
      answer(control).lifecycle,
      answer(control).successorId,
    ],
    [ids.term, 'merged', ids.survivor],
  );
  assert.deepEqual(
    await snapshot(ids),
    before,
    'successful raw-request control rolls all effects back',
  );
  console.log(
    'ok - actual private outer accepts the raw request; SAVEPOINT restores all domain/effect/authority stores',
  );

  const mutex = `pg_catalog.hashtextextended('cms.taxonomy.merge.enqueue:' || ${sql(ids.party)}::uuid::text, 0)`;
  const holder = start(
    'outer-party-holder',
    `begin isolation level read committed;
    select pg_catalog.pg_advisory_xact_lock(${mutex});`,
    true,
  );
  await ready(holder);
  const invalid = start(
    'invalid-key-control',
    tx(outer({ ...ids, request: { ...ids.request, idempotencyKey: 17 } })),
  );
  const refused = await outcome(invalid);
  assert.notEqual(
    refused.code,
    0,
    'bad key type is refused before mutex admission',
  );
  assert.match(
    refused.stderr,
    /ERROR:\s+P0001:\s+INVALID_REQUEST\b/u,
    'bad key type has its existing typed refusal',
  );
  assert.deepEqual(
    await snapshot(ids),
    before,
    'bad key type writes no receipt or domain effects',
  );
  console.log(
    'ok - invalid idempotency-key type refuses while the party mutex is held; no effects',
  );

  const producer = start('actual-private-outer', tx(outer(ids)), true);
  await until('actual outer owned backend PID', () => producer.pid !== null, [
    producer,
  ]);
  assert.equal(
    await query(`select exists (select 1 from pg_stat_activity a where a.pid = ${holder.pid}
    and a.application_name = ${sql(holder.app)} and a.state = 'idle in transaction' and exists (
      select 1 from pg_locks where pid = a.pid and locktype = 'advisory' and mode = 'ExclusiveLock' and granted));`),
    't',
    'raw mutex holder is still live before the admission assertion',
  );
  console.log(
    `# outer admission probe: waiter PID ${producer.pid}; raw mutex holder PID ${holder.pid}`,
  );
  await blocked(
    'actual outer merge waits on the raw party enqueue mutex before domain locks',
    producer,
    holder,
    true,
  );
  assert.equal(
    await query(`select count(distinct relation) = 3 from pg_locks where pid = ${producer.pid}
    and granted and mode = 'RowShareLock' and relation in ('platform_private.person_party'::regclass,
      'identity_private.membership_tenure'::regclass, 'identity_private.organization_actor_grant'::regclass);`),
    't',
    'authority is locked before party mutex admission',
  );
  assert.equal(
    await query(`select not exists (select 1 from pg_locks where pid = ${producer.pid} and granted
    and relation in ('platform_private.cms_taxonomy_versions'::regclass, 'platform_private.cms_terms'::regclass,
      'platform_private.idempotency_records'::regclass) and mode in ('RowShareLock', 'RowExclusiveLock'));`),
    't',
    'mutex precedes actual vocabulary/term FOR SHARE/UPDATE and CMS receipt insert/FOR UPDATE',
  );
  assert.deepEqual(
    await snapshot(ids),
    before,
    'blocked outer merge has no committed receipt/domain effects',
  );
  await commit(holder); // 091 proves COMMIT released the advisory key while this same backend stayed connected.
  await ready(producer);
  assert.deepEqual(
    await snapshot(ids),
    before,
    'all outer merge effects stay invisible before its explicit COMMIT',
  );
  const resource = answer(producer);
  assert.deepEqual(
    [resource.id, resource.version, resource.lifecycle, resource.successorId],
    [ids.term, '2', 'merged', ids.survivor],
  );
  await commit(producer);
  const after = await snapshot(ids);
  assert.equal(
    after.authority,
    before.authority,
    'person, membership and grant rows unchanged',
  );
  assert.deepEqual(after.survivor, before.survivor, 'survivor row unchanged');
  assert.deepEqual(
    [
      after.retired.lifecycle,
      after.retired.successor_id,
      after.retired.version,
    ],
    ['merged', ids.survivor, 2],
  );
  for (const stable of ['versions', 'labels', 'jobs'])
    assert.equal(
      after.stores[stable],
      before.stores[stable],
      `${stable} unchanged`,
    );
  for (const store of ['audit', 'outbox'])
    assert.equal(
      after.stores[store],
      before.stores[store] + 1,
      `exact one ${store} effect`,
    );
  assert.equal(
    after.assignments.length,
    9,
    'three original, three superseding and three survivor assignments',
  );
  for (const row of before.assignments) {
    assert.deepEqual(
      after.assignments.find((r) => r.id === row.id),
      row,
      'original assignment remains byte-equivalent',
    );
    for (const [term, state, version] of [
      [ids.term, 'superseded', 2],
      [ids.survivor, 'active', 1],
    ]) {
      const next = after.assignments.filter(
        (r) =>
          r.revision_id === row.revision_id &&
          r.field_definition_id === row.field_definition_id &&
          r.term_id === term &&
          r.state === state &&
          r.version === version,
      );
      assert.equal(
        next.length,
        1,
        'one exact assignment successor per original revision/field',
      );
      for (const field of [
        'owner_id',
        'taxonomy_version_id',
        'position',
        'provenance',
        'created_by',
      ])
        assert.equal(
          next[0][field],
          row[field],
          `assignment ${field} retained`,
        );
    }
  }
  assert.equal(
    await query(`select pg_temp.s12tt_work(${sql(ids.party)}::uuid);`, true),
    '0',
    'small ordinary merge converges all work without a Job',
  );
  assert.deepEqual(
    [after.audit.length, after.events.length, after.receipts.length],
    [1, 1, 1],
  );
  const audit = after.audit[0];
  assert.deepEqual(
    [
      audit.action,
      audit.actor_id,
      audit.acting_party_id,
      audit.target_type,
      audit.target_id,
      audit.decision,
      audit.reason_code,
    ],
    [
      'cms.taxonomy.term.merge',
      ids.actor,
      ids.party,
      'cms_term',
      ids.term,
      'allowed',
      'CMS_TAXONOMY_TERM_MERGED',
    ],
  );
  const event = after.events[0];
  assert.deepEqual(
    [
      event.event_type,
      event.schema_version,
      event.aggregate_type,
      event.aggregate_id,
      event.aggregate_version,
      event.payload,
    ],
    [
      'cms.taxonomy.changed.v1',
      1,
      'cms_term',
      ids.term,
      2,
      { taxonomyId: ids.tax, taxonomyVersionId: ids.active },
    ],
  );
  assert.deepEqual(after.receipts[0].response_ref, {
    status: 200,
    resourceRef: ids.term,
    safeHeaders: { response: resource },
  });
  assert.equal(
    after.receipts[0].state,
    'completed',
    'the real CMS reservation completes with the merge',
  );
  console.log(
    `ok - outer admission precedes receipt/vocabulary/terms; committed merge ${ids.term}; waiter PID ${producer.pid}, blocker PID ${holder.pid}`,
  );
} catch (error) {
  primaryFailure = error;
} finally {
  const errors = await cleanupSessions(
    bootstrapOwned
      ? 'set client_min_messages = warning; drop table if exists public.s12dcr_cases, public.s12dcr_gov, public.s12dcr_base, public.s12dcr_actor;'
      : null,
  );
  if (primaryFailure || errors.length)
    throw new AggregateError(
      [primaryFailure, ...errors].filter(Boolean),
      'DEC-194 outer race/cleanup failed',
    );
}
console.log(
  '# DEC-194 outer race passed; reset the database before reusing the fixture',
);
