-- Slice 10 repair (stream 1): the shared field-kind value shape.  The literal
-- default gate that uses it is pinned in phase_02_slice_10_field_kind_default.sql.
--
-- platform_private.cms_field_kind_value_shape(kind, constraints, value) is the
-- one kind-specific encoding gate (BE03b "Value encodings by field kind"): it
-- decides both a literal defaultValue at definition time (through
-- cms_valid_field_input) and a draft value at write time (through
-- cms_draft_field_value_valid).  A defect let every primitive kind (short_text,
-- long_text, boolean, integer, decimal) and the calendar/enum/taxonomy/media
-- tails fall through to a media-only final return, so a perfectly valid literal
-- default such as short_text "n/a" was refused.  These assertions exercise the
-- predicate directly for EVERY field kind: valid values are accepted, wrong
-- primitives are refused, 03a constraints bind, and an authored null never
-- passes the shape helper (a present literal JSON null default is admitted by
-- cms_valid_field_input alone).
--
-- Every probe goes through a guarded helper: a raising or absent predicate
-- yields null, which fails both the true and the false assertions, so the
-- suite reports every case instead of aborting at the first error.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.s10k_shape(
  p_kind text,
  p_constraints jsonb,
  p_value jsonb
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

-- ===========================================================================
-- cms_field_kind_value_shape: every kind accepts a valid value and refuses a
-- wrong encoding.
-- ===========================================================================
select is(
  pg_temp.s10k_shape(c.kind, c.constraints, c.value),
  c.expected,
  c.label || ' [P2-S10-AC-031]'
)
from (values
  -- short_text
  ('short_text', '{}'::jsonb, '"n/a"'::jsonb, true, 'short_text admits a string'),
  ('short_text', '{}', '""', true, 'short_text admits the empty string when no minLength binds'),
  ('short_text', '{}', '7', false, 'short_text refuses a number'),
  ('short_text', '{}', 'true', false, 'short_text refuses a boolean'),
  ('short_text', '{}', '["a"]', false, 'short_text refuses an array'),
  ('short_text', '{}', '{"a":1}', false, 'short_text refuses an object'),
  ('short_text', '{"minLength":3}', '"ab"', false, 'short_text refuses a string under minLength'),
  ('short_text', '{"minLength":3}', '"abc"', true, 'short_text admits a string at minLength'),
  ('short_text', '{"maxLength":3}', '"abcd"', false, 'short_text refuses a string over maxLength'),
  ('short_text', '{"maxLength":3}', '"abc"', true, 'short_text admits a string at maxLength'),
  ('short_text', '{"enumValues":["a","b"]}', '"a"', true, 'short_text honours a declared enumValues member'),
  ('short_text', '{"enumValues":["a","b"]}', '"c"', false, 'short_text refuses a string outside declared enumValues'),
  -- long_text
  ('long_text', '{}', '"A longer body of text."', true, 'long_text admits a string'),
  ('long_text', '{}', '7', false, 'long_text refuses a number'),
  ('long_text', '{}', 'null', false, 'long_text refuses a JSON null authored value'),
  ('long_text', '{"maxLength":5}', '"abcdef"', false, 'long_text refuses a string over maxLength'),
  ('long_text', '{"minLength":2,"maxLength":5}', '"abc"', true, 'long_text admits a string inside minLength..maxLength'),
  -- boolean
  ('boolean', '{}', 'true', true, 'boolean admits true'),
  ('boolean', '{}', 'false', true, 'boolean admits false'),
  ('boolean', '{}', '"true"', false, 'boolean refuses the string true'),
  ('boolean', '{}', '0', false, 'boolean refuses zero'),
  ('boolean', '{}', '1', false, 'boolean refuses one'),
  -- integer
  ('integer', '{}', '0', true, 'integer admits zero'),
  ('integer', '{}', '5', true, 'integer admits a positive integer'),
  ('integer', '{}', '-3', true, 'integer admits a negative integer'),
  ('integer', '{}', '5.5', false, 'integer refuses a fractional number'),
  ('integer', '{}', '"5"', false, 'integer refuses a numeric string'),
  ('integer', '{}', 'true', false, 'integer refuses a boolean'),
  ('integer', '{"minimum":0,"maximum":10}', '10', true, 'integer admits a value at maximum'),
  ('integer', '{"minimum":0,"maximum":10}', '0', true, 'integer admits a value at minimum'),
  ('integer', '{"minimum":0,"maximum":10}', '11', false, 'integer refuses a value over maximum'),
  ('integer', '{"minimum":0,"maximum":10}', '-1', false, 'integer refuses a value under minimum'),
  -- decimal
  ('decimal', '{}', '0', true, 'decimal admits zero'),
  ('decimal', '{}', '1.5', true, 'decimal admits a fractional number'),
  ('decimal', '{}', '-2.25', true, 'decimal admits a negative fractional number'),
  ('decimal', '{}', '"1.5"', false, 'decimal refuses a numeric string'),
  ('decimal', '{}', 'true', false, 'decimal refuses a boolean'),
  ('decimal', '{"minimum":0.5,"maximum":9.5}', '0.5', true, 'decimal admits a value at minimum'),
  ('decimal', '{"minimum":0.5,"maximum":9.5}', '9.5', true, 'decimal admits a value at maximum'),
  ('decimal', '{"minimum":0.5,"maximum":9.5}', '0.4', false, 'decimal refuses a value under minimum'),
  ('decimal', '{"minimum":0.5,"maximum":9.5}', '9.6', false, 'decimal refuses a value over maximum'),
  -- date
  ('date', '{}', '"2026-02-28"', true, 'date admits a real calendar day'),
  ('date', '{}', '"2026-02-30"', false, 'date refuses a non-existent calendar day'),
  ('date', '{}', '"2026-2-8"', false, 'date refuses a non-canonical spelling'),
  ('date', '{}', '"2026-02-28T00:00:00Z"', false, 'date refuses a timestamp'),
  ('date', '{}', '20260228', false, 'date refuses a number'),
  -- datetime
  ('datetime', '{}', '"2026-02-28T10:00:00Z"', true, 'datetime admits a UTC timestamp'),
  ('datetime', '{}', '"2026-02-28T10:00:00.123+23:59"', true, 'datetime admits fractional seconds and the widest ISO offset'),
  ('datetime', '{}', '"2026-02-28"', false, 'datetime refuses a bare date'),
  ('datetime', '{}', '"2026-02-30T10:00:00Z"', false, 'datetime refuses a non-existent calendar day'),
  ('datetime', '{}', '"2026-02-28T25:00:00Z"', false, 'datetime refuses an hour above 23'),
  ('datetime', '{}', '5', false, 'datetime refuses a number'),
  -- enum
  ('enum', '{"enumValues":["jazz","rock"]}', '"jazz"', true, 'enum admits a declared choice'),
  ('enum', '{"enumValues":["jazz","rock"]}', '"metal"', false, 'enum refuses a choice outside the set'),
  ('enum', '{"enumValues":["jazz","rock"]}', '7', false, 'enum refuses a number'),
  ('enum', '{}', '"jazz"', false, 'enum without a choice set fails closed'),
  ('enum', '{"enumValues":[]}', '"jazz"', false, 'enum with an empty choice set fails closed'),
  ('enum', '{"enumValues":["jazz"],"maxLength":3}', '"jazz"', false, 'enum keeps the 03a maxLength bound'),
  -- taxonomy (BE03b "Value encodings by field kind": { termIds: UUID[] <= 128 }; the untyped string pass-through is gone,
  -- see phase_02_slice_10_value_source_refusal.sql for the exhaustive typed-encoding table)
  ('taxonomy', '{}', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}', true, 'taxonomy admits a { termIds } term reference list'),
  ('taxonomy', '{}', '"term-one"', false, 'taxonomy refuses the untyped string pass-through (BE03b { termIds })'),
  ('taxonomy', '{}', '5', false, 'taxonomy refuses a number'),
  ('taxonomy', '{}', '["a"]', false, 'taxonomy refuses an array'),
  -- rich_text
  ('rich_text', '{}', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}', true, 'rich_text admits a canonical rich_text.v1 document'),
  ('rich_text', '{}', '"Hello"', false, 'rich_text refuses a raw string'),
  ('rich_text', '{"maxLength":3}', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}', false, 'rich_text honours the 03a maxLength over total text'),
  ('rich_text', '{"minLength":1,"maxLength":10}', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}', true, 'rich_text admits total text inside minLength..maxLength'),
  -- media (BE03b: { assetId: UUID, assetVersion: Version } or an array of them; the prior permissive string/array/object
  -- admission is gone, see phase_02_slice_10_value_source_refusal.sql for the exhaustive typed-encoding table)
  ('media', '{}', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}', true, 'media admits a typed asset reference'),
  ('media', '{}', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]', true, 'media admits an array of typed asset references'),
  ('media', '{}', '"asset"', false, 'media refuses the untyped string reference (BE03b { assetId, assetVersion })'),
  ('media', '{}', '["asset"]', false, 'media refuses an array of untyped string references'),
  ('media', '{}', '{"assetId":"x"}', false, 'media refuses an untyped object reference'),
  ('media', '{}', '5', false, 'media refuses a number'),
  ('media', '{}', 'true', false, 'media refuses a boolean'),
  ('media', '{"maxLength":2}', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"1"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"2"},{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]', false, 'media array honours the 03a maxLength bound')
) c(kind, constraints, value, expected, label);

-- relation: the ordered { targets: [ { targetId, expectedTargetVersion } ] } shape.
select is(
  pg_temp.s10k_shape('relation', '{}'::jsonb, c.value),
  c.expected,
  c.label || ' [P2-S10-AC-031]'
)
from (values
  ('{"targets":[]}'::jsonb, true, 'relation admits an empty ordered target list'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":null}]}', true, 'relation admits a target with a null expected version'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":"3"}]}', true, 'relation admits a target with a canonical expected version'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301"}]}', true, 'relation admits a target without the optional expected version'),
  ('{"targets":[{"targetId":"not-a-uuid"}]}', false, 'relation refuses a target that is not a UUID'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":"0"}]}', false, 'relation refuses a non-canonical expected version'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":3}]}', false, 'relation refuses a numeric expected version'),
  ('{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","extra":1}]}', false, 'relation refuses an unknown target member'),
  ('{"targets":[],"extra":1}', false, 'relation refuses an unknown top-level member'),
  ('"a9100000-0000-4000-8000-000000000301"', false, 'relation refuses a bare identifier string'),
  ('[]', false, 'relation refuses a bare array'),
  ('{"targets":"x"}', false, 'relation refuses a non-array targets member')
) c(value, expected, label);

