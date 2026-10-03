\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the compiled
-- SchemaArtifact (immutable, content-addressed, hash-stable), the server-derived
-- compatibility classification and the evidence gates it implies, the populated-
-- data gate for a new required field, and the activation preconditions.  Every
-- candidate, plan, report, review and activation comes from the named RPCs and the
-- worker protocol; the few forged rows are negative controls that must be refused.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

select pg_temp.s09d_grant_specialist('owner', 'cms.author');
select pg_temp.s09d_grant_specialist('owner', 'cms.editor');
create or replace function pg_temp.p_plan(p_tag text, p_col text) returns text language plpgsql stable as $body$
declare result text;
begin
  execute format('select %I::text from platform_private.cms_schema_migration_plans where id = $1', p_col) into result using pg_temp.s09d_id(p_tag || ':plan');
  return result;
end;
$body$;
create or replace function pg_temp.p_artifact(p_tag text) returns text language sql stable as $body$
  select a::text from platform_private.cms_schema_artifacts a where a.content_type_version_id = pg_temp.s09d_id(p_tag || ':version')
$body$;
create or replace function pg_temp.p_count(p_table text) returns bigint language plpgsql stable as $body$
declare n bigint;
begin execute format('select count(*) from platform_private.%I', p_table) into n; return n; end;
$body$;
create or replace function pg_temp.p_efield(p_key text, p_kind text, p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('key', p_key, 'kind', p_kind, 'constraints', '{}'::jsonb, 'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', initcap(p_key), 'order', 1), 'lifecycle', 'active') || p_over
$body$;
create or replace function pg_temp.p_add(p_label text, p_tag text, p_field jsonb) returns text language plpgsql as $body$
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'),
    'versionId', pg_temp.s09d_id(p_tag || ':version'), 'field', p_field, 'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag),
    'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return pg_temp.s09d_outcome(p_label);
end;
$body$;

-- ===================================================== AC008 the compiled artifact ====
select pg_temp.s09d_create_type('a', 'p240_art_a');
select ok((select a.compiler_version = '1' and a.zod_contract_ref = 'cms/content-type/p240_art_a/v1' and a.artifact_hash ~ '^[a-f0-9]{64}$' and a.state = 'compiled'
      and jsonb_typeof(a.editor_manifest) = 'object' and jsonb_typeof(a.renderer_manifest) = 'object' and a.editor_manifest ? 'schema' and a.editor_manifest ? 'fields'
      and a.renderer_manifest ? 'relations' and a.renderer_manifest ? 'templateBindings' and a.renderer_manifest ? 'capabilityBindings'
    from platform_private.cms_schema_artifacts a where a.content_type_version_id = pg_temp.s09d_id('a:version')),
  'the artifact persists the compiler version, the versioned contract reference, both manifests and a lowercase 64-hex hash [P2-S09-AC-008]');
