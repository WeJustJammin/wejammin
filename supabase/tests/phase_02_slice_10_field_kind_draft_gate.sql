-- Slice 10 repair (stream 1): the pinned-schema draft value gate for EVERY
-- field kind, against a real compiled schema.
--
-- cms_draft_field_value_valid decides a draft value from the stored field
-- definition row; the kind-specific encoding and the 03a constraints it
-- applies are the same ones cms_field_kind_value_shape applies to a literal
-- default, so a default can never be a looser encoding than its field.  This
-- suite is the characterization of the gate's per-kind behavior: it pins what
-- every kind admits and refuses so that the gate and the definition-time
-- default check can share one implementation without any behavior drift.
-- An explicit null and a missing value stay distinct from an authored null.
--
-- Probes are guarded: a raising or absent gate yields null, which fails both
-- the true and the false assertions, so every case is reported.

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

create or replace function pg_temp.s10g_field(
  p_n integer,
  p_key text,
  p_kind text,
  p_constraints jsonb default '{}'::jsonb
)
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'stableFieldId', 'a9100000-0000-4000-8000-0000000008' || lpad(p_n::text, 2, '0'),
    'key', p_key, 'kind', p_kind, 'constraints', p_constraints,
    'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', initcap(p_key), 'order', p_n),
    'lifecycle', 'active'
  )
$body$;

create temp table s10g_request on commit drop as
select request || jsonb_build_object(
  'typeKey', 's10kinddraftgate', 'label', 'Kind Draft Gate',
  'idempotencyKey', 's10-kind-draft-gate-0001',
  'fields', jsonb_build_array(
    pg_temp.s10g_field(1, 's_text', 'short_text', '{"minLength":2,"maxLength":5}'),
    pg_temp.s10g_field(2, 'l_text', 'long_text', '{"maxLength":8}'),
    pg_temp.s10g_field(3, 'flag', 'boolean'),
    pg_temp.s10g_field(4, 'whole', 'integer', '{"minimum":0,"maximum":10}'),
    pg_temp.s10g_field(5, 'amount', 'decimal', '{"minimum":0.5,"maximum":9.5}'),
    pg_temp.s10g_field(6, 'day', 'date'),
    pg_temp.s10g_field(7, 'moment', 'datetime'),
    pg_temp.s10g_field(8, 'choice', 'enum', '{"enumValues":["jazz","rock"]}'),
    pg_temp.s10g_field(9, 'tax', 'taxonomy'),
    pg_temp.s10g_field(10, 'body', 'rich_text', '{"maxLength":10}'),
    pg_temp.s10g_field(11, 'hero', 'object', jsonb_build_object('objectStructure',
      jsonb_build_object('properties', jsonb_build_array(
        jsonb_build_object('key', 'title', 'kind', 'scalar', 'required', true, 'constraints', '{}'::jsonb),
        jsonb_build_object('key', 'status', 'kind', 'enum', 'required', false,
          'constraints', jsonb_build_object('enumValues', jsonb_build_array('draft', 'live'))),
        jsonb_build_object('key', 'note', 'kind', 'rich_text', 'required', false, 'constraints', '{}'::jsonb)
      )))),
    pg_temp.s10g_field(12, 'tags', 'list', '{"itemKind":"integer"}'),
    pg_temp.s10g_field(13, 'gallery', 'media', '{"maxLength":2}'),
    pg_temp.s10g_field(14, 'free_text', 'short_text', '{"enumValues":["a","b"]}')
  ),
  'relations', '[]'::jsonb
) as request
from s10_type_request;

create temp table s10g_type on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft('
    || quote_literal((select request::text from s10g_request)) || '::jsonb)'
) as response;

create temp table s10g_schema on commit drop as
select (response->>'id')::uuid as schema_id from s10g_type;

select ok(
  (select schema_id is not null from s10g_schema),
  'a schema carrying one field of every non-relation kind compiles through the real 03a authoring RPC'
);
select is(
  (select count(distinct f.kind)::integer
   from platform_private.cms_field_definition_versions f
   where f.content_type_version_id = (select schema_id from s10g_schema)),
  13,
  'the probe schema stores thirteen distinct field kinds (relation is probed on the fixture schema)'
);

create or replace function pg_temp.s10g_valid(
  p_key text,
  p_value jsonb,
  p_provenance text default 'authored'
)
returns boolean
language plpgsql
stable
as $body$
begin
  return (
    select platform_private.cms_draft_field_value_valid(
      f.content_type_version_id, f.stable_field_id, p_value, p_provenance)
    from platform_private.cms_field_definition_versions f
    where f.content_type_version_id = (select schema_id from s10g_schema)
      and f.field_key = p_key
  );
