-- Slice 11 shared helpers: the E7 settings snapshot authority
-- (BE03b "Settings snapshot authority (E7)"; tracker P2-S11-AC-091, AC-092):
-- platform_private.cms_publication_settings_keys, cms_publication_settings_registry_version,
-- cms_publication_settings_effective_values and cms_settings_snapshot after DEC-163.
--
-- CMS_PUBLICATION_SETTINGS_KEYS (registry version 1) has no members, so the
-- version 1 snapshot is the empty array, whose JCS SHA-256 is the spec constant
-- 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945. Lookup returns
-- only an existing exact owner/hash ordinal; missing snapshots fail closed.
-- Guarded h11s_seed rows are LOOKUP TEST FIXTURES, not ordinary-save initialization
-- or recovery proof. Authorized write materialization/atomicity has separate QA.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(35);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc

select set_config('app.cms_rpc', 'true', true);
-- The S10 fixture ran real commands in this one transaction, and a command publishes its verified session
-- (app.cms_session_actor / app.cms_session_party) for the rest of the transaction.  In production each command is
-- its own transaction; this file tests the settings helpers directly, for several owners, as a service path with no
-- published session, so the leftover session is cleared (the Slice 11 session-scope policies,
-- 20261010169000, would otherwise confine the helper to the fixture's party).
select set_config('app.cms_session_actor', '', true), set_config('app.cms_session_party', '', true);

create or replace function pg_temp.h11s_org()
returns uuid language sql stable as $body$
  select value::uuid from s10_ids where key = 'organization'
$body$;

create or replace function pg_temp.h11s_snap(p_owner uuid)
returns jsonb
language sql
as $body$
  select pg_temp.h11_json(format('select platform_private.cms_settings_snapshot(%L::uuid)', p_owner))
$body$;

create or replace function pg_temp.h11s_rows(p_owner uuid)
returns text
language sql
as $body$
  select coalesce(string_agg(ordinal::text || ':' || snapshot_hash || ':' || effective_values::text, ',' order by ordinal), '')
    from platform_private.cms_publication_settings_snapshots where owner_id = p_owner
$body$;

create or replace function pg_temp.h11s_seed(p_owner uuid, p_ordinal bigint, p_values jsonb)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_publication_settings_snapshots(
    owner_id, state, version, ordinal, registry_version, snapshot_hash, effective_values
  ) values (
    p_owner, 'active', 1, p_ordinal, 1, platform_private.cms_jcs_sha256(p_values)::char(64), p_values
  );
end;
$body$;

-- ---------------------------------------------------------------------------
-- Registry (version 1, empty) and shapes.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_publication_settings_keys()')
    and pg_temp.h11_private_definer('cms_publication_settings_registry_version()')
    and pg_temp.h11_private_definer('cms_publication_settings_effective_values(uuid, timestamp with time zone)')
    and pg_temp.h11_private_definer('cms_settings_snapshot(uuid)'),
  'the four settings helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-091]'
);
select is(pg_temp.h11_text('select platform_private.cms_publication_settings_keys()::text'), '{}',
  'CMS_PUBLICATION_SETTINGS_KEYS registry version 1 has no members [P2-S11-AC-091]');
select is(pg_temp.h11_text('select platform_private.cms_publication_settings_registry_version()'), '1',
  'the registry version is 1 [P2-S11-AC-091]');
select ok(
  pg_temp.h11_volatility('cms_publication_settings_keys()') = 'i'
    and pg_temp.h11_volatility('cms_publication_settings_registry_version()') = 'i'
    and pg_temp.h11_volatility('cms_settings_snapshot(uuid)') = 'v',
  'the registry constants are IMMUTABLE and the lookup retains its VOLATILE ABI [P2-S11-AC-092]'
);
select is(pg_temp.h11_rettype('cms_settings_snapshot(uuid)'), 'jsonb', 'the snapshot function returns jsonb [P2-S11-AC-092]');
select is(
  pg_temp.h11_text('select platform_private.cms_publication_settings_effective_values(''a9200000-0000-4000-8000-0000000000e1''::uuid, clock_timestamp())'),
  '[]', 'with no registered key the effective values are the empty array [P2-S11-AC-091]');

