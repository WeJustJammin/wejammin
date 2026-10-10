-- E7 / DEC-163: actual private settings lookup, not writer or API acceptance.
-- BE03b 1813-1819 requires an existing exact hash/ordinal and no read effects.
-- The 001 fixture contributes four assertions and a real legacy organization.
-- Guarded snapshot inserts below are lookup fixtures, never materializer proof.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(32);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc

select set_config('app.cms_rpc', 'true', true);

create or replace function pg_temp.h11e7_owner()
returns uuid language sql stable as $body$
  select value::uuid from s10_ids where key = 'organization'
$body$;

-- Full row images include IDs, timestamps, versions, hashes and values.
create or replace function pg_temp.h11e7_rows(p_owner uuid default null)
returns jsonb language sql as $body$
  select coalesce(jsonb_agg(to_jsonb(snapshot)
    order by snapshot.owner_id, snapshot.ordinal, snapshot.id), '[]'::jsonb)
  from platform_private.cms_publication_settings_snapshots snapshot
  where p_owner is null or snapshot.owner_id = p_owner
$body$;

create or replace function pg_temp.h11e7_lookup()
returns jsonb language sql as $body$
  select pg_temp.h11_json(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner()))
$body$;

-- Same trusted write-context/insert pattern as helpers_settings.sql:50-61.
-- No disabled trigger, immutable-row deletion, recording helper or CFG change.
create or replace function pg_temp.h11e7_seed(p_values jsonb)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_publication_settings_snapshots(
    owner_id, state, version, ordinal, registry_version,
    snapshot_hash, effective_values
  ) values (
    pg_temp.h11e7_owner(), 'active', 1, 1, 1,
    platform_private.cms_jcs_sha256(p_values)::char(64), p_values
  );
end;
$body$;

create temp table h11e7_baseline on commit drop as
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as owner_rows,
       pg_temp.h11e7_rows() as all_rows;

select is(platform_private.cms_publication_settings_keys(), array[]::text[],
  'E7/DEC163 L01: publication settings registry has no keys');
select is(platform_private.cms_publication_settings_registry_version(), 1::bigint,
  'E7/DEC163 L02: publication settings registry version remains 1');
select is(platform_private.cms_publication_settings_effective_values(
    pg_temp.h11e7_owner(), clock_timestamp()), '[]'::jsonb,
  'E7/DEC163 L03: current real-owner settings evaluate to the empty array');
select is(platform_private.cms_jcs_sha256('[]'::jsonb),
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  'E7/DEC163 L04: empty-array JCS hash is the locked constant');
select is((select count(*) from platform_private.cms_publication_settings_snapshots),
  0::bigint, 'E7/DEC163 L05: legacy fixture starts with zero snapshots');
select is((select owner_rows from h11e7_baseline), '[]'::jsonb,
  'E7/DEC163 L06: legacy owner has no stored snapshot row');
select is((select all_rows from h11e7_baseline), '[]'::jsonb,
  'E7/DEC163 L07: global snapshot baseline is empty');

-- h11_outcome preserves successful effects: current insertion must be visible
-- to both fingerprint assertions before the savepoint removes it.
savepoint h11e7_missing;
select is(pg_temp.h11_outcome(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner())), 'P0001:DEPENDENCY_UNAVAILABLE',
  'E7/DEC163 L08: missing legacy snapshot refuses with exact dependency error');
select is(pg_temp.h11e7_rows(pg_temp.h11e7_owner()),
  (select owner_rows from h11e7_baseline),
  'E7/DEC163 L09: missing lookup leaves every owner snapshot row unchanged');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_baseline),
  'E7/DEC163 L10: missing lookup leaves every global snapshot row unchanged');
rollback to savepoint h11e7_missing;
release savepoint h11e7_missing;
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_baseline),
  'E7/DEC163 L11: missing probe is isolated before positive fixture insertion');

savepoint h11e7_existing;
select pg_temp.h11e7_seed('[]'::jsonb);
create temp table h11e7_existing_before on commit drop as
select pg_temp.h11e7_rows() as all_rows;
create temp table h11e7_answers(label text primary key, answer jsonb) on commit drop;

