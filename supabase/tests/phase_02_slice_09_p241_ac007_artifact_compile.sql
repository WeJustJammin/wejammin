commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P241 (AC007, database half): every definition compiles
-- deterministically into its artifacts and unknown fields are refused.  The
-- compiled artifact is the persisted, content-addressed projection of the
-- definition graph: a versioned Zod contract reference (the Zod and OpenAPI
-- source), an editor manifest, a renderer manifest and a lowercase 64-hex hash,
-- beside the stored definition rows themselves (the database artifact).  The
-- hash is a pure function of the definition (no salt, no clock, no row id), so
-- recompiling, reordering the definition or rebuilding the request from the
-- stored rows reproduces it, and any definition change moves it.  Unknown
-- members are refused at the command boundary and commit nothing.  Every
-- candidate is produced through named commands.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc

create or replace function pg_temp.s09k_artifact(p_tag text, p_column text) returns text
language sql stable as $body$
  select pg_temp.s09d_scalar(format('select %I::text from platform_private.cms_schema_artifacts where content_type_version_id = %L',
    p_column, pg_temp.s09d_id(p_tag || ':version')))
$body$;
create or replace function pg_temp.s09k_keys(p_value jsonb) returns text language sql immutable as $body$
  select string_agg(k, ',' order by k) from jsonb_object_keys(p_value) k
$body$;
create or replace function pg_temp.s09k_request(p_tag text) returns jsonb language sql stable as $body$
  select platform_private.cms_candidate_definition_request(pg_temp.s09d_id(p_tag || ':version'))
$body$;
create or replace function pg_temp.s09k_hash(p_request jsonb, p_version_no integer) returns text language sql stable as $body$
  select platform_private.cms_definition_artifact_hash(p_request, p_version_no)
$body$;

-- A draft with a text field, a relation field with its binding, and a second text field.
select pg_temp.s09d_create_type('a', 'p241_ac007');
create temp table s09k_created on commit drop as
select pg_temp.s09d_scalar(format('select artifact_hash::text from platform_private.cms_schema_artifacts where content_type_version_id = %L',
  pg_temp.s09d_id('a:version'))) as hash;
select pg_temp.s09d_add_relation('a');
select pg_temp.s09d_rpc('a:body', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'field', jsonb_build_object('key', 'body', 'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', false,
    'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Body', 'order', 2), 'lifecycle', 'active'),
  'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 'p241-ac007-body-0001'));
select is(pg_temp.s09d_outcome('a:body'), 'OK', 'fixture: a draft with three fields and one relation is built through the named commands [P2-S09-AC-007]');
-- The draft's artifact is recompiled from its persisted definition graph by the dry-run command.
select pg_temp.s09d_dry_run('a');
select is(pg_temp.s09d_outcome('a:dryRun'), 'OK', 'fixture: the dry-run command recompiles the draft artifact from the stored definition [P2-S09-AC-007]');

-- --------------------------------------------- the persisted artifact set ----
select is((select string_agg(column_name, ',' order by column_name) from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'cms_schema_artifacts'),
  'artifact_hash,compiled_at,compiler_version,content_type_version_id,created_at,editor_manifest,id,owner_id,renderer_manifest,state,updated_at,version,zod_contract_ref',
  'the compiled artifact persists only the compiler version, the versioned contract reference, the editor and renderer manifests and the hash: no zod, openapi or database manifest column [P2-S09-AC-007]');
select is(pg_temp.s09k_artifact('a', 'zod_contract_ref'), 'cms/content-type/p241_ac007/v1',
  'the Zod and OpenAPI source is the versioned contract reference cms/content-type/{typeKey}/v{version} [P2-S09-AC-007]');
