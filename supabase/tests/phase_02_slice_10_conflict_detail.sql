-- Slice 10 QA-RED (WP-S10-2a): CMS-03B-12 protected three-way conflict detail
-- (BE03b Route Registry row CMS-03B-12; validation matrix `CMS-03B-12`).
--
-- The detail read is a bounded, write-free projection of one conflict that
-- belongs to the resolved readable entry.  Preimages (`paths`) are carried
-- only while the conflict is `open`; a `resolved` or `superseded` record is a
-- concealed 404 NOT_FOUND identical to an absent one (DEC-139, AC-090).  Authority never leaks: the envelope carries no ownership,
-- acting-party, assignment, or resolution-person identifier, and a hidden or
-- absent entry/conflict, or a caller outside the owner tenant, are all
-- concealed as NOT_FOUND while a visible entry without read scope is
-- FORBIDDEN.  The suite is written before the WP-S10-3
-- `cms_conflict_detail_read.sql` migration, so an absent RPC produces
-- evidence-backed RED rather than a silent pass.  Helpers resolve by OID so a
-- missing function yields false instead of aborting the run.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- The two named functions are the RED target.  A missing migration makes both
-- guards false without raising, so the remaining assertions still execute.
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_get_conflict_detail', 'jsonb')
    and pg_temp.s10_fn_exists('platform_api', 'cms_get_conflict_detail', 'jsonb'),
  'CMS-03B-12 has a private conflict-detail read and a named RPC'
);
select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_get_conflict_detail', 'jsonb')
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_get_conflict_detail', 'jsonb', 'authenticated')
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_get_conflict_detail', 'jsonb', 'anon')
    and pg_temp.s10_no_execute_for(
      'platform_private', 'cms_get_conflict_detail', 'authenticated')
    and pg_temp.s10_no_execute_for(
      'platform_private', 'cms_get_conflict_detail', 'anon'),
  'CMS-03B-12 is service-role only, never browser-callable'
);

-- One open conflict for the fixture entry, seeded inside this rolled-back
-- transaction exactly as a rejected autosave would have written it.  The
-- insert is guarded on the conflict table so a missing foundation cannot abort
-- the whole RED run.
select set_config('app.cms_rpc', 'true', true);
do $body$
begin
  if to_regclass('platform_private.cms_conflict_records') is not null then
    insert into platform_private.cms_conflict_records(
      id, owner_id, entry_id, base_revision_id, theirs_revision_id,
      yours_source, proposed_values, proposed_values_hash, changed_paths,
      base_hash, theirs_hash, yours_hash, conflict_hash, state
    )
    select
      'a9100000-0000-4000-8000-000000000801',
      ids_org.value::uuid,
      ids_entry.value::uuid,
      'a9100000-0000-4000-8000-000000000302',
      'a9100000-0000-4000-8000-000000000302',
      'proposed',
      jsonb_build_object(ids_field.value, 'Concurrent title from old base'),
      platform_private.cms_jcs_sha256(
        jsonb_build_object(ids_field.value, 'Concurrent title from old base')
      )::char(64),
      jsonb_build_array('/fields/' || ids_field.value),
      repeat('e', 64), repeat('e', 64), repeat('e', 64), repeat('f', 64),
      'open'
    from s10_ids ids_org, s10_ids ids_entry, s10_ids ids_field
    where ids_org.key = 'organization'
      and ids_entry.key = 'entryId'
      and ids_field.key = 'typeFieldId';
  end if;
end;
$body$;

insert into s10_ids(key, value)
values ('conflictId', 'a9100000-0000-4000-8000-000000000801')
on conflict (key) do update set value = excluded.value;

create temp table s10_cd_request on commit drop as
select jsonb_build_object(
  'entryId', ids_entry.value,
  'conflictId', ids_conflict.value,
  'context', jsonb_build_object(
    'actingPartyId', ids_org.value,
    'actingContextId', 'a9100000-0000-4000-8000-000000000094',
    'correlationId', 'a9100000-0000-4000-8000-000000000095'
  )
) as request
from s10_ids ids_entry, s10_ids ids_conflict, s10_ids ids_org
where ids_entry.key = 'entryId'
  and ids_conflict.key = 'conflictId'
  and ids_org.key = 'organization';

-- The creator holds cms.author plus the entry assignment, so the read is
-- authorized.  An absent RPC leaves the response null with a 42883 state,
-- which is the intended RED evidence.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
create temp table s10_cd_result on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((select request::text from s10_cd_request))
    || '::jsonb)'
) as response;

