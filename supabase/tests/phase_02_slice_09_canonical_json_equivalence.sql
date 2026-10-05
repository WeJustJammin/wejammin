commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 (AC217, R12 holdover): cms_json_bounded and cms_jcs were rewritten
-- to run in a single pass so a 128-field create fits the 300 ms RPC budget.
-- Every stored artifact hash and every JSON CHECK depends on their results, so
-- this suite holds the new implementations to the previous ones: verbatim
-- copies of the old bodies live here as the reference and a deterministic
-- corpus (fixed seed, mixed depth, width, scalars, unicode, numbers) must give
-- identical answers under several bound sets.

create or replace function pg_temp.ref_depth(p_value jsonb) returns integer language plpgsql immutable as $body$
declare child jsonb; deepest integer := 0; child_depth integer;
begin
  if p_value is null or jsonb_typeof(p_value) not in ('object', 'array') then return 0; end if;
  if jsonb_typeof(p_value) = 'object' then
    for child in select value from jsonb_each(p_value) loop
      child_depth := pg_temp.ref_depth(child); if child_depth > deepest then deepest := child_depth; end if;
    end loop;
  else
    for child in select value from jsonb_array_elements(p_value) loop
      child_depth := pg_temp.ref_depth(child); if child_depth > deepest then deepest := child_depth; end if;
    end loop;
  end if;
  return deepest + 1;
end $body$;

create or replace function pg_temp.ref_bounded(p_value jsonb, p_max_bytes integer, p_max_depth integer, p_max_keys integer, p_max_array integer)
returns boolean language plpgsql immutable as $body$
declare child jsonb;
begin
  if p_value is null or octet_length(p_value::text) > p_max_bytes or pg_temp.ref_depth(p_value) > p_max_depth then return false; end if;
  if jsonb_typeof(p_value) = 'object' then
    if (select count(*) from jsonb_each(p_value)) > p_max_keys then return false; end if;
    for child in select value from jsonb_each(p_value) loop
      if not pg_temp.ref_bounded(child, p_max_bytes, p_max_depth, p_max_keys, p_max_array) then return false; end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    if jsonb_array_length(p_value) > p_max_array then return false; end if;
    for child in select value from jsonb_array_elements(p_value) loop
      if not pg_temp.ref_bounded(child, p_max_bytes, p_max_depth, p_max_keys, p_max_array) then return false; end if;
    end loop;
  end if;
  return true;
end $body$;

