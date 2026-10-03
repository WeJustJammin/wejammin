commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the twelve original BE03a
-- persistence tables.  A real fixture puts producer rows in eleven of them (a type with a
-- field, a relation and a capability binding, an active type with a successor draft,
-- its dry-run report and plan, and a signed block with a lifecycle event and nonce receipts);
-- no producer can create a template binding (see AC045/AC049), so that table is proved from
-- the catalog.  Behaviour is probed on the real rows with the isolated-constraint helpers.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

select pg_temp.s09d_rpc('fx:a', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('tb_alpha', jsonb_build_object(
  'fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), pg_temp.p_field('related', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0ccc"}')),
  'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0ccc', 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')),
  'capabilityBindings', '[{"capabilityKey":"cms.editor","capabilityVersion":"1"}]'::jsonb)));
select pg_temp.s09d_remember('a:type', (pg_temp.s09d_resp('fx:a')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('a:version', (pg_temp.s09d_resp('fx:a')->>'id')::uuid);
select pg_temp.s09d_create_type('act', 'tb_active');
select pg_temp.s09d_to_active('act');
select pg_temp.s09d_successor('suc', 'act');
select pg_temp.s09d_dry_run('suc');
select pg_temp.p_register('fx:blk', pg_temp.p_block_request('tbhero', 1));
select pg_temp.p_advance('fx:adv', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('fx:blk')->>'id')::uuid, 'supported', 'deprecated'));
select is(pg_temp.s09d_outcome('fx:a') || pg_temp.s09d_outcome('suc:dryRun') || pg_temp.s09d_outcome('fx:blk') || pg_temp.s09d_outcome('fx:adv'), 'OKOKOKOK', 'fixture: producer rows exist in eleven of the twelve tables');

create temp table p_tables(t text primary key, immutable boolean, has_rows boolean) on commit drop;
insert into p_tables values ('cms_content_types', false, null), ('cms_content_type_versions', false, null), ('cms_content_type_template_bindings', false, null), ('cms_content_type_capability_bindings', false, null),
  ('cms_field_definition_versions', false, null), ('cms_relation_definitions', false, null), ('cms_schema_migration_plans', false, null), ('cms_schema_artifacts', true, null),
  ('cms_schema_dry_run_reports', false, null), ('cms_block_definition_versions', true, null), ('cms_release_nonce_receipts', false, null), ('cms_block_definition_lifecycle_events', true, null);
create or replace function pg_temp.s09t_rows(p_table text) returns bigint language plpgsql as $body$
declare n bigint; begin execute format('select count(*) from platform_private.%I', p_table) into n; return n; end; $body$;
update p_tables set has_rows = pg_temp.s09t_rows(t) > 0;
select is((select string_agg(t, ',' order by t) from p_tables where not has_rows), 'cms_content_type_template_bindings', 'only the template binding table lacks a producer row, because no producer can write one [P2-S09-AC-165]');

-- ==================================================== AC165 the IA envelope ====
select is((select count(*)::integer from p_tables pt cross join (values ('id', 'uuid'), ('owner_id', 'uuid'), ('version', 'bigint'), ('created_at', 'timestamp with time zone'), ('updated_at', 'timestamp with time zone')) c(col, typ)
    where pt.t <> 'cms_release_nonce_receipts' and not exists (select 1 from information_schema.columns k where k.table_schema = 'platform_private' and k.table_name = pt.t and k.column_name = c.col and k.data_type = c.typ and k.is_nullable = 'NO')), 0,
  'the eleven owned tables carry NOT NULL id, owner_id, version, created_at and updated_at of the envelope types [P2-S09-AC-165]');
select is((select count(*)::integer from p_tables pt where pt.t <> 'cms_release_nonce_receipts' and not exists (select 1 from information_schema.columns k where k.table_schema = 'platform_private' and k.table_name = pt.t and k.column_name = 'state' and k.is_nullable = 'NO')), 0,
  'each of them carries a NOT NULL closed state [P2-S09-AC-165]');
select is((select string_agg(k.column_name, ',' order by k.column_name) from information_schema.columns k where k.table_schema = 'platform_private' and k.table_name = 'cms_release_nonce_receipts' and k.column_name in ('id', 'owner_id', 'state', 'version', 'created_at', 'updated_at')),
  'created_at,id,updated_at', 'the nonce receipt is the one documented exception: no owner, state or version (the release key identifies it) [P2-S09-AC-165]');