-- ---------------------------------------------------------------------------
-- Cold missing lookup refuses without recording; guarded fixtures test reuse.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.h11_text('select platform_private.cms_jcs_sha256(''[]''::jsonb)'),
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  'oracle: the empty array hashes to the spec constant [P2-S11-AC-091]');

select is(pg_temp.h11s_rows(pg_temp.h11s_org()), '', 'no snapshot exists before the first evaluation (no migration seeds a row) [P2-S11-AC-092]');

select is(
  pg_temp.h11_outcome(format('select platform_private.cms_settings_snapshot(%L::uuid)', pg_temp.h11s_org())),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'the first missing lookup refuses with DEPENDENCY_UNAVAILABLE [P2-S11-AC-092]');

select is(
  pg_temp.h11s_rows(pg_temp.h11s_org()),
  '',
  'the first missing lookup leaves no owner snapshot row [P2-S11-AC-092]');

select is(
  pg_temp.h11_outcome(format('select platform_private.cms_settings_snapshot(%L::uuid)', pg_temp.h11s_org())),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a repeated missing lookup still refuses with DEPENDENCY_UNAVAILABLE [P2-S11-AC-092]');
select is(
  (select count(*)::integer from platform_private.cms_publication_settings_snapshots where owner_id = pg_temp.h11s_org()),
  0, 'a repeated missing lookup inserts no owner snapshot row [P2-S11-AC-092]');

-- LOOKUP TEST FIXTURE only: guarded storage for independent positive controls.
-- This is not an authorized save or proof of the write initialization path.
select pg_temp.h11s_seed(pg_temp.h11s_org(), 1, '[]'::jsonb);

select is(
  (select registry_version::text || '/' || state || '/' || version::text
     from platform_private.cms_publication_settings_snapshots where owner_id = pg_temp.h11s_org()),
  '1/active/1', 'the stored row records registry version 1, state active, version 1 [P2-S11-AC-092]');

-- The version is a decimal string (CmsVersion), never a JSON number.
select is(pg_temp.h11s_snap(pg_temp.h11s_org())->>'version', '1', 'the version member is the ordinal as text [P2-S11-AC-092]');
select is(jsonb_typeof(pg_temp.h11s_snap(pg_temp.h11s_org())->'version'), 'string',
  'the version member is a JSON string (a lossless decimal) [P2-S11-AC-092]');
select is(pg_temp.h11s_snap(pg_temp.h11s_org()),
  '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb,
  'the answer carries exactly version and hash (no owner or snapshot identifier) [P2-S11-AC-092]');

-- ---------------------------------------------------------------------------
-- Owner scope.
-- ---------------------------------------------------------------------------
-- A second guarded LOOKUP TEST FIXTURE, not creation by the read helper.
select pg_temp.h11s_seed('a9200000-0000-4000-8000-0000000000e2'::uuid, 1, '[]'::jsonb);
select is(
  pg_temp.h11s_snap('a9200000-0000-4000-8000-0000000000e2'::uuid)->>'version', '1',
  'another owner looks up its own stored ordinal 1 for the same snapshot hash [P2-S11-AC-092]');
select is(
  (select count(*)::integer from platform_private.cms_publication_settings_snapshots),
  2, 'two owners hold one snapshot each [P2-S11-AC-092]');
select is(pg_temp.h11_outcome('select platform_private.cms_settings_snapshot(null)'), 'P0001:INVALID_REQUEST',
  'a null owner is a malformed helper call [P2-S11-AC-092]');

-- ---------------------------------------------------------------------------
-- Noncurrent historical lookup fixtures cannot allocate the current snapshot.
-- ---------------------------------------------------------------------------
select pg_temp.h11s_seed('a9200000-0000-4000-8000-0000000000e3'::uuid, 1,
  '[{"key":"cms.h11.alpha","definitionVersionId":"a9200000-0000-4000-8000-0000000000f1","sourceValueVersionId":null,"valueHash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}]'::jsonb);
select pg_temp.h11s_seed('a9200000-0000-4000-8000-0000000000e3'::uuid, 2,
  '[{"key":"cms.h11.alpha","definitionVersionId":"a9200000-0000-4000-8000-0000000000f2","sourceValueVersionId":null,"valueHash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}]'::jsonb);
select is(
  pg_temp.h11_outcome('select platform_private.cms_settings_snapshot(''a9200000-0000-4000-8000-0000000000e3''::uuid)'),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a missing current hash refuses with DEPENDENCY_UNAVAILABLE despite stored history [P2-S11-AC-092]');
select is(
  (select string_agg(ordinal::text, ',' order by ordinal) from platform_private.cms_publication_settings_snapshots
    where owner_id = 'a9200000-0000-4000-8000-0000000000e3'),
  '1,2', 'the two stored legacy ordinals remain unchanged after missing-current lookup [P2-S11-AC-092]');

-- The current empty snapshot already has ordinal 1; append guarded noncurrent
-- fixture history at ordinal 2 without changing registry or resolver values.
select pg_temp.h11s_seed(pg_temp.h11s_org(), 2,
  '[{"key":"cms.h11.alpha","definitionVersionId":"a9200000-0000-4000-8000-0000000000f3","sourceValueVersionId":null,"valueHash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}]'::jsonb);
select is(
  pg_temp.h11s_snap(pg_temp.h11s_org())->>'version', '1',
  'the current empty hash reuses stored ordinal 1 despite later noncurrent ordinal 2 [P2-S11-AC-092]');
select is(
  (select count(*)::integer from platform_private.cms_publication_settings_snapshots where owner_id = pg_temp.h11s_org()),
  2, 'the reuse inserts no row [P2-S11-AC-092]');

-- ---------------------------------------------------------------------------
-- A healthy direct lookup retains no ordinary-writer owner transaction lock.
-- Observe this transaction's successful lookup sequence without caught rollback;
-- this does not establish absence of transient session locks or other namespaces.
-- ---------------------------------------------------------------------------
create temp table h11s_healthy_lookup on commit drop as
select platform_private.cms_settings_snapshot(pg_temp.h11s_org()) as snapshot;
select ok(
  (select snapshot = '{"version":"1","hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}'::jsonb
     from h11s_healthy_lookup)
  and (select count(*)::integer from pg_catalog.pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
      and l.classid = (((pg_catalog.hashtextextended('cms.settings_snapshot:' || pg_temp.h11s_org()::text, 0)) >> 32) & 4294967295)::oid
      and l.objid = ((pg_catalog.hashtextextended('cms.settings_snapshot:' || pg_temp.h11s_org()::text, 0)) & 4294967295)::oid) = 0,
  'successful exact stored lookup retains no owner settings-snapshot transaction advisory lock [P2-S11-AC-092]');

-- ---------------------------------------------------------------------------
-- Registered keys are resolved through the Slice 07 resolver (consumer cms.publication).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11s_with_keys(p_keys text, p_owner uuid)
returns text
language plpgsql
as $body$
declare
  result text;
begin
  execute format(
    'create or replace function platform_private.cms_publication_settings_keys() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
    p_keys);
  begin
    execute format('select platform_private.cms_settings_snapshot(%L::uuid)::text', p_owner) into result;
  exception when others then
    result := 'ERR:' || sqlstate || ':' || sqlerrm;
  end;
  return result;
end;
$body$;

select is(
  pg_temp.h11s_with_keys('{cms.h11.no_such_setting}', 'a9200000-0000-4000-8000-0000000000e5'::uuid),
  'ERR:P0001:DEPENDENCY_UNAVAILABLE',
  'a registered key the resolver cannot serve makes the snapshot unavailable (never a partial snapshot) [P2-S11-AC-091]');
select is(pg_temp.h11s_rows('a9200000-0000-4000-8000-0000000000e5'::uuid), '',
  'a failed evaluation records nothing [P2-S11-AC-092]');
-- A spy resolver replaces cfg_resolve_effective_value for the rest of this rolled-back transaction (registry version 1
-- has no members, so no real key can be served): it appends every request it is asked to serve to the transaction-local
-- setting s11.spy and answers a typed result whose identity depends on the key (cms.h11.b has no source value version:
-- a contract default).  The registry is replaced by keys registered OUT OF ORDER, with an upper-case key whose bytewise
-- position differs from its locale position.  Everything the proof observes is the function's behaviour: the requests
-- the resolver receives and the array it returns.
create or replace function pg_temp.h11s_spy_run(p_keys text, p_owner uuid, p_at timestamptz)
returns jsonb
language plpgsql
as $body$
begin
  execute format(
    'create or replace function platform_private.cms_publication_settings_keys() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
    p_keys);
  execute $spy$
    create or replace function platform_private.cfg_resolve_effective_value(p_request jsonb)
    returns jsonb
    language plpgsql security definer set search_path = ''
    as $g$
    begin
      perform pg_catalog.set_config('s11.spy',
        coalesce(nullif(pg_catalog.current_setting('s11.spy', true), ''), '')
          || (p_request->>'key') || '|' || (p_request->>'consumerKey') || '|' || (p_request->>'partyId') || '|'
          || (p_request->>'at') || ';', true);
      return pg_catalog.jsonb_build_object(
        'definitionVersionId', pg_catalog.md5('definition:' || (p_request->>'key'))::uuid,
        'sourceValueVersionId', case when p_request->>'key' = 'cms.h11.b' then null
                                     else pg_catalog.md5('source:' || (p_request->>'key'))::uuid end,
        'typedValue', pg_catalog.to_jsonb('value-of-' || (p_request->>'key')));
    end
    $g$
  $spy$;
  perform set_config('s11.spy', '', true);
  return platform_private.cms_publication_settings_effective_values(p_owner, p_at);
end;
$body$;

create temp table h11s_spy_result(result jsonb not null, calls text not null, instant timestamptz not null) on commit drop;
with run as materialized (
  select pg_temp.h11s_spy_run('{cms.h11.b,cms.h11.a,cms.h11.B}', pg_temp.h11s_org(), timestamptz '2026-10-11 12:34:56.789012+00') as result
)
insert into h11s_spy_result(result, calls, instant)
select run.result, current_setting('s11.spy', true), timestamptz '2026-10-11 12:34:56.789012+00' from run;

select is(
  (select string_agg(split_part(item.txt, '|', 1) || '/' || split_part(item.txt, '|', 2) || '/'
                     || (split_part(item.txt, '|', 3) = pg_temp.h11s_org()::text)::text || '/'
                     || (split_part(item.txt, '|', 4)::timestamptz = spy.instant)::text, ',' order by item.ord)
     from h11s_spy_result spy
     cross join lateral unnest(string_to_array(trim(trailing ';' from spy.calls), ';')) with ordinality as item(txt, ord)),
  'cms.h11.B/cms.publication/true/true,cms.h11.a/cms.publication/true/true,cms.h11.b/cms.publication/true/true',
  'each registered key is resolved through cfg_resolve_effective_value with consumer key cms.publication, for the owner party and the given instant, in ascending bytewise order (observed on a spy resolver) [P2-S11-AC-091]');
select is(
  (select result from h11s_spy_result),
  (select jsonb_agg(jsonb_build_object(
            'key', k.key,
            'definitionVersionId', md5('definition:' || k.key)::uuid,
            'sourceValueVersionId', case when k.key = 'cms.h11.b' then null else md5('source:' || k.key)::uuid end,
            'valueHash', pg_temp.h11_sha256(to_jsonb('value-of-' || k.key)::text)) order by k.key collate "C")
     from unnest(array['cms.h11.b', 'cms.h11.a', 'cms.h11.B']) as k(key)),
  'keys registered out of order (b, a, B) come back in ascending bytewise order (B, a, b) as { key, definitionVersionId, sourceValueVersionId, valueHash } members, a contract default carrying a null source value version [P2-S11-AC-091]');

-- ---------------------------------------------------------------------------
-- Table posture is the data-model lane''s; the helper never deletes or updates.
-- ---------------------------------------------------------------------------
select ok(
  (select pg_get_functiondef(to_regprocedure('platform_private.cms_settings_snapshot(uuid)')) !~* '(update|delete)\s+(from\s+)?platform_private'),
  'the snapshot function neither updates nor deletes snapshot rows [P2-S11-AC-092]');
select ok(
  (select pg_get_functiondef(to_regprocedure('platform_private.cms_settings_snapshot(uuid)')) !~* '\minsert\s+into\M'),
  'the settings lookup contains no INSERT INTO statement [P2-S11-AC-092]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_publication_settings_keys', 'cms_publication_settings_registry_version',
                        'cms_publication_settings_effective_values', 'cms_settings_snapshot')),
  4, 'exactly one overload of each settings helper exists [P2-S11-AC-091]');

select * from finish();
rollback;
