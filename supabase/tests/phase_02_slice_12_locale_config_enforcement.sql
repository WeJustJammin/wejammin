commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- BE03a OD-4 / CMS-03C-04: the active schema version's locale configuration is
-- the only authority for locale authoring.  A target locale outside the active
-- version's supportedLocales is a 422 validation failure; a fallbackChain that
-- differs from the active chain of the target is a 409 version conflict whose
-- machine detail carries the reason code and the active chain.  Nothing is
-- written on either refusal.

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s12c_base on commit drop as
select jsonb_build_object(
  'entryId', (select value from s10_ids where key = 'entryId'),
  'locale', 'fr-FR',
  'sourceRevisionId', (select value from s10_ids where key = 'entryRevisionId'),
  'sourceHash', (
    select btrim(payload_hash::text)
    from platform_private.cms_entry_revisions
    where id = (select value::uuid from s10_ids where key = 'entryRevisionId')
  ),
  'fields', jsonb_build_array(jsonb_build_object(
    'fieldId', (select value from s10_ids where key = 'typeFieldId'),
    'value', 'Titre traduit'
  )),
  'fallbackChain', jsonb_build_array('en-US'),
  'noFallbackFieldIds', '[]'::jsonb,
  'expectedVersion', '1', 'ifMatch', '1',
  'idempotencyKey', 'locale-config-0001'
) as request;

create or replace function pg_temp.s12c_try(p_request jsonb) returns text
language plpgsql as $body$
begin
  perform platform_api.cms_author_locale_variant(p_request);
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
create or replace function pg_temp.s12c_detail(p_request jsonb) returns text
language plpgsql as $body$
declare d text;
begin
  perform platform_api.cms_author_locale_variant(p_request);
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end;
$body$;
create temp table s12c_before on commit drop as
select (select count(*) from platform_private.cms_locale_variants) as variants,
       (select count(*) from platform_private.cms_entry_revisions) as revisions,
       (select version from platform_private.cms_content_entries
         where id = (select value::uuid from s10_ids where key = 'entryId')) as entry_version;

select is(pg_temp.s12c_try((select request || '{"locale":"es-ES","idempotencyKey":"locale-config-0002"}'::jsonb from s12c_base)),
  'VALIDATION_FAILED',
  'a locale outside the active version''s supportedLocales is a validation failure (422)');
select is(pg_temp.s12c_try((select request || '{"locale":"de-DE","fallbackChain":["en-US","fr-FR"],"idempotencyKey":"locale-config-0003"}'::jsonb from s12c_base)),
  'VERSION_MISMATCH',
  'a fallbackChain that differs from the active chain is a 409 version conflict');
select is(pg_temp.s12c_detail((select request || '{"locale":"de-DE","fallbackChain":["en-US","fr-FR"],"idempotencyKey":"locale-config-0004"}'::jsonb from s12c_base))::jsonb,
  '{"reasonCode":"FALLBACK_CHAIN_MISMATCH","activeFallbackChain":["en-US"]}'::jsonb,
  'the conflict detail carries the reason code and the active chain');
select is(pg_temp.s12c_try((select request || '{"fallbackChain":[],"idempotencyKey":"locale-config-0005"}'::jsonb from s12c_base)),
  'VERSION_MISMATCH', 'an empty chain for a locale whose active chain is [en-US] is a conflict');
select is(pg_temp.s12c_try((select request || '{"fallbackChain":["fr-FR","en-US"],"locale":"de-DE","idempotencyKey":"locale-config-0006"}'::jsonb from s12c_base)),
  'VERSION_MISMATCH', 'a longer chain than the active one is a conflict');
select ok((select (select count(*) from platform_private.cms_locale_variants) = variants
    and (select count(*) from platform_private.cms_entry_revisions) = revisions
    and (select version from platform_private.cms_content_entries where id = (select value::uuid from s10_ids where key = 'entryId')) = entry_version
    from s12c_before),
  'a refused authoring writes no variant, no revision and does not move the entry version');
select is(pg_temp.s12c_try((select request from s12c_base)), 'OK',
  'the exact active chain and a supported locale author a variant');
select is((select count(*)::integer from platform_private.cms_locale_variants
    where entry_id = (select value::uuid from s10_ids where key = 'entryId') and locale = 'fr-FR'), 1,
  'the accepted variant is committed');

select * from finish();
rollback;
