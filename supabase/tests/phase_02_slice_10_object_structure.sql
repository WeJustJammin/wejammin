-- Slice 10 repair (stream 1): the DEC-133 typed depth-1 `object` structure as
-- the database enforces it (BE03a "Field kind structure (DEC-112, DEC-133)",
-- BE03b "`object` field structure"; criteria P2-S10-AC-076..080).
--
-- An `object` field declares constraints.objectStructure = { properties: [...] }
-- with 0..32 properties.  Each property is a strict
-- { key, kind, required, constraints } with a unique stable key
-- (^[a-z][a-z0-9_]{1,63}$), a kind of scalar | enum | rich_text only, an
-- explicit boolean required flag, and a constraint record drawn from the closed
-- per-kind vocabulary of DEC-144 (an enum member must carry a nonempty immutable
-- enumValues set; the full vocabulary and its value checks are pinned in
-- phase_02_slice_10_object_property_constraints.sql).  The structure is stored in
-- the field constraints, frozen into the definition hash and compiled into the
-- SchemaArtifact; every object value is validated against it with closed keys,
-- required presence, primitive scalars, declared enum choices and rich_text.v1
-- documents, so there is no untyped pass-through.
--
-- This file pins the pure predicates (structure, value, field definition input);
-- phase_02_slice_10_object_structure_rpc.sql proves a refused structure commits
-- nothing, an accepted one is bound into the compiled artifact and the frozen
-- definition hash, and the draft value gate validates against it.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.s10o_structure(p_structure jsonb)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_object_structure_valid(p_structure);
exception
  when others then
    return null;
end;
$body$;

create or replace function pg_temp.s10o_value(p_structure jsonb, p_value jsonb)
returns boolean
language plpgsql
stable
as $body$
begin
  return platform_private.cms_object_value_valid(p_structure, p_value);
exception
  when others then
    return null;
end;
$body$;

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

-- A guarded field-definition input check (complete definition by default).
create or replace function pg_temp.s10o_field(
  p_kind text,
  p_constraints jsonb,
  p_stable boolean default true,
  p_default_mode text default 'none',
  p_default jsonb default null,
  p_has_default boolean default false
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
    'defaultMode', p_default_mode, 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Probe', 'order', 0),
    'lifecycle', 'active'
  );
  if p_stable then
    field := field || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000b01');
  end if;
  if p_has_default then
    field := field || jsonb_build_object('defaultValue', p_default);
  end if;
  return platform_private.cms_valid_field_input(field, p_stable);
exception
  when others then
    return null;
end;
$body$;

-- ===========================================================================
-- P2-S10-AC-076: exactly one typed depth-1 properties[] declaration with
-- 0..32 properties; nested object/list property kinds are refused.
-- ===========================================================================
select is(pg_temp.s10o_structure(c.structure), c.expected, c.label || ' [P2-S10-AC-076]')
from (values
  ('{"properties":[]}'::jsonb, true, 'a structure with zero properties is accepted'),
  (jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('title', 'scalar', true))), true, 'a structure with one scalar property is accepted'),
  (pg_temp.s10o_many(32), true, 'a structure with exactly 32 properties is accepted'),
  (pg_temp.s10o_many(33), false, 'a structure with 33 properties is refused'),
  ('{}', false, 'a structure without properties is refused'),
  ('{"properties":{}}', false, 'a properties member that is an object is refused'),
  ('{"properties":null}', false, 'a null properties member is refused'),
  ('{"properties":"x"}', false, 'a string properties member is refused'),
  ('{"properties":[],"extra":1}', false, 'a structure with an extra top-level member is refused'),
  ('[]', false, 'a structure that is an array is refused'),
  ('null', false, 'a structure that is JSON null is refused'),
  ('"x"', false, 'a structure that is a string is refused'),
  (jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('inner', 'object', false))), false, 'a nested object property kind is refused'),
  (jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('inner', 'list', false))), false, 'a nested list property kind is refused'),
  (jsonb_build_object('properties', jsonb_build_array(pg_temp.s10o_prop('inner', 'array', false))), false, 'an array property kind is refused'),
  ('{"properties":[["a"]]}', false, 'a property that is itself an array is refused'),
  ('{"properties":["title"]}', false, 'a property that is a bare string is refused')
) c(structure, expected, label);
select is(pg_temp.s10o_structure(NULL::jsonb), false,
  'a SQL NULL structure is refused [P2-S10-AC-076]');

