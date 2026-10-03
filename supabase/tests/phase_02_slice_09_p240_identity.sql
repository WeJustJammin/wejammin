\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): definition identity
-- (AC001), normalized storage without runtime DDL, EAV or caller-authored code (AC002) and
-- rejection of reserved-concept impersonation across types, fields, relations, templates and
-- blocks (AC017).  Every row comes from the named RPCs.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create temp table p_reserved(k text primary key) on commit drop;
insert into p_reserved select unnest(array['user', 'users', 'person', 'persons', 'account', 'accounts', 'session', 'sessions', 'identity', 'identities', 'party', 'parties', 'profile', 'profiles',
  'asset', 'assets', 'menu', 'menus', 'setting', 'settings', 'comment', 'comments', 'credit', 'credits', 'right', 'rights', 'money', 'mandate', 'mandates', 'dispute', 'disputes', 'entitlement',
  'entitlements', 'credential', 'credentials', 'evidence', 'institution', 'institutions', 'institution_gate', 'course', 'courses', 'lesson', 'lessons', 'authority', 'authorities', 'permission',
  'permissions', 'role', 'roles', 'billing', 'payment', 'payments', 'transaction', 'transactions']);
select is((select count(*)::integer from p_reserved), 54, 'fixture: the 54 reserved concept names of the code registry');
select is((select count(*)::integer from p_reserved where not platform_private.cms_reserved_key(k)), 0, 'every one of them is a member of the registry function, which holds no other member [P2-S09-AC-017]');
select is((select count(*)::integer from p_reserved where not platform_private.cms_reserved_key(upper(k))), 0, 'membership is case-insensitive [P2-S09-AC-017]');

-- ============================================================ AC017 types and fields ====
select is(pg_temp.p_run('t:' || k, pg_temp.p_base(k), 'VALIDATION_FAILED'), 'ok', 'CMS-03A-01 refuses the type key ' || k || ' and commits nothing [P2-S09-AC-017]') from p_reserved order by k;
select is(pg_temp.p_run('f:' || k, pg_temp.p_base(pg_temp.p_key('rf' || k), jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field(case when length(k) < 2 then k || 'x' else k end, 'short_text')))), 'VALIDATION_FAILED'), 'ok',
  'CMS-03A-01 refuses the field key ' || k || ' and commits nothing [P2-S09-AC-017]') from p_reserved order by k;
select pg_temp.s09d_create_type('d', 'p240_ident');
create or replace function pg_temp.p_a02(p_key text) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_rows();
begin
  perform pg_temp.s09d_rpc('a02:' || p_key, 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('d:type'), 'versionId', pg_temp.s09d_id('d:version'),
    'field', pg_temp.p_field(p_key, 'short_text') - 'stableFieldId', 'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('d'), 'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return pg_temp.s09d_outcome('a02:' || p_key) || ' ' || (before_rows = pg_temp.p_rows())::text;
end;
$body$;
select is(pg_temp.p_a02(k), 'INVALID_REQUEST true', 'CMS-03A-02 refuses the field key ' || k || ' and commits nothing [P2-S09-AC-017]') from p_reserved where length(k) >= 2 order by k;
select is(pg_temp.p_a02('p240_fine'), 'OK false', 'control: a non-reserved key is accepted by CMS-03A-02 [P2-S09-AC-017]');

-- ===================================================================== AC017 relations ====
select is(pg_temp.p_run('r:' || k, pg_temp.p_base(pg_temp.p_key('rr' || k), jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), pg_temp.p_field('rel', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0ddd"}')),
    'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0ddd', 'targetKind', 'domain', 'targetType', k, 'projectionKey', 'public.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')))),
  'VALIDATION_FAILED'), 'ok', 'a relation targeting the reserved concept ' || k || ' as a content or domain type is refused: only allowlisted targets resolve [P2-S09-AC-017]')
from p_reserved where k in ('user', 'account', 'credential', 'entitlement', 'money', 'payment', 'permission', 'institution_gate', 'authority', 'evidence', 'rights') order by k;
select is(pg_temp.p_run('r:ok', pg_temp.p_base(pg_temp.p_key('rrok'), jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), pg_temp.p_field('rel', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0eee"}')),
    'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0eee', 'targetKind', 'domain', 'targetType', 'organization', 'projectionKey', 'public.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')))),
  'OK'), 'ok', 'control: an allowlisted public projection target is accepted [P2-S09-AC-017]');

