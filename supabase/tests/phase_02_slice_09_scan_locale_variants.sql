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

-- Slice 09 DEC-108 (BE03a "Locale variant source rows", P2-S09-AC-1197): a
-- breaking locale-configuration change scans the affected cms_locale_variants
-- rows (the variants of a removed locale and the variants whose retained
-- fallback chain changes) through the real worker protocol, in addition to the
-- entry revisions bound to the source version, so the plan's source/target
-- counts and the sealed counts include locale variant rows.  Every producer row
-- is written by a named RPC; variants are authored through CMS-03C-04.

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

-- ---- scenario 2: a retained locale's chain changes --------------------------------
select pg_temp.s09d_create_type('n', 'localevariantschain', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09v_localized_field('n');
select pg_temp.s09d_to_active('n');
select pg_temp.s09w_entry('n1', 'n', 'Alpha');
select pg_temp.s09v_variant('w1', 'n', 'n1', 'fr-FR', '["en-US"]');
select pg_temp.s09v_variant('w2', 'n', 'n1', 'pt-BR', '["fr-FR","en-US"]');
select pg_temp.s09d_successor('o', 'n', 'owner', null, '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["en-US"]}');
select pg_temp.s09d_dry_run('o', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09v_state('o', 'classification'), 'breaking', 'changing the members of pt-BR''s chain is classified breaking [P2-S09-AC-1197]');
select is(pg_temp.s09v_state('o', 'source_count'), '4',
  'only the variant whose retained chain changed (pt-BR) joins the three entry revisions [P2-S09-AC-1197]');
select pg_temp.s09w_claim('o');
select pg_temp.s09w_read('o', 'o:read');
select is((select string_agg(row->>'sourceRowId', ',') from jsonb_array_elements(pg_temp.s09d_resp('o:read')->'rows') row
    where row->>'sourceTable' = 'cms_locale_variants'), pg_temp.s09v_variant_id('n1', 'pt-BR')::text,
  'the scanned variant is the pt-BR variant, not the unchanged fr-FR one [P2-S09-AC-1197]');

-- ---- scenario 3: an additive locale change scans no variant -----------------------
select pg_temp.s09d_create_type('p', 'localevariantsadd', 'editorial', 'owner',
  '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09v_localized_field('p');
select pg_temp.s09d_to_active('p');
select pg_temp.s09w_entry('p1', 'p', 'Alpha');
select pg_temp.s09v_variant('x1', 'p', 'p1', 'fr-FR', '["en-US"]');
select pg_temp.s09d_successor('q', 'p', 'owner', null, '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["en-US"]}');
-- definer helper called outside a command: it reads the forced tables under the RPC context, as a command does
select set_config('app.cms_rpc', 'true', true);
select ok((select count(*) = 0 from platform_private.cms_migration_live_rows(
    pg_temp.s09d_id('p:version'), pg_temp.s09d_id('q:version')) where source_table = 'cms_locale_variants'),
  'adding a supported locale affects no stored variant: the additive successor scans no variant row [P2-S09-AC-1197]');
select set_config('app.cms_rpc', '', true);
-- definer helper called outside a command: it reads the forced tables under the RPC context, as a command does
select set_config('app.cms_rpc', 'true', true);
select ok((select count(*) = 0 from platform_private.cms_migration_live_rows(
    pg_temp.s09d_id('p:version'), null) where source_table = 'cms_locale_variants'),
  'without a target version no variant row is in scope');
select set_config('app.cms_rpc', '', true);
-- definer helper called outside a command: it reads the forced tables under the RPC context, as a command does
select set_config('app.cms_rpc', 'true', true);
select is(platform_private.cms_schema_source_row_count(pg_temp.s09d_id('p:version'), pg_temp.s09d_id('q:version')), 2::bigint,
  'the additive source count is the two entry revisions only');
select set_config('app.cms_rpc', '', true);

select ok(pg_temp.s09x_via_rpc('cms_schema_dry_run_row_evidence') > 0 and pg_temp.s09x_via_rpc('cms_schema_migration_target_rows') > 0,
  'precondition: evidence and target rows were written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

select * from finish();
rollback;