-- ===========================================================================
-- P2-S10-AC-077: unique stable keys, only scalar | enum | rich_text child
-- kinds, and an explicit boolean required flag on every property.
-- ===========================================================================
select is(
  pg_temp.s10o_structure(jsonb_build_object('properties', jsonb_build_array(c.property))),
  c.expected,
  c.label || ' [P2-S10-AC-077]'
)
from (values
  (pg_temp.s10o_prop('title', 'scalar', true), true, 'a lowercase snake key with the scalar kind is accepted'),
  (pg_temp.s10o_prop('ab', 'scalar', true), true, 'a two-character key is accepted'),
  (pg_temp.s10o_prop('a' || repeat('b', 63), 'scalar', true), true, 'a 64-character key is accepted'),
  (pg_temp.s10o_prop('a_1', 'scalar', true), true, 'a key with digits and underscores is accepted'),
  (pg_temp.s10o_prop('Title', 'scalar', true), false, 'an uppercase key is refused'),
  (pg_temp.s10o_prop('a', 'scalar', true), false, 'a one-character key is refused'),
  (pg_temp.s10o_prop('a' || repeat('b', 64), 'scalar', true), false, 'a 65-character key is refused'),
  (pg_temp.s10o_prop('a-b', 'scalar', true), false, 'a hyphenated key is refused'),
  (pg_temp.s10o_prop('1ab', 'scalar', true), false, 'a key with a leading digit is refused'),
  (pg_temp.s10o_prop('a b', 'scalar', true), false, 'a key with a space is refused'),
  ('{"key":5,"kind":"scalar","required":true,"constraints":{}}', false, 'a numeric key is refused'),
  ('{"kind":"scalar","required":true,"constraints":{}}', false, 'a missing key member is refused'),
  (pg_temp.s10o_prop('title', 'enum', true, '{"enumValues":["a"]}'), true, 'the enum kind is accepted'),
  (pg_temp.s10o_prop('title', 'rich_text', true), true, 'the rich_text kind is accepted'),
  (pg_temp.s10o_prop('title', 'short_text', true), false, 'the short_text kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'integer', true), false, 'the integer kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'date', true), false, 'the date kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'relation', true), false, 'the relation kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'media', true), false, 'the media kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'taxonomy', true), false, 'the taxonomy kind is refused as a child kind'),
  (pg_temp.s10o_prop('title', 'rich-text', true), false, 'a misspelled child kind is refused'),
  (pg_temp.s10o_prop('title', 'SCALAR', true), false, 'an uppercase child kind is refused'),
  (pg_temp.s10o_prop('title', '', true), false, 'an empty child kind is refused'),
  ('{"key":"title","required":true,"constraints":{}}', false, 'a missing kind member is refused'),
  ('{"key":"title","kind":null,"required":true,"constraints":{}}', false, 'a null kind is refused'),
  (pg_temp.s10o_prop('title', 'scalar', false), true, 'an explicit required false is accepted'),
  ('{"key":"title","kind":"scalar","constraints":{}}', false, 'a missing required flag is refused'),
  ('{"key":"title","kind":"scalar","required":"true","constraints":{}}', false, 'a string required flag is refused'),
  ('{"key":"title","kind":"scalar","required":null,"constraints":{}}', false, 'a null required flag is refused'),
  ('{"key":"title","kind":"scalar","required":1,"constraints":{}}', false, 'a numeric required flag is refused')
) c(property, expected, label);
select is(
  pg_temp.s10o_structure(jsonb_build_object('properties', jsonb_build_array(
    pg_temp.s10o_prop('title', 'scalar', true), pg_temp.s10o_prop('title', 'enum', false, '{"enumValues":["a"]}')))),
  false,
  'two properties sharing one key are refused whatever their kinds [P2-S10-AC-077]'
);
select is(
  pg_temp.s10o_structure(jsonb_build_object('properties', jsonb_build_array(
    pg_temp.s10o_prop('title', 'scalar', true), pg_temp.s10o_prop('subtitle', 'scalar', false),
    pg_temp.s10o_prop('body', 'rich_text', false)))),
  true,
  'distinct stable keys across the three child kinds are accepted [P2-S10-AC-077]'
);

