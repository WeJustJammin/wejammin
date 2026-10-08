-- Slice 10 follow-up (lane F, task 4): taxonomy and media typed encodings and the
-- producer refusal predicate.
--
-- BE03b "Value encodings by field kind" (lines 1042-1053):
--   * taxonomy: `{ termIds: UUID[] <= 128 }` ... "A non-empty value fails closed
--     with typed reason `taxonomy_source_unavailable` until the taxonomy-version
--     authority exists."
--   * media: `{ assetId: UUID, assetVersion: Version }` (or an array per list).
--     "A non-empty value fails closed with typed reason `media_source_unavailable`
--     until the media provider exists."
--   * the BE03b raw-body bound: "JSON nesting max 8, keys 128, arrays 128".
--
-- This file pins the typed encodings (an untyped string/array/object
-- pass-through is not an encoding), the pure refusal predicate, and the
-- definer-only privilege of the refusal helpers.  The write commands that call
-- them are driven through the real RPCs in
-- phase_02_slice_10_value_source_refusal.sql (create, append) and
-- phase_02_slice_10_value_source_resolve.sql (conflict resolution).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc

-- Guarded predicate probes: a raising predicate yields null, which fails both
-- the true and the false assertions.
create or replace function pg_temp.s10s_shape(
  p_kind text, p_constraints jsonb, p_value jsonb
)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_field_kind_value_shape(p_kind, p_constraints, p_value);
exception
  when others then
    return null;
end;
$body$;

create or replace function pg_temp.s10s_refusal(p_kind text, p_value jsonb)
returns text
language plpgsql
stable
as $body$
begin
  return coalesce(platform_private.cms_value_source_refusal(p_kind, p_value), '<none>');
exception
  when others then
    return '<raised>';
end;
$body$;

create or replace function pg_temp.s10s_supported(p_kind text)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_authored_value_kind_supported(p_kind);
exception
  when others then
    return null;
end;
$body$;

create or replace function pg_temp.s10s_uuids(p_count integer)
returns jsonb
language sql
immutable
as $body$
  select coalesce(jsonb_agg('a9100000-0000-4000-8000-' || lpad(g::text, 12, '0')), '[]'::jsonb)
  from generate_series(1, p_count) g
$body$;

