-- Slice 11 dependency recheck, the event resolver (BE03b "Review invalidation / Dependency
-- recheck"; BE03a / BE03c "Event schemas"; tracker P2-S11-AC-113):
-- platform_api.cms_dependency_recheck_resolve_event and its private twin.  RED before
-- 20261010164100, GREEN after.
--
-- The queue envelope of a source event is identifier-only, so each consumer rereads the
-- committed outbox row and turns the published payload into the dependency index lookup
-- (kind, refId) the recheck job selects by.  The rows below carry the payload shapes the
-- producers write (cms_activate_schema, cms_advance_block_lifecycle, cms_author_locale_variant)
-- and the BE03c table (template, pattern, taxonomy: producers land with Slice 12).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(35);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc

-- A locale variant (fr-FR) of an en-US source revision of one entry, as the manifest suite builds it.
select pg_temp.h11w_revision('locsrc');
select pg_temp.h11w_revision('locsrc2', 'creatorPerson', 'en-US', '[]'::jsonb, 'locsrc', 3);
select pg_temp.h11w_revision('locvar', 'creatorPerson', 'fr-FR', '[]'::jsonb, 'locsrc', 2);
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
) values (
  pg_temp.h11w_uuid('variant'), pg_temp.h11w_org(), 'draft', 1,
  pg_temp.h11w_uuid('locsrc:entry'), pg_temp.h11w_uuid('locvar:revision'),
  pg_temp.h11w_uuid('locsrc:revision'), 'fr-FR', 'en-US',
  (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('locsrc:revision')),
  (select value::uuid from s10_ids where key = 'creatorAuth'));

create or replace function pg_temp.rv_event(
  p_key text, p_type text, p_aggregate text, p_payload jsonb, p_schema_version integer default 1
)
returns uuid
language plpgsql
as $body$
declare
  event_id uuid := ('a1130000-0000-4000-8000-' || substr(md5('rv:' || p_key), 1, 12))::uuid;
begin
  insert into platform_private.outbox_events(
    id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version, correlation_id, payload)
  values (event_id, p_type, p_schema_version, p_aggregate, extensions.gen_random_uuid(), 2,
    'a1130000-0000-4000-8000-0000000000c1', p_payload);
  return event_id;
end;
$body$;

create or replace function pg_temp.rv_resolve(p_event uuid)
returns jsonb
language plpgsql
as $body$
begin
  return platform_private.cms_dependency_recheck_event_ref(p_event);
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

create or replace function pg_temp.rv_resolve_api(p_event uuid)
returns jsonb
language plpgsql
as $body$
begin
  return platform_api.cms_dependency_recheck_resolve_event(p_event);
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

-- ---------------------------------------------------------------------------
-- Surface.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_dependency_recheck_event_ref(uuid)'),
  'the private resolver is a SECURITY DEFINER function of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-113]');
select ok(
  (select p.prosecdef and pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.grantee = 0 and acl.privilege_type = 'EXECUTE')
     from pg_proc p where p.oid = 'platform_api.cms_dependency_recheck_resolve_event(uuid)'::regprocedure),
  'the platform_api wrapper is executable by the service role only [P2-S11-AC-113]');
