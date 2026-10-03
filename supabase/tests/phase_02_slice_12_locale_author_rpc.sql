\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  to_regprocedure('platform_api.cms_author_locale_variant(jsonb)') is not null,
  'CMS-03C-04 exposes a named, server-only locale authoring RPC'
);
select ok(
  not has_function_privilege('anon', 'platform_api.cms_author_locale_variant(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'platform_api.cms_author_locale_variant(jsonb)', 'execute')
    and has_function_privilege('service_role', 'platform_api.cms_author_locale_variant(jsonb)', 'execute'),
  'browser roles cannot call the locale authoring RPC directly'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s12_locale_request on commit drop as
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
  'idempotencyKey', 'locale-variant-0001'
) as request;

create temp table s12_locale_result on commit drop as
select platform_api.cms_author_locale_variant(request) as response
from s12_locale_request;

select ok(
  (select response->>'state' = 'draft'
     and response->>'locale' = 'fr-FR'
     and response->>'version' = '1'
     and response->>'entryId' = (select value from s10_ids where key = 'entryId')
     and response->>'sourceRevisionId' = (select value from s10_ids where key = 'entryRevisionId')
   from s12_locale_result),
  'assigned author receives a draft locale resource tied to the exact source'
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  1,
  'one immutable locale variant is committed'
);
select is(
  (select no_fallback_field_ids
   from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and locale = 'fr-FR'),
  '[]'::jsonb,
  'the variant stores its own per-variant no_fallback field set (empty here: the source version declares no no_fallback field) [P2-S09-AC-1166]'
);
select ok(
  (select count(*) = 1
     and bool_and(revision.locale = 'fr-FR'
       and revision.payload_hash::text = variant_hash.content_hash)
   from platform_private.cms_entry_revisions revision
   join (
     select response->>'revisionId' as revision_id,
            response->>'contentHash' as content_hash
     from s12_locale_result
   ) variant_hash on revision.id::text = variant_hash.revision_id),
  'locale authoring commits a target-locale immutable revision and hash'
);
select is(
  (select version::text from platform_private.cms_content_entries
   where id = (select value::uuid from s10_ids where key = 'entryId')),
  '2',
  'locale authoring advances the entry aggregate CAS version'
);
select is(
  (select platform_api.cms_author_locale_variant(request)
   from s12_locale_request),
  (select response from s12_locale_result),
  'same idempotency key replays the exact committed response'
);
select is(
  pg_temp.s10_audit_count(
    'cms.locale.variant.author',
    (select (response->>'id')::uuid from s12_locale_result)
  ),
  1,
  'locale authoring commits one private audit event'
);
select is(
  pg_temp.s10_outbox_count(
    'cms.localization.changed.v1',
    (select value::uuid from s10_ids where key = 'entryId')
  ),
  1,
  'locale authoring commits one identifier-only outbox event'
);
select ok(
  (select payload ?& array['entryId','locale','revisionId']
     and (select count(*) from jsonb_object_keys(payload)) = 3
   from (
     select pg_temp.s10_outbox_payload(
       'cms.localization.changed.v1',
       (select value::uuid from s10_ids where key = 'entryId')
     ) as payload
   ) event),
  'outbox payload excludes translated field values and source text'
);

select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_set((select request from s12_locale_request),
        '{idempotencyKey}', '"locale-variant-0002"'::jsonb)
    )$$,
  'P0001', 'VERSION_MISMATCH',
  'stale entry version cannot create a second variant'
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_set(jsonb_set((select request from s12_locale_request),
        '{expectedVersion}', '"2"'::jsonb),
        '{idempotencyKey}', '"locale-variant-0003"'::jsonb)
    )$$,
  'P0001', 'INVALID_REQUEST',
  'If-Match must equal the request expected version'
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_set(jsonb_set(jsonb_set((select request from s12_locale_request),
        '{sourceHash}', to_jsonb(repeat('0', 64))),
        '{expectedVersion}', '"2"'::jsonb),
        '{ifMatch}', '"2"'::jsonb) ||
        '{"idempotencyKey":"locale-variant-0004"}'::jsonb
    )$$,
  'P0001', 'VERSION_MISMATCH',
  'false source hash is rejected before mutation'
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      (select request from s12_locale_request) ||
      jsonb_build_object(
        'expectedVersion', '2', 'ifMatch', '2',
        'idempotencyKey', 'locale-variant-0007',
        'fields', jsonb_build_array(jsonb_build_object(
          'fieldId', (select value from s10_ids where key = 'typeRelationFieldId'),
          'value', 'not localizable'
        ))
      )
    )$$,
  'P0001', 'VALIDATION_FAILED',
  'nonlocalizable source-schema field cannot be translated [P2-S09-AC-1166]'
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      (select request from s12_locale_request) ||
      '{"expectedVersion":"2","ifMatch":"2",
         "idempotencyKey":"locale-variant-0008",
         "fallbackChain":["en-US","EN-us"]}'::jsonb
    )$$,
  'P0001', 'VALIDATION_FAILED',
  'case-insensitive duplicate fallback locale is rejected'
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      (select request from s12_locale_request) ||
      jsonb_build_object(
        'expectedVersion', '2', 'ifMatch', '2',
        'idempotencyKey', 'locale-variant-0009',
        'noFallbackFieldIds', jsonb_build_array(
          (select value from s10_ids where key = 'typeRelationFieldId')
        )
      )
    )$$,
  'P0001', 'VALIDATION_FAILED',
  'nonlocalizable field cannot be misdeclared as no-fallback [P2-S09-AC-1166]'
);