exception
  when others then
    return null;
end;
$body$;

-- ---------------------------------------------------------------------------
-- Per-kind admission and refusal.
-- ---------------------------------------------------------------------------
select is(pg_temp.s10g_valid(c.key, c.value), c.expected, c.label || ' [P2-S10-AC-031]')
from (values
  ('s_text', '"abc"'::jsonb, true, 'short_text admits a string inside minLength..maxLength'),
  ('s_text', '"a"', false, 'short_text refuses a string under minLength'),
  ('s_text', '"abcdef"', false, 'short_text refuses a string over maxLength'),
  ('s_text', '7', false, 'short_text refuses a number'),
  ('s_text', '{"a":1}', false, 'short_text refuses an object'),
  ('l_text', '"body"', true, 'long_text admits a string'),
  ('l_text', '"123456789"', false, 'long_text refuses a string over maxLength'),
  ('l_text', 'true', false, 'long_text refuses a boolean'),
  ('flag', 'true', true, 'boolean admits true'),
  ('flag', 'false', true, 'boolean admits false'),
  ('flag', '"true"', false, 'boolean refuses a string'),
  ('whole', '5', true, 'integer admits a value inside minimum..maximum'),
  ('whole', '11', false, 'integer refuses a value over maximum'),
  ('whole', '-1', false, 'integer refuses a value under minimum'),
  ('whole', '5.5', false, 'integer refuses a fractional number'),
  ('whole', '"5"', false, 'integer refuses a numeric string'),
  ('amount', '1.5', true, 'decimal admits a value inside minimum..maximum'),
  ('amount', '9.6', false, 'decimal refuses a value over maximum'),
  ('amount', '0.4', false, 'decimal refuses a value under minimum'),
  ('amount', '"1.5"', false, 'decimal refuses a numeric string'),
  ('day', '"2026-02-28"', true, 'date admits a real calendar day'),
  ('day', '"2026-02-30"', false, 'date refuses a non-existent calendar day'),
  ('day', '"2026-02-28T00:00:00Z"', false, 'date refuses a timestamp'),
  ('moment', '"2026-02-28T10:00:00Z"', true, 'datetime admits an ISO timestamp'),
  ('moment', '"2026-02-28T10:00:00.5+23:59"', true, 'datetime admits fractional seconds and the widest ISO offset'),
  ('moment', '"2026-02-28"', false, 'datetime refuses a bare date'),
  ('moment', '"2026-02-30T10:00:00Z"', false, 'datetime refuses a non-existent calendar day'),
  ('choice', '"jazz"', true, 'enum admits a declared choice'),
  ('choice', '"metal"', false, 'enum refuses a choice outside the set'),
  ('choice', '7', false, 'enum refuses a number'),
  -- BE03b "Value encodings by field kind": taxonomy is { termIds: UUID[] <= 128 }, never an untyped string.
  ('tax', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}', true, 'taxonomy admits a { termIds } term id list'),
  ('tax', '{"termIds":[]}', true, 'taxonomy admits an empty term id list'),
  ('tax', '"term-one"', false, 'taxonomy refuses the untyped string pass-through'),
  ('tax', '7', false, 'taxonomy refuses a number'),
  ('body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}', true, 'rich_text admits a canonical document inside maxLength'),
  ('body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello world!","marks":[]}]}]}', false, 'rich_text refuses a document over maxLength'),
  ('body', '"Hello"', false, 'rich_text refuses a raw string'),
  ('hero', '{"title":"Hero","status":"draft"}', true, 'object admits a value matching its structure'),
  ('hero', '{"status":"draft"}', false, 'object refuses a missing required property'),
  ('hero', '{"title":"Hero","status":"retired"}', false, 'object refuses an enum property outside its choice set'),
  ('hero', '{"title":"Hero","extra":1}', false, 'object refuses an undeclared property'),
  ('hero', '{"title":{"n":1}}', false, 'object refuses a nested value for a scalar property'),
  ('hero', '"Hero"', false, 'object refuses a non-object value'),
  ('tags', '[1,2,3]', true, 'list admits an array of its integer itemKind'),
  ('tags', '[1,"2"]', false, 'list refuses a mixed array'),
  ('tags', '[1.5]', false, 'list refuses a fractional integer item'),
  ('tags', '"1"', false, 'list refuses a non-array value'),
  -- BE03b: media is { assetId: UUID, assetVersion: Version } or an array of them (03a maxLength bounds the array); the
  -- permissive string/array/object admission is gone.
  ('gallery', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"2"}]', true, 'media admits an array of typed references inside maxLength'),
  ('gallery', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"2"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]', false, 'media refuses an array over maxLength'),
  ('gallery', '[]', true, 'media admits an empty reference array'),
  ('gallery', '"as"', false, 'media refuses an untyped string reference even inside the 03a maxLength bound'),
  ('gallery', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}', true, 'media admits one typed asset reference'),
  ('gallery', '{"assetId":"x"}', false, 'media refuses an untyped object reference'),
  ('gallery', '5', false, 'media refuses a number'),
  ('free_text', '"a"', true, 'a text field honours a declared enumValues member'),
  ('free_text', '"z"', false, 'a text field refuses a string outside declared enumValues')
) c(key, value, expected, label);

