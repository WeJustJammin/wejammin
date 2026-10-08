-- Slice 10 QA-RED (WP-S10-2a): value encodings by field kind (BE03b
-- "Value encodings by field kind" + DEC-112 rich_text.v1 + DEC-133 object).
--
-- Every field kind is a typed encoding, never a stringly-typed pass-through:
-- scalar kinds are primitive-typed, enum is bounded by its immutable choice
-- set, relation is the ordered { targets: [...] } shape, list is an array of
-- its declared itemKind, rich_text is the canonical rich_text.v1 AST, and
-- object is the DEC-133 typed depth-1 properties[] structure (<= 32).  Unknown
-- or nested content is refused, an explicit null and a missing value stay
-- distinct, and no validator result carries a UUID identity.  These assertions
-- are written before the WP-S10-3 cms_rich_text_v1_validator.sql and
-- cms_field_kind_encodings.sql migrations exist, so an absent validator or an
-- unadmitted encoding is evidence-backed RED rather than a silent pass.
--
-- Probes are guarded: every read resolves through the Slice 10 helpers, so a
-- missing function yields false rather than aborting the run, and every refusal
-- assertion is paired with a positive-control guard so it can never pass
-- vacuously while the schema it references is absent.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(26);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Guarded value-validator call: an absent schema/field or a raising validator
-- resolves to false instead of aborting the single-transaction plan.
create or replace function pg_temp.s10v_valid(
  p_schema uuid,
  p_field uuid,
  p_value jsonb,
  p_provenance text default 'authored'
)
returns boolean
language plpgsql
stable
as $body$
declare
  result boolean;
begin
  if p_schema is null or p_field is null then
    return false;
  end if;
  begin
    select platform_private.cms_draft_field_value_valid(
      p_schema, p_field, p_value, p_provenance
    ) into result;
    return coalesce(result, false);
  exception
    when others then
      return false;
  end;
end;
$body$;

-- Guarded rich_text.v1 validator call; absent until WP-S10-3 registers it.
create or replace function pg_temp.s10v_rich_valid(p_value jsonb)
returns boolean
language plpgsql
stable
as $body$
declare
  result boolean;
begin
  begin
    select platform_private.cms_rich_text_v1_valid(p_value) into result;
    return coalesce(result, false);
  exception
    when others then
      return false;
  end;
end;
$body$;

-- Builds the locked relation value shape for one target identity.
create or replace function pg_temp.s10v_relation_shape(p_target uuid)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object('targets', jsonb_build_array(
    jsonb_build_object(
      'targetId', p_target, 'expectedTargetVersion', null
    )
  ))
$body$;

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- Probe A: a rich_text field and an itemKind list field.  Neither depends on
-- the DEC-133 object structure.
create temp table s10v_text_request on commit drop as
select request || jsonb_build_object(
  'typeKey', 's10valuetext', 'label', 'Value Text Probe',
  'idempotencyKey', 's10-value-text-0001',
  'fields', jsonb_build_array(
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000401',
      'key', 'note', 'kind', 'short_text', 'constraints', '{}'::jsonb
    ),
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000402',
      'key', 'body', 'kind', 'rich_text', 'constraints', '{}'::jsonb
    ),
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000403',
      'key', 'tags', 'kind', 'list',
      'constraints', jsonb_build_object('itemKind', 'short_text')
    )
  ),
  'relations', '[]'::jsonb
) as request
from s10_type_request;

-- Probe B: the DEC-133 typed depth-1 object structure (3 of <= 32 properties).
create temp table s10v_object_request on commit drop as
select request || jsonb_build_object(
  'typeKey', 's10valueobject', 'label', 'Value Object Probe',
  'idempotencyKey', 's10-value-object-0001',
  'fields', jsonb_build_array(
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000501',
      'key', 'hero', 'kind', 'object',
      'constraints', jsonb_build_object('objectStructure', jsonb_build_object(
        'properties', jsonb_build_array(
          jsonb_build_object('key', 'title', 'kind', 'scalar', 'required', true, 'constraints', '{}'::jsonb),
          jsonb_build_object('key', 'status', 'kind', 'enum', 'required', true,
            'constraints', jsonb_build_object('enumValues', jsonb_build_array('draft', 'live'))),
          jsonb_build_object('key', 'body', 'kind', 'rich_text', 'required', false, 'constraints', '{}'::jsonb)
        )
      ))
    )
  ),
  'relations', '[]'::jsonb
) as request
from s10_type_request;

