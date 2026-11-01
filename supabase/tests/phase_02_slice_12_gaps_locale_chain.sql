-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-233 clause 4 (BE03a OD-4 / CMS-03C-04): after a SUCCESSOR content-type version
-- changes the fallback chain of a locale, authoring against the new active version applies the NEW chain (accepted) and refuses the
-- OLD chain with 409 VERSION_MISMATCH carrying { reasonCode: FALLBACK_CHAIN_MISMATCH, activeFallbackChain: <new chain> }.  The existing
-- enforcement suite runs against one active version.  World: the real 03a chain (create, dry run, seal, review, activate; then a
-- real successor), the real public cms_create_entry (the s12edt_* driver copied verbatim from the entry-default suite) and the real
-- cms_author_locale_variant under the real service_role.  The one non-reusable step is the type draft: s09d_create_type fixes the title
-- field to localization `none`, so the localized-title draft below is a copy of that producer call with localizationMode `localized`.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.template_designer'), 'OK', 'setup: real owner template-designer grant [P2-S12-AC-233]');
select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.author'), 'OK', 'setup: real owner entry-author grant [P2-S12-AC-233]');
create or replace function pg_temp.g2c_create_type(p_tag text, p_type_key text, p_supported jsonb, p_chains jsonb) returns jsonb language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':create', 'platform_api.cms_create_type_draft', 'owner',
    jsonb_build_object(
      'typeKey', p_type_key, 'label', 'gap ' || p_type_key, 'ownerCapability', 'cms.schema_designer', 'sourceLocale', 'en-US',
      'defaultLocale', 'en-US', 'supportedLocales', p_supported, 'fallbackChains', p_chains,
      'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
      'fields', jsonb_build_array(jsonb_build_object(
        'stableFieldId', extensions.gen_random_uuid(), 'key', 'title', 'kind', 'short_text',
        'constraints', '{}'::jsonb, 'required', true, 'validatorKey', null, 'validatorVersion', null,
        'defaultMode', 'none', 'localizationMode', 'localized',
        'editorConfig', jsonb_build_object('label', 'Title', 'order', 0), 'lifecycle', 'active')),
      'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb,
      'idempotencyKey', pg_temp.s09d_idem(p_tag, 'create')));
  perform pg_temp.s09d_remember(p_tag || ':type', (resource->>'contentTypeId')::uuid);
  perform pg_temp.s09d_remember(p_tag || ':version', (resource->>'id')::uuid);
  return resource;
end;
$body$;
-- v1: fr-FR falls back to en-US
select pg_temp.g2c_create_type('lc-base', 's12lcbase', '["en-US","fr-FR"]'::jsonb, '{"fr-FR":["en-US"]}'::jsonb);
select pg_temp.s09d_to_active('lc-base');
select is(pg_temp.s09d_outcome('lc-base:activate'), 'OK', 'setup: the v1 type (fr-FR chain [en-US]) is really created, reviewed and activated [P2-S12-AC-233]');
select is(pg_temp.s12ga_grant('rev1', 'cms.reviewer'), 'OK', 'setup: independent reviewer grant [P2-S12-AC-233]');
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';
-- v2: a REAL successor whose fr-FR chain is [de-DE, en-US]
select pg_temp.s09d_successor('lc-v2', 'lc-base', p_supported => '["de-DE","en-US","fr-FR"]'::jsonb,
  p_chains => '{"de-DE":["en-US"],"fr-FR":["de-DE","en-US"]}'::jsonb);
-- changing the members of a retained chain is BREAKING (phase_02_slice_09_od4_locale_config.sql): the dry run needs the registered
-- identity.revalidate transform pair, and the worker seal carries the plan's transform pair (a copy of s09d_seal with that one change)
create or replace function pg_temp.g2c_seal(p_tag text) returns void language plpgsql as $body$
declare
  plan_id uuid := pg_temp.s09d_id(p_tag || ':plan'); plan_json jsonb; claim jsonb; base jsonb;
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  plan_json := pg_temp.s09d_call(p_tag || ':plan.get', 'platform_api.cms_get_schema_migration_plan',
    jsonb_build_object('migrationPlanId', plan_id, 'schemaVersionId', pg_temp.s09d_id(p_tag || ':version'),
      'expectedVersion', pg_temp.s09d_read('cms_schema_migration_plans', 'version', plan_id)));
  base := jsonb_build_object('migrationPlanId', plan_id, 'schemaVersionId', pg_temp.s09d_id(p_tag || ':version'),
    'cursor', '0', 'transformKey', plan_json->'transformKey', 'transformVersion', plan_json->'transformVersion',
    'compilerHash', plan_json->'compilerHash', 'sourceHash', plan_json->'sourceHash', 'targetHash', plan_json->'targetHash');
  claim := pg_temp.s09d_call(p_tag || ':plan.claim', 'platform_api.cms_claim_schema_migration_lease',
    base || jsonb_build_object('expectedVersion', pg_temp.s09d_read('cms_schema_migration_plans', 'version', plan_id),
      'leaseOwner', 's09d-worker', 'workerId', 's09d-worker', 'leaseDurationMs', '30000', 'now', clock_timestamp()::text));
  perform pg_temp.s09d_call(p_tag || ':plan.batch', 'platform_api.cms_process_schema_migration_dry_run_batch',
    base || jsonb_build_object('expectedVersion', pg_temp.s09d_read('cms_schema_migration_plans', 'version', plan_id),
      'limit', '1', 'leaseToken', claim->>'leaseToken', 'rowEvidence', '[]'::jsonb,
      'correlationId', extensions.gen_random_uuid(), 'causationId', null));
  perform pg_temp.s09d_call(p_tag || ':plan.seal', 'platform_api.cms_finalize_schema_migration_dry_run',
    (base - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09d_read('cms_schema_migration_plans', 'version', plan_id),
      'sourceCount', '0', 'targetCount', '0', 'rowErrorCount', '0'));