select is((select count(*)::integer from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')), 1, 'one artifact exists per type version [P2-S09-AC-008]');
select is(pg_temp.s09e_unique('cms_schema_artifacts', (select id from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')),
    array['content_type_version_id'], jsonb_build_object('content_type_version_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'a second artifact for one version is rejected by the unique constraint (a control with another version is accepted) [P2-S09-AC-008]');
-- the definition rebuild is a definer function: it reads the graph under the RPC context
select set_config('app.cms_rpc', 'true', true);
select is((select a.artifact_hash = platform_private.cms_definition_artifact_hash(platform_private.cms_candidate_definition_request(v.id), v.version_no)
      and v.definition_hash = a.artifact_hash
    from platform_private.cms_content_type_versions v join platform_private.cms_schema_artifacts a on a.id = v.schema_artifact_id where v.id = pg_temp.s09d_id('a:version')),
  true, 'the hash is content-addressed: recomputing it from the persisted definition graph gives the stored hash, which is the version''s definition hash [P2-S09-AC-008]');
select set_config('app.cms_rpc', '', true);
create temp table p_art_before on commit drop as select pg_temp.p_artifact('a') as row,
  (select artifact_hash::text from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')) as hash;
select pg_temp.s09d_dry_run('a');
select ok(pg_temp.s09d_outcome('a:dryRun') = 'OK' and pg_temp.p_artifact('a') = (select row from p_art_before),
  'compiling an unchanged draft again (the dry-run command recompiles) leaves the artifact row byte-identical: repeated compilation is hash-stable [P2-S09-AC-008]');
select pg_temp.p_add('art:add', 'a', pg_temp.p_efield('another', 'short_text'));
select is(pg_temp.s09d_outcome('art:add'), 'OK', 'control: the draft definition changes [P2-S09-AC-008]');
select pg_temp.s09d_dry_run('a');
select isnt((select artifact_hash::text from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')), (select hash from p_art_before),
  'a different definition compiles to a different hash [P2-S09-AC-008]');
select is((select artifact_hash from platform_private.cms_schema_artifacts where content_type_version_id = pg_temp.s09d_id('a:version')), (select definition_hash from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')),
  'the recompiled artifact hash is again the definition hash [P2-S09-AC-008]');
select set_config('app.cms_rpc', 'true', true);
select set_config('app.cms_compile', '', true);
select throws_ok(format('update platform_private.cms_schema_artifacts set artifact_hash = %L where content_type_version_id = %L', repeat('b', 64), pg_temp.s09d_id('a:version')), 'P0001', 'IMMUTABLE_RECORD',
  'outside the compile command even a draft artifact cannot be updated [P2-S09-AC-008]');
select throws_ok(format('delete from platform_private.cms_schema_artifacts where content_type_version_id = %L', pg_temp.s09d_id('a:version')), 'P0001', 'IMMUTABLE_RECORD', 'an artifact cannot be deleted [P2-S09-AC-008]');
select pg_temp.s09d_seal('a');
select pg_temp.s09d_submit('a');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'review', 'fixture: the candidate left draft for review [P2-S09-AC-008]');
select set_config('app.cms_rpc', 'true', true);
select set_config('app.cms_compile', 'true', true);
select throws_ok(format('update platform_private.cms_schema_artifacts set artifact_hash = %L where content_type_version_id = %L', repeat('b', 64), pg_temp.s09d_id('a:version')), 'P0001', 'IMMUTABLE_RECORD',
  'once the candidate leaves draft its artifact is immutable even inside the compile context [P2-S09-AC-008]');
select set_config('app.cms_compile', '', true);
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09e_writers('cms_schema_artifacts', 'delete[[:space:]]+from'), '', 'no function deletes an artifact [P2-S09-AC-008]');
select is(pg_temp.s09e_writers('cms_schema_artifacts', 'insert[[:space:]]+into'), 'cms_create_schema_successor,cms_create_type_draft', 'artifacts are inserted only by the two draft producers [P2-S09-AC-008]');

-- ===================================================== AC009 classification and gates ====
select pg_temp.s09d_create_type('c0', 'p240_cls_src');
select pg_temp.s09d_to_active('c0');
-- additive
select pg_temp.s09d_successor('ad', 'c0');
select pg_temp.p_add('ad:add', 'ad', pg_temp.p_efield('added', 'short_text'));
select pg_temp.s09d_dry_run('ad', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('ad:dryRun'), 'VALIDATION_FAILED', 'an additive candidate refuses a transform pair and no attempt, plan or job is created [P2-S09-AC-009]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_schema_migration_plans where to_version_id = ''' || pg_temp.s09d_id('ad:version') || ''''), '0', 'no plan exists for the refused additive attempt [P2-S09-AC-009]');
select pg_temp.s09d_dry_run('ad');
select ok(pg_temp.s09d_outcome('ad:dryRun') = 'OK' and pg_temp.p_plan('ad', 'classification') = 'additive' and pg_temp.p_plan('ad', 'transform_key') is null
    and pg_temp.s09d_read('cms_content_type_versions', 'compatibility', pg_temp.s09d_id('ad:version')) = 'additive'
    and pg_temp.s09d_read('cms_schema_dry_run_reports', 'classification', pg_temp.s09d_id('ad:dryRun')) = 'additive',
  'adding an optional field is derived additive by the server and recorded on the plan, the report and the version, with no transform [P2-S09-AC-009]');
-- conditional
select pg_temp.s09d_create_type('c1', 'p240_cls_cond');
select pg_temp.s09d_to_active('c1');
select pg_temp.s09d_successor('co', 'c1');
select pg_temp.s09d_dry_run('co');
select pg_temp.s09w_dry_run('co');
select pg_temp.s09w_tighten('co', 40);
select pg_temp.s09d_dry_run('co');
select is(pg_temp.s09d_outcome('co:dryRun'), 'VALIDATION_FAILED', 'a conditional candidate without a transform pair is refused (422) before any attempt exists [P2-S09-AC-009]');
select pg_temp.s09d_dry_run('co', 'owner', 'caller.fn', '1');
select is(pg_temp.s09d_outcome('co:dryRun'), 'VALIDATION_FAILED', 'a transform outside the code-owned registry is refused [P2-S09-AC-009]');
select pg_temp.s09d_dry_run('co', 'owner', 'identity.revalidate', '1');
select ok(pg_temp.s09d_outcome('co:dryRun') = 'OK' and pg_temp.p_plan('co', 'classification') = 'conditional' and pg_temp.p_plan('co', 'transform_key') = 'identity.revalidate',
  'tightening a constraint is derived conditional and the plan carries the registered transform pair [P2-S09-AC-009]');
select pg_temp.s09w_dry_run('co');
select pg_temp.s09d_submit('co'); select pg_temp.s09d_assign('co', 'rev1'); select pg_temp.s09d_decide('co', 'rev1');
select pg_temp.s09d_activate('co', 'owner', '{}'::jsonb, 'co:act:null', jsonb_build_object('migrationPlanId', null));
select is(pg_temp.s09d_outcome('co:act:null'), 'VALIDATION_FAILED', 'a conditional candidate cannot activate without its migration plan [P2-S09-AC-009]');
select pg_temp.s09d_activate('co', 'owner', '{}'::jsonb, 'co:act:other', jsonb_build_object('migrationPlanId', pg_temp.s09d_id('ad:plan')));
select is(pg_temp.s09d_outcome('co:act:other'), 'VALIDATION_FAILED', 'nor with another candidate''s plan [P2-S09-AC-009]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('co:version')), 'approved', 'the refused activations left the candidate approved [P2-S09-AC-009]');
select pg_temp.s09d_activate('co');
select is(pg_temp.s09d_outcome('co:activate'), 'OK', 'with the exact plan and evidence the conditional candidate activates [P2-S09-AC-009]');
-- breaking
select pg_temp.s09d_create_type('c2', 'p240_cls_brk');
select pg_temp.s09d_to_active('c2');
select pg_temp.s09d_successor('br', 'c2');
select pg_temp.s09d_dry_run('br');
select pg_temp.s09w_dry_run('br');
select pg_temp.s09w_redefine('br', 'long_text', '{}'::jsonb);
select pg_temp.s09d_dry_run('br');
select is(pg_temp.s09d_outcome('br:dryRun'), 'VALIDATION_FAILED', 'a breaking candidate without a transform pair is refused [P2-S09-AC-009]');
select pg_temp.s09d_dry_run('br', 'owner', 'identity.revalidate', '1');
select ok(pg_temp.s09d_outcome('br:dryRun') = 'OK' and pg_temp.p_plan('br', 'classification') = 'breaking' and pg_temp.s09d_read('cms_content_type_versions', 'compatibility', pg_temp.s09d_id('br:version')) = 'breaking',
  'changing a field kind is derived breaking and recorded on the plan and the version [P2-S09-AC-009]');
select pg_temp.s09d_submit('br');
select is(pg_temp.s09d_outcome('br:submit'), 'CONFLICT', 'a breaking candidate cannot enter review before its dry run is sealed: the dry-run evidence gate [P2-S09-AC-009]');
-- an underivable classification is refused before any attempt
select pg_temp.s09d_create_type('c3', 'p240_cls_unk');
select pg_temp.s09d_to_active('c3');
select pg_temp.s09d_successor('un', 'c3');
create or replace function pg_temp.p_underivable() returns text language plpgsql as $body$
declare before_counts text := concat_ws('|', pg_temp.p_count('cms_schema_migration_plans'), pg_temp.p_count('cms_schema_dry_run_reports'), pg_temp.p_count('jobs')); result text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_content_type_versions disable trigger user;
    update platform_private.cms_content_type_versions set supersedes_id = pg_temp.s09d_id('c0:version') where id = pg_temp.s09d_id('un:version');
    perform pg_temp.s09d_dry_run('un');
    result := pg_temp.s09d_outcome('un:dryRun') || ' ' || (before_counts = concat_ws('|', pg_temp.p_count('cms_schema_migration_plans'), pg_temp.p_count('cms_schema_dry_run_reports'), pg_temp.p_count('jobs')))::text;
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return 'ERROR:' || sqlerrm;
  end;
end;
$body$;
select is(pg_temp.p_underivable(), 'VALIDATION_FAILED true', 'a candidate whose source cannot be resolved has no derivable classification: refused with 422 and no attempt, plan or job exists [P2-S09-AC-009]');

-- ============================================= AC063 a new required field over populated data ====
select pg_temp.s09d_create_type('p', 'p240_pop');
select pg_temp.s09d_to_active('p');
select pg_temp.s09w_entry('e1', 'p', 'Alpha');
select pg_temp.s09w_entry('e2', 'p', 'Beta');
select is(pg_temp.s09d_outcome('e1') || pg_temp.s09d_outcome('e2'), 'OKOK', 'fixture: the active version holds two real entries [P2-S09-AC-063]');
select pg_temp.s09d_successor('q', 'p');
select is(pg_temp.p_add('pop:req', 'q', pg_temp.p_efield('extra', 'short_text', '{"required":true}')), 'OK', 'the draft may declare a new required field with no default [P2-S09-AC-063]');
select pg_temp.s09d_dry_run('q');
select is(pg_temp.s09d_outcome('q:dryRun'), 'VALIDATION_FAILED', 'the candidate is conditional, so a dry run without a migration transform is refused [P2-S09-AC-063]');
select pg_temp.s09d_dry_run('q', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('q');
select ok(pg_temp.p_plan('q', 'state') = 'blocked' and pg_temp.p_plan('q', 'row_error_count') = '2' and pg_temp.p_plan('q', 'source_count') = '2',
  'scanning the populated data finds both entries without the new required value: the revalidating transform fabricates nothing and the plan is blocked [P2-S09-AC-063]');
select is(pg_temp.s09d_read('cms_schema_dry_run_reports', 'result', pg_temp.s09d_id('q:dryRun')), 'fail', 'the sealed report records the failure [P2-S09-AC-063]');
select pg_temp.s09d_submit('q');
select is(pg_temp.s09d_outcome('q:submit'), 'CONFLICT', 'a candidate whose migration cannot complete never reaches review, so the required field is never added over populated data [P2-S09-AC-063]');

select * from finish();
rollback;