select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-03B-12 authorized conflict detail read succeeds'
);
select ok(
  (select response ?& array[
     'conflict', 'entry', 'base', 'theirs', 'yours', 'paths', 'resolvedRevisionId'
   ] from s10_cd_result),
  'CMS-03B-12 returns the strict seven-key conflict-detail envelope'
);

-- The conflict meta is ResourceMeta plus state, changedPaths, and conflictHash
-- only; the entry meta carries exactly the four ResourceMeta keys.  Any extra
-- key would be a contract break, so assert the exact key set.
select ok(
  (select (select count(*) from jsonb_object_keys(response->'conflict')) = 7
      and (select count(*) from jsonb_object_keys(response->'entry')) = 4
   from s10_cd_result),
  'CMS-03B-12 conflict meta is exactly id/version/timestamps/state/changedPaths/conflictHash'
);

select is(
  (select response->'conflict'->>'id' from s10_cd_result),
  (select value from s10_ids where key = 'conflictId'),
  'CMS-03B-12 conflict meta addresses the requested conflict'
);
select is(
  (select response->'conflict'->>'state' from s10_cd_result),
  'open',
  'CMS-03B-12 reports the stored open conflict state'
);
select is(
  (select response->'conflict'->>'conflictHash' from s10_cd_result),
  (select conflict.conflict_hash::text
   from platform_private.cms_conflict_records conflict
   where conflict.id = (select value::uuid from s10_ids where key = 'conflictId')),
  'CMS-03B-12 reports the stored conflictHash'
);
select is(
  (select response->'conflict'->>'version' from s10_cd_result),
  (select conflict.version::text
   from platform_private.cms_conflict_records conflict
   where conflict.id = (select value::uuid from s10_ids where key = 'conflictId')),
  'CMS-03B-12 reports the stored conflict version as a decimal string'
);

-- Open-only preimages: an open conflict carries a bounded per-path three-way
-- projection whose sides are schema-typed and hash-bearing.
select ok(
  (select jsonb_array_length(response->'paths') between 1 and 128
      and (response->'paths'->0) ?& array['path', 'base', 'theirs', 'yours']
      and (response->'paths'->0->'base') ?& array['value', 'provenance', 'valueHash']
   from s10_cd_result),
  'CMS-03B-12 open conflict carries bounded per-path three-way preimages'
);
select ok(
  (select (response->'base') ?& array[
       'revisionId', 'revisionNumber', 'schemaVersionId', 'contentHash']
      and (response->'theirs') ?& array[
       'revisionId', 'revisionNumber', 'schemaVersionId', 'contentHash']
      and (response->'yours') ?& array['source', 'revisionId', 'contentHash']
   from s10_cd_result),
  'CMS-03B-12 carries the base/theirs revision refs and the yours source'
);
select ok(
  (select (response->'yours'->>'source') = 'proposed'
      and jsonb_typeof(response->'yours'->'revisionId') = 'null'
   from s10_cd_result),
  'CMS-03B-12 states a proposed yours side with no revision identity'
);
select ok(
  (select jsonb_typeof(response->'resolvedRevisionId') = 'null' from s10_cd_result),
  'CMS-03B-12 open conflict reports no resolved revision'
);

-- DEC-139 (P2-S10-AC-090): a closed conflict is indistinguishable from an
-- absent or hidden one.  A resolved conflict is a 404 NOT_FOUND, never a 200
-- metadata record.  The write is rolled back so the shared open fixture stays
-- pristine for later assertions.
savepoint s10_cd_resolved;
update platform_private.cms_conflict_records
set state = 'resolved',
    version = version + 1,
    resolved_revision_id = 'a9100000-0000-4000-8000-000000000302',
    resolved_by_person_id = (select value::uuid from s10_ids where key = 'creatorPerson'),
    resolved_acting_party_id = (select value::uuid from s10_ids where key = 'organization'),
    resolved_at = clock_timestamp(),
    updated_at = clock_timestamp()
where id = (select value::uuid from s10_ids where key = 'conflictId');

select ok(
  pg_temp.s10_rpc_call(
    'select platform_api.cms_get_conflict_detail('
      || quote_literal((select request::text from s10_cd_request))
      || '::jsonb)'
  ),
  'CMS-03B-12 refuses a resolved conflict [DEC-139, AC-090]'
);
select is(
  pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'CMS-03B-12 conceals a resolved conflict as NOT_FOUND, identical to an absent one [DEC-139, AC-090]'
);
rollback to savepoint s10_cd_resolved;
release savepoint s10_cd_resolved;

