-- Slice 10 gap resolution DEC-144 (P2-S10-AC-078/AC-080, audit D-7): the closed
-- per-kind object-property constraint vocabulary, held identically by
-- PostgreSQL and TypeScript.
--
-- BE03b "`object` field structure" (DEC-133): each property is a strict
-- { key, kind, required, constraints }.  DEC-144 closes `constraints` by
-- mirroring the field-level members per property kind:
--
--   scalar    minLength / maxLength (apply to string values) and
--             minimum / maximum (apply to number values);
--   enum      required non-empty enumValues (1..256 strings of at most 160
--             characters) plus optional minLength / maxLength;
--   rich_text minLength / maxLength over the total NFC text.
--
-- Unknown members, members of another kind, wrong types, a length member that
-- is not an integer in 0..100000, and min > max are refused, and every value is
-- checked against the constraints its property declares (lengths count Unicode
-- characters, BE03a).  A boolean value is constrained by neither family.
--
-- This file is the SINGLE corpus both implementations are held to: every row of
-- the VALUES list is parsed by
-- packages/contracts/src/content-schema-registry/object-property-constraints-parity.test.ts,
-- which runs ObjectPropertySchema / isObjectValueForStructure over the same JSON
-- and asserts the same verdict.
--
-- Row shape: (label, kind, property, value, expected).
--   kind 'structure': property is the declared property; expected is whether the
--                     one-property structure is valid (value is ignored);
--   kind 'value'    : property is a valid declared property and value is the
--                     candidate object value (expected is the verdict).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create temp table s10_opc_corpus on commit drop as
select row_number() over () as n, label, kind, property::jsonb as property,
       value::jsonb as value, expected
from (values
  -- structure: scalar -----------------------------------------------------
  ('scalar with no constraint', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{}}$j$, $j$null$j$, true),
  ('scalar length members', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":1,"maxLength":8}}$j$, $j$null$j$, true),
  ('scalar number members', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":0,"maximum":9.5}}$j$, $j$null$j$, true),
  ('scalar all four members', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":0,"maxLength":10,"minimum":-5,"maximum":5}}$j$, $j$null$j$, true),
  ('scalar equal bounds', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":3,"maxLength":3,"minimum":2,"maximum":2}}$j$, $j$null$j$, true),
  ('scalar length upper bound 100000', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maxLength":100000}}$j$, $j$null$j$, true),
  ('scalar length above 100000', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maxLength":100001}}$j$, $j$null$j$, false),
  ('scalar min length above max length', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":9,"maxLength":3}}$j$, $j$null$j$, false),
  ('scalar minimum above maximum', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":8,"maximum":1}}$j$, $j$null$j$, false),
  ('scalar negative length', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":-1}}$j$, $j$null$j$, false),
  ('scalar fractional length', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maxLength":1.5}}$j$, $j$null$j$, false),
  ('scalar string length', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":"1"}}$j$, $j$null$j$, false),
  ('scalar null length', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maxLength":null}}$j$, $j$null$j$, false),
  ('scalar string minimum', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":"1"}}$j$, $j$null$j$, false),
  ('scalar null maximum', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maximum":null}}$j$, $j$null$j$, false),
  ('scalar boolean maximum', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maximum":true}}$j$, $j$null$j$, false),
  ('scalar enum members belong to the enum kind', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"enumValues":["a"]}}$j$, $j$null$j$, false),
  ('scalar item kind is list only', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"itemKind":"short_text"}}$j$, $j$null$j$, false),
  ('scalar unknown member', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"pattern":"x"}}$j$, $j$null$j$, false),
  ('scalar unknown nested member', 'structure', $j${"key":"code","kind":"scalar","required":false,"constraints":{"nested":{"a":[1,2,null]}}}$j$, $j$null$j$, false),
  -- structure: enum -------------------------------------------------------
  ('enum choices only', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["a","b"]}}$j$, $j$null$j$, true),
  ('enum choices with length members', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["abcd"],"minLength":1,"maxLength":4}}$j$, $j$null$j$, true),
  ('enum without choices', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{}}$j$, $j$null$j$, false),
  ('enum empty choices', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":[]}}$j$, $j$null$j$, false),
  ('enum non-string choice', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["a",1]}}$j$, $j$null$j$, false),
  ('enum number members belong to scalar', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["a"],"minimum":1}}$j$, $j$null$j$, false),
  ('enum unknown member', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["a"],"custom":{"x":1}}}$j$, $j$null$j$, false),
  ('enum min length above max length', 'structure', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["a"],"minLength":4,"maxLength":1}}$j$, $j$null$j$, false),
  -- structure: rich_text --------------------------------------------------
  ('rich_text with no constraint', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{}}$j$, $j$null$j$, true),
  ('rich_text length members', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"minLength":1,"maxLength":100}}$j$, $j$null$j$, true),
  ('rich_text number members belong to scalar', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"minimum":1}}$j$, $j$null$j$, false),
  ('rich_text enum members belong to enum', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"enumValues":["a"]}}$j$, $j$null$j$, false),
  ('rich_text min length above max length', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"minLength":5,"maxLength":1}}$j$, $j$null$j$, false),
  ('rich_text unknown member', 'structure', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"unknown":1}}$j$, $j$null$j$, false),
  -- value: scalar ---------------------------------------------------------
  ('scalar string within length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":4}}$j$, $j${"code":"abc"}$j$, true),
  ('scalar string at the minimum length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":4}}$j$, $j${"code":"ab"}$j$, true),
  ('scalar string at the maximum length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":4}}$j$, $j${"code":"abcd"}$j$, true),
  ('scalar string below the minimum length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":4}}$j$, $j${"code":"a"}$j$, false),
  ('scalar string above the maximum length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":4}}$j$, $j${"code":"abcde"}$j$, false),
  ('scalar string length counts characters not UTF-16 units', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":2}}$j$, $j${"code":"😀😀"}$j$, true),
  ('scalar astral string above the maximum length', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"maxLength":2}}$j$, $j${"code":"😀😀😀"}$j$, false),
  ('scalar number within range', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":3}$j$, true),
  ('scalar number at the minimum', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":-5}$j$, true),
  ('scalar number at the maximum', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":5}$j$, true),
  ('scalar number above the maximum', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":6}$j$, false),
  ('scalar number below the minimum', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":-6}$j$, false),
  ('scalar fractional number above the maximum', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":-5,"maximum":5}}$j$, $j${"code":5.5}$j$, false),
  ('scalar number ignores length members', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":2,"maxLength":3}}$j$, $j${"code":123456}$j$, true),
  ('scalar string ignores number members', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minimum":0,"maximum":5}}$j$, $j${"code":"zzzzzzzz"}$j$, true),
  ('scalar boolean is constrained by neither family', 'value', $j${"key":"code","kind":"scalar","required":false,"constraints":{"minLength":9,"maxLength":9,"minimum":9,"maximum":9}}$j$, $j${"code":true}$j$, true),
  -- value: enum -----------------------------------------------------------
  ('enum member within length', 'value', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["x","live","draft"],"minLength":4,"maxLength":5}}$j$, $j${"tone":"live"}$j$, true),
  ('enum member too short for the length constraint', 'value', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["x","live","draft"],"minLength":4,"maxLength":5}}$j$, $j${"tone":"x"}$j$, false),
  ('enum member too long for the length constraint', 'value', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["live","drafted"],"minLength":4,"maxLength":5}}$j$, $j${"tone":"drafted"}$j$, false),
  ('enum value outside the choice set', 'value', $j${"key":"tone","kind":"enum","required":false,"constraints":{"enumValues":["live","draft"]}}$j$, $j${"tone":"final"}$j$, false),
  -- value: rich_text ------------------------------------------------------
  ('rich_text within the maximum length', 'value', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"maxLength":5}}$j$, $j${"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello","marks":[]}]}]}}$j$, true),
  ('rich_text above the maximum length', 'value', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"maxLength":5}}$j$, $j${"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hello!","marks":[]}]}]}}$j$, false),
  ('rich_text length sums every span of every block', 'value', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"maxLength":5}}$j$, $j${"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hel","marks":[]}]},{"type":"paragraph","spans":[{"text":"lo!","marks":[]}]}]}}$j$, false),
  ('rich_text below the minimum length', 'value', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"minLength":3}}$j$, $j${"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}}$j$, false),
  ('rich_text still needs the canonical grammar', 'value', $j${"key":"body","kind":"rich_text","required":false,"constraints":{"maxLength":50}}$j$, $j${"body":"plain"}$j$, false)
) as corpus(label, kind, property, value, expected);