select is((select jsonb_agg(jsonb_build_object(
    'ordinal', ordinal, 'registryVersion', registry_version,
    'state', state, 'rowVersion', version,
    'hash', snapshot_hash, 'values', effective_values))
  from platform_private.cms_publication_settings_snapshots
  where owner_id = pg_temp.h11e7_owner()),
  '[{"ordinal":1,"registryVersion":1,"state":"active","rowVersion":1,
     "hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
     "values":[]}]'::jsonb,
  'E7/DEC163 L12: guarded positive fixture stores exactly the ordinal-1 snapshot');

insert into h11e7_answers values ('first', pg_temp.h11e7_lookup());
select is((select answer from h11e7_answers where label = 'first'),
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L13: existing lookup returns the exact stored two-member envelope');
select is((select jsonb_typeof(answer->'version') from h11e7_answers
    where label = 'first'), 'string',
  'E7/DEC163 L14: stored ordinal is returned as a JSON string');
select is((select jsonb_typeof(answer->'hash') from h11e7_answers
    where label = 'first'), 'string',
  'E7/DEC163 L15: stored hash is returned as a JSON string');
select is((select count(*) from h11e7_answers,
    lateral jsonb_object_keys(case when jsonb_typeof(answer) = 'object'
      then answer else '{}'::jsonb end) member
    where label = 'first'), 2::bigint,
  'E7/DEC163 L16: lookup exposes exactly two JSON object members');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_existing_before),
  'E7/DEC163 L17: first existing lookup preserves every stored row field');

insert into h11e7_answers values ('repeat', pg_temp.h11e7_lookup());
select is((select answer from h11e7_answers where label = 'repeat'),
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L18: repeated lookup reuses the exact stored hash and ordinal');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_existing_before),
  'E7/DEC163 L19: repeated lookup preserves every stored row field');
rollback to savepoint h11e7_existing;
release savepoint h11e7_existing;
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_baseline),
  'E7/DEC163 L20: positive fixture is isolated before noncurrent-hash probe');

savepoint h11e7_noncurrent;
-- Typed historic values copied from helpers_settings.sql, using the real owner.
-- This row neither registers nor activates the synthetic setting definition.
select pg_temp.h11e7_seed(
  '[{"key":"cms.h11.alpha", "definitionVersionId":"a9200000-0000-4000-8000-0000000000f1",
     "sourceValueVersionId":null,
     "valueHash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}]'::jsonb);
create temp table h11e7_noncurrent_before on commit drop as
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as owner_rows,
       pg_temp.h11e7_rows() as all_rows;

select ok((select count(*) = 1 and bool_and(
    ordinal = 1 and registry_version = 1
    and snapshot_hash = platform_private.cms_jcs_sha256(effective_values)
    and snapshot_hash <> '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')
  from platform_private.cms_publication_settings_snapshots
  where owner_id = pg_temp.h11e7_owner()),
  'E7/DEC163 L21: real owner has only a valid noncurrent ordinal-1 snapshot');
select is(pg_temp.h11_outcome(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner())), 'P0001:DEPENDENCY_UNAVAILABLE',
  'E7/DEC163 L22: absent current hash refuses despite an existing owner snapshot');
select is(pg_temp.h11e7_rows(pg_temp.h11e7_owner()),
  (select owner_rows from h11e7_noncurrent_before),
  'E7/DEC163 L23: noncurrent lookup preserves the complete owner fingerprint');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_noncurrent_before),
  'E7/DEC163 L24: noncurrent lookup preserves the complete global fingerprint');
select is((select count(*) from platform_private.cms_publication_settings_snapshots
    where owner_id = pg_temp.h11e7_owner()
      and snapshot_hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'),
  0::bigint, 'E7/DEC163 L25: noncurrent lookup inserts no current-hash snapshot');
select is((select jsonb_agg(ordinal order by ordinal)
    from platform_private.cms_publication_settings_snapshots
    where owner_id = pg_temp.h11e7_owner()), '[1]'::jsonb,
  'E7/DEC163 L26: noncurrent lookup allocates no new ordinal');

-- Capture immediately before null input, independently of the prior RED probe.
create temp table h11e7_null_before on commit drop as
select pg_temp.h11e7_rows() as all_rows;
select is(pg_temp.h11_outcome('select platform_private.cms_settings_snapshot(null::uuid)'),
  'P0001:INVALID_REQUEST', 'E7/DEC163 L27: null owner keeps exact invalid-request refusal');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_null_before),
  'E7/DEC163 L28: null-owner refusal preserves every global snapshot row field');
rollback to savepoint h11e7_noncurrent;
release savepoint h11e7_noncurrent;

select * from finish();
rollback;
