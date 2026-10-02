commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- CMS-03B-01 must author the already-validated 03a calendar field kinds on
-- immutable entry revisions. This test-only policy projection is rolled back
-- with the entire pgTAP transaction and is not owner-approved production policy.
create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select jsonb_build_object(
    'key', 's10-rolled-back-calendar-fixture', 'version', '1',
    'policyHash', repeat('c', 64), 'riskClass', 'ordinary',
    'requiredDecisionCount', 1, 'requiredCapabilities', '[]'::jsonb,
    'approvalEvidenceHash', repeat('d', 64)
  )
  where p_version_id is not null
$body$;

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

create temp table s10_calendar_revision_request on commit drop as
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
  'expectedVersion', '1',
  'ifMatch', '1',
  'idempotencyKey', 's10-calendar-revision-0001',
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

select pg_temp.s10_rpc_probe(
  'calendar-revision-invalid-date', null,
  'select platform_api.cms_create_revision('
    || quote_literal((
      select jsonb_set(request, array['values', ids_date.value],
        to_jsonb('2026-02-30'::text))::text
      from s10_calendar_revision_request, s10_ids ids_date
      where ids_date.key = 'typeDateFieldId'
    )) || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('calendar-revision-invalid-date'),
  'VALIDATION_FAILED',
  'CMS-03B-01 rejects an impossible calendar date before revision mutation'
);

select pg_temp.s10_rpc_probe(
  'calendar-revision-invalid-time', null,
  'select platform_api.cms_create_revision('
    || quote_literal((
      select jsonb_set(request, array['values', ids_datetime.value],
        to_jsonb('2026-01-01T24:00:00Z'::text))::text
      from s10_calendar_revision_request, s10_ids ids_datetime
      where ids_datetime.key = 'typeDateTimeFieldId'
    )) || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('calendar-revision-invalid-time'),
  'VALIDATION_FAILED',
  'CMS-03B-01 rejects an impossible datetime before revision mutation'
);

select is(
  (select count(*)::integer from platform_private.cms_entry_revisions
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  1,
  'Rejected calendar values do not append an immutable revision'
);

create temp table s10_calendar_revision_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal((select request::text from s10_calendar_revision_request))
    || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_message(), null::text,
  'CMS-03B-01 accepts a valid date and offset datetime on an active schema'
);
select is(
  (select response->>'revisionNumber' from s10_calendar_revision_result),
  '2',
  'Calendar authoring appends the second immutable revision'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (
     select (response->>'id')::uuid from s10_calendar_revision_result
   ) and field_id = (
     select value::uuid from s10_ids where key = 'typeDateFieldId'
   )),
  to_jsonb('2024-02-29'::text),
  'Calendar authoring stores the exact valid date in the normalized snapshot'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (
     select (response->>'id')::uuid from s10_calendar_revision_result
   ) and field_id = (
     select value::uuid from s10_ids where key = 'typeDateTimeFieldId'
   )),
  to_jsonb('2024-02-29T23:59:59+15:00'::text),
  'Calendar authoring stores the exact valid offset datetime'
);
select is(
  (select response->>'contentHash' from s10_calendar_revision_result),
  (select platform_private.cms_draft_content_hash(
     (response->>'id')::uuid, 'en-US'
   ) from s10_calendar_revision_result),
  'Calendar revision content hash covers the copied-and-patched snapshot'
);
select is(
  (select version from platform_private.cms_content_entries
   where id = (select value::uuid from s10_ids where key = 'entryId')),
  2::bigint,
  'Calendar revision CAS-advances the entry version exactly once'
);

create temp table s10_calendar_revision_replay on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal((select request::text from s10_calendar_revision_request))
    || '::jsonb)'
) as response;
select ok(
  (select response from s10_calendar_revision_replay)
    = (select response from s10_calendar_revision_result),
  'Calendar revision exact-key replay returns the identical committed response'
);
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  2,
  'Calendar revision exact-key replay creates no duplicate revision'
);

-- A stale author proposes competing values for both calendar fields. The
-- revision command must persist one real conflict before the resolver sees it.
create temp table s10_calendar_conflict_request on commit drop as
select jsonb_set(request, '{values}', jsonb_build_object(
  ids_date.value, '2024-03-01',
  ids_datetime.value, '2024-03-01T10:15:00-05:00'
)) || jsonb_build_object(
  'expectedVersion', '2', 'ifMatch', '2',
  'idempotencyKey', 's10-calendar-conflict-0001'
) as request
from s10_calendar_revision_request, s10_ids ids_date, s10_ids ids_datetime
where ids_date.key = 'typeDateFieldId'
  and ids_datetime.key = 'typeDateTimeFieldId';

create temp table s10_calendar_conflict_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal((select request::text from s10_calendar_conflict_request))
    || '::jsonb)'
) as response;
select is(
  (select response->>'kind' from s10_calendar_conflict_result), 'conflict',
  'Competing calendar edits create a committed conflict disposition'
);
select is(
  (select response->>'code' from s10_calendar_conflict_result),
  'VERSION_MISMATCH',
  'Competing calendar edits retain the stable version-conflict code'
);
select is(
  (select count(*)::integer from platform_private.cms_conflict_records
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')
     and state = 'open'
     and proposed_values = (select request->'values' from s10_calendar_conflict_request)),
  1,
  'Calendar conflict records both proposed values without appending a revision'
);