select ok((select count(*) >= 59 from s10_opc_corpus),
  'the object-property constraint corpus carries every structure and value row');

-- Structure rows: the one-property structure is valid exactly when expected.
select is(
  platform_private.cms_object_structure_valid(
    jsonb_build_object('properties', jsonb_build_array(corpus.property))),
  corpus.expected,
  'PG constraints (structure): ' || corpus.label || ' [DEC-144, AC-078]'
)
from s10_opc_corpus corpus
where corpus.kind = 'structure'
order by corpus.n;

-- Value rows: the declared structure is valid, and the value verdict is expected.
select is(
  platform_private.cms_object_structure_valid(
    jsonb_build_object('properties', jsonb_build_array(corpus.property))),
  true,
  'PG constraints (value fixture is a valid structure): ' || corpus.label
)
from s10_opc_corpus corpus
where corpus.kind = 'value'
order by corpus.n;

select is(
  platform_private.cms_object_value_valid(
    jsonb_build_object('properties', jsonb_build_array(corpus.property)),
    corpus.value),
  corpus.expected,
  'PG constraints (value): ' || corpus.label || ' [DEC-144, AC-080]'
)
from s10_opc_corpus corpus
where corpus.kind = 'value'
order by corpus.n;

-- A value is never admitted under a structure whose constraints are not in the
-- closed vocabulary, even if the key set would match.
select is(
  platform_private.cms_object_value_valid(
    '{"properties":[{"key":"code","kind":"scalar","required":false,"constraints":{"pattern":"x"}}]}'::jsonb,
    '{"code":"abc"}'::jsonb),
  false,
  'a value is refused under a structure with an unknown constraint member [DEC-144]'
);

select * from finish();
rollback;
