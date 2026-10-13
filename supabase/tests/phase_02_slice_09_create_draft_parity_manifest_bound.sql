\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 (AC217; P2-S09-AC-217): platform_private.cms_compiled_manifest_bounded reads a manifest with jsonpath
-- instead of the recursive walk of cms_json_bounded
-- (supabase/migrations/20261010166100_cms_compiled_manifest_bound_scan.sql).  cms_json_bounded is untouched and
-- is the reference here: the answer of the new function must equal
-- cms_json_bounded(document, 524288, 12, 128, 128) on boundary documents, on documents generated at every
-- bound, and on deep documents (which must be refused, never raise).  The boundary documents also carry the
-- expected answer, so the equality is not between two wrong answers.

-- ---- identity of the function and of the reference ---------------------------------------------------------
select is((select pg_get_userbyid(p.proowner) || ' ' || l.lanname || ' ' || p.provolatile::text || ' ' || p.proisstrict::text || ' ' || p.prosecdef::text
      || ' ' || p.proconfig::text || ' ' || p.proacl::text
    from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = 'platform_private.cms_compiled_manifest_bounded(jsonb)'::regprocedure),
  'postgres sql i true false {"search_path=\"\""} {postgres=X/postgres,wejammin_cms_definer=X/postgres}',
  'the manifest bound keeps its owner, language, volatility, strictness, search_path and ACL (definer-only EXECUTE) [P2-S09-AC-217]');
select isnt((select md5(prosrc) from pg_proc where oid = 'platform_private.cms_compiled_manifest_bounded(jsonb)'::regprocedure),
  '348f71cf3a958c64a44ac4445d1429da', 'the manifest bound is the jsonpath body, not the previous cms_json_bounded wrapper [P2-S09-AC-217]');
select is((select md5(prosrc) from pg_proc where oid = 'platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer)'::regprocedure),
  'eb90c29820436cdf74e89812b4b3e742',
  'fixture: the reference is cms_json_bounded exactly as 20261003130100 installed it, and this migration leaves it alone [P2-S09-AC-217]');