create temp table s10_calendar_resolve_request on commit drop as
select jsonb_build_object(
  'entryId', conflict.entry_id,
  'conflictId', conflict.id,
  'baseRevision', '1',
  'choices', jsonb_build_array(
    jsonb_build_object(
      'path', '/fields/' || ids_date.value,
      'choice', 'explicit', 'value', '2024-03-02'
    ),
    jsonb_build_object(
      'path', '/fields/' || ids_datetime.value,
      'choice', 'explicit', 'value', '2024-03-02T10:15:00-05:00'
    )
  ),
  'expectedVersion', '2', 'ifMatch', '2',
  'idempotencyKey', 's10-calendar-resolve-0001',
  'context', (select request->'context' from s10_calendar_revision_request)
) as request
from platform_private.cms_conflict_records conflict, s10_ids ids_date, s10_ids ids_datetime
where conflict.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and conflict.state = 'open'
  and ids_date.key = 'typeDateFieldId'
  and ids_datetime.key = 'typeDateTimeFieldId';

select pg_temp.s10_rpc_probe(
  'calendar-resolve-invalid-date', null,
  'select platform_api.cms_resolve_conflict('
    || quote_literal((select jsonb_set(request, '{choices,0,value}',
      to_jsonb('2026-02-30'::text))::text from s10_calendar_resolve_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('calendar-resolve-invalid-date'),
  'VALIDATION_FAILED',
  'Calendar resolution rejects an impossible explicit date'
);
select pg_temp.s10_rpc_probe(
  'calendar-resolve-invalid-time', null,
  'select platform_api.cms_resolve_conflict('
    || quote_literal((select jsonb_set(request, '{choices,1,value}',
      to_jsonb('2026-01-01T24:00:00Z'::text))::text from s10_calendar_resolve_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_probe_message('calendar-resolve-invalid-time'),
  'VALIDATION_FAILED',
  'Calendar resolution rejects an impossible explicit datetime'
);
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  2,
  'Invalid calendar resolution leaves both immutable parents unchanged'
);
select is(
  (select state from platform_private.cms_conflict_records
   where id = (select (request->>'conflictId')::uuid from s10_calendar_resolve_request)),
  'open',
  'Invalid calendar resolution leaves the durable conflict open'
);

create temp table s10_calendar_resolve_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_resolve_conflict('
    || quote_literal((select request::text from s10_calendar_resolve_request))
    || '::jsonb)'
) as response;
select is(
  pg_temp.s10_last_error_message(), null::text,
  'Authorized calendar resolution commits without a database exception'
);
select is(
  (select response->>'revisionNumber' from s10_calendar_resolve_result),
  '3',
  'Calendar resolution creates the next immutable draft revision'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->>'id')::uuid from s10_calendar_resolve_result)
     and field_id = (select value::uuid from s10_ids where key = 'typeDateFieldId')),
  to_jsonb('2024-03-02'::text),
  'Calendar resolution persists the validated explicit date'
);
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->>'id')::uuid from s10_calendar_resolve_result)
     and field_id = (select value::uuid from s10_ids where key = 'typeDateTimeFieldId')),
  to_jsonb('2024-03-02T10:15:00-05:00'::text),
  'Calendar resolution persists the validated explicit offset datetime'
);
select is(
  (select response->>'contentHash' from s10_calendar_resolve_result),
  (select platform_private.cms_draft_content_hash((response->>'id')::uuid, 'en-US')
   from s10_calendar_resolve_result),
  'Calendar resolution hashes the complete resolved field snapshot'
);
select is(
  (select response->'parentRevisionIds' from s10_calendar_resolve_result),
  (select jsonb_build_array(
     (select (response->>'id')::uuid from s10_calendar_revision_result),
     (select id from platform_private.cms_entry_revisions
      where entry_id = (select value::uuid from s10_ids where key = 'entryId')
        and revision_number = 1)
   )),
  'Calendar resolution binds the current and common-base immutable parents'
);
select ok(
  exists (
    select 1 from platform_private.cms_conflict_records conflict
    where conflict.id = (select (request->>'conflictId')::uuid
                         from s10_calendar_resolve_request)
      and conflict.state = 'resolved'
      and conflict.version = 2
      and conflict.resolved_revision_id =
        (select (response->>'id')::uuid from s10_calendar_resolve_result)
      and conflict.resolved_by_person_id =
        (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'Calendar resolution CAS-closes the conflict with server-derived actor'
);
select is(
  (select version from platform_private.cms_content_entries
   where id = (select value::uuid from s10_ids where key = 'entryId')),
  3::bigint,
  'Calendar resolution atomically advances the entry version'
);
select is(
  pg_temp.s10_outbox_count(
    'cms.entry.revision-created.v1',
    (select value::uuid from s10_ids where key = 'entryId')
  ),
  2,
  'Calendar resolution emits one additional revision-created event'
);

create temp table s10_calendar_resolve_replay on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_resolve_conflict('
    || quote_literal((select request::text from s10_calendar_resolve_request))
    || '::jsonb)'
) as response;
select ok(
  (select response from s10_calendar_resolve_replay)
    = (select response from s10_calendar_resolve_result),
  'Calendar resolution exact-key replay returns the identical committed result'
);
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions
   where entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  3,
  'Calendar resolution replay appends no duplicate revision'
);

select finish();
rollback;