-- ===========================================================================
-- P2-S10-AC-078: property members are strict and the constraints are
-- kind-specific: an enum property carries a nonempty immutable enumValues
-- string set; scalar and rich_text carry the closed DEC-144 vocabulary (the
-- open Record<string, Json> BE03b once typed is closed per kind).
-- ===========================================================================
select is(
  pg_temp.s10o_structure(jsonb_build_object('properties', jsonb_build_array(c.property))),
  c.expected,
  c.label || ' [P2-S10-AC-078]'
)
from (values
  ('{"key":"title","kind":"scalar","required":true,"constraints":{},"default":"x"}'::jsonb, false, 'an unknown property member is refused'),
  ('{"key":"title","kind":"scalar","required":true}', false, 'a missing constraints member is refused'),
  ('{"key":"title","kind":"scalar","required":true,"constraints":null}', false, 'a null constraints member is refused'),
  ('{"key":"title","kind":"scalar","required":true,"constraints":[]}', false, 'an array constraints member is refused'),
  ('{"key":"title","kind":"scalar","required":true,"constraints":"x"}', false, 'a string constraints member is refused'),
  (pg_temp.s10o_prop('status', 'enum', true), false, 'an enum property without enumValues is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"enumValues":[]}'), false, 'an enum property with an empty choice set is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"enumValues":"a"}'), false, 'an enum property whose enumValues is not an array is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"enumValues":["a",1]}'), false, 'an enum property with a non-string choice is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"enumValues":[null]}'), false, 'an enum property with a null choice is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"other":["a"]}'), false, 'an enum property whose only constraint is not enumValues is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, jsonb_build_object('enumValues', (select jsonb_agg('v' || g) from generate_series(1, 256) g))), true, 'an enum property with 256 choices is accepted'),
  (pg_temp.s10o_prop('status', 'enum', true, jsonb_build_object('enumValues', (select jsonb_agg('v' || g) from generate_series(1, 257) g))), false, 'an enum property with 257 choices is refused'),
  (pg_temp.s10o_prop('status', 'enum', true, '{"enumValues":["draft","live"]}'), true, 'an enum property with a nonempty string choice set is accepted'),
  (pg_temp.s10o_prop('title', 'scalar', true, '{"minLength":1}'), true, 'a scalar property carries a member of its closed constraint vocabulary (DEC-144)'),
  (pg_temp.s10o_prop('body', 'rich_text', false, '{"maxLength":100}'), true, 'a rich_text property carries a member of its closed constraint vocabulary (DEC-144)')
) c(property, expected, label);

-- Values: closed keys, required presence, primitive scalars, declared enum
-- choices and rich_text.v1 documents.  The structure under test:
--   title (scalar, required), status (enum draft|live), body (rich_text),
--   count (scalar).
create temp table s10o_s on commit drop as
select jsonb_build_object('properties', jsonb_build_array(
  pg_temp.s10o_prop('title', 'scalar', true),
  pg_temp.s10o_prop('status', 'enum', false, '{"enumValues":["draft","live"]}'),
  pg_temp.s10o_prop('body', 'rich_text', false),
  pg_temp.s10o_prop('count', 'scalar', false)
)) as structure;

select is(
  pg_temp.s10o_value((select structure from s10o_s), c.value),
  c.expected,
  c.label || ' [P2-S10-AC-078]'
)
from (values
  ('{"title":"x"}'::jsonb, true, 'a value with only the required property is accepted'),
  ('{"title":"x","status":"draft","count":3}', true, 'a value using every scalar and enum property is accepted'),
  ('{}', false, 'a missing required property is refused'),
  ('{"status":"draft"}', false, 'a value that omits the required property is refused'),
  ('{"title":"x","unknown":1}', false, 'an undeclared key is refused'),
  ('{"title":"x","status":"retired"}', false, 'an enum value outside the declared choice set is refused'),
  ('{"title":"x","status":5}', false, 'a non-string enum value is refused'),
  ('{"title":"x","status":["draft"]}', false, 'an array enum value is refused'),
  ('{"title":"x","body":"plain text"}', false, 'a raw string for a rich_text property is refused'),
  ('{"title":"x","body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}}', true, 'a canonical rich_text.v1 document for a rich_text property is accepted'),
  ('{"title":"x","body":{"format":"html","blocks":[]}}', false, 'a non-rich_text.v1 document for a rich_text property is refused'),
  ('{"title":["a"]}', false, 'an array for a scalar property is refused (depth is exactly 1)'),
  ('{"title":{"n":1}}', false, 'an object for a scalar property is refused (depth is exactly 1)'),
  ('{"title":{"a":{"b":1}}}', false, 'a doubly nested value for a scalar property is refused'),
  ('{"title":"x","count":1.5}', true, 'a fractional number is a scalar value'),
  ('{"title":true}', true, 'a boolean is a scalar value'),
  ('{"title":null}', false, 'a JSON null does not satisfy a required scalar property (BE03a: scalar covers the scalar field kinds, none admits an authored null; required is the only presence control)'),
  ('{"title":"x","count":null}', false, 'a JSON null is not a value for an optional scalar property either: leave the key out instead'),
  ('{"title":"x","status":null}', false, 'a JSON null is not an enum member'),
  ('{"title":"x","body":null}', false, 'a JSON null is not a rich_text.v1 document'),
  ('"x"', false, 'a string value is not an object'),
  ('[]', false, 'an array value is not an object'),
  ('null', false, 'a JSON null value is not an object'),
  ('5', false, 'a number value is not an object')
) c(value, expected, label);
select is(pg_temp.s10o_value((select structure from s10o_s), NULL::jsonb), false,
  'a SQL NULL value is refused [P2-S10-AC-078]');