select is(pg_temp.h11_rettype('cms_dependency_recheck_event_ref(uuid)'), 'jsonb',
  'the resolver answers jsonb [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The six events resolve to the identity their published payload names.
-- ---------------------------------------------------------------------------
select is(pg_temp.rv_resolve(pg_temp.rv_event('schema', 'cms.schema.activated.v1', 'cms_content_type_version',
    jsonb_build_object('contentTypeId', 'a1130000-0000-4000-8000-0000000000a1',
      'schemaVersionId', 'a1130000-0000-4000-8000-0000000000a2', 'migrationPlanId', null,
      'localeConfigHash', repeat('a', 64), 'activationEvidence', '{}'::jsonb))),
  jsonb_build_object('found', true, 'kind', 'schema', 'refId', 'a1130000-0000-4000-8000-0000000000a2'),
  'cms.schema.activated.v1 names the activated schema version under the schema kind [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('template', 'cms.template.activated.v1', 'cms_template_version',
    jsonb_build_object('templateId', 'a1130000-0000-4000-8000-0000000000a3',
      'templateVersionId', 'a1130000-0000-4000-8000-0000000000a4'))),
  jsonb_build_object('found', true, 'kind', 'template', 'refId', 'a1130000-0000-4000-8000-0000000000a4'),
  'cms.template.activated.v1 names the template version under the template kind [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('pattern', 'cms.pattern.activated.v1', 'cms_pattern_version',
    jsonb_build_object('patternId', 'a1130000-0000-4000-8000-0000000000a5',
      'patternVersionId', 'a1130000-0000-4000-8000-0000000000a6'))),
  jsonb_build_object('found', true, 'kind', 'pattern', 'refId', 'a1130000-0000-4000-8000-0000000000a6'),
  'cms.pattern.activated.v1 names the pattern version under the pattern kind [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('taxonomy', 'cms.taxonomy.changed.v1', 'cms_taxonomy_version',
    jsonb_build_object('taxonomyId', 'a1130000-0000-4000-8000-0000000000a7',
      'taxonomyVersionId', 'a1130000-0000-4000-8000-0000000000a8'))),
  jsonb_build_object('found', true, 'kind', 'taxonomy_version', 'refId', 'a1130000-0000-4000-8000-0000000000a8'),
  'cms.taxonomy.changed.v1 names the taxonomy version under the taxonomy_version kind [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('block', 'cms.block.lifecycle.changed.v1', 'cms_block_definition_version',
    jsonb_build_object('blockDefinitionVersionId', 'a1130000-0000-4000-8000-0000000000a9',
      'blockKey', 'h11.first', 'blockVersion', 1, 'fromLifecycle', 'supported', 'toLifecycle', 'withdrawn',
      'releaseDigest', repeat('a', 64)))),
  jsonb_build_object('found', true, 'kind', 'block', 'refId', 'a1130000-0000-4000-8000-0000000000a9'),
  'cms.block.lifecycle.changed.v1 names the block definition version under the block kind [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('locale', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'fr-FR',
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', true, 'kind', 'locale_source', 'refId', pg_temp.h11w_uuid('locsrc:revision')),
  'cms.localization.changed.v1 names the SOURCE revision of the variant, not the variant revision the event carries [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('locale-case', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'FR-fr',
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', true, 'kind', 'locale_source', 'refId', pg_temp.h11w_uuid('locsrc:revision')),
  'the locale of a localization event is compared case-insensitively [P2-S11-AC-113]');

-- The latest version of the variant decides the source revision.
insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
) values (
  pg_temp.h11w_uuid('variant2'), pg_temp.h11w_org(), 'draft', 2,
  pg_temp.h11w_uuid('locsrc:entry'), pg_temp.h11w_uuid('locvar:revision'),
  pg_temp.h11w_uuid('locsrc2:revision'), 'fr-FR', 'en-US',
  (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('locsrc2:revision')),
  (select value::uuid from s10_ids where key = 'creatorAuth'));
