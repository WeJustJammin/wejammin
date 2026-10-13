-- E7 / DEC-163: actual private settings lookup, not writer or API acceptance.
-- BE03b 1813-1819 requires an existing exact hash/ordinal and no read effects.
-- The 001 fixture contributes four assertions and a real legacy organization.
-- Guarded snapshot inserts below are lookup fixtures, never materializer proof.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(54);

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
create or replace function pg_temp.h11e7_seed(
  p_values jsonb, p_ordinal bigint default 1, p_owner uuid default null
)
returns void language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_publication_settings_snapshots(
    owner_id, state, version, ordinal, registry_version,
    snapshot_hash, effective_values
  ) values (
    coalesce(p_owner, pg_temp.h11e7_owner()), 'active', 1, p_ordinal, 1,
    platform_private.cms_jcs_sha256(p_values)::char(64), p_values
  );
end;
$body$;

create temp table h11e7_baseline on commit drop as
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as owner_rows,
       pg_temp.h11e7_rows() as all_rows;

-- Typed historic values from helpers_settings.sql; no registry/CFG activation.
select '[{"key":"cms.h11.alpha","definitionVersionId":"a9200000-0000-4000-8000-0000000000f1",
  "sourceValueVersionId":null,
  "valueHash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}]'::jsonb
  as e7_history \gset

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

-- Capture successful effects BEFORE rollback; no pgTAP call is rolled back.
-- Quoted psql literals retain observations outside transactional rollback.
savepoint h11e7_missing;
select pg_temp.h11_outcome(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner())) as e7_missing_outcome \gset
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_missing_owner,
  pg_temp.h11e7_rows() as e7_missing_all \gset
rollback to savepoint h11e7_missing;
release savepoint h11e7_missing;
select is(:'e7_missing_outcome'::text, 'P0001:DEPENDENCY_UNAVAILABLE',
  'E7/DEC163 L08: missing legacy snapshot refuses with exact dependency error');
select is(:'e7_missing_owner'::jsonb,
  (select owner_rows from h11e7_baseline),
  'E7/DEC163 L09: missing lookup leaves every owner snapshot row unchanged');
select is(:'e7_missing_all'::jsonb, (select all_rows from h11e7_baseline),
  'E7/DEC163 L10: missing lookup leaves every global snapshot row unchanged');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_baseline),
  'E7/DEC163 L11: missing probe is isolated before positive fixture insertion');

savepoint h11e7_existing;
select pg_temp.h11e7_seed('[]'::jsonb);
select pg_temp.h11e7_rows() as e7_existing_before \gset
select (select jsonb_agg(jsonb_build_object(
    'ordinal', ordinal, 'registryVersion', registry_version,
    'state', state, 'rowVersion', version,
    'hash', snapshot_hash, 'values', effective_values))
  from platform_private.cms_publication_settings_snapshots
  where owner_id = pg_temp.h11e7_owner()) as e7_existing_seed \gset
-- JSON null keeps a failed lookup capturable instead of unsetting a variable.
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_existing_first \gset
select pg_temp.h11e7_rows() as e7_existing_first_rows \gset
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_existing_repeat \gset
select pg_temp.h11e7_rows() as e7_existing_repeat_rows \gset

-- A later noncurrent ordinal must not replace the earlier matching ordinal.
select pg_temp.h11e7_seed(:'e7_history'::jsonb, 2);
select pg_temp.h11e7_rows() as e7_later_before \gset
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_later_first \gset
select pg_temp.h11e7_rows() as e7_later_first_rows \gset
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_later_repeat \gset
select pg_temp.h11e7_rows() as e7_later_repeat_rows,
  (select jsonb_agg(ordinal order by ordinal)
   from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()) as e7_later_ordinals \gset
rollback to savepoint h11e7_existing;
release savepoint h11e7_existing;
select is(:'e7_existing_seed'::jsonb,
  '[{"ordinal":1,"registryVersion":1,"state":"active","rowVersion":1,
     "hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
     "values":[]}]'::jsonb,
  'E7/DEC163 L12: guarded positive fixture stores exactly the ordinal-1 snapshot');

