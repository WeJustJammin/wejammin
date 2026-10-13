\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select diag('probe: role=' || current_user || ' rolsuper=' || (select rolsuper::text from pg_roles where rolname = current_user)
  || ' track_functions=' || current_setting('track_functions') || ' shared_preload=' || current_setting('shared_preload_libraries')
  || ' server_version=' || current_setting('server_version') || ' work_mem=' || current_setting('work_mem')
  || ' jit=' || current_setting('jit'));

create temp table probe_times(iter int, step text, ms numeric) on commit drop;

-- Instrument the installed function: same text, a clock stamp injected before each anchor statement.
do $do$
declare
  def text;
  anchors text[] := array[
    'perform platform_private.cms_require_scope_member',
    'reservation := platform_private.cms_reserve',
    'if not platform_private.cms_exact_keys(',
    'if p_request->>''typeKey'' !~',
    'if p_request->''defaultTemplateVersionId'' is distinct',
    'if (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(field_entry->>''stableFieldId''))',
    'if not platform_private.cms_locale_config_shape_valid(',
    'locale_issues := locale_issues || platform_api.cms_validate_locale_config(',
    'perform pg_catalog.pg_advisory_xact_lock(',
    'definition_hash := platform_private.cms_definition_artifact_hash',
    'insert into platform_private.cms_content_types(',
    'insert into platform_private.cms_content_type_versions(',
    'insert into platform_private.cms_schema_artifacts(',
    'if exists (' || chr(10) || '    select 1' || chr(10) || '    from pg_catalog.jsonb_array_elements(p_request->''fields'')',
    'insert into platform_private.cms_field_definition_versions(',
    'for relation_input in',
    'perform platform_private.cms_emit_event(',
    'response := platform_private.cms_type_version_resource(version_id);',
    'perform platform_private.cms_complete(reservation.id, version_id, 201, response);',
    'return response;'
  ];
  k integer := 0;
  a text;
begin
  def := pg_get_functiondef('platform_private.cms_create_type_draft(jsonb)'::regprocedure);
  foreach a in array anchors loop
    k := k + 1;
    if position(a in def) = 0 then
      raise exception 'anchor % not found: %', k, a;
    end if;
    def := replace(def, a, format('perform pg_catalog.set_config(''probe.t%s'', pg_catalog.clock_timestamp()::text, true); ', lpad(k::text, 2, '0')) || a);
  end loop;
  execute def;
end
$do$;

create or replace function pg_temp.probe_run(p_n integer) returns void language plpgsql as $body$
declare
  tag text; t0 timestamptz; resource jsonb; i integer; k integer; prev timestamptz; cur timestamptz; total numeric;
  names text[] := array[
    '01 start->scope/capability/reserve', '02 reserve', '03 exact_keys', '04 field-less validation (regex/registries)',
    '05 template check', '06 duplicate checks (jsonb_array_elements x5)', '07 locale shape', '08 locale validate (platform_api)',
    '09 advisory lock + exists', '10 definition_artifact_hash', '11 insert content_types', '12 insert content_type_versions',
    '13 insert schema_artifacts (manifests)', '14 field validation (cms_valid_field_input x128)', '15 insert 128 field defs',
    '16 relations/capabilities loops', '17 emit_event', '18 type_version_resource', '19 cms_complete', '20 tail'];
begin
  for i in 1..p_n loop
    tag := 'q' || i;
    t0 := clock_timestamp();
    resource := pg_temp.s09d_rpc(tag || ':create', 'platform_api.cms_create_type_draft', 'owner',
      jsonb_build_object('typeKey', 'probe' || i, 'label', 'Probe ' || i, 'ownerCapability', 'cms.schema_designer',
        'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
        'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
        'fields', (select jsonb_agg(jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
            'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
            'defaultMode', 'none', 'localizationMode', 'none',
            'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')) from generate_series(1, 128) g),
        'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb,
        'idempotencyKey', pg_temp.s09d_idem(tag, 'create')));
    total := extract(epoch from clock_timestamp() - t0) * 1000;
    insert into probe_times values (i, '00 TOTAL (as bench times it)', total);
    if resource is null then raise exception 'create failed: %', pg_temp.s09d_outcome(tag || ':create'); end if;
    prev := null;
    for k in 1..20 loop
      begin
        cur := current_setting('probe.t' || lpad(k::text, 2, '0'))::timestamptz;
      exception when others then
        cur := null;
      end;
      if prev is not null and cur is not null then
        insert into probe_times values (i, names[k - 1], extract(epoch from cur - prev) * 1000);
      end if;
      prev := cur;
    end loop;
    insert into probe_times select i, '21 from last stamp to RPC return', extract(epoch from clock_timestamp() - prev) * 1000;
    perform set_config('probe.t01', '', true);
  end loop;
end;
$body$;

select pg_temp.probe_run(15);
select diag(rpad(step, 52) || ' p50=' || lpad(round(percentile_cont(0.5) within group (order by ms)::numeric, 1)::text, 7)
  || ' p95=' || lpad(round(percentile_cont(0.95) within group (order by ms)::numeric, 1)::text, 7) || ' max=' || lpad(round(max(ms), 1)::text, 7))
  from probe_times group by step order by step;

select * from finish();
rollback;
