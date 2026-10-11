\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

create or replace function pg_temp.jb_fast(
  p_value jsonb, p_max_bytes integer default 8192, p_max_depth integer default 8,
  p_max_keys integer default 128, p_max_array integer default 128
) returns boolean language plpgsql immutable set search_path = '' as $b$
begin
  if p_value is null or pg_catalog.octet_length(p_value::text) > p_max_bytes then return false; end if;
  if pg_catalog.jsonb_typeof(p_value) not in ('object', 'array') then return true; end if;
  if pg_catalog.jsonb_path_exists(p_value, pg_catalog.format('strict $.**{%s} ? (@.type() == "object" || @.type() == "array")', p_max_depth)::pg_catalog.jsonpath) then return false; end if;
  if pg_catalog.jsonb_path_exists(p_value, pg_catalog.format('strict $.** ? (@.type() == "array" && @.size() > %s)', p_max_array)::pg_catalog.jsonpath) then return false; end if;
  if exists (select 1 from pg_catalog.jsonb_path_query(p_value, 'strict $.** ? (@.type() == "object")') o(v)
             where (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(o.v)) > p_max_keys) then return false; end if;
  return true;
end $b$;

create or replace function pg_temp.req(p_n int, p_tag text) returns jsonb language sql as $b$
  select jsonb_build_object('typeKey', 'probe' || p_tag, 'label', 'Probe ' || p_tag, 'ownerCapability', 'cms.schema_designer',
        'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
        'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
        'fields', (select jsonb_agg(jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
            'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')) from generate_series(1, p_n) g),
        'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb) $b$;

create temp table t(label text, ms numeric) on commit drop;
do $do$
declare r jsonb; em jsonb; i int; t0 timestamptz; ok1 boolean; ok2 boolean; j jsonb;
begin
  r := pg_temp.req(128, 'z');
  em := platform_private.cms_compiled_editor_manifest(r);
  raise notice 'PROBE manifest bytes % ', octet_length(em::text);
  for i in 1..15 loop
    t0 := clock_timestamp(); ok1 := platform_private.cms_json_bounded(em, 524288, 12, 128, 128); insert into t values ('current json_bounded(editor manifest)', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok2 := pg_temp.jb_fast(em, 524288, 12, 128, 128); insert into t values ('fast    json_bounded(editor manifest)', extract(epoch from clock_timestamp()-t0)*1000);
    if ok1 is distinct from ok2 then raise exception 'mismatch'; end if;
  end loop;
  j := '{"label":"Field 1","order":1}'::jsonb;
  for i in 1..15 loop
    t0 := clock_timestamp(); for k in 1..200 loop ok1 := platform_private.cms_json_bounded(j || jsonb_build_object('i', k), 8192, 4, 32, 32); end loop; insert into t values ('current json_bounded(editorConfig) x200', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); for k in 1..200 loop ok2 := pg_temp.jb_fast(j || jsonb_build_object('i', k), 8192, 4, 32, 32); end loop; insert into t values ('fast    json_bounded(editorConfig) x200', extract(epoch from clock_timestamp()-t0)*1000);
  end loop;
end $do$;
select diag(rpad(label, 52) || ' p50=' || lpad(round(percentile_cont(0.5) within group (order by ms)::numeric, 2)::text, 8) || ' ms')
  from t group by label order by label;
select * from finish();
rollback;