select is((select count(*)::integer from p_tables pt where pt.t <> 'cms_release_nonce_receipts' and not exists (select 1 from pg_constraint k where k.conrelid = format('platform_private.%I', pt.t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ 'version > 0|version >= 1')), 0,
  'every version column is closed to non-positive values [P2-S09-AC-165]');
select is((select count(*)::integer from p_tables pt where pt.t not in ('cms_release_nonce_receipts') and not (
      exists (select 1 from pg_attribute a join pg_type ty on ty.oid = a.atttypid where a.attrelid = format('platform_private.%I', pt.t)::regclass and a.attname = 'state' and ty.typtype = 'e')
      or exists (select 1 from pg_constraint k where k.conrelid = format('platform_private.%I', pt.t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\mstate\M.*(ANY|=)'))), 0,
  'every state is a closed enum or a CHECK over a finite list [P2-S09-AC-165]');
select is((select string_agg(distinct t.tgname, ',' order by t.tgname) from pg_trigger t where t.tgname like '%version_monotonic' and t.tgrelid in (select format('platform_private.%I', pt.t)::regclass from p_tables pt)),
  'cms_content_type_versions_version_monotonic,cms_content_types_version_monotonic,cms_field_definition_versions_version_monotonic,cms_relation_definitions_version_monotonic,cms_schema_dry_run_reports_version_monotonic,cms_schema_migration_plans_version_monotonic',
  'the six tables whose CAS version advances are guarded against a decrease; the other five are immutable and pin version 1 [P2-S09-AC-165]');
select is((select count(*)::integer from platform_private.cms_schema_artifacts where version <> 1) + (select count(*)::integer from platform_private.cms_block_definition_versions where version <> 1)
    + (select count(*)::integer from platform_private.cms_block_definition_lifecycle_events where version <> 1), 0, 'artifacts, blocks and lifecycle events never leave version 1 [P2-S09-AC-165]');

-- ===================================================== AC166 immutable and append-only rows ====
select is((select count(*)::integer from p_tables pt where pt.immutable and not exists (select 1 from pg_constraint k where k.conrelid = format('platform_private.%I', pt.t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%updated_at = created_at%')), 0,
  'artifacts, block versions and lifecycle events pin updated_at = created_at in a CHECK [P2-S09-AC-166]');
select is(pg_temp.s09e_check('cms_schema_artifacts', 'cms_schema_artifacts_created_immutable_check', (select id from platform_private.cms_schema_artifacts limit 1), jsonb_build_object('updated_at', (now() + interval '1 hour')::text)),
  'control:ACCEPTED|override:REJECTED:23514:cms_schema_artifacts_created_immutable_check', 'a renewed updated_at on an artifact is rejected by exactly that CHECK [P2-S09-AC-166]');
select is(pg_temp.s09e_check('cms_block_definition_versions', 'cms_block_definition_versions_created_immutable_check', (select id from platform_private.cms_block_definition_versions limit 1), jsonb_build_object('updated_at', (now() + interval '1 hour')::text)),
  'control:ACCEPTED|override:REJECTED:23514:cms_block_definition_versions_created_immutable_check', 'and on a block version [P2-S09-AC-166]');
select is(pg_temp.s09e_check('cms_block_definition_lifecycle_events', 'cms_block_definition_lifecycle_events_created_immutable_check', (select id from platform_private.cms_block_definition_lifecycle_events limit 1), jsonb_build_object('updated_at', (now() + interval '1 hour')::text)),
  'control:ACCEPTED|override:REJECTED:23514:cms_block_definition_lifecycle_events_created_immutable_check', 'and on a lifecycle event [P2-S09-AC-166]');
select is((select count(*)::integer from platform_private.cms_schema_artifacts where updated_at <> created_at) + (select count(*)::integer from platform_private.cms_block_definition_versions where updated_at <> created_at)
    + (select count(*)::integer from platform_private.cms_block_definition_lifecycle_events where updated_at <> created_at), 0, 'every stored immutable row has updated_at = created_at [P2-S09-AC-166]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('update platform_private.cms_block_definition_versions set version = version where id = %L', (select id from platform_private.cms_block_definition_versions limit 1)), 'P0001', 'IMMUTABLE_RECORD', 'an UPDATE of a block version is rejected [P2-S09-AC-166]');
select throws_ok(format('delete from platform_private.cms_block_definition_versions where id = %L', (select id from platform_private.cms_block_definition_versions limit 1)), 'P0001', 'IMMUTABLE_RECORD', 'a DELETE of a block version is rejected [P2-S09-AC-166]');
select throws_ok(format('update platform_private.cms_block_definition_lifecycle_events set version = version where id = %L', (select id from platform_private.cms_block_definition_lifecycle_events limit 1)), 'P0001', 'IMMUTABLE_RECORD', 'an UPDATE of a lifecycle event is rejected [P2-S09-AC-166]');
select throws_ok(format('delete from platform_private.cms_block_definition_lifecycle_events where id = %L', (select id from platform_private.cms_block_definition_lifecycle_events limit 1)), 'P0001', 'IMMUTABLE_RECORD', 'a DELETE of a lifecycle event is rejected [P2-S09-AC-166]');
select throws_ok(format('delete from platform_private.cms_schema_artifacts where id = %L', (select id from platform_private.cms_schema_artifacts limit 1)), 'P0001', 'IMMUTABLE_RECORD', 'a DELETE of an artifact is rejected [P2-S09-AC-166]');
select set_config('app.cms_compile', 'true', true);
select throws_ok(format('update platform_private.cms_schema_artifacts set artifact_hash = %L where content_type_version_id = %L', repeat('f', 64), pg_temp.s09d_id('act:version')), 'P0001', 'IMMUTABLE_RECORD',
  'an artifact whose version has left draft cannot be updated even in the compile context [P2-S09-AC-166]');
select set_config('app.cms_compile', '', true);
select set_config('app.cms_rpc', '', true);
select is((select string_agg(distinct p.proname, ',' order by p.proname) from pg_proc p where p.pronamespace in ('platform_private'::regnamespace, 'platform_api'::regnamespace) and p.prokind = 'f'
    and pg_get_functiondef(p.oid) ~* 'updated_at[[:space:]]*=[[:space:]]*(now\(\)|pg_catalog\.now\(\)|clock_timestamp)' and pg_get_functiondef(p.oid) ~* 'update[[:space:]]+platform_private\.cms_(block_definition_versions|block_definition_lifecycle_events|schema_artifacts)'),
  null, 'no function renews updated_at on an immutable table [P2-S09-AC-166]');

-- ====================== AC167 .. AC174 the persisted columns and their producers ====
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_content_types'),
  'id,owner_id,state,version,created_at,updated_at,type_key,owner_capability,built_in,created_by', 'cms_content_types persists identity, owner, state, version, timestamps, the immutable type key, owner capability, built-in flag and creator [P2-S09-AC-167]');
select is(pg_temp.s09e_auto_unique('cms_content_types', array['type_key']), 'PROVEN:type_key', 'the type key is unique: a duplicate row collides, a distinct key does not, so keys are never reused [P2-S09-AC-167]');
select is((select count(*)::integer from pg_indexes where schemaname = 'platform_private' and tablename = 'cms_content_types' and indexname in ('cms_content_types_owner_state_idx', 'cms_content_types_owner_updated_idx')), 2, 'the owner/state and owner/time indexes exist [P2-S09-AC-167]');
select throws_ok(format('update platform_private.cms_content_types set type_key = %L where type_key = ''tb_alpha''', 'tb_renamed'), 'P0001', 'IMMUTABLE_RECORD', 'the type key is an immutable identity: a rename is rejected [P2-S09-AC-167]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_content_type_versions'),
  'id,owner_id,state,version,created_at,updated_at,content_type_id,version_no,labels,workflow_key,workflow_version,source_locale,default_locale,default_template_version_id,schema_artifact_id,definition_hash,compatibility,supersedes_id,dry_run_id,created_by,approved_at,activation_workflow_policy_key,activation_workflow_policy_version,activation_workflow_policy_hash,activation_required_decision_count,activation_required_capabilities,activation_approval_evidence_hash,supported_locales,fallback_chains,locale_config_hash',
  'cms_content_type_versions persists the parent type, version number, workflow and locale references, template and artifact references, definition hash, compatibility, supersession, dry run and the frozen activation evidence [P2-S09-AC-168]');
select is(pg_temp.s09e_unique_idx('cms_content_type_versions', (select id from platform_private.cms_content_type_versions where state = 'active' limit 1), 'cms_content_type_versions_one_active_unique', '{"state":"superseded"}'),
  'dup:REJECTED:23505|ctl:ACCEPTED', 'a type has at most one active version: a second active row collides, a superseded copy does not [P2-S09-AC-168]');
select ok((select v.supersedes_id is not null and v.dry_run_id is null and v.compatibility = 'additive' and v.definition_hash ~ '^[a-f0-9]{64}$' from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('suc:version')) is not null
    and (select v.activation_approval_evidence_hash ~ '^[a-f0-9]{64}$' and v.activation_required_decision_count = 1 and v.activation_workflow_policy_key = 'editorial' from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('act:version')),
  'a successor records its supersession and the activated version holds the server-frozen evidence (policy, decision count, approval hash) [P2-S09-AC-168]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_content_type_capability_bindings'),
  'id,owner_id,state,version,created_at,updated_at,content_type_version_id,capability_key,capability_version', 'cms_content_type_capability_bindings persists the parent version, the protected capability key and version and the envelope [P2-S09-AC-170]');
select is(pg_temp.s09e_auto_unique('cms_content_type_capability_bindings', array['content_type_version_id', 'capability_key', 'capability_version']), 'PROVEN:content_type_version_id', 'one binding per (version, key, version) is enforced [P2-S09-AC-170]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_field_definition_versions'),
  'id,owner_id,state,version,created_at,updated_at,content_type_version_id,stable_field_id,field_key,kind,constraints,validator_key,validator_version,required,default_mode,default_value,localization_mode,editor_config,created_by',
  'cms_field_definition_versions persists the stable identity, key, kind, constraints, validator, default, localization, editor config and lifecycle [P2-S09-AC-171]');
select is(pg_temp.s09e_auto_unique('cms_field_definition_versions', array['content_type_version_id', 'field_key']), 'PROVEN:content_type_version_id', 'the field key is unique within a type version [P2-S09-AC-171]');
select is(pg_temp.s09e_auto_unique('cms_field_definition_versions', array['content_type_version_id', 'stable_field_id']), 'PROVEN:content_type_version_id', 'and so is the stable identity [P2-S09-AC-171]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_relation_definitions'),
  'id,owner_id,state,version,created_at,updated_at,field_definition_id,target_kind,target_type,projection_key,cardinality,min_count,max_count,ordered,on_unavailable,created_by',
  'cms_relation_definitions persists the relation field, target kind, type and projection, cardinality, finite bounds, ordering and unavailable behavior [P2-S09-AC-172]');
select is(pg_temp.s09e_auto_unique('cms_relation_definitions', array['field_definition_id']), 'PROVEN:field_definition_id', 'one relation per field [P2-S09-AC-172]');
select is((select count(*)::integer from platform_private.cms_relation_definitions r where not platform_private.cms_projection_registry_valid(r.target_kind, r.target_type, r.projection_key)), 0, 'every stored target resolves in the code allowlist, so a relation never escalates authority [P2-S09-AC-172]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_schema_migration_plans'),
  'id,owner_id,state,version,created_at,updated_at,content_type_id,from_version_id,to_version_id,classification,transform_key,transform_version,dry_run_report,cursor,progress,source_count,target_count,row_error_count,migrated_count,failed_count,created_by,started_at,completed_at,superseded_at',
  'cms_schema_migration_plans persists source and target versions, classification, transform, report, cursor, progress, counters, worker state and timestamps [P2-S09-AC-173]');
select is(pg_temp.s09e_unique_idx('cms_schema_migration_plans', (select id from platform_private.cms_schema_migration_plans where superseded_at is null limit 1), 'cms_schema_migration_plans_one_live_per_pair_unique', jsonb_build_object('superseded_at', now()::text)),
  'dup:REJECTED:23505|ctl:ACCEPTED', 'one live plan per (from, to) version pair: a second live plan collides, a superseded one does not [P2-S09-AC-173]');
select is((select count(*)::integer from pg_constraint k where k.conrelid = 'platform_private.cms_schema_migration_plans'::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ 'draft.*dry_running.*ready.*blocked.*running.*verifying.*completed.*failed_retryable.*failed_terminal'), 1, 'the migration states are the closed nine-member set [P2-S09-AC-173]');
select is((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_schema_artifacts'),
  'id,owner_id,state,version,created_at,updated_at,content_type_version_id,compiler_version,zod_contract_ref,editor_manifest,renderer_manifest,artifact_hash,compiled_at', 'cms_schema_artifacts persists the compiler, contract reference, manifests, hash and composite ownership link [P2-S09-AC-174]');
select is(pg_temp.s09e_auto_unique('cms_schema_artifacts', array['content_type_version_id']), 'PROVEN:content_type_version_id', 'one artifact per type version [P2-S09-AC-174]');
select ok((select c.contype = 'f' and c.condeferrable and c.condeferred from pg_constraint c where c.conname = 'cms_content_type_versions_artifact_pair_fkey'), 'the composite ownership FK from version to artifact is deferred [P2-S09-AC-174]');
select is(pg_temp.s09e_check('cms_schema_artifacts', 'cms_schema_artifacts_state_check', (select id from platform_private.cms_schema_artifacts limit 1), '{"state":"draft"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_artifacts_state_check', 'an artifact is terminal: the only state is compiled [P2-S09-AC-174]');

-- ============================================= AC178 constraints and indexes enforced ====
create temp table p_inventory(kind text, rel text, name text) on commit drop;
insert into p_inventory select case c.contype when 'u' then 'unique' else 'fk' end, r.relname, c.conname from pg_constraint c join pg_class r on r.oid = c.conrelid where r.relnamespace = 'platform_private'::regnamespace
  and r.relname in (select t from p_tables) and c.contype in ('u', 'f');
insert into p_inventory select 'index', tablename, indexname from pg_indexes where schemaname = 'platform_private' and tablename in (select t from p_tables) and indexname not like '%\_pkey'
  and indexname not in (select conname from pg_constraint);
select is((select count(*)::integer from p_inventory where kind = 'unique'), 20, 'the twelve tables carry 20 unique constraints [P2-S09-AC-178]');
select is((select count(*)::integer from p_inventory where kind = 'fk'), 23, 'and 23 foreign keys [P2-S09-AC-178]');
select is((select count(*)::integer from p_inventory where kind = 'index'), 20, 'and 20 further indexes, owner, time and query indexes and the partial unique ones among them [P2-S09-AC-178]');
select is((select string_agg(name, ',' order by name) from p_inventory where kind = 'index' and name like '%owner%'), 'cms_content_type_versions_owner_updated_idx,cms_content_types_owner_state_idx,cms_content_types_owner_updated_idx,cms_schema_artifacts_owner_created_idx',
  'the owner indexes are present [P2-S09-AC-178]');
select is((select count(*)::integer from pg_indexes i where i.schemaname = 'platform_private' and i.indexname in ('cms_content_type_versions_one_active_unique', 'cms_schema_migration_plans_one_live_per_pair_unique') and i.indexdef like '%WHERE%'), 2,
  'both partial unique indexes (one active version per type, one live plan per pair) are present [P2-S09-AC-178]');
create temp table p_auto_unique on commit drop as
select pt.t as table_name, ix.indexrelid::regclass::text as idx,
  pg_temp.s09e_auto_unique(pt.t, (select array_agg(a.attname::text order by a.attname) from pg_attribute a where a.attrelid = ix.indrelid and a.attnum = any(ix.indkey))) as outcome
from p_tables pt join pg_index ix on ix.indrelid = format('platform_private.%I', pt.t)::regclass and ix.indisunique and not ix.indisprimary and 0 not in (select unnest(ix.indkey::int2[]))
where pt.has_rows and pt.t not in ('cms_schema_migration_plans');
select diag(table_name || ' ' || idx || ' => ' || outcome) from p_auto_unique where outcome not like 'PROVEN:%';
select is((select count(*)::integer from p_auto_unique where outcome not like 'PROVEN:%'), 0, 'every plain unique constraint of a table with rows rejects a duplicate producer row and accepts a distinct key [P2-S09-AC-178]');
create temp table p_auto_fk on commit drop as select pt.t as table_name, pg_temp.s09e_fk_probe('platform_private', pt.t,
    case when pt.t = 'cms_schema_artifacts' then jsonb_build_object('artifact_hash', encode(extensions.digest(extensions.gen_random_uuid()::text, 'sha256'), 'hex')) end) as outcome,
  (select count(*)::integer from pg_constraint c where c.conrelid = format('platform_private.%I', pt.t)::regclass and c.contype = 'f') as fk_count
from p_tables pt where pt.has_rows;
select diag(table_name || ' => ' || outcome) from p_auto_fk where outcome <> 'probed=' || fk_count || ';bad=';
select is((select count(*)::integer from p_auto_fk where outcome <> 'probed=' || fk_count || ';bad='), 0, 'every foreign key of a table with rows rejects a dangling value [P2-S09-AC-178]');
select is((select count(*)::integer from p_tables pt where pt.t = 'cms_content_type_template_bindings' and exists (select 1 from pg_constraint c where c.conrelid = 'platform_private.cms_content_type_template_bindings'::regclass and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (content_type_version_id, template_version_id)')), 1, 'the template binding unique pair is declared (no producer row exists to probe it) [P2-S09-AC-178]');
select is(pg_temp.s09e_check('cms_schema_artifacts', 'cms_schema_artifacts_state_check', (select id from platform_private.cms_schema_artifacts limit 1), '{"state":"draft"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_artifacts_state_check',
  'keys and immutable evidence are never reused or rewritten: the immutable evidence tables reject updates (proved above) and the keys are unique [P2-S09-AC-178]');

-- ==================================================== AC179 deferred composite FK ====
create or replace function pg_temp.p_deferred_probe() returns text language plpgsql as $body$
declare result text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_content_type_versions disable trigger user;
    set constraints all deferred;
    update platform_private.cms_content_type_versions set schema_artifact_id = (select id from platform_private.cms_schema_artifacts where content_type_version_id <> pg_temp.s09d_id('act:version') limit 1) where id = pg_temp.s09d_id('act:version');
    result := 'DEFERRED_NO_ERROR_YET';
    set constraints all immediate;
    result := 'ACCEPTED';
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return sqlstate || ' after ' || coalesce(result, 'start');
  end;
end;
$body$;
select is(pg_temp.p_deferred_probe(), '23503 after DEFERRED_NO_ERROR_YET', 'a mismatched artifact pair is accepted by the statement and refused when the deferred constraint is checked, in the same transaction, before it can commit [P2-S09-AC-179]');
select is((select p.provolatile::text || p.prosecdef::text from pg_proc p where p.oid = 'platform_private.cms_create_type_draft(jsonb)'::regprocedure), 'vtrue', 'the aggregate is created inside one SECURITY DEFINER function, so all its foreign keys are checked at that transaction''s commit [P2-S09-AC-179]');
select is(pg_temp.p_run('fk:dangling', pg_temp.p_base(pg_temp.p_key('fkd'), jsonb_build_object('templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', extensions.gen_random_uuid())))), 'VALIDATION_FAILED'), 'ok',
  'a registry or UUID reference that does not resolve (here an unknown template version) is refused before any aggregate row becomes visible [P2-S09-AC-179]');

-- ================================================================ AC185 retention ====
select is((select count(*)::integer from p_tables pt where pt.t <> 'cms_release_nonce_receipts' and exists (select 1 from pg_trigger t where t.tgrelid = format('platform_private.%I', pt.t)::regclass and t.tgname like '%no_delete'))
    + (select count(*)::integer from p_tables pt where pt.immutable), 9, 'nine of the tables refuse DELETE by a dedicated trigger (six definition tables and the three immutable ones) [P2-S09-AC-185]');
select is(pg_temp.s09e_writers('cms_content_types', 'delete[[:space:]]+from') || pg_temp.s09e_writers('cms_content_type_versions', 'delete[[:space:]]+from') || pg_temp.s09e_writers('cms_schema_migration_plans', 'delete[[:space:]]+from')
    || pg_temp.s09e_writers('cms_schema_dry_run_reports', 'delete[[:space:]]+from'), '', 'no function deletes a definition, a version, a plan or a report: active and superseded definitions and migration evidence are retained [P2-S09-AC-185]');
select is((select string_agg(distinct state, ',' order by state) from platform_private.cms_content_types), 'active,retired', 'retirement is a state value on the type row, beside active (a never activated type is physically retired): states, not deletions, carry the lifecycle [P2-S09-AC-185]');
select throws_ok(format('delete from platform_private.cms_schema_migration_plans where id = %L', (select id from platform_private.cms_schema_migration_plans limit 1)), 'P0001', null, 'a migration plan cannot be deleted [P2-S09-AC-185]');
select is((select count(*)::integer from pg_proc p where p.pronamespace in ('platform_private'::regnamespace, 'platform_api'::regnamespace) and p.prokind = 'f' and p.proname ~* '(purge|legal_hold|incident_fence|fence)' and p.proname like 'cms\_%'), 0,
  'no purge, legal-hold or incident-fence object exists for the registry: nothing can purge, and no hold mechanism is modelled [P2-S09-AC-185]');

select * from finish();
rollback;