select is(:'e7_existing_first'::jsonb,
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L13: existing lookup returns the exact stored two-member envelope');
select is(jsonb_typeof(:'e7_existing_first'::jsonb->'version'), 'string',
  'E7/DEC163 L14: stored ordinal is returned as a JSON string');
select is(jsonb_typeof(:'e7_existing_first'::jsonb->'hash'), 'string',
  'E7/DEC163 L15: stored hash is returned as a JSON string');
select is((select count(*) from jsonb_object_keys(
    case when jsonb_typeof(:'e7_existing_first'::jsonb) = 'object'
      then :'e7_existing_first'::jsonb else '{}'::jsonb end)), 2::bigint,
  'E7/DEC163 L16: lookup exposes exactly two JSON object members');
select is(:'e7_existing_first_rows'::jsonb, :'e7_existing_before'::jsonb,
  'E7/DEC163 L17: first existing lookup preserves every stored row field');

select is(:'e7_existing_repeat'::jsonb,
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L18: repeated lookup reuses the exact stored hash and ordinal');
select is(:'e7_existing_repeat_rows'::jsonb, :'e7_existing_before'::jsonb,
  'E7/DEC163 L19: repeated lookup preserves every stored row field');
select is(:'e7_later_first'::jsonb,
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L29: later noncurrent ordinal 2 cannot replace matching ordinal 1');
select is(:'e7_later_repeat'::jsonb,
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L30: repeated lookup reuses ordinal 1 despite later history');
select is(:'e7_later_first_rows'::jsonb, :'e7_later_before'::jsonb,
  'E7/DEC163 L31: lookup with later history preserves every stored row field');
select is(:'e7_later_repeat_rows'::jsonb, :'e7_later_before'::jsonb,
  'E7/DEC163 L32: repeat lookup with later history preserves every stored row field');
select is(:'e7_later_ordinals'::jsonb, '[1,2]'::jsonb,
  'E7/DEC163 L33: earlier matching lookup allocates no new ordinal');
select is(pg_temp.h11e7_rows(), (select all_rows from h11e7_baseline),
  'E7/DEC163 L20: positive fixture is isolated before noncurrent-hash probe');

savepoint h11e7_noncurrent;
select pg_temp.h11e7_seed(:'e7_history'::jsonb);
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_noncurrent_owner_before,
  pg_temp.h11e7_rows() as e7_noncurrent_all_before \gset
select (select count(*) = 1 and bool_and(
    ordinal = 1 and registry_version = 1
    and snapshot_hash = platform_private.cms_jcs_sha256(effective_values)
    and snapshot_hash <> '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')
  from platform_private.cms_publication_settings_snapshots
  where owner_id = pg_temp.h11e7_owner()) as e7_noncurrent_seed \gset
select pg_temp.h11_outcome(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner())) as e7_noncurrent_outcome \gset
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_noncurrent_owner_after,
  pg_temp.h11e7_rows() as e7_noncurrent_all_after,
  (select count(*) from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()
     and snapshot_hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945') as e7_noncurrent_current_count,
  (select jsonb_agg(ordinal order by ordinal)
   from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()) as e7_noncurrent_ordinals \gset
-- Null input is independently baselined, even when the prior probe inserts.
select pg_temp.h11e7_rows() as e7_null_before \gset
select pg_temp.h11_outcome('select platform_private.cms_settings_snapshot(null::uuid)')
  as e7_null_outcome \gset
select pg_temp.h11e7_rows() as e7_null_after \gset
rollback to savepoint h11e7_noncurrent;
release savepoint h11e7_noncurrent;
select ok(:'e7_noncurrent_seed'::boolean,
  'E7/DEC163 L21: real owner has only a valid noncurrent ordinal-1 snapshot');
select is(:'e7_noncurrent_outcome'::text, 'P0001:DEPENDENCY_UNAVAILABLE',
  'E7/DEC163 L22: absent current hash refuses despite an existing owner snapshot');
select is(:'e7_noncurrent_owner_after'::jsonb, :'e7_noncurrent_owner_before'::jsonb,
  'E7/DEC163 L23: noncurrent lookup preserves the complete owner fingerprint');
select is(:'e7_noncurrent_all_after'::jsonb, :'e7_noncurrent_all_before'::jsonb,
  'E7/DEC163 L24: noncurrent lookup preserves the complete global fingerprint');
select is(:'e7_noncurrent_current_count'::bigint,
  0::bigint, 'E7/DEC163 L25: noncurrent lookup inserts no current-hash snapshot');
select is(:'e7_noncurrent_ordinals'::jsonb, '[1]'::jsonb,
  'E7/DEC163 L26: noncurrent lookup allocates no new ordinal');

select is(:'e7_null_outcome'::text,
  'P0001:INVALID_REQUEST', 'E7/DEC163 L27: null owner keeps exact invalid-request refusal');
select is(:'e7_null_after'::jsonb, :'e7_null_before'::jsonb,
  'E7/DEC163 L28: null-owner refusal preserves every global snapshot row field');

savepoint h11e7_ordinal_two;
select pg_temp.h11e7_seed(:'e7_history'::jsonb);
select pg_temp.h11e7_seed('[]'::jsonb, 2);
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_two_owner_before,
  pg_temp.h11e7_rows() as e7_two_all_before \gset
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_two_first \gset
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_two_owner_first,
  pg_temp.h11e7_rows() as e7_two_all_first \gset
select coalesce(pg_temp.h11e7_lookup(), 'null'::jsonb) as e7_two_repeat \gset
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_two_owner_repeat,
  pg_temp.h11e7_rows() as e7_two_all_repeat,
  (select jsonb_agg(ordinal order by ordinal)
   from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()) as e7_two_ordinals \gset
rollback to savepoint h11e7_ordinal_two;
release savepoint h11e7_ordinal_two;
select is(:'e7_two_first'::jsonb,
  '{"version":"2","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L34: matching current snapshot returns stored ordinal 2');
select is(:'e7_two_repeat'::jsonb,
  '{"version":"2","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'E7/DEC163 L35: repeated current lookup reuses stored ordinal 2');
select ok(jsonb_typeof(:'e7_two_first'::jsonb->'version') = 'string'
    and jsonb_typeof(:'e7_two_first'::jsonb->'hash') = 'string',
  'E7/DEC163 L36: ordinal-2 envelope retains string version and hash');
select is((select count(*) from jsonb_object_keys(
    case when jsonb_typeof(:'e7_two_first'::jsonb) = 'object'
      then :'e7_two_first'::jsonb else '{}'::jsonb end)), 2::bigint,
  'E7/DEC163 L37: ordinal-2 envelope has exactly two members');
select is(:'e7_two_owner_first'::jsonb, :'e7_two_owner_before'::jsonb,
  'E7/DEC163 L38: ordinal-2 lookup preserves every owner row field');
select is(:'e7_two_all_first'::jsonb, :'e7_two_all_before'::jsonb,
  'E7/DEC163 L39: ordinal-2 lookup preserves every global row field');
select is(:'e7_two_owner_repeat'::jsonb, :'e7_two_owner_before'::jsonb,
  'E7/DEC163 L40: repeated ordinal-2 lookup preserves every owner row field');
select is(:'e7_two_all_repeat'::jsonb, :'e7_two_all_before'::jsonb,
  'E7/DEC163 L41: repeated ordinal-2 lookup preserves every global row field');
select is(:'e7_two_ordinals'::jsonb, '[1,2]'::jsonb,
  'E7/DEC163 L42: ordinal-2 lookup allocates no new ordinal');

-- Existing bootstrap-created person; no new identity or authority fixture.
create temp table h11e7_foreign on commit drop as
select p.party_id from platform_private.person_party p
join s10_ids i on p.party_id = i.value::uuid where i.key = 'strangerPerson';
select ok((select count(*) = 1 and bool_and(party_id is not null
    and party_id <> pg_temp.h11e7_owner()) from h11e7_foreign),
  'E7/DEC163 L43: foreign lookup fixture uses exactly one existing distinct person party');
savepoint h11e7_foreign_hash;
select pg_temp.h11e7_seed('[]'::jsonb, 1, (select party_id from h11e7_foreign));
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_foreign_owner_before,
  pg_temp.h11e7_rows() as e7_foreign_all_before,
  pg_temp.h11e7_rows((select party_id from h11e7_foreign)) as e7_foreign_rows_before,
  (select count(*) = 1 and bool_and(ordinal = 1 and effective_values = '[]'::jsonb
    and snapshot_hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')
   from platform_private.cms_publication_settings_snapshots
   where owner_id = (select party_id from h11e7_foreign)) as e7_foreign_seed \gset
select pg_temp.h11_outcome(format(
    'select platform_private.cms_settings_snapshot(%L::uuid)',
    pg_temp.h11e7_owner())) as e7_foreign_outcome \gset
select pg_temp.h11e7_rows(pg_temp.h11e7_owner()) as e7_foreign_owner_after,
  pg_temp.h11e7_rows() as e7_foreign_all_after,
  pg_temp.h11e7_rows((select party_id from h11e7_foreign)) as e7_foreign_rows_after,
  (select count(*) from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()
     and snapshot_hash = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945') as e7_foreign_current_count,
  (select coalesce(jsonb_agg(ordinal order by ordinal), '[]'::jsonb)
   from platform_private.cms_publication_settings_snapshots
   where owner_id = pg_temp.h11e7_owner()) as e7_foreign_ordinals \gset
rollback to savepoint h11e7_foreign_hash;
release savepoint h11e7_foreign_hash;
select ok(:'e7_foreign_seed'::boolean and :'e7_foreign_owner_before'::jsonb = '[]'::jsonb,
  'E7/DEC163 L44: only the foreign party owns the guarded matching-hash fixture');
select is(:'e7_foreign_outcome'::text, 'P0001:DEPENDENCY_UNAVAILABLE',
  'E7/DEC163 L45: foreign matching hash cannot satisfy requested-owner lookup');
select is(:'e7_foreign_owner_after'::jsonb, :'e7_foreign_owner_before'::jsonb,
  'E7/DEC163 L46: foreign-hash lookup preserves every requested-owner row field');
select is(:'e7_foreign_all_after'::jsonb, :'e7_foreign_all_before'::jsonb,
  'E7/DEC163 L47: foreign-hash lookup preserves every global row field');
select is(:'e7_foreign_rows_after'::jsonb, :'e7_foreign_rows_before'::jsonb,
  'E7/DEC163 L48: foreign matching snapshot remains entirely unchanged');
select is(:'e7_foreign_current_count'::bigint, 0::bigint,
  'E7/DEC163 L49: foreign-hash lookup inserts no requested current snapshot');
select is(:'e7_foreign_ordinals'::jsonb, '[]'::jsonb,
  'E7/DEC163 L50: foreign-hash lookup allocates no requested-owner ordinal');

select * from finish();
rollback;
