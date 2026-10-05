\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R14 (Codex review of 20261003100000, AC217): platform_private.cms_json_bounded
-- walks a document with a recursive CTE whose lateral step expands a node with
-- jsonb_each / jsonb_array_elements.  Those set-returning functions raise on the wrong
-- container type, so the expansion must be guarded by branching on jsonb_typeof, never
-- by a WHERE qual that the planner is free to order after the call.  This file holds
-- the function to that contract (catalog guard) and pins its answer on every shape:
-- object, array, scalar, nested and each bound edge.

-- Catalog guard.  The two set-returning expansions take the walk node only through a
-- CASE on its type (never bare), and the key and element counts are read only inside
-- the matching `when 'object'` / `when 'array'` branch of one CASE on the node type.
select ok(
  (select count(*) = 0
     from regexp_matches(pg_get_functiondef('platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)'::regprocedure),
            'jsonb_(each|array_elements)\(\s*walk\.node\s*\)', 'g')),
  'neither jsonb_each nor jsonb_array_elements is applied to the walk node unguarded [P2-S09-AC-217]');
select ok(
  (select count(*) = 2
     from regexp_matches(pg_get_functiondef('platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)'::regprocedure),
            'jsonb_(each|array_elements)\(\s*case when pg_catalog\.jsonb_typeof\(walk\.node\) = ''(object|array)''', 'g')),
  'the object expansion and the array expansion each take the node only through a typeof CASE [P2-S09-AC-217]');
select ok(
  pg_get_functiondef('platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)'::regprocedure)
    ~ 'case pg_catalog\.jsonb_typeof\(walk\.node\)\s+when ''object'' then[^;]*jsonb_object_keys\(walk\.node\)[^;]*when ''array'' then[^;]*jsonb_array_length\(walk\.node\)',
  'the key count is read only in the object branch and the element count only in the array branch of one typeof CASE [P2-S09-AC-217]');

-- Scalars and the absent document.
select is(platform_private.cms_json_bounded(null::jsonb), false, 'SQL NULL is out of bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('null'::jsonb), true, 'a JSON null scalar is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('true'::jsonb), true, 'a boolean scalar is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('12.5'::jsonb), true, 'a number scalar is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('"text"'::jsonb), true, 'a string scalar is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('"text"'::jsonb, 5), false, 'a scalar over the byte bound is refused (the 6-byte JSON text of "text" exceeds 5) [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('"text"'::jsonb, 6), true, 'a scalar exactly at the byte bound is accepted [P2-S09-AC-217]');

-- Empty and flat containers.
select is(platform_private.cms_json_bounded('{}'::jsonb), true, 'an empty object is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[]'::jsonb), true, 'an empty array is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('{"a":1,"b":[1,2,{"c":null}],"d":"x"}'::jsonb), true, 'a mixed object with scalars, an array and a nested object is within bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[null,true,"x",1.5,[],{}]'::jsonb), true, 'an array of every scalar kind and empty containers is within bounds [P2-S09-AC-217]');

-- Bytes: the bound is on the length of the JSON text.
select is(platform_private.cms_json_bounded('[1,2]'::jsonb, 6), true, 'a document exactly at the byte bound is accepted (jsonb prints [1, 2] as 6 bytes) [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[1,2]'::jsonb, 5), false, 'a document one byte over the bound is refused [P2-S09-AC-217]');

-- Keys: 128 keys pass, 129 fail, at the root and nested.
select is(platform_private.cms_json_bounded((select jsonb_object_agg('k' || n, n) from generate_series(1, 128) n), 100000), true, 'an object of exactly 128 keys is accepted [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((select jsonb_object_agg('k' || n, n) from generate_series(1, 129) n), 100000), false, 'an object of 129 keys is refused [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded(jsonb_build_object('outer', (select jsonb_object_agg('k' || n, n) from generate_series(1, 129) n)), 100000), false, 'a nested object of 129 keys is refused [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded(jsonb_build_array(jsonb_build_object('inner', (select jsonb_object_agg('k' || n, n) from generate_series(1, 128) n))), 100000), true, 'a nested object of exactly 128 keys inside an array is accepted [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((select jsonb_object_agg('k' || n, n) from generate_series(1, 3) n), 100000, 8, 2, 128), false, 'the key bound is a parameter: 3 keys over a bound of 2 are refused [P2-S09-AC-217]');

-- Array length: 128 elements pass, 129 fail, at the root and nested.
select is(platform_private.cms_json_bounded((select jsonb_agg(n) from generate_series(1, 128) n), 100000), true, 'an array of exactly 128 elements is accepted [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((select jsonb_agg(n) from generate_series(1, 129) n), 100000), false, 'an array of 129 elements is refused [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded(jsonb_build_object('list', (select jsonb_agg(n) from generate_series(1, 129) n)), 100000), false, 'a nested array of 129 elements is refused [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded(jsonb_build_array(jsonb_build_array((select jsonb_agg(n) from generate_series(1, 128) n))), 100000), true, 'a doubly nested array of exactly 128 elements is accepted [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[1,2,3]'::jsonb, 100000, 8, 128, 2), false, 'the array bound is a parameter: 3 elements over a bound of 2 are refused [P2-S09-AC-217]');

-- Depth: the root container is level 0 and the document is deeper than the bound
-- when a container sits at level p_max_depth or below.  Eight nested arrays are 8
-- levels deep (accepted at the default bound), nine are refused.
select is(platform_private.cms_json_bounded((repeat('[', 8) || repeat(']', 8))::jsonb), true, 'eight nested arrays are within the default depth of 8 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((repeat('[', 9) || repeat(']', 9))::jsonb), false, 'nine nested arrays exceed the default depth of 8 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((repeat('{"a":', 8) || '1' || repeat('}', 8))::jsonb), true, 'eight nested objects (a scalar leaf) are within the default depth of 8 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((repeat('{"a":', 9) || '1' || repeat('}', 9))::jsonb), false, 'nine nested objects exceed the default depth of 8 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((repeat('{"a":[', 4) || '1' || repeat(']}', 4))::jsonb), true, 'alternating objects and arrays 8 levels deep are accepted [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded((repeat('{"a":[', 5) || '1' || repeat(']}', 5))::jsonb), false, 'alternating objects and arrays 10 levels deep are refused [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[[1]]'::jsonb, 100000, 2), true, 'the depth bound is a parameter: two levels pass a bound of 2 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[[[1]]]'::jsonb, 100000, 2), false, 'the depth bound is a parameter: three levels fail a bound of 2 [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('{"a":{"b":1},"c":[{"d":2}]}'::jsonb, 100000, 3), true, 'the deepest branch decides: the sibling shapes may differ in depth [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('{"a":{"b":1},"c":[{"d":[2]}]}'::jsonb, 100000, 3), false, 'a single deeper branch beside shallow siblings refuses the document [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[1,"a",null]'::jsonb, 100000, 1), true, 'a flat array of scalars is one level deep [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded('[[]]'::jsonb, 100000, 1), false, 'an empty array nested in an array is a second level [P2-S09-AC-217]');

select * from finish();
rollback;