-- The active source schema already declares localized date and datetime
-- fields. Author a real source revision first: a locale variant must validate
-- and preserve those calendar values, not reject their field kinds before the
-- pinned-schema value validator runs. The test-only policy is rolled back.
create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select jsonb_build_object(
    'key', 's12-rolled-back-calendar-fixture', 'version', '1',
    'policyHash', repeat('c', 64), 'riskClass', 'ordinary',
    'requiredDecisionCount', 1, 'requiredCapabilities', '[]'::jsonb,
    'approvalEvidenceHash', repeat('d', 64)
  )
  where p_version_id is not null
$body$;

create temp table s12_locale_calendar_source_request on commit drop as
select jsonb_build_object(
  'entryId', ids_entry.value,
  'baseRevision', '1',
  'changedPaths', jsonb_build_array(
    '/fields/' || ids_date.value,
    '/fields/' || ids_datetime.value
  ),
  'values', jsonb_build_object(
    ids_date.value, '2024-02-29',
    ids_datetime.value, '2024-02-29T23:59:59+15:00'
  ),
  'locale', 'en-US',
  'expectedVersion', '2', 'ifMatch', '2',
  'idempotencyKey', 's12-locale-calendar-source-0001',
  'context', jsonb_build_object(
    'actingPartyId', ids_org.value,
    'actingContextId', 'a9100000-0000-4000-8000-000000000094',
    'correlationId', 'a9100000-0000-4000-8000-000000000095'
  )
) as request
from s10_ids ids_entry, s10_ids ids_date, s10_ids ids_datetime, s10_ids ids_org
where ids_entry.key = 'entryId'
  and ids_date.key = 'typeDateFieldId'
  and ids_datetime.key = 'typeDateTimeFieldId'
  and ids_org.key = 'organization';

create temp table s12_locale_calendar_source on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal((select request::text from s12_locale_calendar_source_request))
    || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_message(), null::text,
  'source authoring accepts localized calendar fields under the pinned schema'
);
select is(
  (select response->>'revisionNumber' from s12_locale_calendar_source),
  '2',
  'calendar source is a later immutable revision, not the original title-only draft'
);

create temp table s12_locale_calendar_request on commit drop as
select source_request.request || jsonb_build_object(
  'locale', 'de-DE',
  'sourceRevisionId', source.response->>'id',
  'sourceHash', source.response->>'contentHash',
  'fields', jsonb_build_array(
    jsonb_build_object('fieldId', ids_date.value, 'value', '2024-03-01'),
    jsonb_build_object('fieldId', ids_datetime.value,
      'value', '2024-03-01T09:15:00+01:00')
  ),
  'expectedVersion', '3', 'ifMatch', '3',
  'idempotencyKey', 's12-locale-calendar-target-0001'
) as request
from s12_locale_request source_request,
     s12_locale_calendar_source source,
     s10_ids ids_date, s10_ids ids_datetime