-- ---------------------------------------------------------------------------
-- relation, against the fixture schema's relation field.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s10g_relation(p_value jsonb)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_draft_field_value_valid(
    (select value::uuid from s10_ids where key = 'draftVersionId'),
    (select value::uuid from s10_ids where key = 'typeRelationFieldId'),
    p_value, 'authored');
exception
  when others then
    return null;
end;
$body$;

select is(pg_temp.s10g_relation(c.value), c.expected, c.label || ' [P2-S10-AC-031]')
from (values
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":null}]}'::jsonb, true, 'relation admits the ordered targets shape'),
  ('{"targets":[]}', true, 'relation admits an empty target list'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":"4"}]}', true, 'relation admits a canonical expected version'),
  ('"a9100000-0000-4000-8000-000000000301"', false, 'relation refuses a bare identifier string'),
  ('{"targets":[{"targetId":"nope"}]}', false, 'relation refuses a target that is not a UUID'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":"0"}]}', false, 'relation refuses a non-canonical expected version'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","x":1}]}', false, 'relation refuses an unknown target member'),
  ('{"targets":[],"x":1}', false, 'relation refuses an unknown top-level member'),
  ('[]', false, 'relation refuses a bare array')
) c(value, expected, label);
select is(
  pg_temp.s10g_relation(jsonb_build_object('targets', (
    select jsonb_agg(jsonb_build_object(
      'targetId', ('a9100000-0000-4000-8000-' || lpad(g::text, 12, '0')))
    ) from generate_series(1, 513) g))),
  false,
  'relation refuses 513 targets [P2-S10-AC-031]'
);

-- ---------------------------------------------------------------------------
-- Provenance: an explicit null and a missing value are decided by provenance
-- and stay distinct from an authored null, for every kind.
-- ---------------------------------------------------------------------------
select is(pg_temp.s10g_valid(k, 'null'::jsonb, 'explicit_null'), true,
  'an explicit_null ' || k || ' value is admitted [P2-S10-AC-031]')
from unnest(array['s_text', 'l_text', 'flag', 'whole', 'amount', 'day', 'moment', 'choice',
  'tax', 'body', 'hero', 'tags', 'gallery', 'free_text']) k;
select is(pg_temp.s10g_valid(k, null, 'missing'), true,
  'a missing ' || k || ' value is admitted [P2-S10-AC-031]')
from unnest(array['s_text', 'l_text', 'flag', 'whole', 'amount', 'day', 'moment', 'choice',
  'tax', 'body', 'hero', 'tags', 'gallery', 'free_text']) k;
select is(pg_temp.s10g_valid(k, 'null'::jsonb, 'authored'), false,
  'an authored JSON null ' || k || ' value is refused [P2-S10-AC-031]')
from unnest(array['s_text', 'l_text', 'flag', 'whole', 'amount', 'day', 'moment', 'choice',
  'tax', 'body', 'hero', 'tags', 'gallery', 'free_text']) k;
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_id from s10g_schema), 'a9100000-0000-4000-8000-00000000ffff'::uuid,
    '"x"'::jsonb, 'authored'),
  false,
  'a value for a field that is not part of the pinned schema is refused [P2-S10-AC-031]'
);
select is(
  platform_private.cms_draft_field_value_valid(
    (select schema_id from s10g_schema), 'a9100000-0000-4000-8000-00000000ffff'::uuid,
    'null'::jsonb, 'explicit_null'),
  false,
  'an explicit null for a field that is not part of the pinned schema is refused [P2-S10-AC-031]'
);

select * from finish();
rollback;