select is(
  pg_temp.s10o_value(jsonb_build_object('properties', jsonb_build_array(
    pg_temp.s10o_prop('body', 'rich_text', true))), '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}}'),
  true,
  'a required rich_text property that is present and canonical is accepted [P2-S10-AC-078]'
);
select is(
  pg_temp.s10o_value(jsonb_build_object('properties', jsonb_build_array(
    pg_temp.s10o_prop('body', 'rich_text', true))), '{}'),
  false,
  'a required rich_text property that is absent is refused [P2-S10-AC-078]'
);
select is(pg_temp.s10o_value('{"properties":[]}'::jsonb, '{}'::jsonb), true,
  'a zero-property structure admits only the empty object [P2-S10-AC-076]');
select is(pg_temp.s10o_value('{"properties":[]}'::jsonb, '{"a":1}'::jsonb), false,
  'a zero-property structure refuses any key [P2-S10-AC-076]');
select is(pg_temp.s10o_value(pg_temp.s10o_many(33), '{}'::jsonb), false,
  'a value is never admitted under an invalid 33-property structure [P2-S10-AC-076]');
select is(
  pg_temp.s10o_value(jsonb_build_object('properties', jsonb_build_array(
    pg_temp.s10o_prop('inner', 'object', false))), '{}'::jsonb),
  false,
  'a value is never admitted under a structure with a nested object property kind [P2-S10-AC-076]'
);
select is(pg_temp.s10o_value(NULL::jsonb, '{}'::jsonb), false,
  'a value is never admitted without a structure [P2-S10-AC-078]');

-- ===========================================================================
-- Definition input: the structure belongs to the object kind only, is
-- required on a complete definition, and a literal default must satisfy it.
-- ===========================================================================
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', pg_temp.s10o_many(32))), true,
  'an object field with a 32-property structure is a valid definition [P2-S10-AC-076]');
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', pg_temp.s10o_many(33))), false,
  'an object field with a 33-property structure is refused [P2-S10-AC-076]');
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('inner', 'object', false))))), false,
  'an object field with a nested object property kind is refused [P2-S10-AC-076]');
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('dup', 'scalar', false), pg_temp.s10o_prop('dup', 'scalar', true))))), false,
  'an object field with duplicate property keys is refused [P2-S10-AC-077]');
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('status', 'enum', true))))), false,
  'an object field whose enum property has no choice set is refused [P2-S10-AC-078]');
select is(pg_temp.s10o_field('object', '{}'::jsonb), false,
  'a complete object field definition without a structure is refused [P2-S10-AC-076]');
select is(pg_temp.s10o_field('object', '{}'::jsonb, false), true,
  'the incremental field-edit path keeps its legacy permissiveness; the value gate still fails closed without a structure [P2-S10-AC-076]');
select is(pg_temp.s10o_field(k, jsonb_build_object('objectStructure', pg_temp.s10o_many(1))), false,
  'an objectStructure on a ' || k || ' field is refused: it is valid only on the object kind [P2-S10-AC-076]')
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'list']) k;
select is(pg_temp.s10o_field('object', jsonb_build_object('objectStructure', pg_temp.s10o_many(1), 'itemKind', 'short_text')), false,
  'itemKind is list-only: an object field cannot declare a second item encoding [P2-S10-AC-076]');
select is(
  pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('title', 'scalar', true)))),
    true, 'literal', '{"title":"x"}'::jsonb, true),
  true,
  'an object literal default satisfying the structure is accepted [P2-S10-AC-080]'
);
select is(
  pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('title', 'scalar', true)))),
    true, 'literal', '{}'::jsonb, true),
  false,
  'an object literal default missing a required property is refused [P2-S10-AC-080]'
);
select is(
  pg_temp.s10o_field('object', jsonb_build_object('objectStructure', jsonb_build_object('properties',
    jsonb_build_array(pg_temp.s10o_prop('title', 'scalar', true)))),
    true, 'literal', '{"title":"x","extra":1}'::jsonb, true),
  false,
  'an object literal default with an undeclared key is refused [P2-S10-AC-080]'
);

select * from finish();
rollback;