select is(
  pg_temp.s10k_shape('relation', '{}'::jsonb, jsonb_build_object('targets', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'targetId', ('a9100000-0000-4000-8000-' || lpad(g::text, 12, '0'))
    )), '[]'::jsonb) from generate_series(1, 512) g
  ))),
  true,
  'relation admits exactly 512 targets [P2-S10-AC-031]'
);
select is(
  pg_temp.s10k_shape('relation', '{}'::jsonb, jsonb_build_object('targets', (
    select jsonb_agg(jsonb_build_object(
      'targetId', ('a9100000-0000-4000-8000-' || lpad(g::text, 12, '0'))
    )) from generate_series(1, 513) g
  ))),
  false,
  'relation refuses 513 targets [P2-S10-AC-031]'
);

-- list: an array (count <= 128) of its declared scalar or enum itemKind.
select is(
  pg_temp.s10k_shape('list', c.constraints, c.value),
  c.expected,
  c.label || ' [P2-S10-AC-031]'
)
from (values
  ('{"itemKind":"short_text"}'::jsonb, '["a","b"]'::jsonb, true, 'list admits an array of its short_text itemKind'),
  ('{"itemKind":"short_text"}', '[]', true, 'list admits an empty array'),
  ('{"itemKind":"short_text"}', '["a",1]', false, 'list refuses a mixed array'),
  ('{"itemKind":"short_text"}', '[["a"]]', false, 'list refuses a nested array item'),
  ('{"itemKind":"short_text"}', '"a"', false, 'list refuses a non-array value'),
  ('{"itemKind":"short_text","maxLength":2}', '["abc"]', false, 'list text items honour maxLength'),
  ('{"itemKind":"integer"}', '[1,2,3]', true, 'list admits integer items'),
  ('{"itemKind":"integer"}', '[1.5]', false, 'list refuses a fractional integer item'),
  ('{"itemKind":"decimal"}', '[1.5,2]', true, 'list admits decimal items'),
  ('{"itemKind":"boolean"}', '[true,false]', true, 'list admits boolean items'),
  ('{"itemKind":"boolean"}', '["true"]', false, 'list refuses a string boolean item'),
  ('{"itemKind":"date"}', '["2026-02-28"]', true, 'list admits a real calendar date item'),
  ('{"itemKind":"date"}', '["2026-02-30"]', false, 'list refuses a non-existent calendar date item'),
  ('{"itemKind":"datetime"}', '["2026-02-28T10:00:00Z"]', true, 'list admits a datetime item'),
  ('{"itemKind":"enum","enumValues":["a","b"]}', '["a"]', true, 'list admits an enum item from the set'),
  ('{"itemKind":"enum","enumValues":["a","b"]}', '["c"]', false, 'list refuses an enum item outside the set'),
  ('{"itemKind":"object"}', '["x"]', false, 'list with an object itemKind admits nothing'),
  ('{"itemKind":"list"}', '[[]]', false, 'list with a nested list itemKind admits nothing'),
  ('{"itemKind":"rich_text"}', '["x"]', false, 'list with a rich_text itemKind admits nothing'),
  ('{}', '["a"]', false, 'list without an itemKind admits nothing'),
  ('{"itemKind":"blob"}', '["a"]', false, 'list with an unknown itemKind admits nothing')
) c(constraints, value, expected, label);
select is(
  pg_temp.s10k_shape('list', '{"itemKind":"short_text"}'::jsonb,
    (select jsonb_agg('v' || g) from generate_series(1, 128) g)),
  true,
  'list admits exactly 128 items [P2-S10-AC-031]'
);
select is(
  pg_temp.s10k_shape('list', '{"itemKind":"short_text"}'::jsonb,
    (select jsonb_agg('v' || g) from generate_series(1, 129) g)),
  false,
  'list refuses 129 items [P2-S10-AC-031]'
);

