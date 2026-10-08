-- Slice 10 evidence lane EC, remediation R2 (P2-S10-AC-103): CMS-03B-14 enforces its response
-- bounds - at most 32 creatable types and at most 128 selected fields - and OVERFLOW FAILS
-- CLOSED: one past either bound is the typed INTERNAL_ERROR with no partial projection, never a
-- silently truncated list. Every probe is a boundary PAIR (at the bound: served in full; one
-- past: refused), so deleting or loosening either check flips an assertion. The earlier citations
-- of this bound only observed a small fixture or looked for a source-text fragment.
-- New file; every probe is rolled back with its own setup.

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

create temp table ec_ids(key text primary key, value text not null) on commit drop;
insert into ec_ids
select 'fixture', value from s10_ids where key = 'draftVersionId'
union all select 'gallery', value from s10g_ids where key = 'versionId';

create temp table ec_reads(label text primary key, state text, message text, detail text, response jsonb) on commit drop;
create or replace function pg_temp.ec_read(p_label text, p_setup text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
  observed_state text := '00000';
  observed_message text;
  observed_detail text;
  observed_response jsonb;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    begin
      select platform_api.cms_get_entry_authoring_context(p_request) into observed_response;
    exception when others then
      get stacked diagnostics observed_detail = pg_exception_detail;
      observed_state := sqlstate;
      observed_message := sqlerrm;
      observed_response := null;
    end;
    raise exception 'EC_PROBE_SENTINEL_r1a' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'EC_PROBE_SENTINEL_r1a' then raise; end if;
  end;
  insert into ec_reads values (p_label, observed_state, observed_message, observed_detail, observed_response);
end;
$body$;

-- The creatable version ids of one read, sorted, as text.
create or replace function pg_temp.ec_creatable(p_label text)
returns text
language sql
stable
as $body$
  select coalesce(string_agg(type->>'contentTypeVersionId', ',' order by type->>'contentTypeVersionId'), '<none>')
  from ec_reads, jsonb_array_elements(response->'creatableTypes') as type
  where label = p_label
$body$;
create or replace function pg_temp.ec_expect(variadic p_keys text[])
returns text
language sql
stable
as $body$
  select coalesce(string_agg(value, ',' order by value), '<none>')
  from ec_ids where key = any(p_keys)
$body$;
create or replace function pg_temp.ec_refusal(p_label text)
returns text
language sql
stable
as $body$
  select coalesce(state || ' ' || coalesce(message, '-') || ' ' || coalesce(nullif(detail, ''), '-'), 'MISSING')
  from ec_reads where label = p_label
$body$;


-- N more active compiled creatable types for the acting party, created through the real
-- CMS-03A-01 command and activated exactly as the fixtures do.
create or replace function pg_temp.ec_add_types(p_count integer)
returns void
language plpgsql
as $body$
declare
  created jsonb;
  version_ids uuid[] := array[]::uuid[];
  type_ids uuid[] := array[]::uuid[];
  n integer;
begin
  for n in 1 .. p_count loop
    select platform_api.cms_create_type_draft(
      request || jsonb_build_object(
        'typeKey', 's10bound' || n, 'label', 'Bound ' || n,
        'idempotencyKey', 'ec-r2-bound-' || lpad(n::text, 4, '0'),
        'fields', jsonb_build_array(
          jsonb_build_object('stableFieldId', extensions.gen_random_uuid(),
            'key', 'title', 'kind', 'short_text', 'constraints', '{}'::jsonb,
            'required', false, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Title', 'order', 0), 'lifecycle', 'active')),
        'relations', '[]'::jsonb))
    into created
    from s10_type_request;
    version_ids := version_ids || (created->>'id')::uuid;
    type_ids := type_ids || (created->>'contentTypeId')::uuid;
  end loop;
  perform set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_content_type_versions
  set state = 'active', version = version + 1,
      activation_workflow_policy_key = 'cms.entry.author', activation_workflow_policy_version = 1,
      activation_workflow_policy_hash = repeat('a', 64), activation_required_decision_count = 1,
      activation_required_capabilities = jsonb_build_array('cms.author'),
      activation_approval_evidence_hash = repeat('b', 64), updated_at = clock_timestamp()
  where id = any(version_ids);
  update platform_private.cms_content_types
  set state = 'active', version = version + 1, updated_at = clock_timestamp()
  where id = any(type_ids);
end;
$body$;

-- N more ACTIVE fields on the gallery version (copies of its title field).
create or replace function pg_temp.ec_add_fields(p_count integer)
returns void
language plpgsql
as $body$
begin
  set local session_replication_role = replica;
  insert into platform_private.cms_field_definition_versions
  select (jsonb_populate_record(null::platform_private.cms_field_definition_versions,
      to_jsonb(field_row) || jsonb_build_object('id', extensions.gen_random_uuid(),
        'stable_field_id', extensions.gen_random_uuid(), 'field_key', 'pad_' || n))).*
  from platform_private.cms_field_definition_versions field_row,
       generate_series(1, p_count) as n
  where field_row.content_type_version_id = (select value::uuid from ec_ids where key = 'gallery')
    and field_row.field_key = 'title';
  set local session_replication_role = origin;
end;
$body$;

-- ---- creatable types: at the bound served in full, one past it refused ---------------------------
select pg_temp.ec_read('types-32', 'select pg_temp.ec_add_types(30)', '{}'::jsonb);
select is(pg_temp.ec_refusal('types-32'), '00000 - -',
  'EC-103 exactly 32 creatable types are served');
select is((select jsonb_array_length(response->'creatableTypes') from ec_reads where label = 'types-32'), 32,
  'EC-103 all 32 creatable types are in the projection, none dropped');

select pg_temp.ec_read('types-33', 'select pg_temp.ec_add_types(31)', '{}'::jsonb);
select is(pg_temp.ec_refusal('types-33'), 'P0001 INTERNAL_ERROR -',
  'EC-103 33 creatable types are refused as INTERNAL_ERROR with no detail');
select is((select response from ec_reads where label = 'types-33'), null::jsonb,
  'EC-103 the overflow refusal carries no partial projection: the list is never truncated to 32');

-- ---- selected fields: at the bound served in full, one past it refused ---------------------------
select pg_temp.ec_read('fields-128', 'select pg_temp.ec_add_fields(122)',
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'gallery')));
select is(pg_temp.ec_refusal('fields-128'), '00000 - -',
  'EC-103 exactly 128 projected fields are served');
select is((select jsonb_array_length(response->'fields') from ec_reads where label = 'fields-128'), 128,
  'EC-103 all 128 fields are in the projection, none dropped');

select pg_temp.ec_read('fields-129', 'select pg_temp.ec_add_fields(123)',
  jsonb_build_object('contentTypeVersionId', (select value from ec_ids where key = 'gallery')));
select is(pg_temp.ec_refusal('fields-129'), 'P0001 INTERNAL_ERROR -',
  'EC-103 129 projected fields are refused as INTERNAL_ERROR with no detail');
select is((select response from ec_reads where label = 'fields-129'), null::jsonb,
  'EC-103 the field overflow refusal carries no partial projection: the fields are never truncated to 128');

select * from finish();
rollback;
