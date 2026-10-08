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
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc
\ir phase_02_slice_09_dec108/06-trigger-probes.sqlinc

-- Slice 09 (AC-215), second producer-row state: the entry, revision, field-value and locale-variant
-- tables, which the schema entrypoint's fixture leaves empty, plus a real capability binding.  The
-- generic guards are proved behaviorally on every table with a row here (same isolation as
-- phase_02_slice_09_schema/012-trigger-catalog.sqlinc).

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
create or replace function pg_temp.s09v_localized_field(p_tag text) returns jsonb language plpgsql as $body$
begin
  return pg_temp.s09d_rpc(p_tag || ':headline', 'platform_api.cms_add_field_definition', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'),
      'versionId', pg_temp.s09d_id(p_tag || ':version'),
      'field', jsonb_build_object('key', 'headline', 'kind', 'short_text', 'constraints', '{}'::jsonb,
        'required', false, 'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none',
        'localizationMode', 'localized',
        'editorConfig', jsonb_build_object('label', 'Headline', 'order', 2), 'lifecycle', 'active'),
      'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag),
      'idempotencyKey', pg_temp.s09d_idem(p_tag, 'add-headline')));
end;
$body$;
create or replace function pg_temp.s09v_variant(
  p_label text, p_tag text, p_entry text, p_locale text, p_chain jsonb
) returns jsonb language plpgsql as $body$
declare
  entry_id uuid := (pg_temp.s09d_resp(p_entry)->'entry'->>'id')::uuid;
  source_revision uuid := (pg_temp.s09d_resp(p_entry)->'revision'->>'id')::uuid;
  entry_version text;
  title_field uuid;
begin
  select version::text into entry_version from platform_private.cms_content_entries where id = entry_id;
  select stable_field_id into title_field from platform_private.cms_field_definition_versions
   where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = 'headline';
  return pg_temp.s09d_rpc(p_label, 'platform_api.cms_author_locale_variant', 'owner', jsonb_build_object(
    'entryId', entry_id, 'locale', p_locale, 'sourceRevisionId', source_revision,
    'sourceHash', (select btrim(payload_hash::text) from platform_private.cms_entry_revisions where id = source_revision),
    'fields', jsonb_build_array(jsonb_build_object('fieldId', title_field, 'value', 'Titre ' || p_locale)),
    'fallbackChain', p_chain, 'noFallbackFieldIds', '[]'::jsonb,
    'expectedVersion', entry_version, 'ifMatch', entry_version,
    'idempotencyKey', pg_temp.s09d_idem(p_tag, 'variant-' || p_label)));
end;
$body$;
create or replace function pg_temp.s09v_variant_id(p_entry text, p_locale text) returns uuid language sql stable as $body$
  select id from platform_private.cms_locale_variants
   where entry_id = (pg_temp.s09d_resp(p_entry)->'entry'->>'id')::uuid and locale = p_locale $body$;
create or replace function pg_temp.s09v_state(p_tag text, p_column text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_migration_plans', p_column, pg_temp.s09d_id(p_tag || ':plan')) $body$;

-- ---- scenario 1: a removed locale ------------------------------------------------
select pg_temp.s09d_create_type('l', 'localevariants', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09v_localized_field('l');
select pg_temp.s09d_to_active('l');
select pg_temp.s09w_entry('l1', 'l', 'Alpha');
select pg_temp.s09v_variant('v1', 'l', 'l1', 'fr-FR', '["en-US"]');
select pg_temp.s09v_variant('v2', 'l', 'l1', 'pt-BR', '["fr-FR","en-US"]');
select is(pg_temp.s09d_outcome('l1') || pg_temp.s09d_outcome('v1') || pg_temp.s09d_outcome('v2'), 'OKOKOK',
  'fixture: a real entry with a fr-FR and a pt-BR locale variant authored through CMS-03C-04');
select is((select count(*)::integer from platform_private.cms_locale_variants
            where entry_id = (pg_temp.s09d_resp('l1')->'entry'->>'id')::uuid), 2, 'fixture: two stored locale variants');
select pg_temp.s09d_successor('m', 'l', 'owner', null, '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_dry_run('m', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('m:dryRun'), 'OK', 'CMS-03A-10 admits the removed-locale plan with a registered pair');
select is(pg_temp.s09v_state('m', 'classification'), 'breaking', 'removing pt-BR is classified breaking [P2-S09-AC-1197]');
select is(pg_temp.s09v_state('m', 'source_count'), '4',
  'the plan counts the three entry revisions (en-US, fr-FR, pt-BR) AND the one affected pt-BR locale variant [P2-S09-AC-1197]');
select pg_temp.s09w_claim('m');
select pg_temp.s09w_read('m', 'm:read');
select ok((select jsonb_array_length(r->'rows') = 4 and (r->>'done')::boolean
    from (select pg_temp.s09d_resp('m:read') r) s),
  'the worker read serves all four source rows in one page [P2-S09-AC-1197]');
select is((select string_agg(distinct row->>'sourceTable', ',' order by row->>'sourceTable')
    from jsonb_array_elements(pg_temp.s09d_resp('m:read')->'rows') row),
  'cms_entry_revisions,cms_locale_variants', 'the rows come from entry revisions and locale variants [P2-S09-AC-1197]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.s09d_resp('m:read')->'rows') row
    where row->>'sourceTable' = 'cms_locale_variants' and (row->>'sourceRowId')::uuid = pg_temp.s09v_variant_id('l1', 'pt-BR')), 1,
  'the locale variant row is exactly the removed locale''s variant; the retained fr-FR variant is not in the scan [P2-S09-AC-1197]');
select ok((select bool_and(row->>'sourceHash' ~ '^[a-f0-9]{64}$' and jsonb_typeof(row->'document') = 'object')
    from jsonb_array_elements(pg_temp.s09d_resp('m:read')->'rows') row),
  'every row, variant rows included, carries a database-computed source hash and document [P2-S09-AC-1197]');
create temp table s09v_carry on commit drop as
select pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('m:read')) as evidence;
select pg_temp.s09w_batch('m', 'm:scan', (select evidence from s09v_carry), true);
select ok((select r->>'targetCount' = '4' and r->>'rowErrorCount' = '0' and r->>'cursor' = '4'
    from (select pg_temp.s09d_resp('m:scan') r) s),
  'the database accepts and counts four rows of carry evidence [P2-S09-AC-1197]');
select pg_temp.s09d_call('m:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('m') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('m'),
    'cursor', pg_temp.s09w_plan_cursor('m'), 'sourceCount', '4', 'targetCount', '4', 'rowErrorCount', '0'));