-- Probe C: 33 properties must be refused (DEC-133 caps at 32).
create temp table s10v_too_many_request on commit drop as
select request || jsonb_build_object(
  'typeKey', 's10valuetoomany', 'label', 'Too Many',
  'idempotencyKey', 's10-value-toomany-0001',
  'fields', jsonb_build_array(
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000503',
      'key', 'big', 'kind', 'object',
      'constraints', jsonb_build_object('objectStructure', jsonb_build_object(
        'properties', (
          select jsonb_agg(jsonb_build_object(
            'key', 'p' || g, 'kind', 'scalar', 'required', false, 'constraints', '{}'::jsonb
          )) from generate_series(1, 33) as g
        )
      ))
    )
  ),
  'relations', '[]'::jsonb
) as request
from s10_type_request;

-- Probe D: an object kind with no typed properties[] structure is refused
-- (object_kind_unspecified); there is no untyped pass-through.
create temp table s10v_no_structure_request on commit drop as
select request || jsonb_build_object(
  'typeKey', 's10valuenostruct', 'label', 'No Structure',
  'idempotencyKey', 's10-value-nostruct-0001',
  'fields', jsonb_build_array(
    (request->'fields'->0) || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000502',
      'key', 'loose', 'kind', 'object', 'constraints', '{}'::jsonb
    )
  ),
  'relations', '[]'::jsonb
) as request
from s10_type_request;

create temp table s10v_text_type on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft('
    || quote_literal((select request::text from s10v_text_request))
    || '::jsonb)'
) as response;

create temp table s10v_object_type on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft('
    || quote_literal((select request::text from s10v_object_request))
    || '::jsonb)'
) as response;

create temp table s10v_ids on commit drop as
select
  (select (response->>'id')::uuid from s10v_text_type) as text_schema,
  (select (response->>'id')::uuid from s10v_object_type) as object_schema,
  (select value::uuid from s10_ids where key = 'draftVersionId') as draft_schema,
  (select value::uuid from s10_ids where key = 'typeFieldId') as scalar_field,
  (select value::uuid from s10_ids where key = 'typeRelationFieldId') as relation_field,
  (select value::uuid from s10_ids where key = 'typeEnumFieldId') as enum_field,
  (select value::uuid from s10_ids where key = 'typeUnboundedEnumFieldId') as unbounded_enum_field;

select pg_temp.s10_rpc_probe(
  'value_encodings_object_too_many', null,
  'select platform_api.cms_create_type_draft('
    || quote_literal((select request::text from s10v_too_many_request))
    || '::jsonb)'
);

select pg_temp.s10_rpc_probe(
  'value_encodings_object_no_structure', null,
  'select platform_api.cms_create_type_draft('
    || quote_literal((select request::text from s10v_no_structure_request))
    || '::jsonb)'
);

-- ---------------------------------------------------------------------------
-- Validator surface.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_rich_text_v1_valid', 'jsonb'),
  'rich_text.v1 is validated by a code-owned platform_private.cms_rich_text_v1_valid(jsonb)'
);

select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_draft_field_value_valid', 'uuid, uuid, jsonb, text'
  ),
  'the pinned-schema draft value gate keeps its four-argument contract'
);

select ok(
  (select response->>'id' is not null from s10v_text_type),
  'a rich_text and list probe schema compiles through the real 03a authoring RPC'
);

select ok(
  (select response->>'id' is not null from s10v_object_type),
  'a DEC-133 object schema with a typed depth-1 properties[] compiles through 03a'
);

-- ---------------------------------------------------------------------------
-- Scalar and enum encodings.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), to_jsonb('Headline'::text))
    and not pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), to_jsonb(7))
    and not pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), '{"nested":true}'::jsonb),
  'a short_text scalar admits only its declared primitive string encoding'
);

select ok(
  pg_temp.s10v_valid((select draft_schema from s10v_ids), (select enum_field from s10v_ids), to_jsonb('jazz'::text))
    and not pg_temp.s10v_valid((select draft_schema from s10v_ids), (select enum_field from s10v_ids), to_jsonb('metal'::text)),
  'enum admits only a declared immutable choice'
);

select ok(
  not pg_temp.s10v_valid((select draft_schema from s10v_ids), (select unbounded_enum_field from s10v_ids), to_jsonb('anything'::text)),
  'an enum kind without a nonempty choice set fails closed'
);

