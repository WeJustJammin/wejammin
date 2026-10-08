-- Slice 10 repair (stream 1): the definition-time literal default gate.
--
-- cms_valid_field_input decides a field definition; a literal defaultValue must
-- satisfy the encoding its field kind imposes (BE03a: a default is never a looser
-- encoding than its field) through the shared cms_field_kind_value_shape, and an
-- explicit JSON null is itself a valid literal default of every kind (BE03a:
-- defaultValue is Json.nullable().optional(); only a missing key is not a
-- default).  The shape helper keeps refusing an authored null, so a present
-- literal JSON null is admitted here and nowhere else.  A JSON null in a
-- mandatory member (key, kind, editor label, ...) is refused outright rather than
-- skipped by SQL three-valued logic.  A literal default that used to be refused
-- (short_text "n/a", boolean false, integer 0, ...) fell through the shape
-- helper's media-only final return; these assertions pin the repaired behavior.
--
-- Every probe goes through a guarded helper: a raising predicate yields null,
-- which fails both the true and the false assertions.
--
-- These are Slice 10 assertions and carry no Slice 09 criterion marker: the
-- Slice 09 map cites its own files for the BE03a field-definition criteria (field
-- members, constraints, defaultMode), and a marker here would claim evidence that
-- map does not list (the marker-citation guard refuses that).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.s10k_field(
  p_kind text,
  p_constraints jsonb,
  p_mode text,
  p_has_default boolean,
  p_default jsonb default null,
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
    'defaultMode', p_mode, 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Probe', 'order', 0),
    'lifecycle', 'active'
  );
  if p_stable then
    field := field || jsonb_build_object(
      'stableFieldId', 'a9100000-0000-4000-8000-000000000a01'
    );
  end if;
  if p_has_default then
    -- jsonb_build_object turns the SQL NULL default into a present JSON null.
    field := field || jsonb_build_object('defaultValue', p_default);
  end if;
  return platform_private.cms_valid_field_input(field, p_stable);
exception
  when others then
    return null;
end;
$body$;

-- ===========================================================================
-- cms_valid_field_input: a literal defaultValue must satisfy the encoding its
-- field kind imposes (a default is never a looser encoding than its field);
-- an explicit JSON null is itself a valid literal default for every kind.
-- ===========================================================================
select is(
  pg_temp.s10k_field(c.kind, c.constraints, 'literal', true, c.dflt),
  c.expected,
  c.label
)
from (values
  ('short_text', '{}'::jsonb, '"n/a"'::jsonb, true, 'a short_text literal default "n/a" is accepted'),
  ('short_text', '{}', '""', true, 'a short_text literal empty-string default is accepted'),
  ('short_text', '{}', '5', false, 'a short_text field refuses a numeric literal default'),
  ('short_text', '{"maxLength":3}', '"abcd"', false, 'a short_text literal default over maxLength is refused'),
  ('short_text', '{"minLength":2}', '"a"', false, 'a short_text literal default under minLength is refused'),
  ('long_text', '{}', '"long form"', true, 'a long_text literal default is accepted'),
  ('long_text', '{}', 'true', false, 'a long_text field refuses a boolean literal default'),
  ('boolean', '{}', 'false', true, 'a boolean literal false default is accepted'),
  ('boolean', '{}', 'true', true, 'a boolean literal true default is accepted'),
  ('boolean', '{}', '"false"', false, 'a boolean field refuses a string literal default'),
  ('boolean', '{}', '0', false, 'a boolean field refuses a numeric literal default'),
  ('integer', '{}', '0', true, 'an integer literal zero default is accepted'),
  ('integer', '{}', '42', true, 'an integer literal default is accepted'),
  ('integer', '{}', '"0"', false, 'an integer field refuses a string literal default'),
  ('integer', '{}', '1.5', false, 'an integer field refuses a fractional literal default'),
  ('integer', '{"maximum":5}', '6', false, 'an integer literal default over maximum is refused'),
  ('integer', '{"minimum":1}', '0', false, 'an integer literal default under minimum is refused'),
  ('decimal', '{}', '1.5', true, 'a decimal literal default is accepted'),
  ('decimal', '{}', '"1.5"', false, 'a decimal field refuses a string literal default'),
  ('decimal', '{"minimum":0,"maximum":100}', '5', true, 'a decimal literal default inside minimum..maximum is accepted'),
  ('decimal', '{"minimum":0,"maximum":100}', '101', false, 'a decimal literal default over maximum is refused'),
  ('date', '{}', '"2026-02-28"', true, 'a date literal default of a real calendar day is accepted'),
  ('date', '{}', '"2026-02-30"', false, 'a date literal default of a non-existent day is refused'),
  ('datetime', '{}', '"2026-02-28T10:00:00Z"', true, 'a datetime literal default is accepted'),
  ('datetime', '{}', '"yesterday"', false, 'a datetime literal default that is not ISO is refused'),
  ('enum', '{"enumValues":["a","b"]}', '"a"', true, 'an enum literal default from the choice set is accepted'),
  ('enum', '{"enumValues":["a","b"]}', '"c"', false, 'an enum literal default outside the choice set is refused'),
  ('enum', '{}', '"a"', false, 'an enum field without a choice set refuses every literal default (fails closed)'),
  ('enum', '{"enumValues":[]}', '"a"', false, 'an enum field with an empty choice set refuses every literal default (fails closed)'),
  -- BE03b "Value encodings by field kind": taxonomy is { termIds: UUID[] <= 128 }, never an untyped string.
  ('taxonomy', '{}', '{"termIds":[]}', true, 'a taxonomy literal default of an empty term list is accepted'),
  ('taxonomy', '{}', '"term-one"', false, 'a taxonomy field refuses an untyped string literal default (BE03b { termIds })'),
  ('taxonomy', '{}', '5', false, 'a taxonomy field refuses a numeric literal default'),
  ('rich_text', '{}', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}', true, 'a rich_text literal default as a rich_text.v1 document is accepted'),
  ('rich_text', '{}', '"plain"', false, 'a rich_text field refuses a raw string literal default'),
  ('relation', '{}', '{"targets":[]}', true, 'a relation literal default of an empty target list is accepted'),
  ('relation', '{}', '"x"', false, 'a relation field refuses a bare string literal default'),
  -- BE03b: media is { assetId: UUID, assetVersion: Version } or an array of them, never an untyped string.
  ('media', '{}', '[]', true, 'a media literal default of an empty reference array is accepted'),
  ('media', '{}', '"asset"', false, 'a media field refuses an untyped string literal default (BE03b { assetId, assetVersion })'),
  ('media', '{}', '5', false, 'a media field refuses a numeric literal default'),
  ('list', '{"itemKind":"short_text"}', '["a"]', true, 'a list literal default of its itemKind is accepted'),
  ('list', '{"itemKind":"short_text"}', '[1]', false, 'a list literal default with a wrong item is refused'),
  ('object', '{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '{"title":"x"}', true, 'an object literal default matching its structure is accepted'),
  ('object', '{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '{}', false, 'an object literal default missing a required property is refused')
) c(kind, constraints, dflt, expected, label);

-- A present literal JSON null is a literal default of every kind; the shape
-- helper above still refuses an authored null, so the two rules stay apart.
select is(
  pg_temp.s10k_field(
    k.kind,
    case k.kind
      when 'object' then '{"objectStructure":{"properties":[]}}'::jsonb
      when 'list' then '{"itemKind":"short_text"}'::jsonb
      when 'enum' then '{"enumValues":["a"]}'::jsonb
      else '{}'::jsonb
    end,
    'literal', true, 'null'::jsonb
  ),
  true,
  'a literal default of explicit JSON null is accepted for a ' || k.kind || ' field'
)
from (select unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list']) as kind) k;

-- The missing/null distinction around defaultMode.
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'literal', false), false,
  'a literal default mode without a defaultValue key is refused');
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'none', true, 'null'::jsonb), false,
  'none with a present JSON null defaultValue is refused: a present key is a default');
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'inherited', true, 'null'::jsonb), false,
  'inherited with a present JSON null defaultValue is refused');
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'none', true, '"x"'::jsonb), false,
  'none with a defaultValue is refused');
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'none', false), true,
  'none without a defaultValue key is accepted');