select is(pg_temp.s09v_state('m', 'state'), 'ready', 'the plan seals ready over four rows [P2-S09-AC-1197]');
select ok((select source_count = 4 and target_count = 4 and row_error_count = 0
    from platform_private.cms_schema_dry_run_reports where id = pg_temp.s09d_id('m:dryRun')),
  'the sealed report counts include the locale variant row [P2-S09-AC-1197]');
select pg_temp.s09d_submit('m');
select pg_temp.s09d_assign('m', 'rev1');
select pg_temp.s09d_decide('m', 'rev1');
select pg_temp.s09w_backfill('m');
select is(pg_temp.s09d_outcome('m:w.complete'), 'OK', 'the worker backfills, verifies and completes the plan over the variant rows');
select ok((select count(*) = 4 and count(*) filter (where source_table = 'cms_locale_variants') = 1
    from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('m:plan')),
  'the database wrote four target rows, one of them for the locale variant [P2-S09-AC-1197]');
select pg_temp.s09d_activate('m');
select is(pg_temp.s09d_outcome('m:activate'), 'OK', 'the removed-locale successor activates after the variant rows were scanned');


select pg_temp.s09d_rpc('cb:create', 'platform_api.cms_create_type_draft', 'owner',
  jsonb_build_object('typeKey', 'tc_capbind', 'label', 'Capability binding', 'ownerCapability', 'cms.schema_designer',
    'sourceLocale', 'en-US', 'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
    'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null, 'fields', '[]'::jsonb,
    'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb,
    'capabilityBindings', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.schema_designer', 'capabilityVersion', '1')),
    'idempotencyKey', 's09t-capbind-0001'));
select is(pg_temp.s09d_outcome('cb:create'), 'OK', 'fixture: a draft type with a real protected capability binding');
select is((select count(*)::integer from platform_private.cms_locale_variants), 2, 'fixture: two real locale variants');
select is((select count(*)::integer from platform_private.cms_entry_revisions), 3, 'fixture: three real entry revisions (source plus two variants)');

select pg_temp.s09t_run_generic();
select diag(table_name || ' ' || trigger_name || ' ' || event || ' => ' || outcome) from s09t_generic
 where outcome <> 'EMPTY' and outcome <> expected order by 1;
select ok(outcome = expected, trigger_name || ' refuses ' || upper(event) || ' with ' || expected || ' (' || outcome || ') [P2-S09-AC-215]')
  from s09t_generic where outcome <> 'EMPTY' and table_name in ('cms_content_entries', 'cms_entry_assignments', 'cms_entry_field_values',
    'cms_entry_revisions', 'cms_locale_variants', 'cms_content_type_capability_bindings') order by table_name, trigger_name, event;
select is((select count(distinct table_name)::integer from s09t_generic where outcome <> 'EMPTY' and table_name in
    ('cms_content_entries', 'cms_entry_assignments', 'cms_entry_field_values', 'cms_entry_revisions', 'cms_locale_variants',
     'cms_content_type_capability_bindings')), 6,
  'the entry, assignment, field-value, revision, locale-variant and capability-binding tables all held rows and were proved [P2-S09-AC-215]');
select is((select string_agg(distinct table_name, ',' order by table_name) from s09t_generic where outcome = 'EMPTY'),
  'cms_block_definition_lifecycle_events,cms_block_definition_versions,cms_composition_instances,cms_conflict_records,cms_content_type_template_bindings,cms_edit_presence,cms_editorial_decisions,cms_editorial_reviews,cms_entry_relations,cms_pattern_versions,cms_preview_tokens,cms_publication_schedules,cms_publication_versions,cms_related_content_rules,cms_relation_definitions,cms_release_nonce_receipts,cms_restore_chain_manifests,cms_taxonomy_versions,cms_term_assignments,cms_term_labels,cms_terms',
  'the tables empty in this state are exactly the listed ones, proved in the schema entrypoint or owned by Slice 10-16 producers [P2-S09-AC-215]');

select is(pg_temp.s09t_probe_stmt('cms_content_type_capability_bindings', 'cms_content_type_capability_bindings_no_delete', true,
    'delete from platform_private.cms_content_type_capability_bindings'), 'IMMUTABLE_RECORD',
  'cms_content_type_capability_bindings_no_delete alone refuses the DELETE of a real capability binding [P2-S09-AC-215]');

select * from finish();
rollback;
