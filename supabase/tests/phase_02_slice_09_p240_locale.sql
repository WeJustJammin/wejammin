commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criterion AC005, database half (lane p240-db): sourceLocale is
-- the canonical authoring locale, defaultLocale the governed delivery fallback root, and
-- a no_fallback field never borrows it.  The locale configuration is exercised through
-- CMS-03A-01 and CMS-03A-09, the entry locale set through CMS-03B-10, and the fallback
-- chain and no_fallback declaration through CMS-03C-04; delivery of a missing value is a
-- CMS-15 concern outside this shard (BE03a OD-4) and is not claimed here.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc

select pg_temp.s09d_grant_specialist('owner', 'cms.author');
select pg_temp.s09d_grant_specialist('owner', 'cms.editor');

-- =============================================== the configuration at creation ====
create or replace function pg_temp.p_locales(p_key text, p_over jsonb) returns jsonb language sql as $body$ select pg_temp.p_base(p_key, p_over) $body$;
select is(pg_temp.p_run('c:ok', pg_temp.p_locales('p240_loc_ok', '{"sourceLocale":"en-US","defaultLocale":"fr-FR","supportedLocales":["en-US","fr-FR","pt-BR"],"fallbackChains":{"en-US":["fr-FR"],"pt-BR":["fr-FR"]}}'), 'OK'), 'ok',
  'control: a source locale and a different default locale, both supported, with every non-default locale chained to the default root, is accepted [P2-S09-AC-005]');