select is(pg_temp.s10k_field('short_text', '{}'::jsonb, 'inherited', false), true,
  'inherited without a defaultValue key is accepted');

-- itemKind is list-only (DEC-133; BE03a "itemKind is only valid for a list field").
select is(pg_temp.s10k_field('short_text', '{"itemKind":"short_text"}'::jsonb, 'none', false), false,
  'itemKind on a short_text field is refused');
select is(pg_temp.s10k_field('list', '{"itemKind":"short_text"}'::jsonb, 'none', false), true,
  'itemKind on a list field is accepted');

-- A JSON null in a mandatory member is refused outright: SQL three-valued
-- logic must never let a null key, kind or editor member skip its check and
-- reach the storage NOT NULL constraints as an untyped failure.
create or replace function pg_temp.s10k_member(p_member text, p_replacement jsonb)
returns boolean
language plpgsql
stable
as $body$
declare
  field jsonb;
begin
  field := jsonb_build_object(
    'stableFieldId', 'a9100000-0000-4000-8000-000000000a01',
    'key', 'probe', 'kind', 'short_text', 'constraints', '{}'::jsonb,
    'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Probe', 'order', 0),
    'lifecycle', 'active'
  );
  if p_member like 'editorConfig.%' then
    field := jsonb_set(field, array['editorConfig', substr(p_member, 14)], p_replacement);
  else
    field := field || jsonb_build_object(p_member, p_replacement);
  end if;
  return platform_private.cms_valid_field_input(field, true);
exception
  when others then
    return null;
end;
$body$;

select is(pg_temp.s10k_member('key', '"probe"'::jsonb), true,
  'control: the baseline field definition input is accepted');
select is(pg_temp.s10k_member(c.member, 'null'::jsonb), false,
  'a JSON null ' || c.member || ' is refused')
from (values ('stableFieldId'), ('key'), ('kind'), ('constraints'), ('required'), ('defaultMode'),
  ('localizationMode'), ('lifecycle'), ('editorConfig'), ('editorConfig.label'), ('editorConfig.order')) c(member);
select is(pg_temp.s10k_member('editorConfig.label', '5'::jsonb), false,
  'a numeric editorConfig label is refused');

select * from finish();
rollback;