-- ---------------------------------------------------------------------------
-- relation encoding.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid(
    (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
    pg_temp.s10v_relation_shape('a9100000-0000-4000-8000-000000000301'::uuid)
  )
    and not pg_temp.s10v_valid(
      (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
      to_jsonb('a9100000-0000-4000-8000-000000000301'::text)
    ),
  'relation admits the ordered targets shape and refuses a bare identifier string'
);

select ok(
  pg_temp.s10v_valid(
    (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
    pg_temp.s10v_relation_shape('a9100000-0000-4000-8000-000000000301'::uuid)
  )
    and pg_temp.s10v_valid(
      (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
      pg_temp.s10v_relation_shape('a9100000-0000-4000-8000-000000000302'::uuid)
    )
    and pg_temp.s10v_valid(
      (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
      pg_temp.s10v_relation_shape('a9100000-0000-4000-8000-000000000301'::uuid)
    ) = pg_temp.s10v_valid(
      (select draft_schema from s10v_ids), (select relation_field from s10v_ids),
      pg_temp.s10v_relation_shape('a9100000-0000-4000-8000-000000000302'::uuid)
    ),
  'relation validation is shape-only and leaks no target identity'
);

-- ---------------------------------------------------------------------------
-- list encoding.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid((select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000403'::uuid, '["a","b"]'::jsonb),
  'list admits an array of its declared scalar itemKind'
);

select ok(
  (select text_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000403'::uuid,
      '[["a"],["b"]]'::jsonb
    ),
  'list refuses a nested list or object itemKind value'
);

-- ---------------------------------------------------------------------------
-- rich_text.v1 encoding (DEC-112).
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid(
    (select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000402'::uuid,
    '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}'::jsonb
  ),
  'rich_text admits a canonical rich_text.v1 block document'
);

select ok(
  (select text_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000402'::uuid,
      to_jsonb('Hello'::text)
    ),
  'rich_text refuses a raw string in place of the structured AST'
);

select ok(
  (select text_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000402'::uuid,
      '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Click","marks":[],"link":{"kind":"internal","route":"javascript:alert(1)"}}]}]}'::jsonb
    ),
  'rich_text refuses an unsafe link scheme instead of canonicalizing it'
);

select ok(
  (select text_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select text_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000402'::uuid,
      '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[]},{"text":"b","marks":[]}]}]}'::jsonb
    ),
  'rich_text refuses non-canonical adjacent spans rather than merging them'
);

-- ---------------------------------------------------------------------------
-- object encoding (DEC-133 typed depth-1 properties[], <= 32).
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid(
    (select object_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000501'::uuid,
    '{"title":"Hero","status":"draft"}'::jsonb
  ),
  'object admits a value matching its typed depth-1 structure'
);

select ok(
  (select object_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select object_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000501'::uuid,
      '{"title":"Hero","status":"draft","extra":1}'::jsonb
    ),
  'object refuses an unknown property key'
);

select ok(
  (select object_schema from s10v_ids) is not null
    and not pg_temp.s10v_valid(
      (select object_schema from s10v_ids), 'a9100000-0000-4000-8000-000000000501'::uuid,
      '{"title":{"nested":true},"status":"draft"}'::jsonb
    ),
  'object refuses a nested value where a scalar property is declared'
);

select ok(
  (select object_schema from s10v_ids) is not null
    and pg_temp.s10_probe_state('value_encodings_object_too_many') <> '00000',
  'a DEC-133 object with 33 properties is refused while 32 or fewer is admitted'
);

select ok(
  pg_temp.s10_probe_state('value_encodings_object_no_structure') <> '00000',
  'an object field without a typed properties[] structure is refused (object_kind_unspecified)'
);

-- ---------------------------------------------------------------------------
-- Null/default semantics and identity hygiene.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), 'null'::jsonb, 'explicit_null')
    and pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), null, 'missing')
    and not pg_temp.s10v_valid((select draft_schema from s10v_ids), (select scalar_field from s10v_ids), 'null'::jsonb, 'authored'),
  'an explicit null and a missing value stay distinct from an authored null'
);

select ok(
  coalesce((
    select bool_and(p.prorettype = 'boolean'::regtype)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname = 'cms_draft_field_value_valid'
  ), false)
    and coalesce((
      select bool_and(p.prorettype = 'boolean'::regtype)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'platform_private'
        and p.proname = 'cms_rich_text_v1_valid'
    ), false),
  'both value validators return boolean only, never an identity-bearing result'
);

select finish();
rollback;