-- ===========================================================================
-- Part A1: the typed encodings.
-- ===========================================================================
select is(
  pg_temp.s10s_shape(c.kind, c.constraints, c.value),
  c.expected,
  c.label || ' [BE03b value encodings]'
)
from (values
  -- taxonomy: { termIds: UUID[] <= 128 }
  ('taxonomy', '{}'::jsonb, '{"termIds":[]}'::jsonb, true, 'taxonomy admits an empty term list'),
  ('taxonomy', '{}', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}', true, 'taxonomy admits a well-formed term id list'),
  ('taxonomy', '{}', '{"termIds":["a9100000-0000-4000-8000-0000000000f1","a9100000-0000-4000-8000-0000000000f2"]}', true, 'taxonomy admits several term ids'),
  ('taxonomy', '{}', jsonb_build_object('termIds', pg_temp.s10s_uuids(128)), true, 'taxonomy admits exactly 128 term ids'),
  ('taxonomy', '{}', jsonb_build_object('termIds', pg_temp.s10s_uuids(129)), false, 'taxonomy refuses 129 term ids'),
  ('taxonomy', '{}', '{"termIds":["term-one"]}', false, 'taxonomy refuses a term id that is not a UUID'),
  ('taxonomy', '{}', '{"termIds":[1]}', false, 'taxonomy refuses a numeric term id'),
  ('taxonomy', '{}', '{"termIds":[null]}', false, 'taxonomy refuses a null term id'),
  ('taxonomy', '{}', '{"termIds":null}', false, 'taxonomy refuses a null term list'),
  ('taxonomy', '{}', '{"termIds":"a9100000-0000-4000-8000-0000000000f1"}', false, 'taxonomy refuses a bare string where the term list belongs'),
  ('taxonomy', '{}', '{}', false, 'taxonomy refuses an object without termIds'),
  ('taxonomy', '{}', '{"termIds":[],"extra":1}', false, 'taxonomy refuses an undeclared member (strict object)'),
  ('taxonomy', '{}', '"term-one"', false, 'taxonomy refuses the old untyped string pass-through'),
  ('taxonomy', '{}', '["a9100000-0000-4000-8000-0000000000f1"]', false, 'taxonomy refuses a bare array of term ids'),
  ('taxonomy', '{}', '5', false, 'taxonomy refuses a number'),
  ('taxonomy', '{}', 'true', false, 'taxonomy refuses a boolean'),
  ('taxonomy', '{}', 'null', false, 'an authored null is never a taxonomy shape'),
  -- media: { assetId: UUID, assetVersion: Version } or an array of them (<= 128)
  ('media', '{}', '[]', true, 'media admits an empty reference array'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}', true, 'media admits one well-formed asset reference'),
  ('media', '{}', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"},{"assetId":"a9100000-0000-4000-8000-0000000000a2","assetVersion":"1"}]', true, 'media admits an array of well-formed asset references'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"9223372036854775807"}', true, 'media admits the largest signed 64-bit version'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"9223372036854775808"}', false, 'media refuses a version above the signed 64-bit range'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"0"}', false, 'media refuses version 0 (versions start at 1)'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"03"}', false, 'media refuses a non-canonical version'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":3}', false, 'media refuses a numeric version (a decimal string)'),
  ('media', '{}', '{"assetId":"x","assetVersion":"3"}', false, 'media refuses an asset id that is not a UUID'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1"}', false, 'media refuses a reference without assetVersion'),
  ('media', '{}', '{"assetVersion":"3"}', false, 'media refuses a reference without assetId'),
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3","alt":"x"}', false, 'media refuses an undeclared member (strict object)'),
  ('media', '{}', '{}', false, 'media refuses an empty object'),
  ('media', '{}', '"asset"', false, 'media refuses the old untyped string pass-through'),
  ('media', '{}', '["asset"]', false, 'media refuses an array of strings'),
  ('media', '{}', '[[]]', false, 'media refuses a nested array'),
  ('media', '{}', '5', false, 'media refuses a number'),
  ('media', '{}', 'true', false, 'media refuses a boolean'),
  ('media', '{}', 'null', false, 'an authored null is never a media shape'),
  ('media', '{}', (select jsonb_agg('{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"}'::jsonb) from generate_series(1, 128)), true, 'media admits exactly 128 references (BE03b arrays 128)'),
  ('media', '{}', (select jsonb_agg('{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"}'::jsonb) from generate_series(1, 129)), false, 'media refuses 129 references'),
  ('media', '{"maxLength":2}', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"2"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]', false, 'media array honours the 03a maxLength bound')
) c(kind, constraints, value, expected, label);

-- ===========================================================================
-- Part A2: the pure refusal predicate.  Only a non-empty taxonomy/media value
-- is refused; an empty value, every other kind and a null are not.
-- ===========================================================================
select is(
  pg_temp.s10s_refusal(c.kind, c.value),
  c.expected,
  c.label || ' [BE03b value encodings]'
)
from (values
  ('taxonomy', '{"termIds":[]}'::jsonb, '<none>', 'an empty taxonomy value has no producer dependency'),
  ('taxonomy', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}', 'taxonomy_source_unavailable', 'a non-empty taxonomy value fails closed with taxonomy_source_unavailable'),
  ('taxonomy', jsonb_build_object('termIds', pg_temp.s10s_uuids(128)), 'taxonomy_source_unavailable', 'a full taxonomy value fails closed with taxonomy_source_unavailable'),
  ('media', '[]', '<none>', 'an empty media array has no producer dependency'),
  ('media', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}', 'media_source_unavailable', 'a single media reference fails closed with media_source_unavailable'),
  ('media', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]', 'media_source_unavailable', 'a non-empty media array fails closed with media_source_unavailable'),
  ('taxonomy', 'null', '<none>', 'a JSON null taxonomy value is not refused (provenance decides it)'),
  ('media', 'null', '<none>', 'a JSON null media value is not refused (provenance decides it)'),
  ('short_text', '"x"', '<none>', 'a short_text value is never refused here'),
  ('long_text', '"x"', '<none>', 'a long_text value is never refused here'),
  ('boolean', 'true', '<none>', 'a boolean value is never refused here'),
  ('integer', '3', '<none>', 'an integer value is never refused here'),
  ('decimal', '1.5', '<none>', 'a decimal value is never refused here'),
  ('date', '"2026-02-28"', '<none>', 'a date value is never refused here'),
  ('datetime', '"2026-02-28T10:00:00Z"', '<none>', 'a datetime value is never refused here'),
  ('enum', '"a"', '<none>', 'an enum value is never refused here'),
  ('rich_text', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[]}]}', '<none>', 'a rich_text value is never refused here (its validator exists)'),
  ('object', '{"label":"x"}', '<none>', 'an object value is never refused here (its structure validator exists)'),
  ('list', '["a"]', '<none>', 'a list value is never refused here (its item validator exists)'),
  ('relation', '{"targets":[]}', '<none>', 'a relation value is never refused here (owned by the relation seam)')
) c(kind, value, expected, label);
select is(pg_temp.s10s_refusal(null, '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]'::jsonb),
  '<none>', 'a null kind is never refused (the gate refuses it first) [BE03b value encodings]');
