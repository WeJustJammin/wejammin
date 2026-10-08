-- Slice 10 round 4 (lane H, evidence gaps EC R1 079-a / 079-b; P2-S10-AC-079, DEC-133):
-- the DEC-133 object structure is normalized into the immutable SchemaArtifact and the
-- definition hash, and review, activation, write, restore and the reads bind the same bytes.
--
--   079-a  the CREATE command compared the artifact the request names with the stored artifact
--          but never the stored artifact hash with the version definition hash, so a request
--          echoing a drifted stored hash created an entry (append, resolve, restore, the draft
--          read and CMS-03B-14 already refused it).  It now refuses it as
--          DEPENDENCY_UNAVAILABLE before anything is written (migration 20261005015000).
--   079-b  the activation reference check (cms_activation_references_valid, the check both
--          activation commands run) compares every stored field definition, including its
--          DEC-133 `objectStructure`, with the structure frozen in the artifact's editor manifest,
--          and the manifest with the version's relations / bindings.  Lane EC's probe for it
--          flipped `required` of the first property to `true`, which the gallery fixture already
--          has, so the probe changed nothing and read as a gap; every REAL structure drift below
--          (required, key, kind, an added property, a removed structure, the artifact side) is
--          refused by the existing check, so 079-b is not a production defect.  This suite
--          pins that, so a later redefinition of the check cannot silently drop the comparison.
--
-- Fixtures: the gallery type (a rich_text field and a DEC-133 object field `meta` whose first
-- property `label` is required) through the real cms_create_type_draft; drifts are written with
-- row triggers skipped (no command can produce a stored structure that differs from the frozen
-- one), each in its own rolled-back subtransaction.

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

create temp table sb_probe(label text primary key, verdict text, detail text) on commit drop;
create or replace function pg_temp.sb_probe(p_label text, p_setup text, p_call text)
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
    raise exception 'SB_PROBE_SENTINEL_r4a' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'SB_PROBE_SENTINEL_r4a' then raise; end if;
  end;
  insert into sb_probe values (p_label, observed_verdict, observed_detail);
end;
$body$;
create or replace function pg_temp.sb_verdict(p_label text)
returns text language sql stable as $body$
  select coalesce((select verdict from sb_probe where label = p_label), 'MISSING')
$body$;
create or replace function pg_temp.sb_replica(p_sql text)
returns text language sql immutable as $body$
  select 'set local session_replication_role = replica; ' || p_sql || '; set local session_replication_role = origin;'
$body$;
create or replace function pg_temp.sb_version() returns text language sql stable as $body$
  select value from s10g_ids where key = 'versionId' $body$;
create or replace function pg_temp.sb_valid_sql() returns text language sql stable as $body$
  select format('select platform_private.cms_activation_references_valid(%L::uuid)::text', pg_temp.sb_version()) $body$;
create or replace function pg_temp.sb_field(p_set text) returns text language sql stable as $body$
  select pg_temp.sb_replica(format(
    $sql$update platform_private.cms_field_definition_versions set %s
          where content_type_version_id = %L and field_key = 'meta'$sql$, p_set, pg_temp.sb_version()))
$body$;
create or replace function pg_temp.sb_create_sql(p_key text, p_hash text default null) returns text
language sql stable as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key)
      || case when p_hash is null then '{}'::jsonb else jsonb_build_object('schemaArtifact',
           (pg_temp.s10g_create_request(jsonb_build_object('title', 'New'), p_key)->'schemaArtifact')
             || jsonb_build_object('artifactHash', p_hash)) end)::text) || '::jsonb)::text'
$body$;

-- ---------------------------------------------------------------- 079-b (activation) ----
select pg_temp.sb_probe('act-control', null, pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-control'), 'true',
  '079-b control: the untouched gallery type passes the activation reference check');

select pg_temp.sb_probe('act-noop', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties,0,required}', 'true'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-noop'), 'true',
  '079-b: setting the first property to the required=true it already has changes nothing (the lane EC probe was a no-op)');

select pg_temp.sb_probe('act-required', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties,0,required}', 'false'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-required'), 'false',
  '079-b: a stored property whose required flag differs from the frozen structure is refused');

select pg_temp.sb_probe('act-key', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties,0,key}', '"other"'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-key'), 'false',
  '079-b: a stored property key that differs from the frozen structure is refused');