select is((select count(*)::integer from pg_constraint c
    where c.conrelid = 'platform_private.cms_schema_artifacts'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%cms_compiled_manifest_bounded(%'), 2,
  'both artifact manifest CHECK constraints still call the manifest bound [P2-S09-AC-217]');

-- ---- documents -----------------------------------------------------------------------------------------------
create or replace function pg_temp.nest(p_levels integer, p_inner jsonb) returns jsonb language plpgsql as $body$
declare doc jsonb := p_inner; i integer;
begin
  for i in 1..p_levels loop doc := jsonb_build_array(doc); end loop;
  return doc;
end;
$body$;
create or replace function pg_temp.nest_obj(p_levels integer, p_inner jsonb) returns jsonb language plpgsql as $body$
declare doc jsonb := p_inner; i integer;
begin
  for i in 1..p_levels loop doc := jsonb_build_object('a', doc); end loop;
  return doc;
end;
$body$;
create or replace function pg_temp.wide_obj(p_keys integer) returns jsonb language sql as $body$
  select coalesce(jsonb_object_agg('k' || n, n), '{}'::jsonb) from generate_series(1, p_keys) n
$body$;
create or replace function pg_temp.wide_arr(p_len integer) returns jsonb language sql as $body$
  select coalesce(jsonb_agg(n), '[]'::jsonb) from generate_series(1, p_len) n
$body$;

create temp table bound_docs(name text primary key, doc jsonb not null, expected boolean) on commit drop;
insert into bound_docs values
  ('json null', 'null', true), ('json true', 'true', true), ('number', '12.5', true), ('string', '"text"', true),
  ('empty object', '{}', true), ('empty array', '[]', true),
  ('mixed shallow', '{"a":1,"b":[1,2,{"c":null}],"d":"x"}', true),
  ('arrays 12 deep', pg_temp.nest(12, '1'::jsonb), true),
  ('arrays 13 deep', pg_temp.nest(13, '1'::jsonb), false),
  ('objects 12 deep', pg_temp.nest_obj(12, '1'::jsonb), true),
  ('objects 13 deep', pg_temp.nest_obj(13, '1'::jsonb), false),
  ('empty array at level 11', pg_temp.nest(11, '[]'::jsonb), true),
  ('empty array at level 12', pg_temp.nest(12, '[]'::jsonb), false),
  ('empty object at level 11', pg_temp.nest_obj(11, '{}'::jsonb), true),
  ('empty object at level 12', pg_temp.nest_obj(12, '{}'::jsonb), false),
  ('object in array chain 11', pg_temp.nest(11, '{"x":1}'::jsonb), true),
  ('object in array chain 12', pg_temp.nest(12, '{"x":1}'::jsonb), false),
  ('128 keys', pg_temp.wide_obj(128), true), ('129 keys', pg_temp.wide_obj(129), false),
  ('128 elements', pg_temp.wide_arr(128), true), ('129 elements', pg_temp.wide_arr(129), false),
  ('129 keys at level 1', pg_temp.nest(1, pg_temp.wide_obj(129)), false),
  ('128 keys at level 11', pg_temp.nest(11, pg_temp.wide_obj(128)), true),
  ('129 keys at level 11', pg_temp.nest(11, pg_temp.wide_obj(129)), false),
  ('128 keys at level 12', pg_temp.nest(12, pg_temp.wide_obj(128)), false),
  ('129 elements at level 5', pg_temp.nest_obj(5, pg_temp.wide_arr(129)), false),
  ('128 elements at level 11', pg_temp.nest_obj(11, pg_temp.wide_arr(128)), true),
  ('wide arrays of wide arrays', (select jsonb_agg(pg_temp.wide_arr(128)) from generate_series(1, 128)), true),
  ('wide arrays of wide arrays plus one', (select jsonb_agg(pg_temp.wide_arr(129)) from generate_series(1, 4)), false),
  ('wide objects of wide objects', (select jsonb_object_agg('o' || n, pg_temp.wide_obj(128)) from generate_series(1, 128) n), true),
  ('wide objects of wide objects plus one key', (select jsonb_object_agg('o' || n, pg_temp.wide_obj(129)) from generate_series(1, 2) n), false),
  ('byte bound exactly met', jsonb_build_array(repeat('x', 524284)), true),
  ('byte bound one over', jsonb_build_array(repeat('x', 524285)), false),
  ('scalar string over the byte bound', to_jsonb(repeat('x', 524288)), false),
  ('1000 levels', pg_temp.nest(1000, '1'::jsonb), false),
  ('1000 object levels', pg_temp.nest_obj(1000, '1'::jsonb), false),
  ('every scalar kind in an array', '[null,true,"x",1.5,[],{}]', true),
  ('unicode keys and strings', '{"é":"ü","😀":["😀"]}', true),
  ('array of 128 empty objects', (select jsonb_agg('{}'::jsonb) from generate_series(1, 128)), true),
  ('compiled manifest shape', jsonb_build_object('schema', jsonb_build_object('fields', pg_temp.wide_arr(128)), 'fields', pg_temp.wide_arr(128)), true);

-- Generated mixtures: narrow containers, containers of exactly 127 to 130 scalars, scalars, at random depth.
select setseed(0.4242);
create or replace function pg_temp.rand_doc(p_depth integer) returns jsonb language plpgsql volatile as $body$
declare r double precision := random(); n integer; kids jsonb := '[]'::jsonb; i integer; doc jsonb;
begin
  if p_depth <= 0 or r < 0.2 then
    return (array['null', 'true', '1.5', '"s"', '0']::jsonb[])[1 + floor(random() * 5)::integer];
  end if;
  if r < 0.35 then
    n := (array[127, 128, 129, 130])[1 + floor(random() * 4)::integer];
    return case when random() < 0.5 then pg_temp.wide_arr(n) else pg_temp.wide_obj(n) end;
  end if;
  n := floor(random() * 4)::integer;
  if random() < 0.5 then
    doc := '[]'::jsonb;
    for i in 1..n loop doc := doc || jsonb_build_array(pg_temp.rand_doc(p_depth - 1)); end loop;
  else
    doc := '{}'::jsonb;
    for i in 1..n loop doc := doc || jsonb_build_object('k' || i, pg_temp.rand_doc(p_depth - 1)); end loop;
  end if;
  return doc;
end;
$body$;
insert into bound_docs(name, doc)
select 'generated ' || g, pg_temp.rand_doc(14) from generate_series(1, 600) g;

-- ---- the answer ------------------------------------------------------------------------------------------------
create temp table bound_answers on commit drop as
select d.name, d.expected,
  platform_private.cms_json_bounded(d.doc, 524288, 12, 128, 128) as reference,
  platform_private.cms_compiled_manifest_bounded(d.doc) as current
from bound_docs d;
select is((select string_agg(name, ', ' order by name) from bound_answers where reference is distinct from current), null,
  'the manifest bound equals cms_json_bounded(doc, 524288, 12, 128, 128) on every boundary and generated document [P2-S09-AC-217]');
select is((select string_agg(name, ', ' order by name) from bound_answers where expected is not null and current is distinct from expected), null,
  'every boundary document gets the answer the bounds dictate (depth 12 levels, 128 keys, 128 elements, 524288 bytes) [P2-S09-AC-217]');
select cmp_ok((select count(*)::integer from bound_answers where name like 'generated %' and current), '>', 40,
  'the generated corpus has documents inside every bound [P2-S09-AC-217]');
select cmp_ok((select count(*)::integer from bound_answers where name like 'generated %' and not current), '>', 40,
  'the generated corpus has documents outside a bound, so the equality is not between two constants [P2-S09-AC-217]');
select is((select count(*)::integer from bound_answers where current is null), 0, 'no document answers NULL [P2-S09-AC-217]');
select is(platform_private.cms_compiled_manifest_bounded(null::jsonb), null,
  'STRICT: a NULL manifest answers NULL exactly as before (the NOT NULL column keeps that unreachable) [P2-S09-AC-217]');

-- The constraint itself: an editor manifest over the bound is still refused by the table CHECK.
select set_config('app.cms_rpc', 'true', true);
select throws_ok(
  $q$insert into platform_private.cms_schema_artifacts(owner_id, state, version, content_type_version_id, compiler_version,
       zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at)
     values (gen_random_uuid(), 'compiled', 1, gen_random_uuid(), '1', 'cms/content-type/x/v1',
       jsonb_build_object('schema', pg_temp.nest(13, '1'::jsonb)), '{}', repeat('a', 64), now())$q$,
  '23514', null, 'a manifest nested past 12 levels is refused by cms_schema_artifacts_editor_manifest_check [P2-S09-AC-217]');

select * from finish();
rollback;