where ids_date.key = 'typeDateFieldId'
  and ids_datetime.key = 'typeDateTimeFieldId';

select pg_temp.s10_rpc_probe(
  'locale-invalid-calendar-date', null,
  'select platform_api.cms_author_locale_variant('
    || quote_literal((
      select jsonb_set(request, '{fields,0,value}',
        to_jsonb('2026-02-30'::text))::text
      from s12_locale_calendar_request
    )) || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('locale-invalid-calendar-date'),
  'VALIDATION_FAILED',
  'invalid localized date fails value validation before any locale write'
);
select pg_temp.s10_rpc_probe(
  'locale-invalid-calendar-time', null,
  'select platform_api.cms_author_locale_variant('
    || quote_literal((
      select jsonb_set(request, '{fields,1,value}',
        to_jsonb('2024-03-01T24:00:00Z'::text))::text
      from s12_locale_calendar_request
    )) || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('locale-invalid-calendar-time'),
  'VALIDATION_FAILED',
  'invalid localized datetime fails value validation before any locale write'
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and locale = 'de-DE'),
  0,
  'invalid calendar translations leave no German locale variant'
);

create temp table s12_locale_calendar_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_author_locale_variant('
    || quote_literal((select request::text from s12_locale_calendar_request))
    || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_message(), null::text,
  'valid localized date and datetime pass the active-schema validator'
);
select is(
  (select response->>'state' from s12_locale_calendar_result),
  'draft',
  'calendar translation creates only a draft locale variant'
);
select is(
  (select response->>'locale' from s12_locale_calendar_result),
  'de-DE',
  'calendar translation is bound to the requested target locale'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (
     select (response->>'revisionId')::uuid from s12_locale_calendar_result
   ) and field_id = (
     select value::uuid from s10_ids where key = 'typeDateFieldId'
   )),
  to_jsonb('2024-03-01'::text),
  'localized date is stored exactly in the immutable target revision'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (
     select (response->>'revisionId')::uuid from s12_locale_calendar_result
   ) and field_id = (
     select value::uuid from s10_ids where key = 'typeDateTimeFieldId'
   )),
  to_jsonb('2024-03-01T09:15:00+01:00'::text),
  'localized datetime is stored exactly in the immutable target revision'
);
select is(
  (select response->>'contentHash' from s12_locale_calendar_result),
  (select platform_private.cms_draft_content_hash(
     (response->>'revisionId')::uuid, 'de-DE'
   ) from s12_locale_calendar_result),
  'calendar locale response hash commits to the translated field snapshot'
);
select is(
  (select version::text from platform_private.cms_content_entries
   where id = (select value::uuid from s10_ids where key = 'entryId')),
  '4',
  'calendar locale commit advances the aggregate version exactly once'
);
select is(
  (select platform_api.cms_author_locale_variant(request)
   from s12_locale_calendar_request),
  (select response from s12_locale_calendar_result),
  'calendar locale exact-key replay returns the same committed resource'
);
select is(
  (select count(*)::integer from platform_private.cms_locale_variants
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and locale = 'de-DE'),
  1,
  'calendar locale replay does not append another variant'
);

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_set((select request from s12_locale_request),
        '{idempotencyKey}', '"locale-variant-0005"'::jsonb)
    )$$,
  'P0001', 'FORBIDDEN',
  'member without entry assignment and author/editor capability is denied'
);
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'strangerAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select throws_ok(
  $$select platform_api.cms_author_locale_variant(
      jsonb_set((select request from s12_locale_request),
        '{idempotencyKey}', '"locale-variant-0006"'::jsonb)
    )$$,
  'P0001', 'NOT_FOUND',
  'other-tenant entry existence remains concealed'
);

select finish();
rollback;