-- ================================================== AC017 templates and blocks ====
select pg_temp.s09d_grant_specialist('owner', 'cms.template_designer');
select pg_temp.s09d_to_active('d');
create or replace function pg_temp.p_template(p_label text, p_key text) returns text language plpgsql as $body$
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_define_template', 'owner', jsonb_build_object('templateKey', p_key, 'compatibleTypeIds', jsonb_build_array(pg_temp.s09d_id('d:type')),
    'slots', '[]'::jsonb, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'), 'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public',
    'expectedVersion', null, 'idempotencyKey', 'p240-tpl-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return pg_temp.s09d_outcome(p_label);
end;
$body$;
select is(pg_temp.p_template('tp:ok', 'p240-template'), 'OK', 'control: a non-reserved template key is accepted [P2-S09-AC-017]');
select is(pg_temp.p_template('tp:' || k, k), 'VALIDATION_FAILED', 'CMS-03C-01 refuses the template key ' || k || ' [P2-S09-AC-017]') from p_reserved where k !~ '_' order by k;
select is((select count(*)::integer from platform_private.cms_template_versions where template_key in (select k from p_reserved)), 0, 'no template named after a reserved concept exists [P2-S09-AC-017]');
select is(pg_temp.p_block_expect('b:' || k, pg_temp.p_block_request(k, 1), 'VALIDATION_FAILED'), 'ok', 'CMS-03A-05 refuses the block key ' || k || ' and registers nothing [P2-S09-AC-017]') from p_reserved where k !~ '_' order by k;
select is(pg_temp.p_block_expect('b:ok', pg_temp.p_block_request('p240block', 1), 'OK'), 'ok', 'control: a non-reserved block key is registered [P2-S09-AC-017]');
select is((select count(*)::integer from platform_private.cms_block_definition_versions where block_key in (select k from p_reserved)), 0, 'no block named after a reserved concept exists [P2-S09-AC-017]');