-- A superseded conflict is closed as well and is the same concealed 404.
savepoint s10_cd_superseded;
update platform_private.cms_conflict_records
set state = 'superseded',
    version = version + 1,
    updated_at = clock_timestamp()
where id = (select value::uuid from s10_ids where key = 'conflictId');
select ok(
  pg_temp.s10_rpc_call(
    'select platform_api.cms_get_conflict_detail('
      || quote_literal((select request::text from s10_cd_request))
      || '::jsonb)'
  ),
  'CMS-03B-12 refuses a superseded conflict [DEC-139, AC-090]'
);
select is(
  pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'CMS-03B-12 conceals a superseded conflict as NOT_FOUND, identical to an absent one [DEC-139, AC-090]'
);
rollback to savepoint s10_cd_superseded;
release savepoint s10_cd_superseded;

-- Privacy: the open envelope must carry no ownership, acting-party, retriever,
-- or resolver identifier at any level.
select ok(
  (select position(
     (select value from s10_ids where key = 'creatorPerson')
     in response::text) = 0
      and position(
        (select value from s10_ids where key = 'organization')
        in response::text) = 0
      and position('resolvedByPersonId' in response::text) = 0
      and position('ownerId' in response::text) = 0
      and position('assigneeId' in response::text) = 0
   from s10_cd_result),
  'CMS-03B-12 exposes no ownership, acting-party, or resolver identifier'
);

-- 403: an authenticated member of the owner tenant with no read scope can
-- distinguish the entry, so the refusal is explicit rather than concealed.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((select request::text from s10_cd_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'CMS-03B-12 visible entry without read scope returns FORBIDDEN'
);

-- 404: an authenticated principal outside the owner tenant cannot learn that
-- the entry or the conflict exists.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'strangerAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((select request::text from s10_cd_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'CMS-03B-12 non-member conceals the entry and conflict as NOT_FOUND'
);

-- Tenant isolation: the same entry read while acting in a party other than the
-- entry owner is concealed, never served from the wrong tenancy.  The acting
-- party rides in the request context -- the channel the Worker fills from the
-- resolved session and the one every slice read is scoped by -- so the
-- override is applied there rather than to the session setting alone.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  'a9100000-0000-4000-8000-0000000009f1'::uuid
);
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((
         (select request from s10_cd_request)
           || jsonb_build_object(
                'context',
                (select request->'context' from s10_cd_request)
                  || jsonb_build_object(
                       'actingPartyId',
                       'a9100000-0000-4000-8000-0000000009f1')
              )
       )::text)
    || '::jsonb)'
);
select ok(
  pg_temp.s10_last_error_message() in ('NOT_FOUND', 'FORBIDDEN'),
  'CMS-03B-12 acting outside the owner tenancy is concealed'
);

-- An absent or foreign conflict id is concealed, never distinguished from a
-- hidden one.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((
         (select request from s10_cd_request)
           || jsonb_build_object('conflictId', 'a9100000-0000-4000-8000-000000000899')
       )::text)
    || '::jsonb)'
);
select is(
  pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'CMS-03B-12 conceals an absent or foreign conflict identity'
);

-- A request that names an authority field has no slot for it.
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((
         (select request from s10_cd_request)
           || jsonb_build_object('ownerId', 'a9100000-0000-4000-8000-000000000899')
       )::text)
    || '::jsonb)'
);
select ok(
  pg_temp.s10_last_error_message() = 'INVALID_REQUEST',
  'CMS-03B-12 rejects a caller-supplied owner field as INVALID_REQUEST'
);

-- Unauthenticated callers never reach the conflict.
select pg_temp.s10_rpc_clear_actor();
select pg_temp.s10_rpc_call(
  'select platform_api.cms_get_conflict_detail('
    || quote_literal((select request::text from s10_cd_request))
    || '::jsonb)'
);
select is(
  pg_temp.s10_last_error_message(), 'UNAUTHENTICATED',
  'CMS-03B-12 read without an authenticated actor returns UNAUTHENTICATED'
);

-- The read is safe: no mutation, no audit row, no outbox row.
select ok(
  pg_temp.s10_audit_count(
    'cms.conflict.read',
    (select value::uuid from s10_ids where key = 'entryId')
  ) = 0
    and pg_temp.s10_outbox_count(
      'cms.conflict.read.v1',
      (select value::uuid from s10_ids where key = 'entryId')
    ) = 0,
  'CMS-03B-12 detail read emits no audit or outbox evidence'
);

select finish();
rollback;