end;
$body$;
select pg_temp.s09d_dry_run('lc-v2', 'owner', 'identity.revalidate', '1');
select pg_temp.g2c_seal('lc-v2');
select pg_temp.s09d_submit('lc-v2');
select pg_temp.s09d_assign('lc-v2', 'rev3');
select pg_temp.s09d_decide('lc-v2', 'rev3');
select pg_temp.s09d_activate('lc-v2');
select ok(pg_temp.s09d_outcome('lc-v2:successor') = 'OK' and pg_temp.s09d_outcome('lc-v2:activate') = 'OK'
    and (select v.state = 'active' and v.fallback_chains -> 'fr-FR' = '["de-DE","en-US"]'::jsonb
      from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('lc-v2:version'))
    and (select v.state = 'superseded' and v.fallback_chains -> 'fr-FR' = '["en-US"]'::jsonb
      from platform_private.cms_content_type_versions v where v.id = pg_temp.s09d_id('lc-base:version')),
  'setup: the successor is active with the NEW fr-FR chain [de-DE, en-US] and v1 (chain [en-US]) is superseded [P2-S12-AC-233]');

\ir phase_02_slice_12_gaps_entry/005-edt-driver.sqlinc
select * from pg_temp.s12edt_check('lc-v2', 'Titre source', null::uuid, null::jsonb);

create temp table g2c_out(label text primary key, state text, message text, detail text, response jsonb) on commit drop;
create function pg_temp.g2c_author(p_label text, p_chain jsonb, p_key text) returns void language plpgsql security invoker as $body$
declare
  entry_id uuid := (select (response->'entry'->>'id')::uuid from s12edt_out where label = 'lc-v2');
  rev platform_private.cms_entry_revisions%rowtype;
  field_id uuid;
  request jsonb; answer jsonb; code text := '00000'; msg text; det text; prior_role text := current_setting('role');
begin
  select * into rev from platform_private.cms_entry_revisions where id = (select (response->'revision'->>'id')::uuid from s12edt_out where label = 'lc-v2');
  select stable_field_id into field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = rev.schema_version_id and field_key = 'title';
  perform pg_temp.s09d_session('owner', 'service_role');
  request := jsonb_build_object('entryId', entry_id, 'locale', 'fr-FR', 'sourceRevisionId', rev.id, 'sourceHash', btrim(rev.payload_hash::text),
    'fields', jsonb_build_array(jsonb_build_object('fieldId', field_id, 'value', 'Titre traduit')),
    'fallbackChain', p_chain, 'noFallbackFieldIds', '[]'::jsonb,
    'expectedVersion', (select version::text from platform_private.cms_content_entries where id = entry_id),
    'ifMatch', (select version::text from platform_private.cms_content_entries where id = entry_id),
    'idempotencyKey', p_key, 'context', pg_temp.s09d_context('owner', true));
  begin
    set local role service_role;
    begin
      answer := platform_api.cms_author_locale_variant(request);
    exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text, det = pg_exception_detail;
    end;
    perform set_config('role', prior_role, true);
  exception when others then perform set_config('role', prior_role, true); raise;
  end;
  insert into g2c_out values (p_label, code, msg, det, answer);
end;
$body$;
create temp table g2c_before on commit drop as
select (select count(*) from platform_private.cms_locale_variants) as variants, (select count(*) from platform_private.cms_entry_revisions) as revisions;

-- the OLD chain (v1''s [en-US]) is refused against the new active version, with the NEW chain in the detail
select pg_temp.g2c_author('old-chain', '["en-US"]'::jsonb, 'g2c-old-key-0001');
select is((select state || ':' || message from g2c_out where label = 'old-chain'), 'P0001:VERSION_MISMATCH',
  'authoring with the superseded version''s chain [en-US] is refused as a 409 version conflict [P2-S12-AC-233]');
select is((select detail::jsonb from g2c_out where label = 'old-chain'),
  '{"reasonCode":"FALLBACK_CHAIN_MISMATCH","activeFallbackChain":["de-DE","en-US"]}'::jsonb,
  'the conflict carries FALLBACK_CHAIN_MISMATCH and the NEW active chain [de-DE, en-US] [P2-S12-AC-233]');
select ok((select variants = (select count(*) from platform_private.cms_locale_variants) and revisions = (select count(*) from platform_private.cms_entry_revisions) from g2c_before),
  'the refused authoring wrote no variant and no revision [P2-S12-AC-233]');
-- the NEW chain is accepted
select pg_temp.g2c_author('new-chain', '["de-DE","en-US"]'::jsonb, 'g2c-new-key-0001');
select is((select state from g2c_out where label = 'new-chain'), '00000',
  'authoring with the new active chain [de-DE, en-US] is accepted [P2-S12-AC-233]');
select is((select count(*)::integer from platform_private.cms_locale_variants
      where entry_id = (select (response->'entry'->>'id')::uuid from s12edt_out where label = 'lc-v2') and locale = 'fr-FR'), 1,
  'the variant authored under the new chain is committed [P2-S12-AC-233]');

select * from finish();
rollback;