select is((select pg_temp.s09k_keys(editor_manifest) from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
  'fields,schema', 'the editor manifest carries exactly the schema and its fields [P2-S09-AC-007]');
select is((select pg_temp.s09k_keys(renderer_manifest) from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
  'capabilityBindings,relations,templateBindings', 'the renderer manifest carries exactly the relations, template bindings and capability bindings [P2-S09-AC-007]');
select is((select pg_temp.s09k_keys(editor_manifest->'schema') from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
  'capabilityBindings,defaultLocale,defaultTemplateVersionId,fields,label,ownerCapability,relations,sourceLocale,templateBindings,typeKey,workflowKey,workflowVersion',
  'the compiled schema has exactly the definition members and no database id, owner or timestamp [P2-S09-AC-007]');
select ok((select jsonb_array_length(editor_manifest->'fields') = 3
      and (select count(*) from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version')) = 3
      and not exists (select 1 from jsonb_array_elements(editor_manifest->'fields') f
          where not exists (select 1 from platform_private.cms_field_definition_versions row_field
            where row_field.content_type_version_id = pg_temp.s09d_id('a:version')
              and row_field.stable_field_id = (f->>'stableFieldId')::uuid and row_field.field_key = f->>'key' and row_field.kind = f->>'kind'))
    from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
  'every compiled field is exactly one stored definition row (stable id, key and kind) and nothing is added or dropped [P2-S09-AC-007]');
select is((select jsonb_array_length(renderer_manifest->'relations') from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
  1, 'the renderer manifest lists the one stored relation binding [P2-S09-AC-007]');

-- ------------------------------------------------------------ determinism ----
select is(pg_temp.s09k_artifact('a', 'artifact_hash'), pg_temp.s09k_hash(pg_temp.s09k_request('a'), 1),
  'the stored hash is the hash of the definition rebuilt from the stored rows [P2-S09-AC-007]');
select is(pg_temp.s09k_artifact('a', 'artifact_hash'), pg_temp.s09d_scalar(format($q$select platform_private.cms_jcs_sha256(jsonb_build_object(
    'compilerVersion', compiler_version, 'zodContractRef', zod_contract_ref,
    'editorManifest', editor_manifest, 'rendererManifest', renderer_manifest,
    'localeConfigHash', (select locale_config_hash from platform_private.cms_content_type_versions where id = content_type_version_id)))
  from platform_private.cms_schema_artifacts where content_type_version_id = %L$q$, pg_temp.s09d_id('a:version'))),
  'the stored hash is the canonical SHA-256 of the persisted artifact members and the locale configuration hash, with no salt [P2-S09-AC-007]');
select is(pg_temp.s09k_hash(pg_temp.s09k_request('a') || jsonb_build_object('fields', (
    select jsonb_agg(f order by f->>'key' desc) from jsonb_array_elements(pg_temp.s09k_request('a')->'fields') f)), 1),
  pg_temp.s09k_artifact('a', 'artifact_hash'),
  'reordering the definition members does not move the hash: compilation canonicalizes the order [P2-S09-AC-007]');
select is(pg_temp.s09d_scalar(format('select platform_private.cms_compile_candidate(%L)::text', pg_temp.s09d_id('a:version'))),
  pg_temp.s09k_artifact('a', 'artifact_hash'), 'the compiler returns the hash it already stored for an unchanged draft [P2-S09-AC-007]');
create temp table s09k_snapshot on commit drop as
select pg_temp.s09d_scalar(format('select row_to_json(a)::text from platform_private.cms_schema_artifacts a where a.content_type_version_id = %L',
  pg_temp.s09d_id('a:version'))) as artifact;
select pg_temp.s09d_scalar(format('select platform_private.cms_compile_candidate(%L)::text', pg_temp.s09d_id('a:version')));
select is(pg_temp.s09d_scalar(format('select row_to_json(a)::text from platform_private.cms_schema_artifacts a where a.content_type_version_id = %L',
    pg_temp.s09d_id('a:version'))), (select artifact from s09k_snapshot),
  'compiling the unchanged draft again leaves the artifact row byte-identical [P2-S09-AC-007]');

-- A second type built from the same definition members differs only through its own typeKey reference.
select pg_temp.s09d_create_type('b', 'p241_ac007_twin');
select pg_temp.s09d_create_type('c', 'p241_ac007_twin2');
select ok(pg_temp.s09k_artifact('b', 'artifact_hash') <> pg_temp.s09k_artifact('c', 'artifact_hash')
    and (select (b.editor_manifest->'schema') - 'typeKey' - 'label' - 'fields' = (c.editor_manifest->'schema') - 'typeKey' - 'label' - 'fields'
         from platform_private.cms_schema_artifacts b, platform_private.cms_schema_artifacts c
         where b.content_type_version_id = pg_temp.s09d_id('b:version') and c.content_type_version_id = pg_temp.s09d_id('c:version')),
  'two types with the same definition members differ only in the type-addressed members: no id, clock or random value enters the artifact [P2-S09-AC-007]');

-- ------------------------------------------------------------ sensitivity ----
select ok(pg_temp.s09k_artifact('a', 'artifact_hash') <> (select hash from s09k_created)
    and pg_temp.s09d_read('cms_content_type_versions', 'definition_hash', pg_temp.s09d_id('a:version')) = pg_temp.s09k_artifact('a', 'artifact_hash'),
  'adding fields and a relation moved the hash from the one the single-field definition compiled to, and the version''s definition hash is the artifact hash [P2-S09-AC-007]');
select is(pg_temp.s09k_hash(pg_temp.s09k_request('a') || jsonb_build_object('fields', (
    select jsonb_agg(f) from jsonb_array_elements(pg_temp.s09k_request('a')->'fields') f where f->>'key' <> 'body')), 1) <> pg_temp.s09k_artifact('a', 'artifact_hash'), true,
  'removing one field from the definition changes the hash [P2-S09-AC-007]');
select is(pg_temp.s09k_hash(pg_temp.s09k_request('a') || jsonb_build_object('relations', '[]'::jsonb), 1) <> pg_temp.s09k_artifact('a', 'artifact_hash'), true,
  'removing the relation from the definition changes the hash [P2-S09-AC-007]');

-- ------------------------------------------------- unknown fields refused ----
select is(pg_temp.p_run('u:top', pg_temp.p_base(pg_temp.p_key('u-top'), jsonb_build_object('zodManifest', '{}'::jsonb)), 'INVALID_REQUEST'), 'ok',
  'CMS-03A-01 refuses an unknown top-level member such as a client-supplied artifact manifest and commits nothing [P2-S09-AC-007]');
select is(pg_temp.p_run('u:openapi', pg_temp.p_base(pg_temp.p_key('u-openapi'), jsonb_build_object('openapiManifest', '{}'::jsonb)), 'INVALID_REQUEST'), 'ok',
  'CMS-03A-01 refuses a client-supplied OpenAPI manifest and commits nothing [P2-S09-AC-007]');
select is(pg_temp.p_run('u:field', pg_temp.p_base(pg_temp.p_key('u-field'), jsonb_build_object('fields',
    jsonb_build_array(pg_temp.p_field('title', 'short_text', jsonb_build_object('rendererManifest', '{}'::jsonb))))), 'VALIDATION_FAILED'), 'ok',
  'CMS-03A-01 refuses an unknown member inside a field definition and commits nothing [P2-S09-AC-007]');
select is(pg_temp.p_run('u:ids', pg_temp.p_base(pg_temp.p_key('u-ids'), jsonb_build_object('schemaArtifactId', extensions.gen_random_uuid())), 'INVALID_REQUEST'), 'ok',
  'CMS-03A-01 refuses a client-supplied artifact or owner identifier and commits nothing [P2-S09-AC-007]');
create temp table s09k_before_unknown on commit drop as select pg_temp.p_rows() as rows;
select pg_temp.s09d_rpc('u:a02', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'field', jsonb_build_object('key', 'late', 'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', false,
    'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Late', 'order', 4), 'lifecycle', 'active'),
  'editorManifest', '{}'::jsonb,
  'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 'p241-ac007-unknown-0001'));
select ok(pg_temp.s09d_outcome('u:a02') = 'INVALID_REQUEST' and pg_temp.p_rows() = (select rows from s09k_before_unknown),
  'CMS-03A-02 refuses a client-supplied editor manifest (400) and commits nothing [P2-S09-AC-007]');
select is(pg_temp.s09k_artifact('a', 'artifact_hash'), pg_temp.s09k_hash(pg_temp.s09k_request('a'), 1),
  'after every refusal the stored artifact is still the compilation of the stored definition [P2-S09-AC-007]');

-- The artifact cannot be written by anything but the compiler.
select set_config('app.cms_rpc', 'false', true);
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_schema_artifacts
    set editor_manifest = '{"schema":{},"fields":[],"forged":true}'::jsonb where content_type_version_id = %L$q$, pg_temp.s09d_id('a:version'))),
  'negative control: a hand-written manifest is refused, so an artifact is only ever the compiler''s output [P2-S09-AC-007]');

select * from finish();
rollback;