select ok((select v.source_locale = 'en-US' and v.default_locale = 'fr-FR' and v.supported_locales = '["en-US","fr-FR","pt-BR"]'::jsonb and v.fallback_chains = '{"en-US":["fr-FR"],"pt-BR":["fr-FR"]}'::jsonb
    from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_loc_ok'),
  'the version stores the two roles separately: sourceLocale en-US as the authoring locale and defaultLocale fr-FR as the fallback root [P2-S09-AC-005]');
select is(pg_temp.p_run('c:' || c.n, pg_temp.p_locales(pg_temp.p_key('loc' || c.n), c.o), 'VALIDATION_FAILED'), 'ok', 'a configuration ' || c.n || ' is refused and nothing is committed [P2-S09-AC-005]')
from (values
  ('whose supported set omits the source locale', '{"sourceLocale":"en-US","defaultLocale":"fr-FR","supportedLocales":["fr-FR"],"fallbackChains":{}}'::jsonb),
  ('whose supported set omits the default locale', '{"sourceLocale":"en-US","defaultLocale":"fr-FR","supportedLocales":["en-US"],"fallbackChains":{"en-US":["fr-FR"]}}'),
  ('whose chain does not end at the default root', '{"sourceLocale":"en-US","defaultLocale":"en-US","supportedLocales":["en-US","fr-FR","pt-BR"],"fallbackChains":{"fr-FR":["pt-BR"],"pt-BR":["en-US"]}}'),
  ('that gives the default locale its own chain', '{"sourceLocale":"en-US","defaultLocale":"en-US","supportedLocales":["en-US","fr-FR"],"fallbackChains":{"fr-FR":["en-US"],"en-US":["fr-FR"]}}'),
  ('that omits the chain of a non-default locale', '{"sourceLocale":"en-US","defaultLocale":"en-US","supportedLocales":["en-US","fr-FR"],"fallbackChains":{}}'),
  ('with a chain that loops', '{"sourceLocale":"en-US","defaultLocale":"en-US","supportedLocales":["en-US","fr-FR","pt-BR"],"fallbackChains":{"fr-FR":["pt-BR","en-US"],"pt-BR":["fr-FR","en-US"]}}'),
  ('with a non-canonical locale tag', '{"sourceLocale":"en-us","defaultLocale":"en-us","supportedLocales":["en-us"],"fallbackChains":{}}')) c(n, o);

-- ============================ a successor can never remove the source or default locale ====
select pg_temp.s09d_create_type('l', 'p240_loc_succ', 'editorial', 'owner', '["en-US","fr-FR"]'::jsonb, '{"fr-FR":["en-US"]}'::jsonb, 'en-US', 'en-US');
select pg_temp.s09d_to_active('l');
create or replace function pg_temp.p_succ(p_label text, p_supported jsonb, p_chains jsonb) returns text language plpgsql as $body$
declare before_rows text := (select count(*)::text from platform_private.cms_content_type_versions);
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_schema_successor', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('l:type'), 'versionId', pg_temp.s09d_id('l:version'),
    'expectedVersion', pg_temp.s09d_version('l'), 'supportedLocales', p_supported, 'fallbackChains', p_chains, 'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return pg_temp.s09d_outcome(p_label) || ' ' || (before_rows = (select count(*)::text from platform_private.cms_content_type_versions))::text;
end;
$body$;
select is(pg_temp.p_succ('s:nosource', '["fr-FR"]'::jsonb, '{}'::jsonb), 'VALIDATION_FAILED true', 'a successor whose supported set drops the inherited sourceLocale is refused and no draft appears [P2-S09-AC-005]');
select is(pg_temp.p_succ('s:nodefault', '["en-US","fr-FR"]'::jsonb, '{"en-US":["fr-FR"],"fr-FR":["en-US"]}'::jsonb), 'VALIDATION_FAILED true', 'a successor that moves the default root (the chain of the inherited default) is refused [P2-S09-AC-005]');
select is(pg_temp.p_succ('s:half', '["en-US","fr-FR"]'::jsonb, null), 'VALIDATION_FAILED true', 'a successor that names a supported set without chains is refused [P2-S09-AC-005]');
select is(pg_temp.p_succ('s:clone', null, null), 'OK false', 'control: a clone inherits the source configuration unchanged [P2-S09-AC-005]');
select ok((select n.source_locale = o.source_locale and n.default_locale = o.default_locale and n.locale_config_hash = o.locale_config_hash from platform_private.cms_content_type_versions n, platform_private.cms_content_type_versions o
    where n.supersedes_id = o.id and o.id = pg_temp.s09d_id('l:version')), 'the clone carries the same source locale, default locale and configuration hash [P2-S09-AC-005]');

-- ====================================================== the entry locale set (CMS-03B-10) ====
select pg_temp.s09w_entry('ok', 'l', 'Alpha');
select is(pg_temp.s09d_outcome('ok'), 'OK', 'control: an entry in the authoring locale en-US is created [P2-S09-AC-005]');
create or replace function pg_temp.p_entry_in(p_label text, p_locale text) returns text language plpgsql as $body$
declare before_rows text := (select count(*)::text from platform_private.cms_content_entries) || '|' || (select count(*)::text from platform_private.cms_entry_revisions);
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_entry', 'owner', pg_temp.s09w_entry_request(p_label, 'l', 'Beta ' || p_locale) || jsonb_build_object('locale', p_locale));
  return pg_temp.s09d_outcome(p_label) || ' ' || (before_rows = (select count(*)::text from platform_private.cms_content_entries) || '|' || (select count(*)::text from platform_private.cms_entry_revisions))::text;
end;
$body$;
select is(pg_temp.p_entry_in('en:fr', 'fr-FR'), 'OK false', 'an entry in another supported locale is accepted [P2-S09-AC-005]');
select is(pg_temp.p_entry_in('en:de', 'de-DE'), 'VALIDATION_FAILED true', 'an entry in a locale the active version does not support is 422 and creates no entry or revision [P2-S09-AC-005]');
select is(pg_temp.p_entry_in('en:case', 'EN-us'), 'VALIDATION_FAILED true', 'a non-canonical spelling of a supported locale is not a member either [P2-S09-AC-005]');
select is((select string_agg(distinct r.locale, ',' order by r.locale) from platform_private.cms_entry_revisions r), 'en-US,fr-FR', 'only supported locales exist as revision locales [P2-S09-AC-005]');

-- ===================================== chain and no_fallback at authoring time (CMS-03C-04) ====
select pg_temp.s09d_create_type('nf', 'p240_loc_nf', 'editorial', 'owner', '["en-US","fr-FR","pt-BR"]'::jsonb, '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}'::jsonb, 'en-US', 'en-US');
select pg_temp.s09d_rpc('nf:headline', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('nf:type'), 'versionId', pg_temp.s09d_id('nf:version'),
  'field', pg_temp.p_field('headline', 'short_text', '{"localizationMode":"localized"}') - 'stableFieldId', 'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('nf'), 'idempotencyKey', 'p240-loc-headline-0001'));
select pg_temp.s09d_rpc('nf:legal', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('nf:type'), 'versionId', pg_temp.s09d_id('nf:version'),
  'field', pg_temp.p_field('legal_text', 'short_text', '{"localizationMode":"no_fallback"}') - 'stableFieldId', 'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('nf'), 'idempotencyKey', 'p240-loc-legal-0001'));
select pg_temp.s09d_to_active('nf');
select pg_temp.s09w_entry('nfe', 'nf', 'Alpha');
create temp table p_ids on commit drop as select
  (select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('nf:version') and field_key = 'headline') as headline,
  (select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('nf:version') and field_key = 'legal_text') as legal,
  (pg_temp.s09d_resp('nfe')->'entry'->>'id')::uuid as entry_id, (pg_temp.s09d_resp('nfe')->'revision'->>'id')::uuid as revision_id;
create or replace function pg_temp.p_variant(p_label text, p_locale text, p_chain jsonb, p_no_fallback jsonb, p_fields jsonb default null) returns text language plpgsql as $body$
declare entry_version text; before_rows text := (select count(*)::text from platform_private.cms_locale_variants);
begin
  select version::text into entry_version from platform_private.cms_content_entries where id = (select entry_id from p_ids);
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_author_locale_variant', 'owner', jsonb_build_object('entryId', (select entry_id from p_ids), 'locale', p_locale, 'sourceRevisionId', (select revision_id from p_ids),
    'sourceHash', (select btrim(payload_hash::text) from platform_private.cms_entry_revisions where id = (select revision_id from p_ids)),
    'fields', coalesce(p_fields, jsonb_build_array(jsonb_build_object('fieldId', (select headline from p_ids), 'value', 'Titre ' || p_locale))), 'fallbackChain', p_chain, 'noFallbackFieldIds', p_no_fallback,
    'expectedVersion', entry_version, 'ifMatch', entry_version, 'idempotencyKey', 'p240-var-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return pg_temp.s09d_outcome(p_label) || ' ' || (before_rows = (select count(*)::text from platform_private.cms_locale_variants))::text;
end;
$body$;
select is(pg_temp.p_variant('v:nonf', 'fr-FR', '["en-US"]'::jsonb, '[]'::jsonb), 'VALIDATION_FAILED true', 'a variant that does not declare the type''s no_fallback field is refused and writes nothing: a no_fallback field is never silently left to fall back [P2-S09-AC-005]');
select is(pg_temp.p_variant('v:unknown', 'fr-FR', '["en-US"]'::jsonb, jsonb_build_array((select legal from p_ids), extensions.gen_random_uuid())), 'VALIDATION_FAILED true', 'declaring a field the active version does not define as no_fallback is refused [P2-S09-AC-005]');
select is(pg_temp.p_variant('v:chain', 'fr-FR', '["pt-BR"]'::jsonb, jsonb_build_array((select legal from p_ids))), 'VERSION_MISMATCH true', 'a chain other than the active one (which ends at the default root) is refused [P2-S09-AC-005]');
select is(pg_temp.p_variant('v:ok', 'fr-FR', '["en-US"]'::jsonb, jsonb_build_array((select legal from p_ids))), 'OK false', 'control: the exact active chain with the declared no_fallback field authors the variant [P2-S09-AC-005]');
select ok((select v.no_fallback_field_ids = jsonb_build_array((select legal::text from p_ids)) and v.fallback_chain = '["en-US"]'::jsonb from platform_private.cms_locale_variants v where v.entry_id = (select entry_id from p_ids) and v.locale = 'fr-FR' order by v.created_at desc limit 1),
  'the variant stores its no_fallback field set and the chain that ends at the default root [P2-S09-AC-005]');
select is((select count(*)::integer from platform_private.cms_entry_field_values fv join platform_private.cms_entry_revisions r on r.id = fv.revision_id where r.entry_id = (select entry_id from p_ids) and fv.locale = 'fr-FR' and fv.field_id = (select legal from p_ids)), 0,
  'no value of the no_fallback field was copied from the default locale into the variant: the field does not borrow the root [P2-S09-AC-005]');
select is((select count(*)::integer from platform_private.cms_entry_field_values fv join platform_private.cms_entry_revisions r on r.id = fv.revision_id where r.entry_id = (select entry_id from p_ids) and fv.locale = 'fr-FR' and fv.field_id = (select headline from p_ids)), 1,
  'while the localized field carries exactly the authored target-locale value [P2-S09-AC-005]');
select is(pg_temp.p_variant('v:unsupported', 'de-DE', '["en-US"]'::jsonb, jsonb_build_array((select legal from p_ids))), 'VALIDATION_FAILED true', 'a target locale outside the supported set is refused [P2-S09-AC-005]');

select * from finish();
rollback;