-- object: a value must satisfy the declared DEC-133 structure.
select is(
  pg_temp.s10k_shape('object', c.constraints, c.value),
  c.expected,
  c.label || ' [P2-S10-AC-031]'
)
from (values
  ('{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}'::jsonb, '{"title":"x"}'::jsonb, true, 'object admits a value matching its structure'),
  ('{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '{}', false, 'object refuses a missing required property'),
  ('{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '{"title":"x","extra":1}', false, 'object refuses an undeclared property'),
  ('{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '{"title":{"n":1}}', false, 'object refuses a nested value for a scalar property'),
  ('{"objectStructure":{"properties":[{"key":"title","kind":"scalar","required":true,"constraints":{}}]}}', '"x"', false, 'object refuses a non-object value'),
  ('{}', '{"title":"x"}', false, 'object without a structure fails closed')
) c(constraints, value, expected, label);

-- ===========================================================================
-- An authored null never passes the shape helper: explicit_null and missing
-- are decided by the callers' provenance rule, never by the kind encoding.
-- ===========================================================================
select is(
  pg_temp.s10k_shape(k, '{"itemKind":"short_text","enumValues":["a"],"objectStructure":{"properties":[]}}'::jsonb, 'null'::jsonb),
  false,
  'the shape helper refuses a JSON null authored ' || k || ' value [P2-S10-AC-031]'
)
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list']) k;
select is(
  pg_temp.s10k_shape(k, '{"itemKind":"short_text","enumValues":["a"],"objectStructure":{"properties":[]}}'::jsonb, null::jsonb),
  false,
  'the shape helper refuses a SQL NULL ' || k || ' value [P2-S10-AC-031]'
)
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
  'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list']) k;
-- The helper answers true or false for every kind and every JSON type, never NULL
-- and never an error: an IF on NULL is skipped, so a NULL verdict would let an
-- unknown pass as a valid value.
select is(
  (select count(*)::integer
   from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
     'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list']) kind
   cross join (values ('{}'::jsonb), ('{"enumValues":["a"],"itemKind":"short_text","objectStructure":{"properties":[]}}'::jsonb)) c(constraints)
   cross join (values ('true'::jsonb), ('5'), ('1.5'), ('"x"'), ('""'), ('[]'), ('{}'), ('["a"]'), ('{"targets":[]}'), ('"2026-02-28"')) v(value)
   where pg_temp.s10k_shape(kind, c.constraints, v.value) is null),
  0,
  'the shape helper never answers NULL or raises for any kind and any JSON type [P2-S10-AC-031]'
);
select is(pg_temp.s10k_shape('markdown', '{}'::jsonb, '"x"'::jsonb), false,
  'the shape helper refuses an unknown field kind [P2-S10-AC-031]');
select is(pg_temp.s10k_shape(null, '{}'::jsonb, '"x"'::jsonb), false,
  'the shape helper refuses a null field kind [P2-S10-AC-031]');

select * from finish();
rollback;