select is(pg_temp.rv_resolve(pg_temp.rv_event('locale-latest', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'fr-FR',
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', true, 'kind', 'locale_source', 'refId', pg_temp.h11w_uuid('locsrc2:revision')),
  'the latest version of the locale variant names its source revision [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The wrapper answers what the private function answers.
-- ---------------------------------------------------------------------------
select is(pg_temp.rv_resolve_api(pg_temp.rv_event('schema-api', 'cms.schema.activated.v1', 'cms_content_type_version',
    jsonb_build_object('schemaVersionId', 'a1130000-0000-4000-8000-0000000000b1'))),
  jsonb_build_object('found', true, 'kind', 'schema', 'refId', 'a1130000-0000-4000-8000-0000000000b1'),
  'the platform_api wrapper returns the resolved lookup [P2-S11-AC-113]');
select is(current_setting('app.cms_rpc', true), 'true',
  'control: the CMS RPC context set by the fixtures is restored by the wrapper [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Everything else is { found: false }.
-- ---------------------------------------------------------------------------
select is(pg_temp.rv_resolve('a1130000-0000-4000-8000-0000000000ff'), jsonb_build_object('found', false),
  'an event row that does not exist is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(null), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a null event id is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('v2', 'cms.schema.activated.v1', 'cms_content_type_version',
    jsonb_build_object('schemaVersionId', 'a1130000-0000-4000-8000-0000000000b2'), 2)),
  jsonb_build_object('found', false), 'an event of another schema version is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('other', 'cms.entry.review-changed.v1', 'cms_editorial_review',
    jsonb_build_object('schemaVersionId', 'a1130000-0000-4000-8000-0000000000b3'))),
  jsonb_build_object('found', false), 'an event type outside the six is not found even when its payload looks right [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('missing', 'cms.schema.activated.v1', 'cms_content_type_version',
    jsonb_build_object('contentTypeId', 'a1130000-0000-4000-8000-0000000000a1'))),
  jsonb_build_object('found', false), 'a payload without the published identity member is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('not-uuid', 'cms.pattern.activated.v1', 'cms_pattern_version',
    jsonb_build_object('patternVersionId', 'not-a-uuid'))),
  jsonb_build_object('found', false), 'an identity member that is not a UUID is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('not-string', 'cms.taxonomy.changed.v1', 'cms_taxonomy_version',
    jsonb_build_object('taxonomyVersionId', 7))),
  jsonb_build_object('found', false), 'an identity member that is not a string is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('upper', 'cms.template.activated.v1', 'cms_template_version',
    jsonb_build_object('templateVersionId', 'A1130000-0000-4000-8000-0000000000B4'))),
  jsonb_build_object('found', false), 'a non-canonical (uppercase) UUID is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-unknown', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'fr-FR',
      'revisionId', 'a1130000-0000-4000-8000-0000000000b5'))),
  jsonb_build_object('found', false), 'a localization event of a revision with no locale variant is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-locale', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'de-DE',
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', false), 'a localization event of another locale than the variant is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-entry', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', 'a1130000-0000-4000-8000-0000000000b6', 'locale', 'fr-FR',
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', false), 'a localization event naming another entry than the variant is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-no-entry', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('locale', 'fr-FR', 'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', false), 'a localization payload without entryId is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-no-revision', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'), 'locale', 'fr-FR'))),
  jsonb_build_object('found', false), 'a localization payload without revisionId is not found [P2-S11-AC-113]');
select is(pg_temp.rv_resolve(pg_temp.rv_event('loc-no-locale', 'cms.localization.changed.v1', 'cms_content_entry',
    jsonb_build_object('entryId', pg_temp.h11w_uuid('locsrc:entry'),
      'revisionId', pg_temp.h11w_uuid('locvar:revision')))),
  jsonb_build_object('found', false), 'a localization payload without locale is not found [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The resolver reads; it never writes.
-- ---------------------------------------------------------------------------
create temp table rv_before on commit drop as
select (select count(*) from platform_private.outbox_events) as events,
       (select count(*) from audit_private.audit_events) as audits,
       (select count(*) from platform_private.cms_locale_variants) as variants;
select pg_temp.rv_resolve(id) from platform_private.outbox_events where id::text like 'a1130000-0000-4000-8000-%';
select is(
  (select events from rv_before) || ',' || (select audits from rv_before) || ',' || (select variants from rv_before),
  (select count(*) from platform_private.outbox_events) || ',' || (select count(*) from audit_private.audit_events)
    || ',' || (select count(*) from platform_private.cms_locale_variants),
  'resolving every forged event wrote no outbox, audit or variant row [P2-S11-AC-113]');

select * from finish();
rollback;
