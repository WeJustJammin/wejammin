-- Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-079): does every consumer bind the same
-- SchemaArtifact / definition-hash bytes of a type that carries a DEC-133 object structure?
-- New file; every probe is rolled back with its own setup.
--
-- Each probe changes exactly one fact about the gallery type (a rich_text field and a DEC-133
-- object field) and records the verdict of one consumer:
--   activation   platform_private.cms_activation_references_valid(version)
--   write        platform_api.cms_create_entry with the artifact the request names
--   (the two probes that do NOT hold - create echoing a drifted artifact hash, and a stored
--   object structure that differs from the frozen one - are in phase_02_slice_10_ev_ec_r1_gaps.sql)
--   append       platform_api.cms_create_revision (CMS-03B-01)
--   read         platform_api.cms_get_entry_draft (CMS-03B-11)
--   preparation  platform_api.cms_get_entry_authoring_context (CMS-03B-14)

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

create temp table ec_probe(label text primary key, verdict text, detail text) on commit drop;
create or replace function pg_temp.ec_probe(p_label text, p_setup text, p_call text)
returns void
language plpgsql
as $body$
declare
  observed_verdict text;
  observed_detail text;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    begin
      execute p_call into observed_verdict;
    exception when others then
      get stacked diagnostics observed_detail = pg_exception_detail;
      observed_verdict := 'ERR ' || sqlerrm;
    end;
    raise exception 'EC_PROBE_SENTINEL_r1b' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'EC_PROBE_SENTINEL_r1b' then raise; end if;
  end;
  insert into ec_probe values (p_label, observed_verdict, observed_detail);
end;
$body$;
create or replace function pg_temp.ec_verdict(p_label text)
returns text language sql stable as $body$
  select coalesce((select verdict from ec_probe where label = p_label), 'MISSING')
$body$;

create or replace function pg_temp.ec_replica(p_sql text)
returns text language sql immutable as $body$
  select 'set local session_replication_role = replica; ' || p_sql || '; set local session_replication_role = origin;'
$body$;

-- An entry of the gallery type, created while the artifact is current.
create temp table ec_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry(' || quote_literal(
    pg_temp.s10g_create_request(
      jsonb_build_object('title', 'Bound',
        'meta', jsonb_build_object('label', 'One')), 'ec-binding-seed-0001')::text) || '::jsonb)') as response;
select is(pg_temp.s10_last_error_state(), '00000', 'EC-079 fixture: an entry of the object/rich_text type is created while its artifact is current');

create temp table ec_ids2(key text primary key, value text not null) on commit drop;
insert into ec_ids2 select 'entry', response->'entry'->>'id' from ec_created;

create or replace function pg_temp.ec_detail(p_entry text)
returns text language sql stable as $body$
  select 'select platform_api.cms_get_entry_draft(' || quote_literal(jsonb_build_object(
    'entryId', p_entry,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)::text'
$body$;
create or replace function pg_temp.ec_append(p_entry text, p_key text)
returns text language sql stable as $body$
  select 'select platform_api.cms_create_revision(' || quote_literal(
    pg_temp.s10g_revision_request(p_entry, jsonb_build_object('title', 'Rebound'), '1', '1', p_key)::text) || '::jsonb)::text'
$body$;
create or replace function pg_temp.ec_create_sql(p_key text, p_hash text default null)
returns text language sql stable as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key)
      || case when p_hash is null then '{}'::jsonb else jsonb_build_object('schemaArtifact',
           (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key)->'schemaArtifact')
             || jsonb_build_object('artifactHash', p_hash)) end)::text) || '::jsonb)::text'
$body$;

create or replace function pg_temp.ec_version() returns text language sql stable as $body$
  select value from s10g_ids where key = 'versionId' $body$;

-- ---- control ------------------------------------------------------------------------
select pg_temp.ec_probe('act-control', null,
  format('select platform_private.cms_activation_references_valid(%L::uuid)::text', pg_temp.ec_version()));
select is(pg_temp.ec_verdict('act-control'), 'true',
  'EC-079 control: the activation reference check accepts the compiled object/rich_text artifact');
select pg_temp.ec_probe('write-control', null, pg_temp.ec_create_sql('ec-binding-write-0001'));
select ok(pg_temp.ec_verdict('write-control') like '{%', 'EC-079 control: a create naming the current artifact is accepted');
select pg_temp.ec_probe('read-control', null, pg_temp.ec_detail((select value from ec_ids2 where key = 'entry')));
select ok(pg_temp.ec_verdict('read-control') like '{%', 'EC-079 control: the draft read of the bound entry is served');
select pg_temp.ec_probe('append-control', null, pg_temp.ec_append((select value from ec_ids2 where key = 'entry'), 'ec-binding-append-0001'));
select ok(pg_temp.ec_verdict('append-control') like '{%', 'EC-079 control: an append against the bound artifact is accepted');

-- ---- artifact hash drifts away from the definition hash -------------------------------
create or replace function pg_temp.ec_drift_artifact_hash() returns text language sql stable as $body$
  select pg_temp.ec_replica(format(
    'update platform_private.cms_schema_artifacts set artifact_hash = repeat(%L, 64) where content_type_version_id = %L',
    'e', pg_temp.ec_version()))
$body$;
select pg_temp.ec_probe('act-hash', pg_temp.ec_drift_artifact_hash(),
  format('select platform_private.cms_activation_references_valid(%L::uuid)::text', pg_temp.ec_version()));
select is(pg_temp.ec_verdict('act-hash'), 'false',
  'EC-079 activation refuses an artifact whose hash differs from the version definition hash');
select pg_temp.ec_probe('read-hash', pg_temp.ec_drift_artifact_hash(),
  pg_temp.ec_detail((select value from ec_ids2 where key = 'entry')));
select is(pg_temp.ec_verdict('read-hash'), 'ERR DEPENDENCY_UNAVAILABLE',
  'EC-079 the draft read refuses an artifact whose hash differs from the definition hash');
select pg_temp.ec_probe('prep-hash', pg_temp.ec_drift_artifact_hash(),
  'select (platform_api.cms_get_entry_authoring_context(''{}''::jsonb)->''creatableTypes'')::text');
select ok(pg_temp.ec_verdict('prep-hash') not like '%' || pg_temp.ec_version() || '%',
  'EC-079 the preparation read no longer offers a type whose artifact hash differs from the definition hash');
select pg_temp.ec_probe('append-hash', pg_temp.ec_drift_artifact_hash(),
  pg_temp.ec_append((select value from ec_ids2 where key = 'entry'), 'ec-binding-append-0002'));
select is(pg_temp.ec_verdict('append-hash'), 'ERR DEPENDENCY_UNAVAILABLE',
  'EC-079 an append against an artifact whose hash differs from the definition hash is refused');

select * from finish();
rollback;
