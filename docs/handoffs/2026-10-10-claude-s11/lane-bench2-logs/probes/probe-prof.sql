\connect postgres supabase_admin
\ir /w/supabase/tests/support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
set pg_stat_statements.track = 'all';
create or replace function pg_temp.pp_reset() returns void language plpgsql security definer as $b$
declare ns text;
begin
  select n.nspname into ns from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements';
  execute format('select %I.pg_stat_statements_reset()', ns);
end $b$;
create temp table prof_stmt(rn int, line text) on commit drop;
grant all on pg_temp.prof_stmt to public;
create or replace function pg_temp.pp_gather() returns void language plpgsql security definer as $b$
declare ns text;
begin
  select n.nspname into ns from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements';
  execute format($q$
    insert into prof_stmt
    select row_number() over (order by total_exec_time desc),
           format('calls=%%s tot=%%s mean=%%s rows=%%s hit=%%s read=%%s dirt=%%s | %%s', calls, round(total_exec_time::numeric, 1),
                  round(mean_exec_time::numeric, 3), rows, shared_blks_hit, shared_blks_read, shared_blks_dirtied,
                  left(regexp_replace(query, '\s+', ' ', 'g'), 140))
      from %I.pg_stat_statements
     where dbid = (select oid from pg_database where datname = current_database())
     order by total_exec_time desc limit 45$q$, ns);
end $b$;
set role postgres;
\ir /w/supabase/tests/phase_02_slice_09_dec108/00-helpers.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/01-actors.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/02-chain.sqlinc
\ir /w/supabase/tests/phase_02_slice_09_dec108/03-support.sqlinc


create temp table probe_times(iter int, step text, ms numeric) on commit drop;
do $do$
declare
  def text;
  anchors text[] := array[
    'perform platform_private.cms_require_scope_member',
    'reservation := platform_private.cms_reserve',
    'if not platform_private.cms_exact_keys(',
    'if p_request->>''typeKey'' !~',
    'if (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(field_entry->>''stableFieldId''))',
    'if not platform_private.cms_locale_config_shape_valid(',
    'perform pg_catalog.pg_advisory_xact_lock(',
    'canonical_definition := platform_private.cms_canonical_type_definition(p_request);',
    'editor_manifest := pg_catalog.jsonb_build_object(',
    'contract_ref := platform_private.cms_artifact_contract_ref',
    'hash_stub_text := platform_private.cms_jcs(',
    'if pg_catalog.length(hash_stub_text)',
    'definition_hash := pg_catalog.encode(',
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
  k integer := 0; a text;
begin
  def := pg_get_functiondef('platform_private.cms_create_type_draft(jsonb)'::regprocedure);
  foreach a in array anchors loop
    k := k + 1;
    if position(a in def) = 0 then raise exception 'anchor % not found: %', k, a; end if;
    def := replace(def, a, format('perform pg_catalog.set_config(''probe.t%s'', pg_catalog.clock_timestamp()::text, true); ', lpad(k::text, 2, '0')) || a);
  end loop;
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
create or replace function pg_temp.probe_run(p_n integer, p_pfx text default 'y') returns void language plpgsql as $b$
declare
  r jsonb; t0 timestamptz; i integer; k integer; prev timestamptz; cur timestamptz; total numeric;
  names text[] := array[
    '01 scope member + capability + correlation', '02 idempotency reserve', '03 exact_keys', '04 field-less request validation',
    '05 duplicate checks', '06 locale config shape + validate', '07 advisory lock + type-key exists', '08 canonical_type_definition + required validators',
    '09 editor + renderer manifests', '10 contract ref + locale hash', '11 jcs of the stub document', '12 splice check + jcs of the field array',
    '13 sha256', '14 insert content_types', '15 insert content_type_versions', '16 insert schema_artifacts (manifest CHECKs)',
    '17 field validation x128', '18 insert 128 field defs (row triggers)', '19 relations/capabilities loops', '20 emit_event',
    '21 type_version_resource', '22 cms_complete'];
begin
  for i in 1..p_n loop
    t0 := clock_timestamp();
    r := pg_temp.s09d_rpc(p_pfx || i || ':create', 'platform_api.cms_create_type_draft', 'owner',
      pg_temp.req(128, p_pfx || i) || jsonb_build_object('idempotencyKey', 'probe5-' || p_pfx || i));
    total := extract(epoch from clock_timestamp() - t0) * 1000;
    insert into probe_times values (i, '00 TOTAL (as the bench times it)', total);
    if r is null then raise exception 'create failed: %', pg_temp.s09d_outcome(p_pfx || i || ':create'); end if;
    prev := null;
    for k in 1..23 loop
      cur := current_setting('probe.t' || lpad(k::text, 2, '0'))::timestamptz;
      if prev is not null then insert into probe_times values (i, names[k - 1], extract(epoch from cur - prev) * 1000); end if;
      prev := cur;
    end loop;
    insert into probe_times select i, '24 from last stamp to RPC return', extract(epoch from clock_timestamp() - prev) * 1000;
  end loop;
end;
$b$;

-- warm-up (plan caches, buffers), then reset the statement statistics and measure
select pg_temp.probe_run(2, 'w');
truncate probe_times;
select pg_temp.pp_reset();
select pg_temp.probe_run(15, 'y');
select pg_temp.pp_gather();
select diag('STMT ' || line) from prof_stmt order by rn;
select diag(rpad(step, 52) || ' p50=' || lpad(round(percentile_cont(0.5) within group (order by ms)::numeric, 1)::text, 7)
  || ' p95=' || lpad(round(percentile_cont(0.95) within group (order by ms)::numeric, 1)::text, 7) || ' max=' || lpad(round(max(ms), 1)::text, 7))
  from probe_times group by step order by step;
select * from finish();
rollback;
