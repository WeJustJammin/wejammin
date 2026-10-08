-- Slice 10 repair (stream 1): the DEC-133 object structure through the real
-- authoring RPC and the pinned-schema draft value gate (criteria
-- P2-S10-AC-078..080).  The pure predicates are pinned in
-- phase_02_slice_10_object_structure.sql.
--
-- A refused structure is the typed VALIDATION_FAILED contract error and commits
-- no type, version, field or artifact row; an accepted structure is stored in the
-- field constraints, carried byte-for-byte in the compiled SchemaArtifact editor
-- manifest, bound into the frozen definition hash, and used by the draft value
-- gate to validate every object value (the database half of the shared
-- TypeScript/PostgreSQL object semantics).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- One property record.
create or replace function pg_temp.s10o_prop(
  p_key text,
  p_kind text,
  p_required boolean,
  p_constraints jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object(
    'key', p_key, 'kind', p_kind, 'required', p_required, 'constraints', p_constraints)
$body$;

-- A structure of p_count generated scalar properties.
create or replace function pg_temp.s10o_many(p_count integer)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object('properties', coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', 'p' || lpad(g::text, 3, '0'), 'kind', 'scalar', 'required', false,
      'constraints', '{}'::jsonb))
    from generate_series(1, p_count) g), '[]'::jsonb))
$body$;

-- ===========================================================================
-- The authoring RPC: a refused structure is a typed VALIDATION_FAILED that
-- commits nothing; an accepted structure is stored in the field constraints
-- and bound into the compiled SchemaArtifact and the definition hash.
-- ===========================================================================
create or replace function pg_temp.s10o_type_request(
  p_type_key text,
  p_structure jsonb,
  p_idempotency text
)
returns jsonb
language sql
as $body$
  select request || jsonb_build_object(
    'typeKey', p_type_key, 'label', 'Object ' || p_type_key,
    'idempotencyKey', p_idempotency,
    'fields', jsonb_build_array(jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000c01',
      'key', 'hero', 'kind', 'object',
      'constraints', jsonb_build_object('objectStructure', p_structure),
      'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Hero', 'order', 0),
      'lifecycle', 'active')),
    'relations', '[]'::jsonb)
  from s10_type_request
$body$;

create temp table s10o_before on commit drop as
select
  (select count(*) from platform_private.cms_content_types) as types,
  (select count(*) from platform_private.cms_content_type_versions) as versions,
  (select count(*) from platform_private.cms_field_definition_versions) as fields,
  (select count(*) from platform_private.cms_schema_artifacts) as artifacts;

select pg_temp.s10_rpc_probe(
  'object_structure_' || c.label, null,
  'select platform_api.cms_create_type_draft('
    || quote_literal(pg_temp.s10o_type_request('s10objbad' || c.n, c.structure, 's10-objbad-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from (values
  (1, 'too_many', pg_temp.s10o_many(33)),
  (2, 'nested_kind', jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('inner', 'object', false)))),
  (3, 'duplicate_key', jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('dup', 'scalar', false), pg_temp.s10o_prop('dup', 'scalar', true)))),
  (4, 'enum_without_choices', jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('status', 'enum', true)))),
  (5, 'missing_required_flag', jsonb_build_object('properties', jsonb_build_array(jsonb_build_object('key', 'title', 'kind', 'scalar', 'constraints', '{}'::jsonb))))
) c(n, label, structure);

select is(pg_temp.s10_probe_state('object_structure_' || label), 'P0001',
  'a ' || label || ' object structure is refused by the authoring RPC with a contract error [P2-S10-AC-078]')
from unnest(array['too_many', 'nested_kind', 'duplicate_key', 'enum_without_choices', 'missing_required_flag']) label;
select is(pg_temp.s10_probe_message('object_structure_' || label), 'VALIDATION_FAILED',
  'a ' || label || ' object structure is the typed VALIDATION_FAILED refusal [P2-S10-AC-078]')
from unnest(array['too_many', 'nested_kind', 'duplicate_key', 'enum_without_choices', 'missing_required_flag']) label;
select is(
  (select (count(*) = (select types from s10o_before)) from platform_private.cms_content_types)
    and (select (count(*) = (select versions from s10o_before)) from platform_private.cms_content_type_versions)
    and (select (count(*) = (select fields from s10o_before)) from platform_private.cms_field_definition_versions)
    and (select (count(*) = (select artifacts from s10o_before)) from platform_private.cms_schema_artifacts),
  true,
  'the refused structures committed no type, version, field or artifact row [P2-S10-AC-078]'
);

create temp table s10o_good_structure on commit drop as
select jsonb_build_object('properties', jsonb_build_array(
  pg_temp.s10o_prop('title', 'scalar', true),
  pg_temp.s10o_prop('status', 'enum', false, '{"enumValues":["draft","live"]}'),
  pg_temp.s10o_prop('body', 'rich_text', false)
)) as structure;

create temp table s10o_good_type on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft('
    || quote_literal(pg_temp.s10o_type_request('s10objgood', (select structure from s10o_good_structure), 's10-objgood-0001')::text)
    || '::jsonb)') as response;

