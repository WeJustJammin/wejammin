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

create temp table pt(step text, ms numeric) on commit drop;
create or replace function pg_temp.req(p_n int, p_tag text) returns jsonb language sql as $b$
  select jsonb_build_object('typeKey', 'probe' || p_tag, 'label', 'Probe ' || p_tag, 'ownerCapability', 'cms.schema_designer',
        'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
        'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
        'fields', (select jsonb_agg(jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
            'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')) from generate_series(1, p_n) g),
        'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb) $b$;

create or replace function pg_temp.micro(p_reps int) returns void language plpgsql as $b$
declare r jsonb; t0 timestamptz; i int; x jsonb; h text; ok boolean; em jsonb; rm jsonb; cd jsonb; n int;
begin
  perform set_config('app.cms_rpc', 'true', true);
  for i in 1..p_reps loop
    r := pg_temp.req(128, 'm' || i);
    t0 := clock_timestamp(); cd := platform_private.cms_canonical_type_definition(r); insert into pt values ('canonical_type_definition x1', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); em := platform_private.cms_compiled_editor_manifest(r); insert into pt values ('compiled_editor_manifest', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); rm := platform_private.cms_compiled_renderer_manifest(r); insert into pt values ('compiled_renderer_manifest', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); h := platform_private.cms_definition_artifact_hash(r, 1); insert into pt values ('definition_artifact_hash (whole)', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); h := platform_private.cms_jcs_sha256(jsonb_build_object('compilerVersion','1','zodContractRef','x','editorManifest',em,'rendererManifest',rm,'localeConfigHash','y')); insert into pt values ('jcs_sha256 of the assembled doc', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := platform_private.cms_compiled_manifest_bounded(em); insert into pt values ('compiled_manifest_bounded(editor)', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := platform_private.cms_compiled_manifest_bounded(rm); insert into pt values ('compiled_manifest_bounded(renderer)', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); select count(*) into n from jsonb_array_elements(r->'fields') f(value) where not platform_private.cms_valid_field_input(f.value, true); insert into pt values ('valid_field_input x128 (exists-style)', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := (select bool_and(platform_private.cms_json_bounded(f.value->'constraints', 8192, 8, 64, 256)) from jsonb_array_elements(r->'fields') f(value)); insert into pt values ('json_bounded(constraints) x128', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := (select bool_and(platform_private.cms_exact_keys(f.value, array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[], array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::text[])) from jsonb_array_elements(r->'fields') f(value)); insert into pt values ('exact_keys x128', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := (select bool_and(platform_private.cms_reserved_key(f.value->>'key')) from jsonb_array_elements(r->'fields') f(value)); insert into pt values ('reserved_key x128', extract(epoch from clock_timestamp()-t0)*1000);
    t0 := clock_timestamp(); ok := (select bool_and(platform_private.cms_valid_uuid(f.value->>'stableFieldId')) from jsonb_array_elements(r->'fields') f(value)); insert into pt values ('valid_uuid x128', extract(epoch from clock_timestamp()-t0)*1000);
  end loop;
end $b$;
select pg_temp.micro(12);
select diag(rpad(step, 52) || ' p50=' || lpad(round(percentile_cont(0.5) within group (order by ms)::numeric, 1)::text, 7)
  || ' p95=' || lpad(round(percentile_cont(0.95) within group (order by ms)::numeric, 1)::text, 7) || ' max=' || lpad(round(max(ms), 1)::text, 7))
  from pt group by step order by step;
select diag('jit=' || current_setting('jit') || ' server=' || current_setting('server_version'));
select * from finish();
rollback;
