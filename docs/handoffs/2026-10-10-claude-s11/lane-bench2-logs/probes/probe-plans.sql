\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
\ir /w/supabase/tests/phase_02_slice_09_dec108/00-helpers.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/01-actors.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/02-chain.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/03-support.sqlinc

create table pg_temp.plan_lines(seq timestamptz default clock_timestamp(), label text, line text);
grant all on pg_temp.plan_lines to public;

select diag('prosrc md5=' || md5(p.prosrc) || ' owner=' || pg_get_userbyid(p.proowner) || ' vol=' || p.provolatile::text || ' acl=' || coalesce(p.proacl::text,'-') || ' config=' || p.proconfig::text)
  from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure;

do $do$
declare
  def text;
  ins_fields text := $s$
  insert into platform_private.cms_field_definition_versions($s$;
  a text;
  p1 int; p2 int; stmt text; new_stmt text;
begin
  def := pg_get_functiondef('platform_private.cms_create_type_draft(jsonb)'::regprocedure);
  -- wrap the field insert in EXPLAIN ANALYZE
  p1 := position('insert into platform_private.cms_field_definition_versions(' in def);
  p2 := position('from pg_catalog.jsonb_array_elements(p_request->''fields'') field_entry(value);' in def);
  if p1 = 0 or p2 = 0 then raise exception 'field insert anchor not found'; end if;
  stmt := substr(def, p1, p2 - p1 + length('from pg_catalog.jsonb_array_elements(p_request->''fields'') field_entry(value);'));
  new_stmt := 'for plan_line in execute ' || quote_literal('explain (analyze, buffers, timing on, costs off) ' || regexp_replace(regexp_replace(regexp_replace(regexp_replace(rtrim(stmt, ';'), '\mp_request\M', '$1', 'g'), '\macting_party_id\M', '$2', 'g'), '\mversion_id\M', '$3', 'g'), '\mactor_id\M', '$4', 'g'))
     || ' using p_request, acting_party_id, version_id, actor_id loop insert into pg_temp.plan_lines(label, line) values (''fields'', plan_line); end loop;';
  def := replace(def, stmt, new_stmt);
  def := replace(def, 'declare' || chr(10) || '  actor_id uuid;', 'declare' || chr(10) || '  plan_line text;' || chr(10) || '  actor_id uuid;');
  execute def;
end
$do$;

create or replace function pg_temp.req(p_n int, p_tag text) returns jsonb language sql as $b$
  select jsonb_build_object('typeKey', 'probe' || p_tag, 'label', 'Probe ' || p_tag, 'ownerCapability', 'cms.schema_designer',
        'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
        'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
        'fields', (select jsonb_agg(jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
            'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')) from generate_series(1, p_n) g),
        'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb) $b$;

do $do$
declare r jsonb; i int;
begin
  for i in 1..3 loop
    r := pg_temp.s09d_rpc('p' || i, 'platform_api.cms_create_type_draft', 'owner',
      pg_temp.req(128, 'x' || i) || jsonb_build_object('idempotencyKey', pg_temp.s09d_idem('p' || i, 'create')));
    if r is null then raise exception 'create failed %', pg_temp.s09d_outcome('p' || i); end if;
    insert into pg_temp.plan_lines(label, line) values ('--', '---- end run ' || i);
  end loop;
end $do$;
select diag(label || ' | ' || line) from pg_temp.plan_lines order by seq;
select * from finish();
rollback;
