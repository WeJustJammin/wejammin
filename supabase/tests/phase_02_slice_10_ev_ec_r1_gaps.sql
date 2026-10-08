-- Slice 10 evidence lane EC, remediation R1: probes observed while proving P2-S10-AC-079.
-- Lane H round 4 resolved both rows and removed their TODO wrappers (they are ordinary, citable
-- assertions now):
--   GAP EC-079-a was a real defect, fixed by migration 20261005015000.
--   GAP EC-079-b was NOT a defect: the probe flipped the first object property's `required`
--   to `true`, the value the gallery fixture already stores, so nothing changed and the
--   unchanged type read as "not refused".  The probe now makes a REAL drift (`required` to
--   false); the existing activation check refuses it.  The full drift family is pinned in
--   phase_02_slice_10_activation_structure_binding.sql.
--   GAP EC-079-a  CMS-03B-10 create compares the artifact the REQUEST names with the stored
--                 artifact, but never compares the stored artifact hash with the version
--                 definition hash; the draft read, CMS-03B-01 append, CMS-03B-14 and activation do.
--   GAP EC-079-b  the activation reference check compares counts and the frozen manifest with
--                 itself; it does not detect a stored field definition whose object structure
--                 differs from the structure frozen in the compiled artifact.

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
create or replace function pg_temp.ec_drift_artifact_hash() returns text language sql stable as $body$
  select pg_temp.ec_replica(format(
    'update platform_private.cms_schema_artifacts set artifact_hash = repeat(%L, 64) where content_type_version_id = %L',
    'e', pg_temp.ec_version()))
$body$;
create or replace function pg_temp.ec_flip_structure() returns text language sql stable as $body$
  select pg_temp.ec_replica(format($sql$update platform_private.cms_field_definition_versions
      set constraints = jsonb_set(constraints, '{objectStructure,properties,0,required}', 'false'::jsonb)
    where content_type_version_id = %L and field_key = 'meta'$sql$, pg_temp.ec_version()))
$body$;

select pg_temp.ec_probe('write-hash', pg_temp.ec_drift_artifact_hash(), pg_temp.ec_create_sql('ec-gap-write-0001', repeat('e', 64)));
select is(pg_temp.ec_verdict('write-hash'), 'ERR DEPENDENCY_UNAVAILABLE',
  'EC-079-a a create that echoes a drifted artifact hash is refused: the stored binding, not the request, decides');

select pg_temp.ec_probe('act-structure', pg_temp.ec_flip_structure(),
  format('select platform_private.cms_activation_references_valid(%L::uuid)::text', pg_temp.ec_version()));
select is(pg_temp.ec_verdict('act-structure'), 'false',
  'EC-079-b activation refuses a stored object structure that differs from the structure frozen in the artifact');

select * from finish();
rollback;