select pg_temp.sb_probe('act-kind', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties,0,kind}', '"enum"'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-kind'), 'false',
  '079-b: a stored property kind that differs from the frozen structure is refused');

select pg_temp.sb_probe('act-bound', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties,0,constraints}', '{"maxLength": 3}'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-bound'), 'false',
  '079-b: a stored property constraint that differs from the frozen structure is refused');

select pg_temp.sb_probe('act-extra', pg_temp.sb_field(
  $s$constraints = jsonb_set(constraints, '{objectStructure,properties}',
       (constraints->'objectStructure'->'properties')
         || '[{"key":"extra","kind":"scalar","required":false,"constraints":{}}]'::jsonb)$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-extra'), 'false',
  '079-b: a stored structure with an added property is refused');

select pg_temp.sb_probe('act-removed', pg_temp.sb_field($s$constraints = '{}'::jsonb$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-removed'), 'false',
  '079-b: a stored field whose object structure was removed is refused');

select pg_temp.sb_probe('act-field-required', pg_temp.sb_field($s$required = true$s$), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-field-required'), 'false',
  '079-b: a stored field-level flag that differs from the frozen field is refused');

-- the artifact side: the frozen structure itself is altered (the stored one is the untouched original)
select pg_temp.sb_probe('act-artifact-structure', pg_temp.sb_replica(format(
  $sql$update platform_private.cms_schema_artifacts
          set editor_manifest = jsonb_set(editor_manifest, '{fields,4,constraints,objectStructure,properties,0,required}', 'false'::jsonb)
        where content_type_version_id = %L$sql$, pg_temp.sb_version())), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-artifact-structure'), 'false',
  '079-b: a frozen structure that differs from the stored field definition is refused (the same bytes are required on both sides)');

select pg_temp.sb_probe('act-hash', pg_temp.sb_replica(format(
  $sql$update platform_private.cms_schema_artifacts set artifact_hash = repeat('e', 64)
        where content_type_version_id = %L$sql$, pg_temp.sb_version())), pg_temp.sb_valid_sql());
select is(pg_temp.sb_verdict('act-hash'), 'false',
  '079: an artifact hash that is not the version definition hash is not activatable');

-- ------------------------------------------------------------------ 079-a (create) ----
create temp table sb_before on commit drop as select pg_temp.s10g_counts() as counts;
select pg_temp.sb_probe('create-control', null, pg_temp.sb_create_sql('sb-create-0001'));
select ok(pg_temp.sb_verdict('create-control') not like 'ERR %',
  '079-a control: a create over the untouched artifact commits');

create temp table sb_before_drift on commit drop as select pg_temp.s10g_counts() as counts;
select pg_temp.sb_probe('create-drift-echo', pg_temp.sb_replica(format(
  $sql$update platform_private.cms_schema_artifacts set artifact_hash = repeat('e', 64)
        where content_type_version_id = %L$sql$, pg_temp.sb_version())),
  pg_temp.sb_create_sql('sb-create-0002', repeat('e', 64)));
select is(pg_temp.sb_verdict('create-drift-echo'), 'ERR DEPENDENCY_UNAVAILABLE',
  '079-a: a create that echoes a drifted artifact hash is refused DEPENDENCY_UNAVAILABLE: the stored binding, not the request, decides');
select is(pg_temp.s10g_counts(), (select counts from sb_before_drift),
  '079-a: the refused create wrote nothing (the probe is rolled back; the fingerprint is unchanged)');

select pg_temp.sb_probe('create-drift-honest', pg_temp.sb_replica(format(
  $sql$update platform_private.cms_schema_artifacts set artifact_hash = repeat('e', 64)
        where content_type_version_id = %L$sql$, pg_temp.sb_version())),
  pg_temp.sb_create_sql('sb-create-0003'));
select is(pg_temp.sb_verdict('create-drift-honest'), 'ERR VALIDATION_FAILED',
  '079-a: a create that names the real hash against a drifted stored artifact is refused VALIDATION_FAILED at /schemaArtifact');

-- the refused probes were rolled back: a create over the version's own, untouched artifact still commits
select pg_temp.sb_probe('create-after-probes', null, pg_temp.sb_create_sql('sb-create-0004'));
select ok(pg_temp.sb_verdict('create-after-probes') not like 'ERR %',
  '079-a control: after the refused probes (rolled back) a create over the untouched artifact still commits');

select * from finish();
rollback;
