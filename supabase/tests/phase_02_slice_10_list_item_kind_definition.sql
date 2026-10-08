-- Slice 10 follow-up (lane F, task 2): the definition-time list itemKind rule.
--
-- BE03a "Field kind structure" (DEC-133): a `list` field carries
-- `constraints.itemKind`, which must be a scalar kind (short_text, long_text,
-- boolean, integer, decimal, date, datetime) or `enum`; a nested
-- list/object/relation/media/rich_text item is refused at definition time.  The
-- BE03a validation matrix repeats it ("a `list` field requires
-- `constraints.itemKind` to be a scalar kind or `enum`, so a nested
-- `list|object|relation|media|rich_text` item is refused at definition time",
-- 422 VALIDATION_FAILED, no partial insert) and validateFieldDefinition adds
-- that `itemKind` is only valid for a list field.  The TypeScript contract
-- refineField and the database cms_valid_field_input must agree
-- (P2-S10-AC-080), on the complete-definition path (create/activation field
-- manifest, p_require_stable_id) and on the incremental single-field edit path.
--
-- Part A pins the predicate directly.  Part B drives the real authoring RPC:
-- a refused definition is the typed VALIDATION_FAILED contract error and commits
-- no type, version, field or artifact row.
--
-- Every predicate probe goes through a guarded helper: a raising predicate
-- yields null, which fails both the true and the false assertions.

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

create or replace function pg_temp.s10l_field(
  p_kind text,
  p_constraints jsonb,
  p_stable boolean default true
)
returns boolean
language plpgsql
stable
as $body$
declare
  field jsonb;
begin
  field := jsonb_build_object(
    'key', 'probe', 'kind', p_kind, 'constraints', p_constraints,
    'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Probe', 'order', 0),
    'lifecycle', 'active'
  );
  if p_stable then
    field := field || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000a02'
    );
  end if;
  if p_kind = 'object' then
    field := jsonb_set(field, '{constraints}',
      p_constraints || '{"objectStructure":{"properties":[]}}'::jsonb);
  end if;
  return platform_private.cms_valid_field_input(field, p_stable);
exception
  when others then
    return null;
end;
$body$;

-- ===========================================================================
-- Part A: the predicate.
-- ===========================================================================
-- A list of every scalar kind and of enum is the only admitted list.
select is(
  pg_temp.s10l_field('list',
    case k.item when 'enum' then '{"itemKind":"enum","enumValues":["a"]}'::jsonb
      else jsonb_build_object('itemKind', k.item) end,
    m.stable),
  true,
  'a list of ' || k.item || ' items is accepted'
    || case when m.stable then ' on the complete-definition path' else ' on the incremental path' end
    || ' [P2-S10-AC-080]'
)
from unnest(array['short_text', 'long_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum']) k(item)
cross join (values (true), (false)) m(stable);

-- A nested or non-scalar item kind is refused at definition time.
select is(
  pg_temp.s10l_field('list', jsonb_build_object('itemKind', k.item), m.stable),
  false,
  'a list of ' || k.item || ' items is refused at definition time'
    || case when m.stable then ' on the complete-definition path' else ' on the incremental path' end
    || ' [P2-S10-AC-080]'
)
from unnest(array['list', 'object', 'relation', 'media', 'rich_text', 'taxonomy']) k(item)
cross join (values (true), (false)) m(stable);

-- A list with no usable itemKind is refused: absent, JSON null, non-string,
-- empty, or not a field kind at all.
select is(
  pg_temp.s10l_field('list', c.constraints, m.stable),
  false,
  'a list field ' || c.label
    || case when m.stable then ' is refused on the complete-definition path' else ' is refused on the incremental path' end
    || ' [P2-S10-AC-080]'
)
from (values
  ('{}'::jsonb, 'with no itemKind'),
  ('{"minLength":1,"maxLength":4}'::jsonb, 'with bounds but no itemKind'),
  ('{"itemKind":null}'::jsonb, 'with a JSON-null itemKind'),
  ('{"itemKind":5}'::jsonb, 'with a numeric itemKind'),
  ('{"itemKind":true}'::jsonb, 'with a boolean itemKind'),
  ('{"itemKind":["short_text"]}'::jsonb, 'with an array itemKind'),
  ('{"itemKind":""}'::jsonb, 'with an empty itemKind'),
  ('{"itemKind":"blob"}'::jsonb, 'with an unknown itemKind')
) c(constraints, label)
cross join (values (true), (false)) m(stable);

-- itemKind is only valid for a list field (BE03a validateFieldDefinition).
select is(
  pg_temp.s10l_field(k.kind, '{"itemKind":"short_text"}'::jsonb, m.stable),
  false,
  'a ' || k.kind || ' field carrying an itemKind is refused'
    || case when m.stable then ' on the complete-definition path' else ' on the incremental path' end
    || ' [P2-S10-AC-080]'
)
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object']) k(kind)
cross join (values (true), (false)) m(stable);

-- The non-list kinds still carry no itemKind and are accepted without one (the
-- rule must not tighten any other kind).
select is(
  pg_temp.s10l_field(k.kind, '{}'::jsonb, m.stable),
  true,
  'a ' || k.kind || ' field with no itemKind is still accepted'
    || case when m.stable then ' on the complete-definition path' else ' on the incremental path' end
    || ' [P2-S10-AC-080]'
)
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'taxonomy', 'relation', 'media']) k(kind)
cross join (values (true), (false)) m(stable);