-- ============================================================ AC001 stable identities ====
select is((select pg_temp.s09d_rpc('i:setup', 'platform_api.cms_get_content_type_version', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('d:type'), 'versionId', pg_temp.s09d_id('d:version'))) is not null), true, 'fixture: the active type is readable');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_content_types set type_key = %L where id = %L', 'p240_other', pg_temp.s09d_id('d:type')), 'P0001', 'IMMUTABLE_RECORD', 'a content type key is immutable [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_field_definition_versions set field_key = %L where content_type_version_id = %L and field_key = ''title''', 'headline', pg_temp.s09d_id('d:version')), 'P0001', 'IMMUTABLE_RECORD', 'a field key of an activated version is immutable [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_field_definition_versions set stable_field_id = extensions.gen_random_uuid() where content_type_version_id = %L', pg_temp.s09d_id('d:version')), 'P0001', 'IMMUTABLE_RECORD', 'a stable field identity is immutable [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_content_type_versions set version_no = 9 where id = %L', pg_temp.s09d_id('d:version')), 'P0001', 'IMMUTABLE_RECORD', 'a version number is immutable [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_block_definition_versions set block_key = %L where block_key = ''p240block''', 'renamed'), 'P0001', 'IMMUTABLE_RECORD', 'a block key is immutable [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_block_definition_versions set block_version = 9 where block_key = ''p240block'''), 'P0001', 'IMMUTABLE_RECORD', 'and so is its version [P2-S09-AC-001]');
select throws_ok(format('update platform_private.cms_template_versions set template_key = %L where template_key = ''p240-template''', 'p240-renamed'), 'P0001', null, 'a template key is immutable [P2-S09-AC-001]');
select throws_ok(format('delete from platform_private.cms_template_versions where template_key = ''p240-template'''), 'P0001', null, 'a template version cannot be deleted [P2-S09-AC-001]');
select throws_ok(format('delete from platform_private.cms_content_types where id = %L', pg_temp.s09d_id('d:type')), 'P0001', 'IMMUTABLE_RECORD', 'a content type cannot be deleted [P2-S09-AC-001] [P2-S09-AC-167]');
select throws_ok(format('delete from platform_private.cms_field_definition_versions where content_type_version_id = %L', pg_temp.s09d_id('d:version')), 'P0001', 'IMMUTABLE_RECORD', 'a field definition cannot be deleted [P2-S09-AC-001] [P2-S09-AC-167]');
select throws_ok(format('delete from platform_private.cms_block_definition_versions where block_key = ''p240block'''), 'P0001', 'IMMUTABLE_RECORD', 'a block cannot be deleted [P2-S09-AC-001] [P2-S09-AC-167]');
select throws_ok(format('delete from platform_private.cms_relation_definitions'), 'P0001', null, 'a relation definition cannot be deleted [P2-S09-AC-001]') where exists (select 1 from platform_private.cms_relation_definitions);
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09d_id('d:type') is not null and (select count(*) from platform_private.cms_content_type_versions where content_type_id = pg_temp.s09d_id('d:type')) = 1, true, 'identity survives: the type and its single version still exist [P2-S09-AC-001]');
select pg_temp.s09d_successor('s', 'd');
select is((select string_agg(version_no::text, ',' order by version_no) from platform_private.cms_content_type_versions where content_type_id = pg_temp.s09d_id('d:type')), '1,2', 'identities are versioned: the successor is version 2 of the same type and the source row is untouched [P2-S09-AC-001]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('d:version')), 'active', 'the source version keeps its identity and state until the successor activates [P2-S09-AC-001]');
select is((select count(*)::integer from platform_private.cms_field_definition_versions f where f.content_type_version_id = pg_temp.s09d_id('s:version') and f.stable_field_id in (select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('d:version'))), 2,
  'the successor keeps each stable field identity of its source [P2-S09-AC-001]');
select is(pg_temp.p_run('k:reuse', pg_temp.p_base('p240_ident'), 'CONFLICT'), 'ok', 'a content type key is never reused [P2-S09-AC-001]');
select is(pg_temp.p_block_expect('k:blockreuse', pg_temp.p_block_request('p240block', 1), 'CONFLICT'), 'ok', 'a block key and version pair is never reused [P2-S09-AC-001]');
select is(pg_temp.p_template('k:tplreuse', 'p240-template'), 'CONFLICT', 'a template key is never rewritten or reused: defining it again without naming the prior version is refused [P2-S09-AC-001]');

-- ============================================================ AC002 storage model ====
select is((select string_agg(c.table_name || '.' || c.column_name, ',' order by c.table_name, c.column_name) from information_schema.columns c where c.table_schema = 'platform_private' and c.table_name in ('cms_content_types', 'cms_content_type_versions', 'cms_content_type_template_bindings', 'cms_content_type_capability_bindings',
      'cms_field_definition_versions', 'cms_relation_definitions', 'cms_schema_migration_plans', 'cms_schema_artifacts', 'cms_schema_dry_run_reports', 'cms_block_definition_versions', 'cms_release_nonce_receipts', 'cms_block_definition_lifecycle_events')
    and c.data_type = 'jsonb' and not exists (select 1 from pg_constraint k where k.conrelid = format('platform_private.%I', c.table_name)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%' || c.column_name || '%')),
  null, 'every JSONB column of the twelve tables is covered by at least one CHECK that constrains its shape or size [P2-S09-AC-002]');
select is((select string_agg(c.table_name || '.' || c.column_name, ',' order by c.table_name, c.column_name) from information_schema.columns c where c.table_schema = 'platform_private' and c.table_name in ('cms_content_types', 'cms_content_type_versions',
      'cms_field_definition_versions', 'cms_relation_definitions', 'cms_schema_artifacts', 'cms_block_definition_versions') and c.data_type = 'jsonb'),
  'cms_block_definition_versions.accessibility_contract,cms_block_definition_versions.allowed_children,cms_block_definition_versions.compatibility_range,cms_block_definition_versions.data_source_permissions,cms_block_definition_versions.props_schema_snapshot,cms_block_definition_versions.props_snapshot_attestation,cms_block_definition_versions.slot_rules,cms_content_type_versions.activation_required_capabilities,cms_content_type_versions.fallback_chains,cms_content_type_versions.labels,cms_content_type_versions.supported_locales,cms_field_definition_versions.constraints,cms_field_definition_versions.default_value,cms_field_definition_versions.editor_config,cms_schema_artifacts.editor_manifest,cms_schema_artifacts.renderer_manifest',
  'the JSONB columns are the bounded, named structures of the model (manifests, constraints, locale and policy snapshots), not a generic attribute bag [P2-S09-AC-002]');
select is((select count(*)::integer from information_schema.tables t where t.table_schema in ('platform_private', 'platform_api', 'public_api', 'public') and (t.table_name ~* '(^|_)(eav|attributes?|kv|key_?value|dynamic|custom_fields?)(_|$)')), 0, 'no entity-attribute-value, generic attribute or custom-field table exists [P2-S09-AC-002]');
select is((select count(*)::integer from information_schema.columns c where c.table_schema = 'platform_private' and c.table_name like 'cms\_%' and c.column_name in ('attribute', 'attribute_name', 'attribute_key', 'entity_type', 'entity_id', 'attr_value')), 0, 'no cms_ table has an entity/attribute/value column pattern [P2-S09-AC-002]');
select is((select count(*)::integer from pg_proc p where p.pronamespace in ('platform_api'::regnamespace, 'public_api'::regnamespace) and p.prokind = 'f' and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(create[[:space:]]+(table|index|type|schema|function)|alter[[:space:]]+(table|type|schema)|drop[[:space:]]+(table|column|schema))'), 0,
  'no exposed RPC contains DDL: schema changes are rows, never runtime DDL [P2-S09-AC-002]');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'platform_private'::regnamespace and p.proname like 'cms\_%' and p.prokind = 'f'
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(execute[[:space:]]+(format\(|''(create|alter|drop))|execute[[:space:]]+p_(request|sql|statement))' and p.proname <> 'cms_template_registry_valid'), 0,
  'no cms_ function builds or runs DDL or caller-supplied SQL: the runtime never alters the schema or evaluates caller text [P2-S09-AC-002]');
select ok((select pg_get_functiondef(p.oid) ~ 'to_regclass\(''platform_private\.cms_template_versions''\)' and pg_get_functiondef(p.oid) ~ 'select exists \(select 1 from %s where id = \$1\)' and pg_get_functiondef(p.oid) !~* 'p_request'
    from pg_proc p where p.oid = 'platform_private.cms_template_registry_valid(uuid)'::regprocedure),
  'the one dynamic statement in the module is a fixed existence SELECT over one of three constant relation names: no caller text reaches it [P2-S09-AC-002]');
select is((select count(*)::integer from information_schema.columns c where c.table_schema = 'platform_private' and c.table_name = 'cms_field_definition_versions' and c.column_name in ('validator_source', 'validator_code', 'validator_expression', 'validator_pattern', 'validator_regex')), 0,
  'a field stores no validator source, expression or pattern: only a protected registry key and version [P2-S09-AC-002]');
select is((select count(*)::integer from platform_private.cms_field_definition_versions where validator_key is not null and not platform_private.cms_validator_registry_valid(validator_key, validator_version)), 0, 'every stored validator pair resolves in the code-owned registry [P2-S09-AC-002]');
select is((select count(*)::integer from platform_private.cms_field_definition_versions f where f.constraints ?| array['pattern', 'regex', 'expression', 'code', 'script', 'validate']), 0, 'no stored constraint carries a pattern, expression or code member [P2-S09-AC-002]');
select is(pg_temp.p_run('c:code', pg_temp.p_base(pg_temp.p_key('ccode'), jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('title', 'short_text', '{"constraints":{"pattern":"^(a+)+$"}}')))), 'VALIDATION_FAILED'), 'ok',
  'a caller-authored regular expression is refused at creation and nothing is stored [P2-S09-AC-002]');
select is(pg_temp.p_run('c:eval', pg_temp.p_base(pg_temp.p_key('ceval'), jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('title', 'short_text', '{"validatorKey":"eval(document.cookie)","validatorVersion":1}')))), 'VALIDATION_FAILED'), 'ok',
  'a caller-authored executable validator is refused at creation [P2-S09-AC-002]');

select * from finish();
rollback;