select is(pg_temp.s10s_refusal('media', null), '<none>',
  'a SQL NULL value is never refused (the gate refuses it first) [BE03b value encodings]');

-- Least privilege: the refusal helpers are reachable only from the definer
-- command bodies.
select ok(
  coalesce(pg_temp.s10_fn_exists('platform_private', 'cms_value_source_refusal', 'text, jsonb'), false)
    and pg_temp.s10_no_execute_for('platform_private', 'cms_value_source_refusal', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_value_source_refusal', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_value_source_refusal', 'service_role')
    and coalesce(has_function_privilege('wejammin_cms_definer',
      to_regprocedure('platform_private.cms_value_source_refusal(text, jsonb)'), 'execute'), false),
  'cms_value_source_refusal is definer-only (no API role may execute it)'
);
select ok(
  coalesce(pg_temp.s10_fn_exists('platform_private', 'cms_require_value_source_available', 'uuid, uuid, jsonb'), false)
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_value_source_available', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_value_source_available', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_value_source_available', 'service_role')
    and coalesce(has_function_privilege('wejammin_cms_definer',
      to_regprocedure('platform_private.cms_require_value_source_available(uuid, uuid, jsonb)'), 'execute'), false),
  'cms_require_value_source_available is definer-only (no API role may execute it)'
);
select ok(
  coalesce(pg_temp.s10_fn_exists('platform_private', 'cms_authored_value_kind_supported', 'text'), false)
    and pg_temp.s10_no_execute_for('platform_private', 'cms_authored_value_kind_supported', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_authored_value_kind_supported', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_authored_value_kind_supported', 'service_role')
    and coalesce(has_function_privilege('wejammin_cms_definer',
      to_regprocedure('platform_private.cms_authored_value_kind_supported(text)'), 'execute'), false),
  'cms_authored_value_kind_supported is definer-only (no API role may execute it)'
);
select is(
  (select string_agg(kind || '=' || coalesce(pg_temp.s10s_supported(kind)::text, 'raised'), ',' order by kind)
   from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
     'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list', 'blob']) kind),
  'blob=false,boolean=true,date=true,datetime=true,decimal=true,enum=true,integer=true,list=true,long_text=true,media=true,object=true,relation=true,rich_text=true,short_text=true,taxonomy=true',
  'every field kind is writable by the append and resolve commands (relation joined once its binding and target resolution exist, P2-S10-AC-073); an unknown kind is never writable'
);
select is(pg_temp.s10s_supported(null), false, 'a null kind is never writable');

select * from finish();
rollback;