-- The rule composes with the literal-default encoding: a list default is held
-- to its itemKind, and a list with no itemKind cannot carry a default at all.
select is(
  platform_private.cms_valid_field_input(jsonb_build_object(
    'stableFieldId', 'a9100000-0000-4000-8000-000000000a02',
    'key', 'tags', 'kind', 'list', 'constraints', '{"itemKind":"short_text"}'::jsonb,
    'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'literal', 'defaultValue', '["a","b"]'::jsonb,
    'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Tags', 'order', 0),
    'lifecycle', 'active'), true),
  true,
  'a list literal default of its itemKind is accepted [P2-S10-AC-080]'
);
select is(
  platform_private.cms_valid_field_input(jsonb_build_object(
    'stableFieldId', 'a9100000-0000-4000-8000-000000000a02',
    'key', 'tags', 'kind', 'list', 'constraints', '{}'::jsonb,
    'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'literal', 'defaultValue', '[]'::jsonb,
    'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Tags', 'order', 0),
    'lifecycle', 'active'), true),
  false,
  'a list with no itemKind cannot carry a literal default [P2-S10-AC-080]'
);

-- ===========================================================================
-- Part B: the authoring RPC.
-- ===========================================================================
create or replace function pg_temp.s10l_type_request(
  p_type_key text,
  p_constraints jsonb,
  p_idempotency text
)
returns jsonb
language sql
as $body$
  select request || jsonb_build_object(
    'typeKey', p_type_key, 'label', 'List ' || p_type_key,
    'idempotencyKey', p_idempotency,
    'fields', jsonb_build_array(jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000c11',
      'key', 'tags', 'kind', 'list',
      'constraints', p_constraints,
      'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Tags', 'order', 0),
      'lifecycle', 'active')),
    'relations', '[]'::jsonb)
  from s10_type_request
$body$;

create temp table s10l_before on commit drop as
select
  (select count(*) from platform_private.cms_content_types) as types,
  (select count(*) from platform_private.cms_content_type_versions) as versions,
  (select count(*) from platform_private.cms_field_definition_versions) as fields,
  (select count(*) from platform_private.cms_schema_artifacts) as artifacts;

select pg_temp.s10_rpc_probe(
  'list_item_kind_' || c.label, null,
  'select platform_api.cms_create_type_draft('
    || quote_literal(pg_temp.s10l_type_request('s10listbad' || c.n, c.constraints,
         's10-listbad-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from (values
  (1, 'missing', '{}'::jsonb),
  (2, 'nested_object', '{"itemKind":"object"}'::jsonb),
  (3, 'nested_list', '{"itemKind":"list"}'::jsonb),
  (4, 'nested_relation', '{"itemKind":"relation"}'::jsonb),
  (5, 'nested_media', '{"itemKind":"media"}'::jsonb),
  (6, 'nested_rich_text', '{"itemKind":"rich_text"}'::jsonb)
) c(n, label, constraints);

select is(pg_temp.s10_probe_state('list_item_kind_' || label), 'P0001',
  'a list definition with ' || label || ' itemKind is refused by the authoring RPC with a contract error [P2-S10-AC-080]')
from unnest(array['missing', 'nested_object', 'nested_list', 'nested_relation', 'nested_media', 'nested_rich_text']) label;
select is(pg_temp.s10_probe_message('list_item_kind_' || label), 'VALIDATION_FAILED',
  'a list definition with ' || label || ' itemKind is the typed VALIDATION_FAILED refusal [P2-S10-AC-080]')
from unnest(array['missing', 'nested_object', 'nested_list', 'nested_relation', 'nested_media', 'nested_rich_text']) label;
select is(
  (select (count(*) = (select types from s10l_before)) from platform_private.cms_content_types)
    and (select (count(*) = (select versions from s10l_before)) from platform_private.cms_content_type_versions)
    and (select (count(*) = (select fields from s10l_before)) from platform_private.cms_field_definition_versions)
    and (select (count(*) = (select artifacts from s10l_before)) from platform_private.cms_schema_artifacts),
  true,
  'the refused list definitions committed no type, version, field or artifact row [P2-S10-AC-080]'
);

create temp table s10l_good_type on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft('
    || quote_literal(pg_temp.s10l_type_request('s10listgood', '{"itemKind":"short_text","maxLength":8}'::jsonb,
         's10-listgood-0001')::text)
    || '::jsonb)') as response;

select ok((select response->>'id' is not null from s10l_good_type),
  'a list field of short_text items compiles through the authoring RPC [P2-S10-AC-080]');
select is(
  (select f.constraints
   from platform_private.cms_field_definition_versions f
   where f.content_type_version_id = (select (response->>'id')::uuid from s10l_good_type)
     and f.field_key = 'tags'),
  '{"itemKind":"short_text","maxLength":8}'::jsonb,
  'the stored list constraints are exactly the accepted itemKind and bound [P2-S10-AC-080]'
);

select * from finish();
rollback;