select ok((select response->>'id' is not null from s10o_good_type),
  'an object field with a typed three-property structure compiles through the authoring RPC [P2-S10-AC-079]');
select is(
  (select f.constraints->'objectStructure'
   from platform_private.cms_field_definition_versions f
   where f.content_type_version_id = (select (response->>'id')::uuid from s10o_good_type)
     and f.field_key = 'hero'),
  (select structure from s10o_good_structure),
  'the structure is stored exactly as sent inside the field constraints [P2-S10-AC-079]'
);
select ok(
  exists (
    select 1
    from platform_private.cms_schema_artifacts a,
         jsonb_array_elements(a.editor_manifest->'fields') manifest_field
    where a.id = (select (response->>'schemaArtifactId')::uuid from s10o_good_type)
      and manifest_field->'constraints'->'objectStructure' = (select structure from s10o_good_structure)
  ),
  'the compiled SchemaArtifact editor manifest carries the same structure bytes [P2-S10-AC-079]'
);
select ok(
  exists (
    select 1
    from platform_private.cms_schema_artifacts a,
         jsonb_array_elements(a.editor_manifest->'schema'->'fields') manifest_field
    where a.id = (select (response->>'schemaArtifactId')::uuid from s10o_good_type)
      and manifest_field->'constraints'->'objectStructure' = (select structure from s10o_good_structure)
  ),
  'the compiled schema definition inside the manifest carries the same structure bytes [P2-S10-AC-079]'
);

-- The structure is part of the frozen definition hash: the same definition
-- hashes identically, and changing one property constraint changes the hash.
select is(
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', (select structure from s10o_good_structure), 's10-objhash-0001'), 1),
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', (select structure from s10o_good_structure), 's10-objhash-0002'), 1),
  'the definition hash is deterministic for one object structure [P2-S10-AC-079]'
);
select isnt(
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', (select structure from s10o_good_structure), 's10-objhash-0001'), 1),
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', jsonb_build_object('properties', jsonb_build_array(
      pg_temp.s10o_prop('title', 'scalar', true),
      pg_temp.s10o_prop('status', 'enum', false, '{"enumValues":["draft","live","archived"]}'),
      pg_temp.s10o_prop('body', 'rich_text', false))), 's10-objhash-0003'), 1),
  'changing one enum choice inside the structure changes the frozen definition hash [P2-S10-AC-079]'
);
select isnt(
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', (select structure from s10o_good_structure), 's10-objhash-0001'), 1),
  platform_private.cms_definition_artifact_hash(
    pg_temp.s10o_type_request('s10objhash', jsonb_build_object('properties', jsonb_build_array(
      pg_temp.s10o_prop('title', 'scalar', false),
      pg_temp.s10o_prop('status', 'enum', false, '{"enumValues":["draft","live"]}'),
      pg_temp.s10o_prop('body', 'rich_text', false))), 's10-objhash-0004'), 1),
  'flipping one required flag inside the structure changes the frozen definition hash [P2-S10-AC-079]'
);

-- ===========================================================================
-- The pinned-schema draft value gate validates against the stored structure
-- (the database half of the shared TypeScript/PostgreSQL object semantics).
-- ===========================================================================
create or replace function pg_temp.s10o_draft(p_value jsonb, p_provenance text default 'authored')
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_draft_field_value_valid(
    (select (response->>'id')::uuid from s10o_good_type),
    'a9100000-0000-4000-8000-000000000c01'::uuid,
    p_value, p_provenance);
exception
  when others then
    return null;
end;
$body$;

select is(pg_temp.s10o_draft(c.value), c.expected, c.label || ' [P2-S10-AC-080]')
from (values
  ('{"title":"Hero","status":"draft"}'::jsonb, true, 'the draft gate admits an object matching the stored structure'),
  ('{"title":"Hero","body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}}', true, 'the draft gate admits a canonical rich_text.v1 property'),
  ('{"status":"draft"}', false, 'the draft gate refuses a missing required property'),
  ('{"title":"Hero","status":"retired"}', false, 'the draft gate refuses an enum property outside its stored choice set'),
  ('{"title":"Hero","extra":true}', false, 'the draft gate refuses an undeclared key'),
  ('{"title":{"n":1}}', false, 'the draft gate refuses a nested value for a scalar property'),
  ('{"title":"Hero","body":"plain"}', false, 'the draft gate refuses a raw string for a rich_text property'),
  ('"Hero"', false, 'the draft gate refuses a non-object value'),
  ('null', false, 'the draft gate refuses an authored JSON null')
) c(value, expected, label);
select is(pg_temp.s10o_draft('null'::jsonb, 'explicit_null'), true,
  'the draft gate keeps an explicit null distinct from an authored null [P2-S10-AC-080]');
select is(pg_temp.s10o_draft(null, 'missing'), true,
  'the draft gate keeps a missing value distinct from an authored null [P2-S10-AC-080]');

select * from finish();
rollback;