create or replace function pg_temp.ref_jcs(p_value jsonb) returns text language plpgsql stable strict as $body$
declare value_type text; child jsonb; member record; encoded text;
begin
  value_type := jsonb_typeof(p_value);
  if value_type = 'null' then return 'null'; end if;
  if value_type = 'boolean' then return p_value::text; end if;
  if value_type = 'string' then return to_jsonb(p_value #>> '{}')::text; end if;
  if value_type = 'number' then return platform_private.cms_jcs_number(p_value); end if;
  if value_type = 'array' then
    encoded := '';
    for child in select value from jsonb_array_elements(p_value) as value loop
      if encoded <> '' then encoded := encoded || ','; end if;
      encoded := encoded || pg_temp.ref_jcs(child);
    end loop;
    return '[' || encoded || ']';
  end if;
  encoded := '';
  for member in select key, value from jsonb_each(p_value) order by key collate "C" loop
    if encoded <> '' then encoded := encoded || ','; end if;
    encoded := encoded || to_jsonb(member.key::text)::text || ':' || pg_temp.ref_jcs(member.value);
  end loop;
  return '{' || encoded || '}';
end $body$;

-- Deterministic random document of at most p_depth container levels.
create or replace function pg_temp.gen_doc(p_depth integer) returns jsonb language plpgsql as $body$
declare kind integer := floor(random() * 9)::integer; n integer; i integer; arr jsonb := '[]'::jsonb; obj jsonb := '{}'::jsonb;
begin
  if p_depth <= 0 then kind := floor(random() * 6)::integer; end if;
  if kind = 0 then return 'null'::jsonb; end if;
  if kind = 1 then return to_jsonb(random() < 0.5); end if;
  if kind = 2 then return to_jsonb((array['a','','x"y','é','日本','\\u00e9','line' || chr(10) || 'break','\\','tab' || chr(9)])[1 + floor(random() * 9)::integer]); end if;
  if kind = 3 then return to_jsonb((floor(random() * 2000000)::bigint - 1000000)); end if;
  if kind = 4 then return to_jsonb((array[0.5, -2.25, 1e21, 1e-7, 123456789.123456789, 100, 0.0000001234]::numeric[])[1 + floor(random() * 7)::integer]); end if;
  if kind = 5 then return to_jsonb('s' || floor(random() * 1000)::text); end if;
  n := floor(random() * 6)::integer;
  if kind in (6, 7) then
    for i in 1..n loop arr := arr || jsonb_build_array(pg_temp.gen_doc(p_depth - 1)); end loop;
    return arr;
  end if;
  for i in 1..n loop obj := obj || jsonb_build_object((array['k','b','a','é','Z','_','key' || i::text, 'aa','A'])[1 + floor(random() * 9)::integer] || i::text, pg_temp.gen_doc(p_depth - 1)); end loop;
  return obj;
end $body$;

select setseed(0.4242);
create temp table s09j_docs on commit drop as
  select g as id, pg_temp.gen_doc(1 + (g % 7)) as doc from generate_series(1, 600) g;
-- Wide and deep stress documents beside the random corpus.
insert into s09j_docs
  select 1000 + g, (select jsonb_agg(jsonb_build_object('k' || i, jsonb_build_array(i, jsonb_build_object('z', i)))) from generate_series(1, g) i)
  from unnest(array[1, 127, 128, 129, 130]) g;
insert into s09j_docs
  select 2000 + d, (select case when d = 0 then '1'::jsonb else (
      with recursive nest(level, value) as (select 1, '1'::jsonb union all select level + 1, jsonb_build_object('n', value) from nest where level < d)
      select value from nest where level = d) end)
  from generate_series(0, 12) d;
insert into s09j_docs values (3000, '{}'), (3001, '[]'), (3002, '"s"'), (3003, '5'), (3004, 'null'), (3005, 'true');
insert into s09j_docs
  select 3100 + g, jsonb_object_agg('k' || i, i) from generate_series(1, 5) g, generate_series(1, case g when 1 then 63 when 2 then 64 when 3 then 65 when 4 then 128 else 129 end) i group by g;

select is((select count(*)::integer from s09j_docs), 600 + 5 + 13 + 6 + 5, 'the equivalence corpus was generated');

select is((select count(*)::integer from s09j_docs
    where platform_private.cms_jcs(doc) is distinct from pg_temp.ref_jcs(doc)), 0,
  'cms_jcs gives the byte-identical canonical text of the previous implementation for every corpus document [P2-S09-AC-217]');
select is((select count(*)::integer from s09j_docs
    where platform_private.cms_jcs_sha256(doc) is distinct from encode(extensions.digest(convert_to(pg_temp.ref_jcs(doc), 'utf8'), 'sha256'), 'hex')), 0,
  'cms_jcs_sha256 therefore keeps every stored artifact hash [P2-S09-AC-217]');

select is((select count(*)::integer from s09j_docs d cross join (values (8192, 8, 128, 128), (8192, 4, 64, 256), (524288, 8, 128, 128),
      (262144, 8, 64, 128), (4096, 2, 16, 16), (16384, 2, 128, 128), (8192, 4, 32, 32), (200, 3, 2, 2), (65536, 10, 128, 128), (100000, 0, 5, 5), (100000, 1, 1, 1)) b(bytes, depth, keys, arr)
    where platform_private.cms_json_bounded(d.doc, b.bytes, b.depth, b.keys, b.arr)
      is distinct from pg_temp.ref_bounded(d.doc, b.bytes, b.depth, b.keys, b.arr)), 0,
  'cms_json_bounded agrees with the previous implementation for every corpus document under eleven bound sets [P2-S09-AC-217]');
select is((select count(*)::integer from s09j_docs d where platform_private.cms_json_bounded(d.doc) is distinct from pg_temp.ref_bounded(d.doc, 8192, 8, 128, 128)), 0,
  'and under the default bounds [P2-S09-AC-217]');
select is(platform_private.cms_json_bounded(null::jsonb), false, 'a null document is out of bounds [P2-S09-AC-217]');
select ok((select count(*) from s09j_docs d where platform_private.cms_json_bounded(d.doc, 8192, 4, 64, 256)) between 50 and 900,
  'the corpus exercises both accepted and rejected documents (not a vacuous comparison) [P2-S09-AC-217]');
select ok((select count(*) from s09j_docs d where not platform_private.cms_json_bounded(d.doc, 200, 3, 2, 2)) > 50,
  'the tight bound set rejects a meaningful share of the corpus [P2-S09-AC-217]');

select * from finish();
rollback;
